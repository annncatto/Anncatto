"""Export aggregate neural interventions and bilingual figures in native Anncatto palette.

Usage:
  python scripts/figures/openwam-network-analysis.py EVIDENCE_DIRECTORY [--note-output DIR] [--summary-only]
The directory must contain network/{plan,old,ft,base}.json and projection.json.
"""
import argparse
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path)
parser.add_argument('--note-output', type=Path)
parser.add_argument('--summary-only', action='store_true')
args = parser.parse_args()

root = args.evidence
source = root / 'network'
out = Path(__file__).resolve().parents[2] / 'content/images/openwam-slots'
out.mkdir(parents=True, exist_ok=True)
if args.note_output:
    args.note_output.mkdir(parents=True, exist_ok=True)

models = ['old', 'ft', 'base']

# Native Anncatto palette
INK = '#273b43'
MUTED = '#61747b'
LINE = '#dce9e9'
ORIG = '#95a8ae'
FT = '#556b73'
RESTART = '#237ab2'
GREEN = '#4b9c80'
ALERT = '#b55d4c'
COLORS = {'old': ORIG, 'ft': FT, 'base': RESTART}

variants = ['reverse_text', 'color_forward', 'mask_text', 'mask_state', 'old_lift_stats',
            'no_video_to_action', 'no_future_to_action']
plan = json.loads((source / 'plan.json').read_text())
assert [(r['episode'], r['frame']) for r in plan] == [(3, 211), (115, 32), (135, 66), (154, 155)]
proj = json.loads((root / 'projection.json').read_text())


def stats(values):
    values = np.asarray(values, dtype=np.float64)
    assert np.isfinite(values).all()
    return dict(
        mean=float(values.mean()),
        median=float(np.median(values)),
        minimum=float(values.min()),
        maximum=float(values.max()),
        count=int(values.size),
    )


summary = dict(
    schema=1,
    measured_on='2026-11-19',
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
        scope='Local pathway interventions and training-example fit; task outcome measured separately',
    ),
    models={},
    source_sha256={},
)

for model in models:
    path = source / f'{model}.json'
    data = json.loads(path.read_text())
    assert len(data['one_step']) == 60 and len(data['replay']) == 64
    assert data['native_equivalence'] == dict(max_abs_difference=0.0, exact_equal=True)
    result = dict(
        native_equivalence=data['native_equivalence'],
        baseline_fit={},
        interventions={},
        bridge_groups={},
        context_attention={},
        joint_attention={},
    )
    baseline = [r for r in data['replay'] if r['variant'] == 'baseline']
    joints = [i for i in range(14) if i not in [6, 13]]
    predictions = {(r['window'], r['seed'], r['variant']): np.asarray(r['prediction'])[:, joints] for r in data['replay']}
    result['between_seed_baseline_change'] = stats([
        np.abs(predictions[i, 17, 'baseline'] - predictions[i, 29, 'baseline']).mean() for i in range(4)
    ])
    result['output_ranges'] = {}
    for variant in ['baseline', 'mask_text', 'reverse_text']:
        a = np.stack([predictions[i, seed, variant] for i in range(4) for seed in [17, 29]])
        result['output_ranges'][variant] = dict(
            minimum=float(a.min()),
            maximum=float(a.max()),
            outside_host_joint_range_fraction=float((np.abs(a) > 100).mean()),
            positions=int(a.size),
        )
    for group, predicate in [
        ('all', lambda r: True),
        ('original_validation_window', lambda r: r['window'] == 0),
        ('added_training_windows', lambda r: r['window'] > 0),
    ]:
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
            video_residual_relative_l2=np.mean([np.array(r['layer_relative_l2'])[:, 1] for r in one], axis=0).tolist(),
        )
    for start in range(0, 30, 5):
        key = f'bridge_{start:02d}_{start+4:02d}'
        result['bridge_groups'][key] = stats([r['velocity_relative_l2'] for r in data['one_step'] if r['variant'] == key])
    baselines = [r for r in data['one_step'] if r['variant'] == 'baseline']
    result['context_attention']['state_mass_by_layer'] = np.mean(
        [[r['context_attention'][str(i)]['state_mass'] for i in range(30)] for r in baselines], axis=0
    ).tolist()
    result['joint_attention']['mass_by_layer_observed_future_action'] = np.mean(
        [[r['joint_attention'][str(i)] for i in range(30)] for r in baselines], axis=0
    ).tolist()
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


if args.summary_only:
    write_summary()
    print('Updated aggregate summary with matched-seed scale and output ranges.')
    raise SystemExit(0)


