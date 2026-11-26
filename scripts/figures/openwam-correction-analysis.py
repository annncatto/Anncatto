"""Export public OpenWAM correction comparisons and bilingual figures from archived evidence.

Usage:
  python scripts/figures/openwam-correction-analysis.py EVIDENCE_DIRECTORY [--note-output DIR]
Only explicit aggregate fields and source hashes enter the public summary.
"""
import argparse
import hashlib
import json
from pathlib import Path
import statistics

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path)
parser.add_argument('--note-output', type=Path)
args = parser.parse_args()

root = args.evidence
out = Path(__file__).resolve().parents[2] / 'content/images/openwam-slots'
out.mkdir(parents=True, exist_ok=True)
if args.note_output:
    args.note_output.mkdir(parents=True, exist_ok=True)

folders = {
    'task_finetune': 'openwam_color_sort_155ep_ft_20261106',
    'foundation_restart': 'openwam_color_sort_155ep_base_4gpu_20261109',
}

# Native Anncatto palette
INK = '#273b43'
MUTED = '#61747b'
LINE = '#dce9e9'
SOFT = '#f8fbfa'
ORIG = '#95a8ae'
FT = '#556b73'
RESTART = '#237ab2'
GREEN = '#4b9c80'

colors = dict(task_finetune=FT, foundation_restart=RESTART)


def read(path):
    return json.loads(path.read_text())


