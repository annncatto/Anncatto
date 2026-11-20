"""Export aggregate neural interventions; private observations stay outside the repo.

Usage: python scripts/figures/openwam-network-analysis.py EVIDENCE_DIRECTORY
The directory must contain network/{plan,old,ft,base}.json from probe_network.py.
"""
import hashlib
import json
from pathlib import Path
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root = Path(sys.argv[1])
source = root / 'network'
out = Path(__file__).resolve().parents[2] / 'content/images/openwam-slots'
out.mkdir(parents=True, exist_ok=True)
models = ['old', 'ft', 'base']
colors = {'old': '#94a3b8', 'ft': '#3263d9', 'base': '#79a948'}
labels = {'old': 'Original task model', 'ft': 'A · Fine-tuning', 'base': 'B · Foundation restart'}
variants = ['reverse_text', 'color_forward', 'mask_text', 'mask_state', 'old_lift_stats',
            'no_video_to_action', 'no_future_to_action']
plan = json.loads((source / 'plan.json').read_text())
assert [(r['episode'], r['frame']) for r in plan] == [(3, 211), (115, 32), (135, 66), (154, 155)]


def stats(values):
    values = np.asarray(values, dtype=np.float64)
    assert np.isfinite(values).all()
    return dict(mean=float(values.mean()), median=float(np.median(values)),
                minimum=float(values.min()), maximum=float(values.max()), count=int(values.size))


summary = dict(schema=1, measured_on='2026-11-19',
    method=dict(
        observations='Four demonstrated gripper-opening windows; one original validation, three added training',
        selection='Largest mean gripper opening at offsets 20:32 versus offsets 0:8; frame >=32 and <=length-34',
        windows=[{k: r[k] for k in ['episode', 'frame', 'role', 'forward_color_changed_pixels']} for r in plan],
        physical_metric='Mean absolute difference over 32 steps and 12 arm coordinates in host range_m100_100 units',
        physical_scope='Offline action chunks, without clipping or robot execution; grippers excluded from arm12',
        replay=dict(seeds=[17, 29], steps=10, shift=5, queries_per_model_and_variant=8,
                    input='Current observation only; generated future video'),
        one_step=dict(seed=7, sigma=0.5, observations_per_variant=4,
                      input='Noised demonstrated future video and action, observed video prefix clamped',
                      metric='Relative L2 change of velocity in the first 14 normalized action coordinates'),
        color='Exchange blue/green hue in saturated forward-view pixels below image mid-height; wrists and baskets retained',
        masking='Remove selected attention keys/values, preserving other valid context; no weight updates',
        layer_groups='Zero-indexed groups of five paired Transformer layers; video-to-action attention masked',
        layer_response='Mean per-window relative L2 across all residual tokens after each paired layer',
        scope='Local pathway interventions and training-example fit; task outcome measured separately'),
    models={}, source_sha256={})

for model in models:
    path = source / f'{model}.json'
    data = json.loads(path.read_text())
    assert len(data['one_step']) == 60 and len(data['replay']) == 64
    assert data['native_equivalence'] == dict(max_abs_difference=0.0, exact_equal=True)
    result = dict(native_equivalence=data['native_equivalence'], baseline_fit={}, interventions={}, bridge_groups={},
                  context_attention={}, joint_attention={})
    baseline = [r for r in data['replay'] if r['variant'] == 'baseline']
    joints = [i for i in range(14) if i not in [6, 13]]
    predictions = {(r['window'], r['seed'], r['variant']): np.asarray(r['prediction'])[:, joints] for r in data['replay']}
    result['between_seed_baseline_change'] = stats([
        np.abs(predictions[i, 17, 'baseline'] - predictions[i, 29, 'baseline']).mean() for i in range(4)])
    result['output_ranges'] = {}
    for variant in ['baseline', 'mask_text', 'reverse_text']:
        a = np.stack([predictions[i, seed, variant] for i in range(4) for seed in [17, 29]])
        result['output_ranges'][variant] = dict(minimum=float(a.min()), maximum=float(a.max()),
            outside_host_joint_range_fraction=float((np.abs(a) > 100).mean()), positions=int(a.size))
    for group, predicate in [('all', lambda r: True), ('original_validation_window', lambda r: r['window'] == 0),
                              ('added_training_windows', lambda r: r['window'] > 0)]:
        result['baseline_fit'][group] = stats([r['arm12_mae'] for r in baseline if predicate(r)])
    result['baseline_fit']['by_window'] = [stats([r['arm12_mae'] for r in baseline if r['window'] == i]) for i in range(4)]
    for variant in variants:
        rows = [r for r in data['replay'] if r['variant'] == variant]
        one = [r for r in data['one_step'] if r['variant'] == variant]
        result['interventions'][variant] = dict(
            action_change={field: stats([r['change_from_baseline'][field] for r in rows])
                           for field in ['arm12_mae', 'left_gripper_mae', 'right_gripper_mae']},
            action_change_by_window=[stats([r['change_from_baseline']['arm12_mae'] for r in rows if r['window'] == i]) for i in range(4)],
            velocity_relative_l2=stats([r['velocity_relative_l2'] for r in one]),
            action_residual_relative_l2=np.mean([np.array(r['layer_relative_l2'])[:, 0] for r in one], axis=0).tolist(),
            video_residual_relative_l2=np.mean([np.array(r['layer_relative_l2'])[:, 1] for r in one], axis=0).tolist())
    for start in range(0, 30, 5):
        key = f'bridge_{start:02d}_{start+4:02d}'
        result['bridge_groups'][key] = stats([r['velocity_relative_l2'] for r in data['one_step'] if r['variant'] == key])
    baselines = [r for r in data['one_step'] if r['variant'] == 'baseline']
    result['context_attention']['state_mass_by_layer'] = np.mean(
        [[r['context_attention'][str(i)]['state_mass'] for i in range(30)] for r in baselines], axis=0).tolist()
    result['joint_attention']['mass_by_layer_observed_future_action'] = np.mean(
        [[r['joint_attention'][str(i)] for i in range(30)] for r in baselines], axis=0).tolist()
    result['joint_attention']['token_counts'] = [120, 240, 32]
    result['environment'] = {k: data['environment'][k] for k in ['torch', 'cuda', 'gpu', 'parameter_dtype']}
    summary['models'][model] = result
    summary['source_sha256'][f'{model}.json'] = hashlib.sha256(path.read_bytes()).hexdigest()