def style_rc(lang):
    fonts = ['Noto Sans CJK JP', 'DejaVu Sans'] if lang == 'zh' else ['DejaVu Sans']
    plt.rcParams.update({
        'font.family': fonts,
        'font.size': 10.2,
        'axes.titlesize': 11.8,
        'axes.titleweight': 'semibold',
        'axes.labelsize': 9.8,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.edgecolor': '#b9cccf',
        'text.color': INK,
        'axes.labelcolor': INK,
        'xtick.color': MUTED,
        'ytick.color': MUTED,
        'axes.unicode_minus': False,
        'svg.fonttype': 'none',
        'svg.hashsalt': f'openwam-net-{lang}',
        'savefig.facecolor': 'white',
        'figure.facecolor': 'white',
    })


def save_svg(fig, stem, lang, note_name=None):
    suffix = '-zh' if lang == 'zh' else ''
    fig.savefig(out / f'{stem}{suffix}.svg', format='svg', metadata={'Date': None}, facecolor='white')
    if note_name and lang == 'zh' and args.note_output:
        fig.savefig(args.note_output / note_name, dpi=180, facecolor='white')
    plt.close(fig)


p_new = proj['groups']['new_train']

for lang in ('en', 'zh'):
    style_rc(lang)
    zh = (lang == 'zh')
    lbl = {
        'old': '原 115ep' if zh else 'Orig 115ep',
        'ft': '微调 10k' if zh else 'Fine-tuned 10k',
        'base': '重训 10k' if zh else 'Restarted 10k',
    }

    # Figure 3: State-token L2 shift (left) + Matched condition & pathway interventions (right)
    fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.6), layout='constrained', gridspec_kw={'width_ratios': [1.0, 1.38]})

    st_labels = (
        ['仅换全部统计', '仅换升降统计\n(+0.19 mm)', '仅换微调权重\n（新统计固定）']
        if zh else
        ['All stats only', 'Lift stats only\n(+0.19 mm)', 'Fine-tuned weights\n(new stats fixed)']
    )
    st_vals = [
        p_new['normalization_only_relative_l2'] * 100,
        p_new['normalization_by_group_relative_l2']['lift'] * 100,
        p_new['ft_weights_only_relative_l2'] * 100,
    ]
    bars = axes[0].barh(np.arange(3), st_vals, height=0.52, color=['#8bb7cd', RESTART, ORIG])
    axes[0].bar_label(bars, labels=[f'{v:.1f}%' if v >= 1 else f'{v:.2f}%' for v in st_vals], padding=4, fontsize=9.5, color=INK, fontweight='semibold')
    axes[0].set(
        yticks=np.arange(3),
        yticklabels=st_labels,
        xlim=(0, 66),
        xlabel='状态 token 相对 L2 变化（%）' if zh else 'State-token relative L2 change (%)',
        title='320 个新增状态：归一化 vs 权重' if zh else '320 added states: normalization vs weights',
    )
    axes[0].invert_yaxis()
    axes[0].grid(axis='x', color=LINE, lw=0.8)
    axes[0].set_axisbelow(True)

    selected = ['reverse_text', 'color_forward', 'old_lift_stats', 'mask_state', 'no_future_to_action']
    names = (
        ['反转蓝绿规则', '交换前景色相', '恢复旧升降统计', '屏蔽状态 token', '屏蔽未来视频→动作']
        if zh else
        ['Reverse rule', 'Swap foreground hue', 'Old lift scale', 'Mask state token', 'Mask future → action']
    )
    y = np.arange(len(selected))
    for offset, model in enumerate(['ft', 'base']):
        values = [summary['models'][model]['interventions'][v]['action_change']['arm12_mae']['mean'] for v in selected]
        bars = axes[1].barh(y + (offset - 0.5) * 0.34, values, height=0.31, color=COLORS[model], label=lbl[model])
        axes[1].bar_label(bars, fmt='%.1f', padding=3, fontsize=8.8, color=INK)

    seed_ft = summary['models']['ft']['between_seed_baseline_change']['mean']
    seed_re = summary['models']['base']['between_seed_baseline_change']['mean']
    seed_mid = (seed_ft + seed_re) / 2
    axes[1].axvline(seed_mid, color=ALERT, ls=':', lw=1.3)
    axes[1].text(
        seed_mid + 0.35, -0.45,
        f'换种子对照 {seed_ft:.1f}/{seed_re:.1f}' if zh else f'Seed 17/29 ref: {seed_ft:.1f}/{seed_re:.1f}',
        fontsize=8.2, color=ALERT, va='top', ha='left',
    )
    axes[1].set(
        yticks=y,
        yticklabels=names,
        xlim=(0, 23.8),
        xlabel='12 关节动作相对基线平均绝对变化' if zh else '12-arm action change from matched baseline',
        title='四诊断窗口：条件与通路干预' if zh else 'Matched condition and pathway interventions',
    )
    axes[1].invert_yaxis()
    axes[1].grid(axis='x', color=LINE, lw=0.8)
    axes[1].set_axisbelow(True)
    # Place legend in top-right open area where bars are only 1.5–3.6 (zero overlap!)
    axes[1].legend(loc='upper right', frameon=True, facecolor='white', edgecolor=LINE, fontsize=8.6)
    mt_ft = summary['models']['ft']['interventions']['mask_text']['action_change']['arm12_mae']['mean']
    mt_re = summary['models']['base']['interventions']['mask_text']['action_change']['arm12_mae']['mean']
    axes[1].text(
        0.98, 0.57,
        f'屏蔽全文本：{mt_ft:.0f}/{mt_re:.0f}（49%/47% 越界）\nep.135 换色：臂 8.6/6.8 · 右爪 16.5/29.0'
        if zh else
        f'Mask all text: {mt_ft:.0f}/{mt_re:.0f} (49%/47% OOD)\nep.135 hue: arm 8.6/6.8, R-grip 16.5/29.0',
        transform=axes[1].transAxes, ha='right', va='center', fontsize=7.6, color=MUTED,
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#f8fbfa', edgecolor=LINE, lw=0.9),
    )
    save_svg(fig, 'correction-network-actions', lang)

    # Figure 4: Layer-group masking & 30-layer residual propagation
    fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.4), layout='constrained')
    axes[0].axvspan(1.65, 3.35, color='#edf5f8', alpha=0.75, zorder=0)
    axes[0].axvspan(4.65, 5.35, color='#faf1ef', alpha=0.85, zorder=0)
    for model in models:
        values = [v['mean'] * 100 for v in summary['models'][model]['bridge_groups'].values()]
        lw = 1.6 if model == 'old' else 2.2
        axes[0].plot(range(6), values, 'o-', color=COLORS[model], label=lbl[model], markersize=4.8, lw=lw)
    v25_ft = summary['models']['ft']['bridge_groups']['bridge_25_29']['mean'] * 100
    v25_re = summary['models']['base']['bridge_groups']['bridge_25_29']['mean'] * 100
    v05_ft = summary['models']['ft']['bridge_groups']['bridge_05_09']['mean'] * 100
    v05_re = summary['models']['base']['bridge_groups']['bridge_05_09']['mean'] * 100
    axes[0].annotate(
        f'{v25_ft:.1f}% / {v25_re:.1f}%', xy=(5, v25_ft), xytext=(3.65, 38.8),
        fontsize=8.8, color=ALERT, fontweight='semibold',
        arrowprops=dict(arrowstyle='->', color=ALERT, lw=1.0),
    )
    axes[0].annotate(
        f'{v05_ft:.1f}% / {v05_re:.1f}%', xy=(1, v05_ft), xytext=(1.25, 1.3),
        fontsize=8.5, color=MUTED,
    )
    axes[0].set(
        xticks=range(6),
        xticklabels=[f'{a}–{a+4}' for a in range(0, 30, 5)],
        ylim=(0, 44),
        xlabel='屏蔽视频 → 动作的五层组' if zh else 'Masked video → action layer group',
        ylabel='最终动作速度场相对 L2 变化（%）' if zh else 'Final action-velocity relative L2 (%)',
        title='五层组屏蔽：中段与末段响应最大' if zh else 'Five-layer masking: middle and final peaks',
    )
    axes[0].grid(color=LINE, lw=0.8)
    axes[0].legend(loc='upper left', frameon=False, fontsize=8.6)

    for model in ['ft', 'base']:
        res = summary['models'][model]['interventions']
        for variant, style, vname in [
            ('color_forward', '-', '前景色' if zh else 'Color'),
            ('old_lift_stats', '--', '旧升降统计' if zh else 'Old lift scale'),
        ]:
            arr = np.array(res[variant]['action_residual_relative_l2']) * 100
            axes[1].plot(range(30), arr, style, color=COLORS[model], lw=2.0, label=f'{lbl[model]} · {vname}')
    l_ft = summary['models']['ft']['interventions']['old_lift_stats']['action_residual_relative_l2'][-1] * 100
    l_re = summary['models']['base']['interventions']['old_lift_stats']['action_residual_relative_l2'][-1] * 100
    c_re = summary['models']['base']['interventions']['color_forward']['action_residual_relative_l2'][-1] * 100
    axes[1].text(29.3, l_ft, f'{l_ft:.1f}%', fontsize=8.5, color=FT, va='center', fontweight='semibold')
    axes[1].text(29.3, l_re, f'{l_re:.1f}%', fontsize=8.5, color=RESTART, va='center', fontweight='semibold')
    axes[1].text(29.3, c_re + 0.6, f'{c_re:.1f}%', fontsize=8.4, color=RESTART, va='center')
    axes[1].set(
        xlim=(0, 32.8),
        xticks=[0, 5, 10, 15, 20, 25, 29],
        ylim=(0, 37.5),
        xlabel='配对 Transformer 层号（0 起）' if zh else 'Paired Transformer layer (0-indexed)',
        ylabel='各层动作残差相对 L2 差异（%）' if zh else 'Action-residual relative L2 diff (%)',
        title='颜色与升降统计扰动的逐层传播' if zh else 'Layerwise propagation through action residuals',
    )
    axes[1].grid(color=LINE, lw=0.8)
    axes[1].legend(loc='upper left', ncols=2, frameon=False, fontsize=8.1, columnspacing=0.9)
    save_svg(fig, 'correction-network-layers', lang, note_name='OpenWAM纠偏-层间.png')

