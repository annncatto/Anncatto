"""Export SmolVLA empirical findings and decluttered bilingual figures from archived evidence.

Usage: python scripts/figures/smolvla-experiment-analysis.py EVIDENCE_DIR
       [--note-output IMAGE_DIRECTORY]
Only aggregate statistics and source hashes are published; no training runs.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
from matplotlib.gridspec import GridSpec
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path)
parser.add_argument('--note-output', type=Path)
args = parser.parse_args()
root = args.evidence
out = Path(__file__).resolve().parents[2] / 'content/images/smolvla'
out.mkdir(exist_ok=True)
if args.note_output:
    args.note_output.mkdir(exist_ok=True)

read = lambda name: json.loads((root / name).read_text())
w = read('precision/weights.json')
sw = read('precision/layer-swaps.json')
rep = read('precision/replay.json')
cont = read('continuation/evaluation.json')
cw = read('continuation/weight-changes.json')
boundary = read('continuation/boundary-analysis.json')
cont_err = np.load(root / 'continuation/errors.npz')
plans = read('continuation/plans.json')
ev = read('deployment/evaluation.json')
inter = read('deployment/input-interventions.json')
series = np.load(root / 'deployment/evaluation-series.npz')
fw_p1 = read('fast_weights/probe1_budget_sweep.json')
fw_p2 = read('fast_weights/probe2_live_routing.json')

with (root / 'precision/parameter_inventory.csv').open() as f:
    inventory = list(csv.DictReader(f))

names = {r['name'] for r in inventory if r['version'] == 'mixed' and r['trainable'] == 'True' and r['dtype'] == 'BF16'}
assert len(names) == 129
matrix = {}
for version in ['mixed', 'fp32']:
    rows = [r for r in inventory if r['version'] == version and r['name'] in names]
    count = sum(int(r['numel']) for r in rows)
    assert count == 96607440
    matrix[version] = sum(int(r['last_5k_changed']) for r in rows) / count
matrix['fp32_120k'] = cw['fp32_120k']['aggregates']['same_matrix_names']['changed_fraction']


def rel_l2(rows):
    num = sum(float(x['from_initial_delta_l2']) ** 2 for x in rows) ** 0.5
    den = sum(float(x['from_initial_reference_l2']) ** 2 for x in rows) ** 0.5
    return num / den if den else 0.0


group_drift = {}
layer_drift = {'A_body': [], 'A_ca_kv': [], 'B_all': [], 'B_ca_kv': []}
for ver, label in [('mixed', 'A'), ('fp32', 'B')]:
    rows = [r for r in inventory if r['version'] == ver and r['trainable'] == 'True']
    g_ext = [r for r in rows if r['module'] != 'action_expert']
    g_ln = [r for r in rows if r['module'] == 'action_expert' and 'layernorm' in r['name']]
    g_cakv = [r for r in rows if any(f'.layers.{L}.self_attn.{p}_proj.' in r['name'] for L in range(1, 16, 2) for p in ('k', 'v'))]
    cakv_set = {r['name'] for r in g_cakv}
    ln_set = {r['name'] for r in g_ln}
    g_body = [r for r in rows if r['module'] == 'action_expert' and r['name'] not in cakv_set and r['name'] not in ln_set]
    group_drift[label] = {
        'layernorm': rel_l2(g_ln),
        'expert_body': rel_l2(g_body),
        'external_proj': rel_l2(g_ext),
        'ca_kv': rel_l2(g_cakv),
    }

for L in range(16):
    rA = [r for r in inventory if r['version'] == 'mixed' and f'.layers.{L}.' in r['name'] and r['trainable'] == 'True']
    rB = [r for r in inventory if r['version'] == 'fp32' and f'.layers.{L}.' in r['name'] and r['trainable'] == 'True']
    layer_drift['A_body'].append(rel_l2([r for r in rA if r['dtype'] == 'BF16']) * 100)
    layer_drift['B_all'].append(rel_l2(rB) * 100)
    if L % 2 == 1:
        layer_drift['A_ca_kv'].append((L, rel_l2([r for r in rA if r['dtype'] == 'F32']) * 100))
        ca_names = {r['name'] for r in rA if r['dtype'] == 'F32'}
        layer_drift['B_ca_kv'].append((L, rel_l2([r for r in rB if r['name'] in ca_names]) * 100))

flow = {m: float(np.mean(sw['baselines'][m])) for m in ['A', 'B']}
flow['C'] = cont['fp32_120k']['flow_loss']
assert abs(flow['A'] - cont['old']['flow_loss']) < 1e-12

cases = [
    'demo_images_eval_state',
    'replace_wrist_right',
    'replace_forward',
    'replace_chest',
    'replace_wrist_left',
    'eval_images_demo_state',
    'replace_base',
    'replace_other_arm_joints',
    'replace_motor2',
]
input_values = [
    [next(r['mean_absolute_change_vs_eval'] for r in inter['records'] if r['observation'] == i and r['case'] == case) for i in range(3)]
    for case in cases
]
assert len(inter['records']) == 39

start_idx = [i for i, p in enumerate(plans['plan90']) if p['phase'] == 'start']
assert len(start_idx) == 30
pA_start = cont_err['predictions'][0, start_idx, :, 8][cont_err['valid'][0, start_idx]]
pC_start = cont_err['predictions'][1, start_idx, :, 8][cont_err['valid'][1, start_idx]]
tgt_start = (cont_err['predictions'][1, start_idx, :, 8] - cont_err['errors'][1, start_idx, :, 8])[cont_err['valid'][1, start_idx]]

# Compact aggregate fast-weight summary for precision-summary.json
fw_summary = dict(
    valid_prefix_tokens=280,
    total_prefix_tokens=305,
    odd_ca_layers=[1, 3, 5, 7, 9, 11, 13, 15],
    sweep={
        ver: {
            k: {kk: v[kk] for kk in ['mode', 'm', 'k', 'budget', 'flow_loss_mean', 'std_arm14_mae'] if kk in v}
            for k, v in fw_p1['models'][ver]['sweep'].items()
        }
        for ver in ['mixed', 'fp32']
    },
    ca_layer_eff_tokens={
        ver: {L: fw_p1['models'][ver]['ca_by_layer'][L]['eff_tokens'] for L in ['1', '3', '5', '7', '9', '11', '13', '15']}
        for ver in ['mixed', 'fp32']
    },
    ca_source_mass_mean={
        ver: {
            s: float(np.mean([fw_p1['models'][ver]['ca_by_layer'][L]['source_mass'][s] for L in ['1', '3', '5', '7', '9', '11', '13', '15']]))
            for s in ['forward', 'chest', 'wrist_left', 'wrist_right', 'text', 'state']
        }
        for ver in ['mixed', 'fp32']
    },
    live_l01_source_mass={
        k: fw_p2['cases'][k]['ca_by_layer']['1']['source_mass']
        for k in ['start_underflow', 'base_moving', 'active_open_grasp', 'oscillation_251s']
    },
    live_routing_miou_pairs=fw_p2['routing_miou_pairs'],
)

summary = dict(
    schema=3,
    compiled_on='2026-11-26',
    task='Pick up floor toys and place them into the box held by the left arm',
    protocol=dict(
        dataset_episodes=150, dataset_frames=155727, validation_episodes=0,
        same_task_initialization=True, cameras=4, state_action_dim=18, internal_action_dim=32,
        loss_supervised_dim=18, flow_windows=16, flow_draws=32, prediction_windows=90,
        uniform_comparison_compute='FP32 weights and compute; autocast and TF32 disabled',
        precision_comparison='Mixed 100k vs FP32 100k change training storage, optimizer moments and compute recipe together',
        continuation='FP32 120k adds 20k updates to FP32 100k at constant learning rate 5e-7',
    ),
    parameter_scope=dict(
        total=450046176, trainable=99880992, frozen=350165184,
        expert=98245840, external_projections=1635152, odd_ca_kv=1638400,
        expert_bf16_body=96584400, expert_layernorm=23040,
        matrix_comparison_elements=96607440,
        last_5k_changed_fraction=matrix,
        group_relative_l2_from_init=group_drift,
        layer_relative_l2_pct=layer_drift,
        frozen_numeric_change=0,
    ),
    uniform_fp32_flow_loss=flow,
    checkpoint_sha256=dict(A=w['mixed']['sha256'], B=w['fp32']['sha256'], C=cont['fp32_120k']['checkpoint_sha256']),
    original_recipe_replay=[{k: r[k] for k in ['version', 'step', 'flow_loss_mean', 'precision']} for r in rep],
    module_swaps=[{k: r[k] for k in ['base', 'donor', 'swapped', 'mean_loss', 'relative_loss_reduction_pct']} for r in sw['records']],
    continuation_fit={
        m: {k: r[k] for k in ['training_step', 'flow_loss', 'mean_standardized_arm_mae', 'mae_by_action', 'gripper_open_first_prediction_count', 'gripper_open_windows']}
        for m, r in cont.items()
    },
    boundary={
        m: {k: r[k] for k in ['prediction_positions', 'outside_count', 'outside_fraction', 'phase_counts', 'horizon_counts', 'windows_with_outside_predictions', 'mean_overshoot', 'max_overshoot', 'corresponding_target_min', 'corresponding_target_max', 'raw_mae', 'clipped_mae', 'mae_reduction_after_clipping_pct']}
        for m, r in boundary['models'].items()
    },
    deployment=dict(
        model='FP32 100k', frames=ev['frames'], span_s=ev['recorded_span_s'],
        recording_hz=ev['effective_recording_hz'], motor2=ev['joints'][8], gripper=ev['joints'][13],
        accepted_motor2_range=[float(series['accepted'][:, 8].min()), float(series['accepted'][:, 8].max())],
        holding_frames=ev['holds']['arm_right_gripper'],
    ),
    input_interventions=dict(
        observation_times_s=[next(r['time_s'] for r in inter['records'] if r['observation'] == i) for i in range(3)],
        cases=cases, mean_absolute_motor2_change=input_values,
        queries=117, noise_seeds_per_case=3, predicted_positions_used=25,
        donor='Nearest demonstrated arm state after train-std scaling with std floor 1',
        scope='Saved-observation re-prediction, compared with its matched new baseline; not the cached executed action',
    ),
    fast_weights=fw_summary,
    source_sha256={},
)
runtime = read('continuation/boundary-source-audit.json')
summary['runtime_checks'] = {
    k: runtime[k]
    for k in ['runtime_model_sha256', 'frozen_snapshot_hash_matches', 'real_action_dim', 'max_action_dim', 'feature_padding_dims', 'loss_truncates_to_real_action_dim', 'sampler_updates_all_dims', 'sampler_contains_action_clamp', 'methods']
}
for name in [
    'precision/weights.json', 'precision/parameter_inventory.csv', 'precision/layer-swaps.json', 'precision/replay.json',
    'continuation/evaluation.json', 'continuation/weight-changes.json', 'continuation/boundary-analysis.json',
    'continuation/boundary-source-audit.json', 'deployment/evaluation.json', 'deployment/evaluation-series.npz',
    'deployment/input-interventions.json', 'deployment/intervention-inputs.json',
    'fast_weights/probe1_budget_sweep.json', 'fast_weights/probe2_live_routing.json',
]:
    summary['source_sha256'][name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
(out / 'precision-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
assert not any(s in (out / 'precision-summary.json').read_text() for s in ['/home/', '192.168.', 'password', 'anncatto@', 'lyt@'])

# Native Anncatto editorial palette across ALL SmolVLA figures
SLATE, BLUE, GREEN, CORAL, INK, LIGHT_GRAY = '#556b73', '#237ab2', '#4b9c80', '#b55d4c', '#273b43', '#c8d8d8'
plt.rcParams.update({
    'font.family': ['Noto Sans CJK JP', 'DejaVu Sans'],
    'font.size': 10,
    'text.color': INK,
    'axes.labelcolor': INK,
    'xtick.color': '#556b73',
    'ytick.color': '#556b73',
    'axes.edgecolor': '#c8dada',
    'grid.color': '#dce9e9',
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.titleweight': 'semibold',
    'svg.fonttype': 'none',
    'svg.hashsalt': 'smolvla-precision-20261126',
    'axes.unicode_minus': False,
})


def save_svg(fig, target):
    fig.savefig(target, metadata={'Date': None}, facecolor='white')
    target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')


def figure(language, name, note_name):
    tr = lambda zh, en: zh if language == 'zh' else en

    if name == 'precision-fit':
        fig, ax = plt.subplots(1, 2, figsize=(10.8, 4.4), layout='constrained')
        steps_A = [r['step'] / 1000 for r in rep if r['version'] == 'mixed']
        loss_A = [r['flow_loss_mean'] for r in rep if r['version'] == 'mixed']
        steps_B = [r['step'] / 1000 for r in rep if r['version'] == 'fp32']
        loss_B = [r['flow_loss_mean'] for r in rep if r['version'] == 'fp32']

        ax[0].axvspan(50, 100, color='#f2f6f6', alpha=0.88, zorder=0)
        ax[0].plot(steps_A, loss_A, 'o-', color=SLATE, lw=2.2, ms=5.5, label=tr('混合存储', 'Mixed'))
        ax[0].plot(steps_B, loss_B, 'o-', color=BLUE, lw=2.2, ms=5.5, label=tr('全 FP32', 'Full FP32'))
        ax[0].plot([100, 120], [loss_B[-1], flow['C']], 'D--', color=GREEN, lw=1.8, ms=5.5, zorder=5,
                   label='FP32 120k')
        ax[0].scatter([100], [flow['A']], marker='s', s=42, facecolors='white', edgecolors=SLATE, lw=1.8, zorder=5,
                      label=tr('混合统一 FP32', 'Mixed (FP32 eval)'))
        ax[0].annotate('−39%', xy=(80, 0.0138), xytext=(56, 0.0055), fontsize=9.0, color=BLUE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.1))
        ax[0].annotate('−1.8%', xy=(76, 0.0276), xytext=(64, 0.0338), fontsize=9.0, color=SLATE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=SLATE, lw=1.1))
        ax[0].set(
            xticks=[5, 20, 50, 80, 100, 120],
            xticklabels=['5k', '20k', '50k', '80k', '100k', '120k'],
            xlim=(0, 126), ylim=(0.0, 0.050),
            xlabel=tr('训练步数', 'Training steps'),
            ylabel=tr('配对 flow loss', 'Matched flow loss'),
            title=tr('5k–120k 收敛曲线', '5k–120k loss curves'),
        )
        ax[0].legend(fontsize=8.2, loc='upper right', frameon=True, facecolor='white', framealpha=0.94, edgecolor='#dce9e9')

        g_labels = [
            'RMSNorm',
            tr('专家主体\n96.6M', 'Expert body\n96.6M'),
            tr('外部投影\n1.6M', 'Ext. proj\n1.6M'),
            tr('奇数 CA K,V\n1.6M', 'Odd CA K,V\n1.6M'),
        ]
        vals_A = [group_drift['A'][k] * 100 for k in ['layernorm', 'expert_body', 'external_proj', 'ca_kv']]
        vals_B = [group_drift['B'][k] * 100 for k in ['layernorm', 'expert_body', 'external_proj', 'ca_kv']]
        y = np.arange(len(g_labels))
        h = 0.36
        bA = ax[1].barh(y + h / 2, vals_A, height=h, color=SLATE, label=tr('混合 100k', 'Mixed 100k'))
        bB = ax[1].barh(y - h / 2, vals_B, height=h, color=BLUE, label='FP32 100k')
        ax[1].bar_label(bA, labels=[f'{v:.1f}%' for v in vals_A], padding=4, fontsize=8.8, color=SLATE, fontweight='semibold')
        ax[1].bar_label(bB, labels=[f'{v:.1f}%' for v in vals_B], padding=4, fontsize=8.8, color=BLUE, fontweight='semibold')
        ax[1].annotate('2.5×', xy=(17.3, 3.18), xytext=(12.2, 2.48), fontsize=9.0, color=SLATE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=SLATE, lw=1.1))
        ax[1].set(
            yticks=y, yticklabels=g_labels, xlim=(0, 21.5),
            xlabel=tr('相对 L2 变化（%）', 'Relative L2 change (%)'),
            title=tr('四类参数相对 L2 变化', 'Relative L2 change by group'),
        )
        ax[1].legend(fontsize=8.4, loc='lower right', frameon=True, facecolor='white', edgecolor='#dce9e9')
        ax[0].grid(axis='y', alpha=0.18); ax[0].set_axisbelow(True)
        ax[1].grid(axis='x', alpha=0.18); ax[1].set_axisbelow(True)

    elif name == 'module-swaps':
        fig, ax = plt.subplots(1, 2, figsize=(10.8, 4.4), layout='constrained')
        layers = np.arange(16)
        for a in ax:
            for odd in range(1, 16, 2):
                a.axvspan(odd - 0.42, odd + 0.42, color='#edf5f8', alpha=0.72, zorder=0)

        odd_x = [p[0] for p in layer_drift['A_ca_kv']]
        odd_A = [p[1] for p in layer_drift['A_ca_kv']]
        odd_B = [p[1] for p in layer_drift['B_ca_kv']]
        ax[0].plot(layers, layer_drift['A_body'], 's-', color='#95a8ae', lw=2.0, ms=4.5, label=tr('混合 BF16 主体', 'Mixed BF16 body'))
        ax[0].plot(layers, layer_drift['B_all'], 'o-', color=BLUE, lw=2.1, ms=4.5, label=tr('FP32 全层', 'FP32 full layer'))
        ax[0].plot(odd_x, odd_A, 'D--', color=SLATE, lw=2.1, ms=5.2, label=tr('混合 CA K,V', 'Mixed CA K,V'))
        ax[0].plot(odd_x, odd_B, '^:', color=GREEN, lw=1.7, ms=4.6, label=tr('FP32 CA K,V', 'FP32 CA K,V'))
        ax[0].annotate('L15: 23%', xy=(15, odd_A[-1]), xytext=(11.2, 24.4), fontsize=8.6, color=SLATE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=SLATE, lw=1.0))
        ax[0].set(
            xticks=layers, xlim=(-0.6, 15.6), ylim=(0, 27.0),
            xlabel=tr('专家层（蓝底：奇数 CA）', 'Expert layer (shaded: odd CA)'),
            ylabel=tr('相对 L2 变化（%）', 'Relative L2 change (%)'),
            title=tr('逐层 L2 变化', 'Layerwise L2 change'),
        )
        ax[0].legend(fontsize=8.0, loc='upper left', frameon=True, facecolor='white', framealpha=0.94, edgecolor='#dce9e9')

        ax[1].axhspan(0.84, 1.0, color='#eef6f1', alpha=0.9, zorder=0)
        ax[1].axhline(1.0, color=SLATE, ls='--', lw=1.1, zorder=1)
        for model, color, lbl in [
            ('A', SLATE, tr('混合 ← FP32', 'Mixed ← FP32')),
            ('B', BLUE, tr('FP32 ← 混合', 'FP32 ← Mixed')),
        ]:
            rows = [r for r in sw['records'] if r['base'] == model and r['swapped'].startswith('layer_')]
            ratio = [r['mean_loss'] / float(np.mean(sw['baselines'][model])) for r in rows]
            ax[1].plot(layers, ratio, 'o-', color=color, lw=2.0, ms=4.5, label=lbl, zorder=3)

        ax[1].annotate('L01 · 1.97×', xy=(1, 1.968), xytext=(2.4, 1.82), fontsize=8.4, color=BLUE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.0))
        ax[1].annotate('L08 · 1.87×', xy=(8, 1.874), xytext=(9.3, 1.96), fontsize=8.4, color=SLATE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=SLATE, lw=1.0))
        ax[1].annotate('L15 · 1.81×', xy=(15, 1.809), xytext=(11.2, 1.62), fontsize=8.4, color=BLUE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.0))
        ax[1].annotate('L06 −7.4%', xy=(6, 0.9257), xytext=(3.6, 0.855), fontsize=8.4, color=GREEN, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=GREEN, lw=1.0))
        ax[1].set(
            xticks=layers, xlim=(-0.6, 15.6), ylim=(0.84, 2.25),
            xlabel=tr('替换层号（蓝底：奇数 CA）', 'Swapped layer (shaded: odd CA)'),
            ylabel=tr('换层 / 原配 loss', 'Swap / baseline loss'),
            title=tr('16 层双向替换', '16-layer bidirectional swaps'),
        )
        ax[1].legend(fontsize=8.2, loc='upper right', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')
        for a in ax:
            a.grid(axis='y', alpha=0.16); a.set_axisbelow(True)
            a.tick_params(axis='x', labelsize=8.5)

    elif name == 'boundary-replay':
        fig, ax = plt.subplots(1, 2, figsize=(10.8, 4.3), layout='constrained')
        bins = np.linspace(-103.0, -95.0, 49)
        ax[0].axvspan(-103.0, -100.0, color='#f2f6f6', alpha=0.92, zorder=0)
        ax[0].axvline(-100.0, color=CORAL, ls='--', lw=1.6, zorder=4, label=tr('下限 −100', 'Bound −100'))
        ax[0].hist(tgt_start, bins=bins, histtype='stepfilled', color='#dce9e9', alpha=0.65, edgecolor='#9eb4b7', lw=1.2,
                   label=tr('示范目标', 'Demo targets'))
        ax[0].hist(pA_start, bins=bins, histtype='step', color=SLATE, lw=2.0, label=tr('混合 100k', 'Mixed 100k'))
        ax[0].hist(pC_start, bins=bins, histtype='step', color=GREEN, lw=2.1, label='FP32 120k')
        top_cnt = int(np.histogram(tgt_start, bins=bins)[0].max())
        ax[0].text(-101.55, top_cnt * 0.62, '< −100', ha='center', va='center', fontsize=9.2, color=CORAL, fontweight='bold')
        ax[0].set(
            xlim=(-103.0, -95.0), ylim=(0, max(420, int(top_cnt * 1.15))),
            xlabel=tr('右臂 shoulder_lift（Host）', 'Right shoulder_lift (Host)'),
            ylabel=tr('位置数', 'Positions'),
            title=tr('起始窗口分布', 'Start-window distribution'),
        )
        ax[0].legend(fontsize=8.2, loc='upper right', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')

        hA = [d['count'] for d in boundary['models']['old']['horizon_counts']]
        hC = [d['count'] for d in boundary['models']['fp32_120k']['horizon_counts']]
        h_labels = ['0–9', '10–19', '20–29', '30–39', '40–49']
        x = np.arange(5)
        wbar = 0.36
        bA = ax[1].bar(x - wbar / 2, hA, width=wbar, color=SLATE, label=tr('混合 100k（390）', 'Mixed 100k (390)'))
        bC = ax[1].bar(x + wbar / 2, hC, width=wbar, color=GREEN, label='FP32 120k (153)')
        ax[1].bar_label(bA, padding=3, fontsize=8.5, color=SLATE, fontweight='semibold')
        ax[1].bar_label(bC, padding=3, fontsize=8.5, color=GREEN, fontweight='semibold')
        ax[1].text(
            0.97, 0.94,
            tr('裁剪 MAE: 1.25 → 1.24 (−0.6%)', 'Clip MAE: 1.25 → 1.24 (−0.6%)'),
            transform=ax[1].transAxes, ha='right', va='top', fontsize=8.2,
            bbox=dict(boxstyle='round,pad=0.35', facecolor='#f5f8f7', edgecolor='#dce9e9', lw=1.0),
        )
        ax[1].set(
            xticks=x, xticklabels=h_labels, ylim=(0, 120),
            xlabel=tr('50 步块内位置', 'Chunk step'),
            ylabel=tr('越界数（< −100）', 'Crossings (< −100)'),
            title=tr('块内步数分解', 'Crossings by chunk step'),
        )
        ax[1].legend(fontsize=8.2, loc='upper left', frameon=True, facecolor='white', edgecolor='#dce9e9')
        for a in ax:
            a.grid(axis='y', alpha=0.16); a.set_axisbelow(True)

    elif name == 'deployment-traces':
        fig = plt.figure(figsize=(10.8, 7.2), layout='constrained')
        gs = GridSpec(3, 1, figure=fig, height_ratios=[1.15, 0.80, 1.12])
        ax0 = fig.add_subplot(gs[0])
        ax1 = fig.add_subplot(gs[1], sharex=ax0)
        ax2 = fig.add_subplot(gs[2])
        t = series['time_s']
        req, acc, st = series['requested'][:, 8], series['accepted'][:, 8], series['state'][:, 8]
        g_req, g_st = series['requested'][:, 13], series['state'][:, 13]

        ax0.axvspan(95, 290, color='#f2f6f6', alpha=0.82, zorder=0)
        ax0.axvspan(150, 160, color='#e4f1f6', alpha=0.82, zorder=0)
        ax0.plot(t, st, color='#8fa3a8', lw=0.9, label=tr('反馈', 'Feedback'), zorder=2)
        ax0.plot(t, acc, color=GREEN, lw=0.85, label=tr('Host 目标', 'Host target'), zorder=3)
        ax0.plot(t, req, color=BLUE, lw=0.75, alpha=0.9, label=tr('模型请求', 'Request'), zorder=4)
        ax0.axhline(-100, color=CORAL, ls='--', lw=1.0, label='−100', zorder=5)
        for ts_mark, lbl, xoff, yoff in [
            (0.36, '① 0.4s', 2.0, -45),
            (10.76, '② 10.8s', 13.0, 95),
            (251.12, '③ 251s', 253.5, 95),
        ]:
            ax0.axvline(ts_mark, color=CORAL, ls=':', lw=1.1, alpha=0.85, zorder=5)
            ax0.text(xoff, yoff, lbl, fontsize=8.2, color=CORAL, fontweight='bold', va='top',
                     bbox=dict(boxstyle='round,pad=0.18', facecolor='white', edgecolor='#e0beb6', alpha=0.94, lw=0.8))
        ax0.text(192, 76, tr('95–290 s 振荡（~195 s）', '95–290 s oscillation (~195 s)'),
                 ha='center', va='center', fontsize=8.6, color=INK, fontweight='semibold',
                 bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#dce9e9', alpha=0.92, lw=0.8))
        ax0.set(xlim=(0, 300), ylim=(-134, 106), ylabel='shoulder_lift',
                title=tr('FP32 100k · 300 s 真机记录', 'FP32 100k · 300 s live record'))
        ax0.legend(ncols=4, fontsize=8.2, loc='lower center', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')

        ax1.axvspan(95, 290, color='#f2f6f6', alpha=0.82, zorder=0)
        ax1.plot(t, g_req, color=BLUE, lw=0.9, label=tr('请求', 'Request'))
        ax1.plot(t, g_st, color=GREEN, lw=0.9, label=tr('反馈', 'Feedback'))
        ax1.text(192, 26, tr('夹爪闭合（≈2）', 'Gripper closed (≈2)'),
                 ha='center', va='center', fontsize=8.6, color=SLATE, fontweight='semibold')
        ax1.set(xlim=(0, 300), ylim=(-2, 52), xlabel=tr('时间（s）', 'Time (s)'),
                ylabel=tr('右夹爪', 'Right gripper'))
        ax1.legend(fontsize=8.2, loc='upper right', frameon=True, facecolor='white', edgecolor='#dce9e9')

        m = (t >= 150.0) & (t <= 160.0)
        tz, reqz, accz, stz = t[m], req[m], acc[m], st[m]
        ax2.plot(tz, stz, color=SLATE, lw=2.0, label=tr('反馈', 'Feedback'), zorder=2)
        ax2.plot(tz, accz, color=GREEN, lw=1.6, ls='--', label=tr('Host 目标', 'Host target'), zorder=3)
        ax2.plot(tz, reqz, color=BLUE, lw=1.8, label=tr('模型请求', 'Request'), zorder=4)
        ax2.axhline(-100, color=CORAL, ls=':', lw=1.0)
        for di in np.where(np.diff(reqz) < -30)[0]:
            ax2.axvline(tz[di + 1], color=CORAL, ls=':', lw=0.9, alpha=0.7)
        ax2.annotate('−10.9 → −79.1', xy=(151.62, -79.1), xytext=(150.12, -26), fontsize=8.5, color=CORAL, fontweight='bold',
                     bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#e0beb6', alpha=0.95, lw=0.8),
                     arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.1))
        ax2.set(
            xlim=(150.0, 160.0), ylim=(-106, 2),
            xlabel=tr('时间 150–160 s', 'Time 150–160 s'),
            ylabel='shoulder_lift',
            title=tr('150–160 s 放大（MAE 19.4）', '150–160 s zoom (MAE 19.4)'),
        )
        ax2.legend(ncols=3, fontsize=8.2, loc='lower right', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')
        for a in [ax0, ax1, ax2]:
            a.grid(alpha=0.22); a.set_axisbelow(True)

    elif name == 'input-responses':
        fig, ax = plt.subplots(figsize=(10.2, 5.2), layout='constrained')
        data = np.array(input_values)
        im = ax.imshow(data, cmap='GnBu', norm=LogNorm(vmin=0.001, vmax=100), aspect='auto')
        for i in range(data.shape[0]):
            for j in range(3):
                red, green, blue, _ = im.cmap(im.norm(data[i, j]))
                luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
                weight = 'bold' if data[i, j] >= 3.0 else 'normal'
                val = data[i, j]
                txt = f'{val:.1f}' if val >= 1.0 else (f'{val:.2f}' if val >= 0.05 else f'{val:.3f}')
                ax.text(j, i, txt, ha='center', va='center',
                        color='white' if luminance < 0.55 else '#17324d', fontsize=10.5, fontweight=weight)
        ax.axhline(4.5, color='white', lw=3.0)
        ax.axhline(4.5, color=INK, lw=1.0, ls='--')
        x_labels = [
            tr('① 0.4 s 起步', '① 0.4 s Start'),
            tr('② 10.8 s 前进', '② 10.8 s Moving'),
            tr('③ 251 s 振荡', '③ 251 s Oscillation'),
        ]
        y_labels = [
            tr('全部 4 图', 'All 4 cameras'),
            'wrist_right',
            'forward',
            'chest',
            'wrist_left',
            tr('全部 18D 状态', 'All 18D state'),
            tr('底盘速度', 'Base velocity'),
            tr('其他双臂', 'Other arm joints'),
            'shoulder_lift',
        ]
        ax.set(
            xticks=range(3), xticklabels=x_labels,
            yticks=range(len(y_labels)), yticklabels=y_labels,
            title=tr('单路图像与状态替换响应', 'Per-camera and state substitution response'),
        )
        ax.tick_params(axis='x', labelsize=9.6)
        ax.tick_params(axis='y', labelsize=9.6)
        bar = fig.colorbar(im, ax=ax, shrink=0.92)
        bar.set_label(tr('前 25 步变化（Host）', 'First-25-step Δ (Host)'))

    elif name == 'fast-weight-probes':
        fig, ax = plt.subplots(1, 2, figsize=(10.8, 4.4), layout='constrained')
        sw_f = fw_p1['models']['fp32']['sweep']
        sw_m = fw_p1['models']['mixed']['sweep']
        full_f = sw_f['full']['flow_loss_mean']
        full_m = sw_m['full']['flow_loss_mean']

        # Left: FP32 100k zero-retraining budget sweep (Route-only vs Compress-only vs MiTA)
        b_topk = [4, 8, 16, 32, 64]
        y_topk = [sw_f[f'topk_k{k}']['flow_loss_mean'] for k in b_topk]
        b_agent = [2, 4, 8, 16, 32]
        y_agent = [sw_f[f'agent_m{m}']['flow_loss_mean'] for m in b_agent]
        b_mita = [8, 16, 32, 64]
        y_mita = [sw_f[t]['flow_loss_mean'] for t in ['mita_m4_k4', 'mita_m4_k12', 'mita_m4_k28', 'mita_m8_k56']]

        ax[0].axhline(full_f, color='#95a8ae', ls='--', lw=1.2, label=tr('全量 305 基线', 'Full 305 baseline'))
        ax[0].plot(b_topk, y_topk, 's-', color=SLATE, lw=2.1, ms=5.5, label=tr('纯路由 (Top-k)', 'Route-only (Top-k)'))
        ax[0].plot(b_agent, y_agent, '^-', color=GREEN, lw=2.1, ms=5.8, label=tr('纯压缩 (Agent m)', 'Compress-only (Agent)'))
        ax[0].plot(b_mita, y_mita, 'o-', color=BLUE, lw=2.3, ms=5.8, label=tr('MiTA (m + k)', 'MiTA (m + k)'))
        # Overlay reusable m=4 landmark routing point at budget 20/36 to prove 4 experts match 50 private
        ax[0].scatter([16, 32], [sw_f['mita_route_m4_k16']['flow_loss_mean'], sw_f['mita_route_m4_k32']['flow_loss_mean']],
                      marker='x', s=52, color=INK, lw=1.6, zorder=6, label=tr('4 地标共享 Top-k', '4-landmark Top-k'))
        ax[0].annotate('m=4: 0.0129', xy=(4, y_agent[1]), xytext=(5.0, 0.0108), fontsize=8.4, color=GREEN, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=GREEN, lw=1.0))
        ax[0].annotate('Top-16: +18%', xy=(16, y_topk[2]), xytext=(21, 0.0172), fontsize=8.4, color=SLATE, fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=SLATE, lw=1.0))
        ax[0].set_xscale('log', base=2)
        ax[0].set(
            xticks=[2, 4, 8, 16, 32, 64], xticklabels=['2', '4', '8', '16', '32', '64'],
            xlim=(1.7, 74), ylim=(0.010, 0.0225),
            xlabel=tr('奇数 CA 预算（token 数）', 'Odd-CA budget (tokens)'),
            ylabel=tr('FP32 100k 配对 flow loss', 'FP32 100k flow loss'),
            title=tr('免重训预算扫描', 'Zero-retraining budget sweep'),
        )
        ax[0].legend(fontsize=7.9, loc='upper right', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')

        # Right: Effective attended tokens across the 8 odd CA layers (Mixed vs FP32)
        odd_layers = [1, 3, 5, 7, 9, 11, 13, 15]
        eff_m = [fw_p1['models']['mixed']['ca_by_layer'][str(L)]['eff_tokens'] for L in odd_layers]
        eff_f = [fw_p1['models']['fp32']['ca_by_layer'][str(L)]['eff_tokens'] for L in odd_layers]
        ax[1].plot(odd_layers, eff_m, 's--', color=SLATE, lw=2.0, ms=5.5, label=tr('混合 100k', 'Mixed 100k'))
        ax[1].plot(odd_layers, eff_f, 'o-', color=BLUE, lw=2.3, ms=5.8, label='FP32 100k')
        ax[1].fill_between(odd_layers, eff_m, eff_f, color='#edf5f8', alpha=0.65)
        ax[1].annotate(tr('L01 仅 2.6 个\n(40% 锚定 state)', 'L01: 2.6 tokens\n(state anchor)'),
                       xy=(1, eff_f[0]), xytext=(2.8, 13.5), fontsize=8.3, color=BLUE, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.0))
        ax[1].annotate('FP32: 53.7\nMix: 45.1', xy=(15, eff_f[-1]), xytext=(9.4, 48.0), fontsize=8.4, color=INK, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.0))
        ax[1].set(
            xticks=odd_layers, xticklabels=[f'L{L:02d}' for L in odd_layers],
            xlim=(0.4, 15.6), ylim=(0, 60),
            xlabel=tr('奇数 CA 层', 'Odd CA layer'),
            ylabel=tr('有效关注 token 数 exp(H)', 'Effective tokens exp(H)'),
            title=tr('逐层注意力宽度（浅窄深宽）', 'Layerwise effective width'),
        )
        ax[1].legend(fontsize=8.4, loc='upper left', frameon=True, facecolor='white', edgecolor='#dce9e9')
        for a in ax:
            a.grid(axis='y', alpha=0.18); a.set_axisbelow(True)

    else:  # live-routing
        fig = plt.figure(figsize=(11.0, 4.3), layout='constrained')
        gs = GridSpec(1, 3, figure=fig, width_ratios=[1.25, 1.05, 0.88])
        ax0 = fig.add_subplot(gs[0])
        ax1 = fig.add_subplot(gs[1])
        ax2 = fig.add_subplot(gs[2])

        # Panel 1: L01 CA attention mass breakdown at 4 live moments (dramatic state collapse at 0.4s!)
        keys4 = ['start_underflow', 'base_moving', 'active_open_grasp', 'oscillation_251s']
        ylbl = [
            tr('0.4s 起步\n(49σ)', '0.4s Start\n(49σ)'),
            tr('10.8s 前进', '10.8s Move'),
            tr('51s 开爪', '51s Open'),
            tr('251s 振荡', '251s Osc.'),
        ]
        segs = [
            ('state', tr('state (1)', 'state (1)'), BLUE),
            ('wrist_right', 'wrist_right', GREEN),
            ('forward', 'forward', '#8dc2b0'),
            ('other_cams', tr('其余 2 图', '2 cams'), '#b7ccce'),
            ('text', tr('文本', 'text'), '#e1ecec'),
        ]
        y = np.arange(4)
        left = np.zeros(4)
        for skey, slbl, scol in segs:
            vals = []
            for k in keys4:
                sm = fw_p2['cases'][k]['ca_by_layer']['1']['source_mass']
                if skey == 'other_cams':
                    vals.append((sm['chest'] + sm['wrist_left']) * 100)
                else:
                    vals.append(sm[skey] * 100)
            vals = np.array(vals)
            ax0.barh(y, vals, left=left, height=0.56, color=scol, edgecolor='white', lw=0.6, label=slbl)
            for idx_r, v in enumerate(vals):
                if v >= 16:
                    ax0.text(left[idx_r] + v / 2, idx_r, f'{v:.0f}%', ha='center', va='center',
                             fontsize=8.2, color='white' if scol in (BLUE, GREEN) else INK, fontweight='bold')
            left += vals
        ax0.annotate('state 0.4%', xy=(0.8, 0), xytext=(14, -0.58), fontsize=8.3, color=CORAL, fontweight='bold',
                     arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.0))
        ax0.set(
            yticks=y, yticklabels=ylbl, xlim=(0, 100), ylim=(-0.78, 3.65),
            xlabel=tr('L01 注意力占比（%）', 'L01 attention (%)'),
            title=tr('首层 CA 来源拆分', 'L01 CA split'),
        )
        ax0.invert_yaxis()
        ax0.legend(ncols=3, fontsize=7.4, loc='lower center', bbox_to_anchor=(0.5, -0.34), frameon=False)

        # Panel 2: Cross-frame Top-16 routing mIoU across odd CA layers
        odd_layers = [1, 3, 5, 7, 9, 11, 13, 15]
        m_saw = [fw_p2['routing_miou_pairs']['sawtooth_before_vs_after'][str(L)] for L in odd_layers]
        m_wr = [fw_p2['routing_miou_pairs']['oscillation_vs_swap_wrist_right'][str(L)] for L in odd_layers]
        ax1.plot(odd_layers, m_saw, 'o-', color=GREEN, lw=2.2, ms=5.2, label=tr('跳变前后 40 ms', 'Across 40 ms drop'))
        ax1.plot(odd_layers, m_wr, 's-', color=BLUE, lw=2.2, ms=5.2, label=tr('251s 仅换 wrist_right', '251s swap wrist_right'))
        ax1.annotate('0.84', xy=(11, m_saw[5]), xytext=(7.2, 0.90), fontsize=8.5, color=GREEN, fontweight='bold')
        ax1.annotate('L13: 0.35', xy=(13, m_wr[6]), xytext=(6.8, 0.34), fontsize=8.5, color=BLUE, fontweight='bold',
                     arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.0))
        ax1.set(
            xticks=odd_layers, xticklabels=[f'L{L:02d}' for L in odd_layers],
            xlim=(0.4, 15.6), ylim=(0.22, 1.0),
            xlabel=tr('奇数 CA 层', 'Odd CA layer'),
            ylabel='Top-16 mIoU',
            title=tr('跨帧路由一致性', 'Cross-frame routing mIoU'),
        )
        ax1.legend(ncols=1, fontsize=7.6, loc='lower center', bbox_to_anchor=(0.5, -0.36), frameon=False)
        ax1.grid(axis='y', alpha=0.18); ax1.set_axisbelow(True)
        ax1.tick_params(axis='x', labelsize=8.0)

        # Panel 3: 251s wrist_right camera frame with L11 8x8 Top-16 selection overlay
        thumb = np.asarray(Image.open(root / 'fast_weights/thumbs/oscillation_251s_wrist_right.png'))
        grid_l11 = np.array(fw_p2['cases']['oscillation_251s']['ca_by_layer']['11']['cam_top16_8x8']['wrist_right']) * 100
        ax2.imshow(thumb, extent=[0, 8, 8, 0], aspect='auto')
        im2 = ax2.imshow(grid_l11, cmap='GnBu', alpha=0.58, extent=[0, 8, 8, 0], vmin=0, vmax=70, interpolation='nearest')
        # Highlight peak cell (4, 4) right on the red plush toy
        rect_pk = plt.Rectangle((4, 4), 1, 1, fill=False, edgecolor=CORAL, lw=2.2)
        ax2.add_patch(rect_pk)
        ax2.text(4.5, 3.65, '70%', ha='center', va='bottom', fontsize=8.8, color='white', fontweight='bold',
                 bbox=dict(boxstyle='round,pad=0.15', facecolor=CORAL, edgecolor='none', alpha=0.92))
        ax2.set(xticks=[], yticks=[], title=tr('251s 右腕 L11 热点', '251s wrist_right L11'))
        cbar = fig.colorbar(im2, ax=ax2, shrink=0.82, pad=0.03)
        cbar.set_label(tr('Top-16 命中 (%)', 'Top-16 hit (%)'), fontsize=8.2)
        cbar.ax.tick_params(labelsize=7.8)

    if language == 'en':
        save_svg(fig, out / f'{name}.svg')
    else:
        save_svg(fig, out / f'{name}-zh.svg')
        if args.note_output:
            fig.savefig(args.note_output / f'SmolVLA-{note_name}.png', dpi=180, facecolor='white')
    plt.close(fig)


for name, note in [
    ('precision-fit', '精度拟合'),
    ('module-swaps', '模块交换'),
    ('boundary-replay', '边界预测'),
    ('deployment-traces', '真机轨迹'),
    ('input-responses', '输入响应'),
    ('fast-weight-probes', '快权重探针'),
    ('live-routing', '真机路由'),
]:
    for language in ['en', 'zh']:
        figure(language, name, note)

print('Exported 7 decluttered bilingual SVG pairs, Obsidian PNGs, and v3 empirical summary.')
