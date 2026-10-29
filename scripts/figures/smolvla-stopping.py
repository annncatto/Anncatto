"""Summarize archived control targets and verify the actual inverse processor.

The report contains global quantiles, not raw predictions or phase-wise samples.
Window labels reference the archived plots and camera contact sheet.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--report', required=True, type=Path)
parser.add_argument('--dataset', required=True, type=Path)
parser.add_argument('--algorithm', required=True, type=Path)
args = parser.parse_args()
sys.path.insert(0, str(args.algorithm / 'src'))
processor_file = args.algorithm / 'src/alohamini/learning/processor.py'
processor_bytes = processor_file.read_bytes()
import torch
from alohamini.learning.processor import Processor

report_file = args.report / 'summary.json'
report = json.loads(report_file.read_text())
info = json.loads((args.dataset / 'meta/info.json').read_text())
stat_file = args.dataset / 'meta/stats.json'
stats = json.loads(stat_file.read_text())['action']
index = info['features']['action']['names'].index('x.vel')
processor = Processor({'action': stats}, modes={'action': 'MEAN_STD'})
raw = torch.zeros((1, len(stats['mean'])), dtype=torch.float32)
normalized = processor({'action': raw})['action']
checks = []
for dtype in (torch.float32, torch.bfloat16):
    value = normalized.to(dtype)
    with torch.autocast('cpu', dtype=torch.bfloat16):
        restored = processor.action(value)
    checks.append({
        'normalizedDtype': str(dtype), 'normalizedStop': value[0,index].item(),
        'restoredDtype': str(restored.dtype), 'restoredVelocity': restored[0,index].item(),
    })
events_file = args.report / 'events.csv'
with events_file.open(encoding='utf-8-sig') as stream:
    events = list(csv.DictReader(stream))
right = [event for event in events if event['kind'] == 'largest_recorded_action_change'
         and event['field'].startswith('arm_right_')]
channels = {}
for field in sorted({event['field'] for event in right}):
    selected = [event for event in right if event['field'] == field]
    channels[field] = {
        'frames': sorted(int(event['frame_index']) for event in selected),
        'maximumAdjacentChange': max(float(event['value']) for event in selected),
    }
result = {
    'frames': report['selected_rows'], 'durationSeconds': report['duration_s'],
    'recordedTargets': {key: report['actions'][key]['target'] for key in ('x.vel','y.vel','theta.vel')},
    'inverseStopTests': checks,
    'rightArmLargestChanges': {
        'events':len(right), 'on25FrameGrid':sum(int(event['frame_index']) % 25 == 0 for event in right),
        'gridFrames':25, 'gridSecondsInRecordedTime':25 / report['recorded_frame_hz'],
        'selection':'Three largest adjacent target changes per right-arm channel',
        'channels':channels,
    },
    'eventsSHA256':hashlib.sha256(events_file.read_bytes()).hexdigest(),
    'normalization': {'mean': stats['mean'][index], 'std': stats['std'][index], 'epsilon': 1e-8},
    'visualWindows': [
        {'phase': 'after_forward', 'start':6,'end':10,'source':'archived base plot'},
        {'phase': 'after_turn', 'start':24,'end':30,'source':'archived base plot'},
        {'phase': 'right_arm_raised', 'start':76,'end':80,'source':'archived base plot and camera contact sheet'},
    ],
    'windowBasis': 'Approximate intervals read from figures; no per-window numerical statistics inferred.',
    'reportSHA256': hashlib.sha256(report_file.read_bytes()).hexdigest(),
    'statsSHA256': hashlib.sha256(stat_file.read_bytes()).hexdigest(),
    'processorFileSHA256':hashlib.sha256(processor_bytes).hexdigest(),
    'processorRevision': subprocess.check_output(['git','-C',str(args.algorithm),'rev-parse','HEAD'],text=True).strip(),
    'testDevice':'cpu', 'torchVersion':torch.__version__,
}
assert processor_file.read_bytes() == processor_bytes, 'Processor changed during verification'
out = Path('content/images/smolvla/stopping-summary.json')
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'frames':result['frames'],'targets':result['recordedTargets'],'inverseStopTests':checks},indent=2))