# Dedicated Obsidian Chinese PNGs for state & conditions (matching native palette, zero A/B)
if args.note_output:
    style_rc('zh')
    # OpenWAM纠偏-状态.png
    fig, axes = plt.subplots(1, 2, figsize=(10.6, 4.3), layout='constrained', gridspec_kw={'width_ratios': [1.2, 1.0]})
    st_vals = [
        p_new['normalization_only_relative_l2'] * 100,
        p_new['normalization_by_group_relative_l2']['lift'] * 100,
        p_new['ft_weights_only_relative_l2'] * 100,
    ]
    bars = axes[0].barh(range(3), st_vals, color=['#8bb7cd', RESTART, ORIG], height=0.52)
    axes[0].bar_label(bars, labels=[f'{v:.1f}%' if v >= 1 else f'{v:.2f}%' for v in st_vals], padding=4, fontsize=9.8, fontweight='semibold')
    axes[0].set(yticks=range(3), yticklabels=['仅换全部统计', '仅换升降统计\n(+0.19 mm)', '仅换微调权重\n（新统计固定）'],
                xlim=(0, 66), xlabel='状态 token 相对 L2 变化（%）', title='320 个新增状态的条件变化')
    axes[0].invert_yaxis()
    axes[0].grid(axis='x', color=LINE, lw=0.8)
    axes[0].set_axisbelow(True)

    act_vals = [summary['models'][m]['interventions']['old_lift_stats']['action_change']['arm12_mae']['mean'] for m in ['ft', 'base']]
    bars2 = axes[1].bar([0, 1], act_vals, color=[FT, RESTART], width=0.48)
    axes[1].bar_label(bars2, fmt='%.2f', padding=4, fontsize=10.5, fontweight='semibold')
    axes[1].set(xticks=[0, 1], xticklabels=['微调 10k', '重训 10k'], ylim=(0, 6.6),
                ylabel='12 关节输出平均绝对变化', title='四诊断窗口：仅恢复旧升降统计')
    axes[1].grid(axis='y', color=LINE, lw=0.8)
    axes[1].set_axisbelow(True)
    fig.savefig(args.note_output / 'OpenWAM纠偏-状态.png', dpi=180, facecolor='white')
    plt.close(fig)

    # OpenWAM纠偏-条件.png
    fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.3), layout='constrained')
    for ax, vlist, vnames, xlim, title in [
        (axes[0], ['reverse_text', 'color_forward'], ['反转蓝绿左右规则', '交换前景色相'], 5.8, '改变输入内容（含换种子参照）'),
        (axes[1], ['mask_text', 'mask_state', 'no_future_to_action'], ['屏蔽全部文本', '屏蔽状态 token', '屏蔽未来视频→动作'], 192, '屏蔽整组条件或通路'),
    ]:
        y = np.arange(len(vlist))
        for idx, m in enumerate(['ft', 'base']):
            vals = [summary['models'][m]['interventions'][v]['action_change']['arm12_mae']['mean'] for v in vlist]
            b = ax.barh(y + (idx - 0.5) * 0.32, vals, height=0.29, color=COLORS[m], label='微调 10k' if m == 'ft' else '重训 10k')
            ax.bar_label(b, fmt='%.1f' if xlim > 20 else '%.2f', padding=3, fontsize=9.2)
        ax.set(yticks=y, yticklabels=vnames, xlim=(0, xlim), xlabel='12 关节输出平均绝对变化', title=title)
        ax.invert_yaxis()
        ax.grid(axis='x', color=LINE, lw=0.8)
        ax.set_axisbelow(True)
    seed_mid = (summary['models']['ft']['between_seed_baseline_change']['mean'] + summary['models']['base']['between_seed_baseline_change']['mean']) / 2
    axes[0].axvline(seed_mid, color=ALERT, ls=':', lw=1.3)
    axes[0].text(seed_mid + 0.12, 0.1, '换种子\n4.6 / 4.0', fontsize=8.2, color=ALERT)
    axes[1].legend(loc='lower right', frameon=False, fontsize=9)
    fig.savefig(args.note_output / 'OpenWAM纠偏-条件.png', dpi=180, facecolor='white')
    plt.close(fig)

write_summary()
print('Exported bilingual network figures (native palette, zero overlap) and public summary JSON.')
