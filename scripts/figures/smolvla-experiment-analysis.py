"""Export SmolVLA empirical findings and bilingual figures from archived evidence.

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

# Compute exact 4-group relative L2 drift & layerwise drift from parameter_inventory.csv
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

# Expanded 9-row input-replacement matrix (5 visual + 4 state)
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

# Extract start-window shoulder_lift targets & predictions for boundary density plot
start_idx = [i for i, p in enumerate(plans['plan90']) if p['phase'] == 'start']
assert len(start_idx) == 30
pA_start = cont_err['predictions'][0, start_idx, :, 8][cont_err['valid'][0, start_idx]]
pC_start = cont_err['predictions'][1, start_idx, :, 8][cont_err['valid'][1, start_idx]]
tgt_start = (cont_err['predictions'][1, start_idx, :, 8] - cont_err['errors'][1, start_idx, :, 8])[cont_err['valid'][1, start_idx]]

summary = dict(
    schema=2,
    compiled_on='2026-11-25',
    task='Pick up floor toys and place them into the box held by the left arm',
    protocol=dict(
        dataset_episodes=150, dataset_frames=155727, validation_episodes=0,
        same_task_initialization=True, cameras=4, state_action_dim=18, internal_action_dim=32,
        loss_supervised_dim=18, flow_windows=16, flow_draws=32, prediction_windows=90,
        uniform_comparison_compute='FP32 weights and compute; autocast and TF32 disabled',
        precision_comparison='A/B change training storage, optimizer moments and compute recipe together',
        continuation='C adds 20k updates to B at constant learning rate 5e-7',
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
        model='B · FP32 100k', frames=ev['frames'], span_s=ev['recorded_span_s'],
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
]:
    summary['source_sha256'][name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
(out / 'precision-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
assert not any(s in (out / 'precision-summary.json').read_text() for s in ['/home/', '192.168.', 'password', 'anncatto@'])

# Native Anncatto editorial palette across ALL SmolVLA figures:
# Mixed 100k = SLATE (#556b73), FP32 100k = BLUE (#237ab2), FP32 120k = GREEN (#4b9c80), Alert = CORAL (#b55d4c)
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
    'svg.hashsalt': 'smolvla-precision-20261125',
    'axes.unicode_minus': False,
})


def save_svg(fig, target):
    fig.savefig(target, metadata={'Date': None}, facecolor='white')
    target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines()) + '\n')


def figure(language, name, note_name):
    tr = lambda zh, en: zh if language == 'zh' else en

    if name == 'precision-fit':
        fig, ax = plt.subplots(1, 2, figsize=(11.0, 4.7), layout='constrained')
        # Left: 5k -> 100k replay trajectory showing cosine-decay stalling in A vs continued learning in B
        steps_A = [r['step'] / 1000 for r in rep if r['version'] == 'mixed']
        loss_A = [r['flow_loss_mean'] for r in rep if r['version'] == 'mixed']
        steps_B = [r['step'] / 1000 for r in rep if r['version'] == 'fp32']
        loss_B = [r['flow_loss_mean'] for r in rep if r['version'] == 'fp32']

        ax[0].axvspan(50, 100, color='#faf1ef', alpha=0.85, zorder=0)
        ax[0].plot(steps_A, loss_A, 'o-', color=SLATE, lw=2.2, ms=5.8, label=tr('混合存储（5k–100k）', 'Mixed storage (5k–100k)'))
        ax[0].plot(steps_B, loss_B, 'o-', color=BLUE, lw=2.2, ms=5.8, label=tr('全 FP32（5k–100k）', 'Full FP32 (5k–100k)'))
        ax[0].plot([100, 120], [loss_B[-1], flow['C']], 'D--', color=GREEN, lw=1.8, ms=5.8, zorder=5,
                   label=tr('FP32 续训至 120k（走平 0.013）', 'FP32 extended to 120k (flat 0.013)'))
        ax[0].scatter([100], [flow['A']], marker='s', s=42, facecolors='white', edgecolors=SLATE, lw=1.8, zorder=5,
                      label=tr('混合 100k 统一 FP32 核对（0.027）', 'Mixed 100k FP32 check (0.027)'))
        ax[0].annotate(tr('20k 已低于混合\n50k–100k 再降 39%', 'Lower by 20k;\n−39% over 50k–100k'),
                       xy=(80, 0.0135), xytext=(32, 0.0048), fontsize=8.1, color=BLUE, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=BLUE, lw=1.1))
        ax[0].annotate(tr('衰减期停滞\n仅降 1.8%', 'Plateaus in decay\n(−1.8% only)'),
                       xy=(76, 0.0274), xytext=(56, 0.0326), fontsize=8.1, color=CORAL, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.1))
        ax[0].set(
            xticks=[5, 20, 50, 80, 100, 120],
            xticklabels=['5k', '20k', '50k', '80k', '100k', '120k'],
            xlim=(0, 126), ylim=(0.0, 0.052),
            xlabel=tr('150 回合阶段训练步数', 'Training steps (150-episode stage)'),
            ylabel=tr('16 窗口 × 2 抽样配对 flow loss', 'Matched flow loss (16 windows × 2 draws)'),
            title=tr('收敛曲线：20k 反超、衰减期分化、100k→120k 走平', 'Loss curves: FP32 leads by 20k and converges by 100k'),
        )
        ax[0].legend(fontsize=7.4, loc='upper right', frameon=True, facecolor='white', framealpha=0.94, edgecolor='#dce9e9')

        # Right: 4-group relative L2 weight change from initialization
        g_labels = [
            tr('专家 RMSNorm\n(32 张量 · 混合存 BF16)', 'Expert RMSNorm\n(32 · BF16 in Mixed)'),
            tr('专家主体\n(96.6M · 混合存 BF16)', 'Expert body\n(96.6M · BF16 in Mixed)'),
            tr('外部投影\n(1.6M · 均存 FP32)', 'External proj\n(1.6M · FP32)'),
            tr('奇数 CA K,V\n(1.6M · 均存 FP32)', 'Odd CA K,V\n(1.6M · FP32)'),
        ]
        vals_A = [group_drift['A'][k] * 100 for k in ['layernorm', 'expert_body', 'external_proj', 'ca_kv']]
        vals_B = [group_drift['B'][k] * 100 for k in ['layernorm', 'expert_body', 'external_proj', 'ca_kv']]
        y = np.arange(len(g_labels))
        h = 0.35
        bA = ax[1].barh(y + h / 2, vals_A, height=h, color=SLATE, label=tr('混合 100k', 'Mixed 100k'))
        bB = ax[1].barh(y - h / 2, vals_B, height=h, color=BLUE, label=tr('FP32 100k', 'FP32 100k'))
        ax[1].bar_label(bA, labels=[f'{v:.1f}%' for v in vals_A], padding=4, fontsize=8.5, color=SLATE, fontweight='semibold')
        ax[1].bar_label(bB, labels=[f'{v:.1f}%' for v in vals_B], padding=4, fontsize=8.5, color=BLUE, fontweight='semibold')
        ax[1].annotate(tr('混合主体变化小，FP32 K,V 达 FP32 的 2.5×', 'Small BF16 change; 2.5× FP32 K,V in Mixed'),
                       xy=(17.3, 3.18), xytext=(8.2, 2.48), fontsize=8.0, color=CORAL, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.1))
        ax[1].set(
            yticks=y, yticklabels=g_labels, xlim=(0, 22.5),
            xlabel=tr('相对共同初始化的权重 L2 变化率（%）', 'Relative L2 weight change from init (%)'),
            title=tr('四类参数：混合集中在 FP32 张量，FP32 集中在主体', 'Groups: Mixed updates FP32; FP32 updates body'),
        )
        ax[1].legend(fontsize=8.2, loc='lower right', frameon=True, facecolor='white', edgecolor='#dce9e9')
        fig.suptitle(tr('学习率衰减期混合存储停滞与两类参数的 L2 变化', 'Late-stage plateau in Mixed 100k and L2 weight change'), fontsize=13.2, fontweight='semibold')
        ax[0].grid(axis='y', alpha=0.18); ax[0].set_axisbelow(True)
        ax[1].grid(axis='x', alpha=0.18); ax[1].set_axisbelow(True)

    elif name == 'module-swaps':
        fig, ax = plt.subplots(1, 2, figsize=(11.0, 4.7), layout='constrained')
        layers = np.arange(16)
        # Shade odd CA layers consistently on BOTH panels!
        for a in ax:
            for odd in range(1, 16, 2):
                a.axvspan(odd - 0.42, odd + 0.42, color='#edf5f8', alpha=0.72, zorder=0)

        # Left: Layer-by-layer relative L2 change from initialization
        odd_x = [p[0] for p in layer_drift['A_ca_kv']]
        odd_A = [p[1] for p in layer_drift['A_ca_kv']]
        odd_B = [p[1] for p in layer_drift['B_ca_kv']]
        ax[0].plot(layers, layer_drift['A_body'], 's-', color=SLATE, lw=2.0, ms=4.5, label=tr('混合 · BF16 层主体（3.5–3.8%）', 'Mixed · BF16 body (3.5–3.8%)'))
        ax[0].plot(layers, layer_drift['B_all'], 'o-', color=BLUE, lw=2.1, ms=4.5, label=tr('FP32 · 全层主体（8.1–12.4%）', 'FP32 · full layer (8.1–12.4%)'))
        ax[0].plot(odd_x, odd_A, 'D--', color=CORAL, lw=2.0, ms=5.5, label=tr('混合 · 奇数 CA FP32 K,V（13–23%）', 'Mixed · odd CA K,V (13–23%)'))
        ax[0].plot(odd_x, odd_B, '^:', color='#5fa0c8', lw=1.6, ms=4.5, label=tr('FP32 · 奇数 CA K,V（6–8%）', 'FP32 · odd CA K,V (6–8%)'))
        ax[0].annotate('L15 K,V: 23%', xy=(15, odd_A[-1]), xytext=(10.5, 24.5), fontsize=8.3, color=CORAL, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.0))
        ax[0].set(
            xticks=layers, xlim=(-0.6, 15.6), ylim=(0, 27.5),
            xlabel=tr('动作专家层号（浅蓝底为奇数 CA 层，白底为偶数 SA 层）', 'Action-expert layer (shaded: odd CA; white: even SA)'),
            ylabel=tr('相对共同初始化的 L2 变化率（%）', 'Relative L2 change from init (%)'),
            title=tr('逐层权重变化：混合模型的奇数 CA 层 K,V 随深度增大', 'Layerwise change: Mixed odd CA K,V grows with depth'),
        )
        ax[0].legend(fontsize=7.5, loc='upper left', frameon=True, facecolor='white', framealpha=0.94, edgecolor='#dce9e9')

        # Right: 16 bidirectional single-layer swaps
        ax[1].axhspan(0.84, 1.0, color='#eef6f1', alpha=0.9, zorder=0)
        ax[1].axhline(1.0, color=SLATE, ls='--', lw=1.1, zorder=1)
        for model, color, lbl in [
            ('A', SLATE, tr('混合换入 FP32 单层（L05/06/07/09 降 loss）', 'Mixed ← FP32 layer (L05/06/07/09 lower)')),
            ('B', BLUE, tr('FP32 换入混合单层（全部升高）', 'FP32 ← Mixed layer (all higher)')),
        ]:
            rows = [r for r in sw['records'] if r['base'] == model and r['swapped'].startswith('layer_')]
            ratio = [r['mean_loss'] / float(np.mean(sw['baselines'][model])) for r in rows]
            ax[1].plot(layers, ratio, 'o-', color=color, lw=2.0, ms=4.5, label=lbl, zorder=3)

        ax[1].annotate(tr('L01 首 CA\nFP32←混合 1.97×', 'L01 first CA\nFP32←Mix 1.97×'),
                       xy=(1, 1.968), xytext=(2.2, 1.70), fontsize=7.9, color=CORAL, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.0))
        ax[1].annotate(tr('L08\n混合←FP32 1.87×', 'L08\nMix←FP32 1.87×'),
                       xy=(8, 1.874), xytext=(9.3, 1.82), fontsize=7.9, color=CORAL, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.0))
        ax[1].annotate(tr('L15 末 CA\nFP32←混合 1.81×', 'L15 final CA\nFP32←Mix 1.81×'),
                       xy=(15, 1.809), xytext=(10.7, 1.56), fontsize=7.9, color=CORAL, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.0))
        ax[1].annotate(tr('L06 −7.4%', 'L06 −7.4%'),
                       xy=(6, 0.9257), xytext=(3.8, 0.855), fontsize=8.0, color=GREEN, fontweight='semibold',
                       arrowprops=dict(arrowstyle='->', color=GREEN, lw=1.0))
        ax[1].set(
            xticks=layers, xlim=(-0.6, 15.6), ylim=(0.84, 2.32),
            xlabel=tr('被替换的专家层（浅蓝底为奇数 CA 层）', 'Replaced expert layer (shaded: odd CA)'),
            ylabel=tr('换层 loss / 本模型基线 loss', 'Swap loss / native baseline loss'),
            title=tr('16 层双向替换：首尾 CA 与 L08 升幅最大，部分中段层降 loss', '16 swaps: L01, L08 & L15 rise most; mid layers lower Mixed'),
        )
        ax[1].legend(fontsize=7.6, loc='upper center', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')
        fig.suptitle(tr('逐层权重变化与双向换层结果：首尾 CA 层替换后 loss 升幅最大', 'Layerwise L2 change and bidirectional single-layer swap ratios'), fontsize=13.2, fontweight='semibold')
        for a in ax:
            a.grid(axis='y', alpha=0.16); a.set_axisbelow(True)
            a.tick_params(axis='x', labelsize=8.5)

    elif name == 'boundary-replay':
        fig, ax = plt.subplots(1, 2, figsize=(11.0, 4.6), layout='constrained')
        # Left: Start-window shoulder_lift distribution around -100 lower bound!
        bins = np.linspace(-103.0, -95.0, 49)
        ax[0].axvspan(-103.0, -100.0, color='#faf1ef', alpha=0.9, zorder=0)
        ax[0].axvline(-100.0, color=CORAL, ls='--', lw=1.6, zorder=4, label=tr('Host 标定下限 −100', 'Host lower bound −100'))
        ax[0].hist(tgt_start, bins=bins, histtype='stepfilled', color='#dce9e9', alpha=0.65, edgecolor='#9eb4b7', lw=1.2,
                   label=tr('示范目标（−99.7 ~ −99.0）', 'Demo targets (−99.7 to −99.0)'))
        ax[0].hist(pA_start, bins=bins, histtype='step', color=SLATE, lw=2.0,
                   label=tr('混合 100k（越界 390，最深 −102.4）', 'Mixed 100k (390 crossings, min −102.4)'))
        ax[0].hist(pC_start, bins=bins, histtype='step', color=GREEN, lw=2.1,
                   label=tr('FP32 120k（越界 153，最深 −101.2）', 'FP32 120k (153 crossings, min −101.2)'))
        top_cnt = int(np.histogram(tgt_start, bins=bins)[0].max())
        ax[0].text(-101.55, top_cnt * 0.65, tr('越界区\n< −100', 'Out-of-range\n< −100'), ha='center', va='center', fontsize=8.5, color=CORAL, fontweight='semibold')
        ax[0].set(
            xlim=(-103.0, -95.0), ylim=(0, max(420, int(top_cnt * 1.15))),
            xlabel=tr('起始窗口右臂 shoulder_lift（Host 坐标单位）', 'Start-window right shoulder_lift (Host units)'),
            ylabel=tr('预测位置数（30 起始窗口 × 50 步）', 'Prediction positions (30 start windows × 50 steps)'),
            title=tr('全部越界发生在贴边起始窗口（其余两阶段为 0）', 'All crossings occur in boundary-adjacent start windows'),
        )
        ax[0].legend(fontsize=7.6, loc='upper right', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')

        # Right: Horizon distribution of crossings (0-10 .. 40-50) + clipping note
        hA = [d['count'] for d in boundary['models']['old']['horizon_counts']]
        hC = [d['count'] for d in boundary['models']['fp32_120k']['horizon_counts']]
        h_labels = ['0–9', '10–19', '20–29', '30–39', '40–49']
        x = np.arange(5)
        wbar = 0.36
        bA = ax[1].bar(x - wbar / 2, hA, width=wbar, color=SLATE, label=tr('混合 100k（共 390 / 4,500）', 'Mixed 100k (390 / 4,500)'))
        bC = ax[1].bar(x + wbar / 2, hC, width=wbar, color=GREEN, label=tr('FP32 120k（共 153 / 4,500）', 'FP32 120k (153 / 4,500)'))
        ax[1].bar_label(bA, padding=3, fontsize=8.5, color=SLATE, fontweight='semibold')
        ax[1].bar_label(bC, padding=3, fontsize=8.5, color=GREEN, fontweight='semibold')
        ax[1].text(
            0.98, 0.96,
            tr('离线仅裁剪 FP32 120k 至 [−100,100]：\nMAE 1.25 → 1.24（仅降 0.6%）',
               'Offline clip of FP32 120k to [−100,100]:\nMAE 1.25 → 1.24 (−0.6% only)'),
            transform=ax[1].transAxes, ha='right', va='top', fontsize=8.0,
            bbox=dict(boxstyle='round,pad=0.4', facecolor='#f5f8f7', edgecolor='#dce9e9', lw=1.0),
        )
        ax[1].set(
            xticks=x, xticklabels=h_labels, ylim=(0, 128),
            xlabel=tr('50 步动作块内的预测步位置', 'Step index within 50-step predicted chunk'),
            ylabel=tr('低于 −100 的越界位置数', 'Positions below −100'),
            title=tr('按预测步分解：FP32 120k 中段越界减少约 75%', 'By horizon bin: FP32 120k cuts mid-chunk ~75%'),
        )
        ax[1].legend(fontsize=7.8, loc='upper left', frameon=True, facecolor='white', edgecolor='#dce9e9')
        fig.suptitle(tr('贴边起始窗口的越界分布与离线裁剪核对', 'Start-window boundary crossings and offline clipping check'), fontsize=13.5, fontweight='semibold')
        for a in ax:
            a.grid(axis='y', alpha=0.16); a.set_axisbelow(True)

    elif name == 'deployment-traces':
        fig = plt.figure(figsize=(11.0, 7.6), layout='constrained')
        gs = GridSpec(3, 1, figure=fig, height_ratios=[1.15, 0.85, 1.15])
        ax0 = fig.add_subplot(gs[0])
        ax1 = fig.add_subplot(gs[1], sharex=ax0)
        ax2 = fig.add_subplot(gs[2])
        t = series['time_s']
        req, acc, st = series['requested'][:, 8], series['accepted'][:, 8], series['state'][:, 8]
        g_req, g_st = series['requested'][:, 13], series['state'][:, 13]

        # Panel 1: Full 300s shoulder_lift with stuck region, zoom highlight, and 3 intervention markers!
        ax0.axvspan(95, 290, color='#faf1ef', alpha=0.72, zorder=0)
        ax0.axvspan(150, 160, color='#dceef6', alpha=0.72, zorder=0)
        ax0.plot(t, st, color='#8fa3a8', lw=0.9, label=tr('调用前反馈', 'Pre-request feedback'), zorder=2)
        ax0.plot(t, acc, color=GREEN, lw=0.85, label=tr('Host 接受目标', 'Host accepted'), zorder=3)
        ax0.plot(t, req, color=BLUE, lw=0.75, alpha=0.9, label=tr('模型请求', 'Policy request'), zorder=4)
        ax0.axhline(-100, color=CORAL, ls='--', lw=1.0, label=tr('标定下限 −100', 'Lower bound −100'), zorder=5)
        for ts_mark, lbl_zh, lbl_en, xoff, yoff in [
            (0.36, '① 0.4s\n起步 −119.6', '① 0.4s\n−119.6', 2.5, -52),
            (10.76, '② 10.8s\n底盘移动', '② 10.8s\nBase moving', 13.5, 92),
            (251.12, '③ 251s\n锯齿振荡期', '③ 251s\nOscillation', 253.5, 92),
        ]:
            ax0.axvline(ts_mark, color=CORAL, ls=':', lw=1.1, alpha=0.85, zorder=5)
            ax0.text(xoff, yoff, tr(lbl_zh, lbl_en), fontsize=7.6, color=CORAL, fontweight='semibold', va='top',
                     bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#e0beb6', alpha=0.95, lw=0.8))
        ax0.text(192, 68, tr('95–290 s 持续锯齿振荡（约 195 s）\n蓝框 150–160 s 见下方放大',
                             '95–290 s sustained sawtooth (~195 s)\nShaded 150–160 s zoomed below'),
                 ha='center', va='center', fontsize=8.3, color=INK,
                 bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#dce9e9', alpha=0.94, lw=0.8))
        ax0.set(xlim=(0, 300), ylim=(-136, 104), ylabel=tr('右臂 shoulder_lift', 'Right shoulder_lift'),
                title=tr('FP32 100k 真机 300 秒全过程（标注三个观测替换时刻）', 'FP32 100k · 300-second robot record (with 3 substitution timestamps)'))
        ax0.legend(ncols=4, fontsize=7.9, loc='lower center', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')

        # Panel 2: Full 300s right gripper
        ax1.axvspan(95, 290, color='#faf1ef', alpha=0.72, zorder=0)
        ax1.plot(t, g_req, color=BLUE, lw=0.9, label=tr('右夹爪请求', 'Gripper request'))
        ax1.plot(t, g_st, color=GREEN, lw=0.9, label=tr('调用前反馈', 'Pre-request feedback'))
        ax1.text(192, 26, tr('95–290 s 振荡期夹爪保持闭合（≈2）', 'Gripper stays closed (≈2) during 95–290 s oscillation'),
                 ha='center', va='center', fontsize=8.3, color=CORAL, fontweight='semibold')
        ax1.set(xlim=(0, 300), ylim=(-2, 52), xlabel=tr('Host 时间（秒）', 'Host time (s)'),
                ylabel=tr('右夹爪开度 (0–100)', 'Right gripper (0–100)'))
        ax1.legend(fontsize=8.0, loc='upper right', frameon=True, facecolor='white', edgecolor='#dce9e9')

        # Panel 3: Zoomed 150–160 s sawtooth waveform!
        m = (t >= 150.0) & (t <= 160.0)
        tz, reqz, accz, stz = t[m], req[m], acc[m], st[m]
        ax2.plot(tz, stz, color=SLATE, lw=2.0, label=tr('调用前反馈（物理臂滞后在 −50~−80 摆动）', 'Pre-request feedback (arm lags between −50 & −80)'), zorder=2)
        ax2.plot(tz, accz, color=GREEN, lw=1.6, ls='--', label=tr('Host 接受目标（交接处滞后约 2 帧）', 'Host accepted (~2-frame lag at drops)'), zorder=3)
        ax2.plot(tz, reqz, color=BLUE, lw=1.8, label=tr('模型请求（每 ~0.9 s 升至 −10 后阶跃回落至 −98）', 'Policy request (ramps to −10, drops back to −98 every ~0.9 s)'), zorder=4)
        ax2.axhline(-100, color=CORAL, ls=':', lw=1.0)
        drops = np.where(np.diff(reqz) < -30)[0]
        for di in drops:
            ax2.axvline(tz[di + 1], color=CORAL, ls=':', lw=0.9, alpha=0.7)
        ax2.annotate(tr('块交接阶跃回落\n−10.9 → −79.1', 'Chunk-handoff drop\n−10.9 → −79.1'),
                     xy=(151.62, -79.1), xytext=(150.12, -24), fontsize=8.2, color=CORAL, fontweight='semibold',
                     bbox=dict(boxstyle='round,pad=0.25', facecolor='white', edgecolor='#e0beb6', alpha=0.95, lw=0.8),
                     arrowprops=dict(arrowstyle='->', color=CORAL, lw=1.1))
        ax2.set(
            xlim=(150.0, 160.0), ylim=(-106, 2),
            xlabel=tr('局部放大：Host 时间 150–160 秒', 'Zoomed Host time: 150–160 s'),
            ylabel=tr('右臂 shoulder_lift', 'Right shoulder_lift'),
            title=tr('局部放大（150–160 s）：周期性块交接阶跃回落造成较大请求—反馈差（MAE 19.4）',
                     'Zoom (150–160 s): periodic chunk-handoff drops drive the 19.4 request–feedback MAE'),
        )
        ax2.legend(fontsize=7.6, loc='lower right', frameon=True, facecolor='white', framealpha=0.95, edgecolor='#dce9e9')
        for a in [ax0, ax1, ax2]:
            a.grid(alpha=0.22); a.set_axisbelow(True)

    else:  # input-responses
        fig, ax = plt.subplots(figsize=(10.8, 5.6), layout='constrained')
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
        # Clean horizontal separator between Visual (rows 0..4) and State (rows 5..8)
        ax.axhline(4.5, color='white', lw=3.0)
        ax.axhline(4.5, color=INK, lw=1.0, ls='--')
        x_labels = [
            tr('① 0.36 s\n起步越界（req −119.6）', '① 0.36 s\nStart underflow (−119.6)'),
            tr('② 10.76 s\n底盘前进（x.vel 0.145）', '② 10.76 s\nBase moving (x.vel 0.145)'),
            tr('③ 251.12 s\n锯齿振荡期（右腕见玩偶）', '③ 251.12 s\nOscillation (toy in wrist)'),
        ]
        y_labels = [
            tr('全部四路图像', 'All 4 camera images'),
            tr('单换 wrist_right 图像', 'wrist_right image only'),
            tr('单换 forward 图像', 'forward image only'),
            tr('单换 chest 图像', 'chest image only'),
            tr('单换 wrist_left 图像', 'wrist_left image only'),
            tr('全部 18 维状态', 'All 18D robot state'),
            tr('单换底盘速度状态', 'Base velocity state only'),
            tr('单换其他双臂关节', 'Other arm joints only'),
            tr('单换 shoulder_lift 自身', 'shoulder_lift self only'),
        ]
        ax.set(
            xticks=range(3), xticklabels=x_labels,
            yticks=range(len(y_labels)), yticklabels=y_labels,
            title=tr('三个现场时刻下，单路相机与分通道状态替换对右臂 shoulder_lift 输出的影响',
                     'Effect of per-camera and per-channel state substitutions on right shoulder_lift'),
        )
        ax.tick_params(axis='x', labelsize=9.2)
        ax.tick_params(axis='y', labelsize=9.2)
        bar = fig.colorbar(im, ax=ax, shrink=0.92)
        bar.set_label(tr('前 25 步输出平均绝对变化（Host 单位，对数色标）', 'Mean absolute change over first 25 steps (Host units, log scale)'))

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
]:
    for language in ['en', 'zh']:
        figure(language, name, note)

print('Exported five upgraded bilingual SVG pairs, Obsidian PNGs, and v2 empirical summary.')
