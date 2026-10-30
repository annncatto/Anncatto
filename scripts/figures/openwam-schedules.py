"""Audit OpenWAM's schedule geometry without running a learned model.

python scripts/figures/openwam-schedules.py [--upstream /path/to/denoise_schedule.py]
The optional upstream comparison uses the inspected official module on CPU.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace

COMMIT = '3950b6d9ea848dc980a82a89b4554af2c082544a'
ROOT = Path(__file__).resolve().parents[2]


def shifted(u, alpha):
    return alpha * u / (1 + (alpha - 1) * u)


def offset(u, amount):
    return max((u - amount) / (1 - amount), 0)


def cleanness(progress, rho=5):
    return 1 - shifted(1 - progress, rho)


def schedule(lead='video', alpha=1, amount=0, steps=10, rho=5):
    rows = []
    for i in range(steps + 1):
        progress = i / steps
        ahead, behind = shifted(progress, alpha), offset(progress, amount)
        rv, ra = (ahead, behind) if lead == 'video' else (behind, ahead)
        rows.append(dict(step=i, progress=progress, r_video=rv, r_action=ra,
                         t_video=cleanness(rv, rho), t_action=cleanness(ra, rho)))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--upstream', type=Path)
    args = parser.parse_args()
    cases = [
        ('sync', 'video', 1, 0),
        ('variance-video-lead', 'video', 32, 0),
        ('variance-action-lead', 'action', 32, 0),
        ('offset-video-lead', 'video', 1, .8),
        ('offset-action-lead', 'action', 1, .8),
    ]
    result = dict(source=f'https://github.com/OpenWAM-Official/OpenWAM/blob/{COMMIT}/openwam/deploy/denoise_schedule.py',
                  convention='Paper t: 0=noise, 1=clean. Upstream sigma=1-t.',
                  purpose='Illustrative N=10, rho=5 schedule calculation; not a robot success-rate reproduction.',
                  num_steps=10, backbone_shift=5, cases={})
    upstream = None
    if args.upstream:
        spec = importlib.util.spec_from_file_location('openwam_schedule_audit', args.upstream)
        upstream = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = upstream
        spec.loader.exec_module(upstream)
        result['upstreamSha256'] = hashlib.sha256(args.upstream.read_bytes()).hexdigest()
    max_error = 0.0
    for name, lead, alpha, amount in cases:
        rows = schedule(lead, alpha, amount)
        deltas = [b['t_action'] - a['t_action'] for a, b in zip(rows, rows[1:])]
        assert all(delta >= -1e-12 for delta in deltas)
        assert math.isclose(sum(deltas), 1)
        result['cases'][name] = dict(first_action_step=deltas[0],
                                    nonzero_action_updates=sum(delta > 1e-8 for delta in deltas),
                                    max_action_step=max(deltas), grid=rows)
        if upstream:
            scheduler = SimpleNamespace(num_train_timesteps=1000)
            actual = upstream.schedule_variance_shift(
                scheduler, scheduler, num_steps=10, lead=lead, alpha=alpha,
                offset=amount, shift_video=5, shift_action=5)
            assert len(actual) == len(rows)
            for (video, action), expected in zip(actual, rows):
                max_error = max(max_error,
                                abs(1 - video / 1000 - expected['t_video']),
                                abs(1 - action / 1000 - expected['t_action']))
    if upstream:
        assert max_error < 1e-6
        result['upstreamMaxAbsDifference'] = max_error
    destination = ROOT / 'content/images/openwam/schedule-analysis.json'
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    for name, value in result['cases'].items():
        print(name, {key: val for key, val in value.items() if key != 'grid'})
    if upstream:
        print('Upstream max absolute difference:', max_error)


if __name__ == '__main__':
    main()
