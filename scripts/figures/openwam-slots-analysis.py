"""Reproduce public aggregate figures from a private OpenWAM evaluation.

Usage: python scripts/figures/openwam-slots-analysis.py REPORT_DIRECTORY [DATASET_DIRECTORY]
Only explicitly selected aggregate data and source hashes are exported.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pyarrow.parquet as pq

root = Path(sys.argv[1])
out = Path(__file__).resolve().parents[2] / 'content/images/openwam-slots'
out.mkdir(parents=True, exist_ok=True)
evidence = json.loads((root / 'base_audit/article_evidence_20261105.json').read_text())
metrics = evidence['offline_probe']['metrics']
dataset = Path(sys.argv[2]) if len(sys.argv) > 2 else None
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10,
                     'svg.fonttype': 'none', 'axes.spines.top': False,
                     'axes.spines.right': False, 'axes.edgecolor': '#cbd5e1',
                     'axes.labelcolor': '#334155', 'text.color': '#334155'})
blue, green = '#3263d9', '#79a948'
fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), sharex=True, layout='constrained')
joints = ['shoulder_pan', 'shoulder_lift', 'elbow_flex', 'wrist_flex', 'wrist_yaw', 'wrist_roll']
labels = ['Shoulder pan', 'Shoulder lift', 'Elbow flex', 'Wrist flex', 'Wrist yaw', 'Wrist roll']
for ax, side in zip(axes, ['left', 'right']):
    rows = [metrics[f'arm_{side}_{j}.pos'] for j in joints]
    y = np.arange(6)
    ax.barh(y - .18, [r['chunk_mae'] for r in rows], .34, color=blue, label='OpenWAM')
    ax.barh(y + .18, [r['persistence_chunk_mae'] for r in rows], .34, color=green, label='Hold current state')
    ax.set_yticks(y, labels); ax.invert_yaxis(); ax.set_title(side.title() + ' arm', loc='left')
    ax.set_xlabel('Chunk MAE · Host range −100…100'); ax.set_xlim(0, 28)
    ax.grid(axis='x', alpha=.15); ax.set_axisbelow(True)
axes[0].legend(loc='lower right', frameon=False, fontsize=9)
fig.savefig(out / 'validation-mae.svg'); plt.close(fig)

rows = list(csv.DictReader((root / 'base_audit/recorded_base.csv').open()))
time = np.array([float(r['host_time_s']) for r in rows])
fig, axes = plt.subplots(3, 1, figsize=(10, 5.8), sharex=True, layout='constrained')
for ax, name, unit in zip(axes, ['x.vel', 'y.vel', 'theta.vel'], ['m/s', 'm/s', 'deg/s']):
    ax.plot(time, [float(r['observed_before_request/' + name]) for r in rows], color=green, lw=1, label='Pre-request Host feedback')
    ax.plot(time, [float(r['recorded_action/' + name]) for r in rows], color=blue, lw=1.4, label='Submitted command')
    ax.set_ylabel(f'{name}\n{unit}'); ax.grid(alpha=.15); ax.set_xlim(time[0], time[-1])
    if dataset:
        ax.axvspan(7.3, 8.3, color="#64748b", alpha=.10, lw=0)
axes[0].legend(loc='upper right', frameon=False, fontsize=9, ncol=2)
axes[-1].set_xlabel('Host monotonic elapsed time (s)')
fig.savefig(out / 'fixed-base-feedback.svg'); plt.close(fig)

# Keep prediction horizon separate from physical rollout time.
probes = [np.load(root / f'validation_{ep:03d}/demonstration_predictions.npz')
          for ep in evidence['offline_probe']['episodes']]
names = probes[0]['action_names'].tolist()
pred, target, baseline, valid = [np.concatenate([z[key] for z in probes])
                                for key in ['prediction', 'target', 'baseline', 'coordinate_valid']]
groups = {'Arm joints': [i for i, n in enumerate(names) if n.startswith('arm_') and 'gripper' not in n],
          'Left gripper': [names.index('arm_left_gripper.pos')],
          'Right gripper': [names.index('arm_right_gripper.pos')]}
horizon = {}
fig, axes = plt.subplots(1, 3, figsize=(10, 3.5), layout='constrained')
for ax, (label, indices) in zip(axes, groups.items()):
    mask = valid[:, :, indices]
    count = mask.sum(axis=(0, 2))
    error = np.where(mask, abs(pred[:, :, indices] - target[:, :, indices]), 0)
    held = np.where(mask, abs(baseline[:, :, indices] - target[:, :, indices]), 0)
    a, b = error.sum(axis=(0, 2)) / count, held.sum(axis=(0, 2)) / count
    horizon[label] = {'model_mae': a.tolist(), 'hold_mae': b.tolist(), 'valid_coordinates': count.tolist()}
    ax.plot(np.arange(32), a, color=blue, label='OpenWAM')
    ax.plot(np.arange(32), b, color=green, label='Hold state')
    ax.set_title(label, loc='left'); ax.set_xlabel('Prediction offset (steps)'); ax.grid(alpha=.15)
    ax.set_ylabel('MAE · ' + ('range −100…100' if label == 'Arm joints' else 'range 0…100'))
axes[0].legend(frameon=False, fontsize=9)
fig.savefig(out / 'prediction-horizon.svg'); plt.close(fig)
for probe in probes:
    probe.close()

rollout = None
wheel_feedback = None
if dataset:
    info = json.loads((dataset / 'meta/info.json').read_text())
    assert names == info['features']['action']['names'] == info['features']['observation.state']['names']
    telemetry = [json.loads(line) for line in (dataset / 'meta/safety/episode_000000.jsonl').read_text().splitlines()]
    telemetry = [row for row in telemetry if row.get('frame_index') is not None]
    telemetry.sort(key=lambda row: row['frame_index'])
    table = pq.read_table(dataset / 'data/chunk-000/file-000.parquet').to_pydict()
    assert len(telemetry) == len(table['frame_index']) == 517
    assert [row['frame_index'] for row in telemetry] == table['frame_index']
    host = np.array([row['host_timing']['state_sample_monotonic_s'] for row in telemetry]); host -= host[0]
    np.testing.assert_allclose(host, time, atol=1e-8)
    # Reconstruct the plotted feedback from the saved, signed STS registers.
    wheel_names = ['base_left_wheel', 'base_back_wheel', 'base_right_wheel']
    wheel_speed = np.array([[r['motor_feedback']['motors'][n]['velocity_raw'] for n in wheel_names] for r in telemetry], dtype=np.int64)
    wheel_position = np.array([[r['motor_feedback']['motors'][n]['position_raw'] for n in wheel_names] for r in telemetry], dtype=np.int64)
    # Deployed AlohaMini 2 Pro geometry; same coefficients as BaseDrive/OmniBaseKinematics.
    wheel_radius, base_radius, ticks_per_turn = .063, .195, 4096
    angles = np.deg2rad([150, -90, 30])
    linear = wheel_speed * (2 * np.pi / ticks_per_turn) * wheel_radius
    reconstructed = np.column_stack((-2/3 * (linear * np.cos(angles)).sum(axis=1),
                                      -2/3 * (linear * np.sin(angles)).sum(axis=1),
                                      np.rad2deg(linear.sum(axis=1) / (3 * base_radius))))
    observed = np.array([[float(r['observed_before_request/' + n]) for n in ['x.vel', 'y.vel', 'theta.vel']] for r in rows])
    mismatch = abs(reconstructed - observed).max(axis=0)
    assert np.all(mismatch < [2e-10, 2e-10, 4e-8]), mismatch
    submitted_base = np.array([[r['requested_action'][n] for n in ['x.vel', 'y.vel', 'theta.vel']] for r in telemetry])
    assert np.all(submitted_base == 0)
    values, counts = np.unique(wheel_speed, return_counts=True)
    within_one = (abs(wheel_position - wheel_position[0]) <= 1).sum(axis=0)
    peak = int(np.argmax(abs(observed[:, 0])))
    wheel_feedback = {
        'wheel_order': wheel_names,
        'geometry': {'wheel_radius_m': wheel_radius, 'base_radius_m': base_radius, 'ticks_per_turn': ticks_per_turn},
        'speed_readings': int(wheel_speed.size),
        'speed_register_counts_ticks_s': {str(int(v)): int(c) for v, c in zip(values, counts)},
        'frames_with_nonzero_wheel_speed': int(np.any(wheel_speed != 0, axis=1).sum()),
        'position_start_ticks': wheel_position[0].tolist(),
        'position_end_ticks': wheel_position[-1].tolist(),
        'position_min_ticks': wheel_position.min(axis=0).tolist(),
        'position_max_ticks': wheel_position.max(axis=0).tolist(),
        'position_within_one_tick_of_start_rows': within_one.tolist(),
        'reconstruction_max_abs_error': dict(zip(['x_m_s', 'y_m_s', 'yaw_deg_s'], mismatch.tolist())),
        'peak_abs_x': {'frame_index': int(telemetry[peak]['frame_index']), 'time_s': float(host[peak]),
                       'wheel_ticks_s': wheel_speed[peak].tolist(), 'body_m_s_m_s_deg_s': observed[peak].tolist()},
        'detail_window_s': [7.3, 8.3],
    }
    detail = (host >= 7.3) & (host <= 8.3)
    fig, axes = plt.subplots(2, 1, figsize=(10, 4.8), sharex=True, layout='constrained')
    for j, (label, color, marker) in enumerate(zip(['Left wheel', 'Back wheel', 'Right wheel'],
                                                [blue, green, '#64748b'], ['o', 's', '^'])):
        axes[0].plot(host[detail], wheel_speed[detail, j], color=color, marker=marker, ms=4,
                     lw=.8, label=label)
        axes[1].plot(host[detail], (wheel_position - wheel_position[0])[detail, j], color=color,
                     marker=marker, ms=4, lw=.8, label=label)
    axes[0].set_ylabel('Wheel speed (ticks/s)'); axes[0].set_yticks([-100, -50, 0, 50, 100, 150])
    axes[1].set_ylabel('Position change (ticks)'); axes[1].set_yticks([-3, -2, -1, 0, 1, 2, 3, 4])
    axes[0].legend(loc='upper left', frameon=False, fontsize=9, ncol=3)
    for ax in axes:
        ax.grid(alpha=.15); ax.set_xlim(7.3, 8.3)
        ax.axvline(host[peak], color='#64748b', ls=':', lw=1, alpha=.55)
    axes[-1].set_xlabel('Host monotonic elapsed time (s)')
    fig.savefig(out / 'wheel-feedback-detail.svg'); plt.close(fig)
    action, state = np.array(table['action']), np.array(table['observation.state'])
    latency = np.array([(r['client_timing']['action_sample_finished_monotonic_s'] - r['client_timing']['action_sample_started_monotonic_s']) * 1000 for r in telemetry])
    sequence = np.array([r['issued_command']['sequence'] for r in telemetry])
    fig, axes = plt.subplots(3, 2, figsize=(10, 7), sharex=True, layout='constrained')
    joint_stats = {}
    for col, side in enumerate(['left', 'right']):
        for row, field in enumerate(['shoulder_lift', 'elbow_flex', 'gripper']):
            key = f'arm_{side}_{field}.pos'; i = names.index(key); ax = axes[row, col]
            ax.plot(host, action[:, i], color=blue, lw=1.1, label='Submitted command')
            ax.plot(host, state[:, i], color=green, lw=1, label='Pre-request feedback')
            ax.set_title(side.title() + ' · ' + field.replace('_', ' '), loc='left', fontsize=10)
            ax.set_ylabel('range 0…100' if field == 'gripper' else 'range −100…100'); ax.grid(alpha=.15)
            if field == 'gripper':
                holding = np.array([r['safety']['gripper_control'][f'arm_{side}_gripper']['phase'] == 'holding' for r in telemetry])
                ax.fill_between(host, 0, 1, where=holding, color=green, alpha=.10, transform=ax.get_xaxis_transform(), label='Host holding')
            if row == 2: ax.set_xlabel('Host elapsed time (s)')
            low, high = (0, 100) if field == 'gripper' else (-100, 100)
            joint_stats[key] = {'request_min': float(action[:, i].min()), 'request_max': float(action[:, i].max()),
                                'out_of_range_rows': int(((action[:, i] < low) | (action[:, i] > high)).sum())}
    axes[0, 0].legend(frameon=False, fontsize=8, loc='upper right')
    axes[2, 0].legend(frameon=False, fontsize=8, loc='upper right')
    fig.savefig(out / 'arm-trajectories.svg'); plt.close(fig)
    fig, ax = plt.subplots(figsize=(10, 2.8), layout='constrained')
    ax.scatter(host, latency, s=10, color=blue)
    ax.set_yscale('log'); ax.set_yticks([5, 10, 100, 500, 1000], ['5', '10', '100', '500', '1000'])
    ax.set_ylabel('Policy call duration (ms)'); ax.set_xlabel('Host observation time (s)'); ax.grid(alpha=.15)
    fig.savefig(out / 'policy-timing.svg'); plt.close(fig)
    slow = latency > 100
    holding_intervals = {}
    for side in ['left', 'right']:
        holding = np.array([r['safety']['gripper_control'][f'arm_{side}_gripper']['phase'] == 'holding' for r in telemetry])
        edges = np.flatnonzero(np.diff(np.r_[False, holding, False])).reshape(-1, 2)
        holding_intervals[side] = [{'start_s': float(host[a]), 'end_s': float(host[b-1]), 'rows': int(b-a)} for a,b in edges]
    rollout = {'time_s': host.tolist(), 'select_action_ms': latency.tolist(), 'joints': joint_stats, 'holding_intervals': holding_intervals,
               'recorded_rows': len(host), 'duration_s': float(host[-1]),
               'slow_calls': int(slow.sum()), 'slow_median_ms': float(np.median(latency[slow])),
               'all_median_ms': float(np.median(latency)), 'all_p95_ms': float(np.percentile(latency, 95)),
               'slow_share_of_call_time': float(latency[slow].sum() / latency.sum()),
               'command_hz_estimate': float((sequence[-1] - sequence[0]) / host[-1]),
               'source_sha256': {name: hashlib.sha256((dataset / name).read_bytes()).hexdigest() for name in ['data/chunk-000/file-000.parquet', 'meta/safety/episode_000000.jsonl']}}

public = {
    'model': {'algorithm': 'OpenWAM', 'training_demonstrations': 109, 'total_demonstrations': 115, 'training_steps': 10000},
    'training': evidence['training'],
    'recorded_rollout': {k: evidence['deployment'][k] for k in ['recorded_rows', 'num_steps', 'shift', 'fixed_targets', 'recorded_base']},
    'prediction_horizon': horizon,
    'rollout_analysis': rollout,
    'wheel_feedback_analysis': wheel_feedback,
    'offline_probe': evidence['offline_probe'],
    'scope': 'The recorded rollout and independently sampled validation predictions are separate evidence. Videos are examples, not a success-rate survey.',
    'source_sha256': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in ['validation-aggregate.json', 'base_audit/recorded_base.csv', 'base_audit/summary.json']},
}
(out / 'experiment-summary.json').write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'wheel_feedback': wheel_feedback, 'horizon_endpoints': {k: [v['model_mae'][0], v['hold_mae'][0], v['model_mae'][-1], v['hold_mae'][-1]] for k, v in horizon.items()},
                  'rollout': {k: v for k, v in (rollout or {}).items() if k not in ['time_s', 'select_action_ms', 'source_sha256']}}, indent=2))

# Keep generated SVGs free of trailing whitespace for repository checks.
for name in ['validation-mae.svg', 'fixed-base-feedback.svg', 'wheel-feedback-detail.svg', 'prediction-horizon.svg', 'arm-trajectories.svg', 'policy-timing.svg']:
    path = out / name
    if path.exists():
        path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()).rstrip() + '\n')
