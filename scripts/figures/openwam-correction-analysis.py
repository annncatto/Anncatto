"""Export public OpenWAM correction comparisons from private archived evidence.

Usage: python scripts/figures/openwam-correction-analysis.py EVIDENCE_DIRECTORY
Only explicit aggregate fields and source hashes enter the public summary.
"""
import hashlib
import json
from pathlib import Path
import statistics
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(sys.argv[1])
out = Path(__file__).resolve().parents[2] / 'content/images/openwam-slots'
out.mkdir(parents=True, exist_ok=True)
folders = {
    'task_finetune': 'openwam_color_sort_155ep_ft_20261106',
    'foundation_restart': 'openwam_color_sort_155ep_base_4gpu_20261109',
}
blue, green, gray = '#3263d9', '#79a948', '#64748b'
colors = dict(task_finetune=blue, foundation_restart=green)
labels = dict(task_finetune='A · Task-model fine-tuning', foundation_restart='B · Foundation restart')


def read(path):
    return json.loads(path.read_text())


def records(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


weights = read(root / 'weights.json')
data = read(root / 'data.json')
projection = read(root / 'projection.json')
task = read(root / 'task-contract.json')
assert len(task['tasks']) == 1
assert data['groups']['new_train']['frames'] == 22338
summary = dict(schema=1, verified_on='2026-11-19',
    dataset=dict(total_episodes=155, original_episodes=115, added_episodes=40,
        train_episodes=149, validation_episodes=6, train_frames=79088, validation_frames=3815,
        added_train_frames=22338, added_train_fraction=22338 / 79088,
        validation_source='original demonstrations', task_prompt_count=1,
        task_prompt=task['tasks'][0]['__index_level_0__']),
    runs={}, weight_comparisons={}, state_projection={}, source_sha256={})
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
        new_optimizer=True, current_steps=10000, cumulative_task_steps=20000 if key == 'task_finetune' else 10000,
        learning_rate=cfg['optimizer']['lr'], batch_size=cfg['batch_size'] * cfg['world_size'],
        seed=cfg['seed'], parameter_dtype='bfloat16', compute_dtype='bfloat16', optimizer_moment_dtype='bfloat16',
        first_100_action_loss=statistics.mean(r['metrics']['loss_action'] for r in train[:100]),
        final_1000_video_fraction=sum(r['metrics']['loss_video'] for r in train[-1000:]) / sum(r['loss'] for r in train[-1000:]),
        validation=[dict(step=r['step'], **r['metrics']) for r in val],
        offline_mae=dict(arm_joints12=statistics.mean(joints),
            left_gripper=channels['arm_left_gripper.pos'], right_gripper=channels['arm_right_gripper.pos'],
            valid_action_positions=mae['valid_action_steps']),
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
        if group in ['video_dit', 'action_dit']}
for name in ['old_train', 'new_train', 'old_val']:
    summary['state_projection'][name] = {k: v for k, v in projection['groups'][name].items() if k != 'plan'}
summary['state_projection']['method'] = projection['method']
summary['source_sha256']['task_table'] = task['tasks_sha256']
summary['source_sha256']['weight_headers'] = weights['headers']
for key in ['task_finetune', 'foundation_restart']:
    assert summary['runs'][key]['offline_mae']['valid_action_positions'] == 119104

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11.5, 'svg.fonttype': 'none',
    'svg.hashsalt': 'openwam-correction', 'axes.spines.top': False, 'axes.spines.right': False,
    'axes.edgecolor': '#cbd5e1', 'text.color': '#334155', 'axes.labelcolor': '#334155'})
fig, axes = plt.subplots(1, 2, figsize=(9.8, 4.2), layout='constrained')
for key, (train, val) in curves.items():
    bands = [train[i:i + 100] for i in range(0, len(train), 100)]
    axes[0].plot([statistics.mean(r['step'] for r in b) for b in bands],
        [statistics.mean(r['metrics']['loss_action'] for r in b) for b in bands],
        color=colors[key], label=labels[key], lw=1.9)
    axes[1].plot([r['step'] for r in val], [r['metrics']['loss_action'] for r in val],
        '-o', color=colors[key], lw=1.9, markersize=4)
axes[0].set(yscale='log', xlabel='Current-stage updates', ylabel='Training action flow loss', title='Early adaptation\n100-update means')
axes[1].set(xlabel='Current-stage updates', ylabel='Validation action flow loss', title='Original-distribution validation\n6 held-out episodes')
axes[0].legend(frameon=False, fontsize=9.5)
for ax in axes:
    ax.grid(axis='y', alpha=.15)
fig.savefig(out / 'correction-training.svg', metadata={'Date': None})
plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(9.8, 4), layout='constrained')
for key, pair in [('task_finetune', 'old_to_ft'), ('foundation_restart', 'official_to_base')]:
    values = weights['comparisons'][pair]['layers']
    for ax, prefix, title in zip(axes, ['video_backbone.dit', 'action_backbone'], ['Video DiT', 'Action DiT']):
        rows = sorted((int(name.rsplit('.', 1)[1]), 100 * row['relative_l2']) for name, row in values.items() if name.startswith(prefix))
        ax.plot(*zip(*rows), color=colors[key], label=labels[key], lw=1.9)
        ax.set(title=title, xlabel='Transformer layer · zero-based', ylabel='Relative weight L2 change / %')
        ax.grid(axis='y', alpha=.15)
axes[0].legend(frameon=False, fontsize=9.5)
fig.savefig(out / 'correction-weight-change.svg', metadata={'Date': None})
plt.close(fig)

target = out / 'correction-summary.json'
target.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
public = target.read_text()
assert not any(s in public for s in ['/home/', '192.168.', '183.230.', 'Gpu@', 'password'])
print('Exported two SVG figures and a public aggregate summary.')