def records(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


weights = read(root / 'weights.json')
data = read(root / 'data.json')
projection = read(root / 'projection.json')
task = read(root / 'task-contract.json')
assert len(task['tasks']) == 1
assert data['groups']['new_train']['frames'] == 22338

# Also read diagnostic window MAE directly from archived network probes (same evidence root)
net_mae = {}
for m in ['old', 'ft', 'base']:
    nd = read(root / 'network' / f'{m}.json')
    base_rows = [r for r in nd['replay'] if r['variant'] == 'baseline']
    net_mae[m] = {
        'by_window': [float(np.mean([r['arm12_mae'] for r in base_rows if r['window'] == i])) for i in range(4)],
        'added_mean': float(np.mean([r['arm12_mae'] for r in base_rows if r['window'] > 0])),
    }

summary = dict(
    schema=1,
    verified_on='2026-11-19',
    dataset=dict(
        total_episodes=155,
        original_episodes=115,
        added_episodes=40,
        train_episodes=149,
        validation_episodes=6,
        train_frames=79088,
        validation_frames=3815,
        added_train_frames=22338,
        added_train_fraction=22338 / 79088,
        validation_source='original demonstrations',
        task_prompt_count=1,
        task_prompt=task['tasks'][0]['__index_level_0__'],
    ),
    runs={},
    weight_comparisons={},
    state_projection={},
    source_sha256={},
)

curves = {}
manifests = []
for key, name in folders.items():
    run = root / 'source/runs' / name
    train, val = records(run / 'metrics.jsonl'), records(run / 'validation-metrics.jsonl')
    assert [r['step'] for r in train] == list(range(1, 10001))
    cfg = read(run / 'train.json')
    manifest = read(run / 'checkpoints/010000/pretrained_model/policy.json')
    manifests.append(manifest)
    mae = read(run / 'offline-evaluation.json')
    channels = mae['mae_by_action']
    joints = [value for field, value in channels.items() if field.endswith('.pos') and 'gripper' not in field]
    assert len(joints) == 12
    summary['runs'][key] = dict(
        initialization='115-demonstration task model, 10k updates' if key == 'task_finetune' else 'official foundation, step 154000',
        new_optimizer=True,
        current_steps=10000,
        cumulative_task_steps=20000 if key == 'task_finetune' else 10000,
        learning_rate=cfg['optimizer']['lr'],
        batch_size=cfg['batch_size'] * cfg['world_size'],
        seed=cfg['seed'],
        parameter_dtype='bfloat16',
        compute_dtype='bfloat16',
        optimizer_moment_dtype='bfloat16',
        first_100_action_loss=statistics.mean(r['metrics']['loss_action'] for r in train[:100]),
        final_1000_video_fraction=sum(r['metrics']['loss_video'] for r in train[-1000:]) / sum(r['loss'] for r in train[-1000:]),
        validation=[dict(step=r['step'], **r['metrics']) for r in val],
        offline_mae=dict(
            arm_joints12=statistics.mean(joints),
            left_gripper=channels['arm_left_gripper.pos'],
            right_gripper=channels['arm_right_gripper.pos'],
            valid_action_positions=mae['valid_action_steps'],
        ),
    )
    for filename in ['train.json', 'metrics.jsonl', 'validation-metrics.jsonl', 'offline-evaluation.json']:
        summary['source_sha256'][key + '/' + filename] = hashlib.sha256((run / filename).read_bytes()).hexdigest()
    curves[key] = (train, val)

assert manifests[0]['stats'] == manifests[1]['stats']
assert manifests[0]['training']['train_episodes'] == manifests[1]['training']['train_episodes']
assert manifests[0]['training']['val_episodes'] == manifests[1]['training']['val_episodes']

for pair in ['old_to_ft', 'official_to_base', 'ft_to_base']:
    summary['weight_comparisons'][pair] = {
        group: {field: row[field] for field in ['n', 'changed_fraction', 'relative_l2']}
        for group, row in weights['comparisons'][pair]['groups'].items()
        if group in ['video_dit', 'action_dit']
    }
for name in ['old_train', 'new_train', 'old_val']:
    summary['state_projection'][name] = {k: v for k, v in projection['groups'][name].items() if k != 'plan'}
summary['state_projection']['method'] = projection['method']
summary['source_sha256']['task_table'] = task['tasks_sha256']
summary['source_sha256']['weight_headers'] = weights['headers']
for key in ['task_finetune', 'foundation_restart']:
    assert summary['runs'][key]['offline_mae']['valid_action_positions'] == 119104


def style_rc(lang):
    fonts = ['Noto Sans CJK JP', 'DejaVu Sans'] if lang == 'zh' else ['DejaVu Sans']
    plt.rcParams.update({
        'font.family': fonts,
        'font.size': 10.5,
        'axes.titlesize': 12,
        'axes.titleweight': 'semibold',
        'axes.labelsize': 10,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.edgecolor': '#b9cccf',
        'text.color': INK,
        'axes.labelcolor': INK,
        'xtick.color': MUTED,
        'ytick.color': MUTED,
        'axes.unicode_minus': False,
        'svg.fonttype': 'none',
        'svg.hashsalt': f'openwam-correction-{lang}',
        'savefig.facecolor': 'white',
        'figure.facecolor': 'white',
    })


def save_fig(fig, stem, lang, note_name=None):
    suffix = '-zh' if lang == 'zh' else ''
    svg = out / f'{stem}{suffix}.svg'
    fig.savefig(svg, format='svg', metadata={'Date': None}, facecolor='white')
    if note_name and lang == 'zh' and args.note_output:
        fig.savefig(args.note_output / note_name, dpi=180, facecolor='white')
    plt.close(fig)


for lang in ('en', 'zh'):
    style_rc(lang)
    zh = (lang == 'zh')
    lbl_orig = '原 115ep' if zh else 'Orig 115ep'
    lbl_ft = '微调 10k（lr 1e-5）' if zh else 'Fine-tuned 10k (lr 1e-5)'
    lbl_re = '重训 10k（lr 5e-5）' if zh else 'Restarted 10k (lr 5e-5)'
    lbl_ft_s = '微调 10k' if zh else 'Fine-tuned 10k'
    lbl_re_s = '重训 10k' if zh else 'Restarted 10k'

    # Figure 1: Early adaptation curve + 4-window diagnostic MAE
    fig, axes = plt.subplots(1, 2, figsize=(11.0, 4.5), layout='constrained', gridspec_kw={'width_ratios': [1.05, 1.15]})
    for key, lbl in [('task_finetune', lbl_ft), ('foundation_restart', lbl_re)]:
        train, _ = curves[key]
        bands = [train[i:i + 100] for i in range(0, len(train), 100)]
        xs = [statistics.mean(r['step'] for r in b) / 1000 for b in bands]
        ys = [statistics.mean(r['metrics']['loss_action'] for r in b) for b in bands]
        axes[0].plot(xs, ys, color=colors[key], label=lbl, lw=2.1)

    ft0 = summary['runs']['task_finetune']['first_100_action_loss']
    re0 = summary['runs']['foundation_restart']['first_100_action_loss']
    axes[0].annotate(
        f'1–100: {re0:.2f}' if not zh else f'前 100 步 {re0:.2f}',
        xy=(0.15, re0), xytext=(1.4, 0.72),
        fontsize=9, color=RESTART, fontweight='semibold',
        arrowprops=dict(arrowstyle='->', color=RESTART, lw=1.1, connectionstyle='arc3,rad=-0.12'),
    )
    axes[0].annotate(
        f'1–100: {ft0:.3f}' if not zh else f'前 100 步 {ft0:.3f}',
        xy=(0.15, ft0), xytext=(1.4, 0.046),
        fontsize=9, color=FT, fontweight='semibold',
        arrowprops=dict(arrowstyle='->', color=FT, lw=1.1, connectionstyle='arc3,rad=0.12'),
    )
    axes[0].set(
        yscale='log',
        xlim=(0, 10.2),
        ylim=(0.0045, 2.3),
        xlabel='本轮更新步数（k）' if zh else 'Current-stage updates (k)',
        ylabel='训练动作 flow loss（100 步均值）' if zh else 'Training action flow loss (100-step mean)',
        title='早期适配速度（微调起步低 48 倍）' if zh else 'Early adaptation (48× lower start)',
    )
    axes[0].grid(axis='y', color=LINE, lw=0.8)
    axes[0].legend(loc='upper right', frameon=False, fontsize=9)

    # Right panel: 4 diagnostic windows MAE
    x = np.arange(4)
    w = 0.25
    for idx, (m, col, lbl) in enumerate([('old', ORIG, lbl_orig), ('ft', FT, lbl_ft_s), ('base', RESTART, lbl_re_s)]):
        vals = net_mae[m]['by_window']
        bars = axes[1].bar(x + (idx - 1) * w, vals, width=w * 0.9, color=col, label=lbl)
        axes[1].bar_label(bars, fmt='%.1f', padding=2, fontsize=8.2, color=INK)
    xt = ['旧验证\n回合 3', '新增训练\n回合 115', '新增训练\n回合 135', '新增训练\n回合 154'] if zh else ['Old val\nep. 3', 'Added train\nep. 115', 'Added train\nep. 135', 'Added train\nep. 154']
    axes[1].set(
        xticks=x,
        xticklabels=xt,
        ylim=(0, 21.8),
        ylabel='12 关节预测 MAE（Host 坐标）' if zh else '12-arm MAE to demo (Host units)',
        title='四处右爪松开窗口的轨迹拟合（越低越近示范）' if zh else 'Trajectory fit at 4 right-gripper release windows',
    )
    axes[1].grid(axis='y', color=LINE, lw=0.8)
    axes[1].set_axisbelow(True)
    axes[1].legend(loc='upper left', ncols=3, frameon=False, fontsize=8.6, handlelength=1.1, columnspacing=0.9)
    box_txt = (
        f'新增三窗均值：{net_mae["old"]["added_mean"]:.1f} → {net_mae["ft"]["added_mean"]:.1f} → {net_mae["base"]["added_mean"]:.1f}（ep.115/154 差距最大）'
        if zh else
        f'Added 3-win mean: {net_mae["old"]["added_mean"]:.1f} → {net_mae["ft"]["added_mean"]:.1f} → {net_mae["base"]["added_mean"]:.1f} (ep.115 & 154)'
    )
    axes[1].text(
        0.5, 0.84, box_txt, transform=axes[1].transAxes, ha='center', va='center',
        fontsize=8.8, fontweight='semibold', color=RESTART,
        bbox=dict(boxstyle='round,pad=0.35', facecolor='#edf5f8', edgecolor='#b8d4e2', lw=0.9),
    )
    save_fig(fig, 'correction-training', lang, note_name='OpenWAM纠偏-路线.png')

    # Figure 2: Video DiT & Action DiT 30-layer relative L2 weight change
    fig, axes = plt.subplots(1, 2, figsize=(11.0, 4.1), layout='constrained')
    titles = ('视频 DiT（30 层）', '动作 DiT（30 层）') if zh else ('Video DiT (30 layers)', 'Action DiT (30 layers)')
    gkeys = ('video_dit', 'action_dit')
    for ax, prefix, title, gkey in zip(axes, ['video_backbone.dit', 'action_backbone'], titles, gkeys, strict=True):
        for key, pair, lbl in [('task_finetune', 'old_to_ft', lbl_ft_s), ('foundation_restart', 'official_to_base', lbl_re_s)]:
            values = weights['comparisons'][pair]['layers']
            rows = sorted((int(name.rsplit('.', 1)[1]), 100 * row['relative_l2']) for name, row in values.items() if name.startswith(prefix))
            xs, ys = zip(*rows)
            overall = summary['weight_comparisons'][pair][gkey]['relative_l2'] * 100
            chg = summary['weight_comparisons'][pair][gkey]['changed_fraction'] * 100
            leg = f'{lbl}（整体 {overall:.2f}% · {chg:.1f}% 变）' if zh else f'{lbl} (all {overall:.2f}% · {chg:.1f}% changed)'
            ax.plot(xs, ys, color=colors[key], label=leg, lw=2.1)
            ax.fill_between(xs, ys, 0, color=colors[key], alpha=0.07)
        ax.set(
            title=title,
            xlim=(0, 29),
            ylim=(0, 6.7),
            xlabel='Transformer 层号（0 起）' if zh else 'Transformer layer (0-indexed)',
            ylabel='相对本轮起点 L2 变化（%）' if zh else 'Relative weight L2 change (%)',
        )
        ax.grid(axis='y', color=LINE, lw=0.8)
        ax.legend(loc='upper left', frameon=False, fontsize=8.5)
    axes[1].text(
        0.97, 0.24,
        '微调 state_proj：99.3% 元素保持旧值' if zh else 'Fine-tuned state_proj: 99.3% unchanged',
        transform=axes[1].transAxes, ha='right', va='bottom', fontsize=8.6, color=FT,
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#eff4f4', edgecolor='#c5d4d7', lw=0.8),
    )
    save_fig(fig, 'correction-weight-change', lang)

target = out / 'correction-summary.json'
target.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
public = target.read_text()
assert not any(s in public for s in ['/home/', '192.168.', '183.230.', 'Gpu@', 'password'])
print('Exported bilingual correction-training & correction-weight-change SVGs and summary JSON.')