for name in ['plan.json']:
    summary['source_sha256'][name] = hashlib.sha256((source / name).read_bytes()).hexdigest()
summary['source_sha256']['probe_network.py'] = hashlib.sha256((root / 'probe_network.py').read_bytes()).hexdigest()

def write_summary():
    target = out / 'correction-network-summary.json'
    target.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    assert not any(s in target.read_text() for s in ['/home/', '192.168.', '183.230.', 'Gpu@', 'password'])


if '--summary-only' in sys.argv:
    write_summary()
    print('Updated aggregate summary with matched-seed scale and output ranges.')
    raise SystemExit(0)


plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False,
                     'axes.spines.right': False, 'svg.fonttype': 'none', 'axes.titleweight': 'semibold'})


def save(fig, filename):
    fig.savefig(out / filename, format='svg', metadata={'Date': None}, facecolor='white')
    plt.close(fig)


fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.6), layout='constrained', gridspec_kw={'width_ratios': [1.5, 1]})
selected = ['reverse_text', 'color_forward', 'old_lift_stats', 'mask_state', 'no_future_to_action']
names = ['Reverse sorting rule', 'Exchange foreground color', 'Restore old lift scale', 'Mask state token', 'Mask future → action']
y = np.arange(len(selected))
for offset, model in enumerate(['ft', 'base']):
    values = [summary['models'][model]['interventions'][v]['action_change']['arm12_mae']['mean'] for v in selected]
    bars = axes[0].barh(y + (offset - .5) * .34, values, height=.31, color=colors[model], label=labels[model])
    axes[0].bar_label(bars, fmt='%.2f', padding=3, fontsize=9)
axes[0].set(yticks=y, yticklabels=names, xlabel='12-arm action change from matched baseline', xlim=(0, 23), title='Condition and pathway interventions')
axes[0].invert_yaxis()
axes[0].legend(loc='lower right', fontsize=8)
axes[0].grid(axis='x', alpha=.18)
x = np.arange(4)
for i, model in enumerate(models):
    values = [r['mean'] for r in summary['models'][model]['baseline_fit']['by_window']]
    axes[1].bar(x + (i-1)*.24, values, width=.22, color=colors[model], label=labels[model])
axes[1].set(xticks=x, xticklabels=['Old val\nep. 3', 'Added train\nep. 115', 'Added train\nep. 135', 'Added train\nep. 154'],
            ylabel='12-arm MAE to demonstration', title='Fit on selected diagnostic windows', ylim=(0, 19))
axes[1].tick_params(axis='x', labelsize=8)
axes[1].legend(fontsize=8)
axes[1].grid(axis='y', alpha=.18)
save(fig, 'correction-network-actions.svg')

fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.3), layout='constrained')
for model in models:
    values = [v['mean'] * 100 for v in summary['models'][model]['bridge_groups'].values()]
    axes[0].plot(range(6), values, 'o-', color=colors[model], label=labels[model], markersize=4)
axes[0].set(xticks=range(6), xticklabels=[f'{a}–{a+4}' for a in range(0, 30, 5)],
            xlabel='Masked video → action layer group', ylabel='Action-velocity change · relative L2 (%)',
            title='Where the video–action bridge matters', ylim=(0, 42))
axes[0].legend(fontsize=8)
axes[0].grid(alpha=.18)
for model in ['ft', 'base']:
    result = summary['models'][model]['interventions']
    for variant, style, name in [('color_forward', '-', 'Color'), ('old_lift_stats', '--', 'Lift scale')]:
        axes[1].plot(range(30), np.array(result[variant]['action_residual_relative_l2']) * 100,
                     style, color=colors[model], label=f'{"A" if model == "ft" else "B"} · {name}')
axes[1].set(xlabel='Paired Transformer layer (zero-indexed)', ylabel='Action-residual change · relative L2 (%)',
            title='Propagation through action residuals', ylim=(0, 35), xlim=(0, 29))
axes[1].legend(fontsize=8, ncols=2)
axes[1].grid(alpha=.18)
save(fig, 'correction-network-layers.svg')

write_summary()
print('Exported two network figures and a public aggregate summary; all native sampler checks exact.')
