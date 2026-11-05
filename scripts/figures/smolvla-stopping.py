"""Audit recorded targets, stopping windows, and the actual inverse processor.

Reads the original evaluation Parquet; never runs a policy. Target and pre-request
feedback retain their recorded units and nominal recording time coordinates.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pyarrow.parquet as pq
from scipy.signal import periodogram

parser = argparse.ArgumentParser()
parser.add_argument('--report', required=True, type=Path)
parser.add_argument('--dataset', required=True, type=Path)
parser.add_argument('--algorithm', required=True, type=Path)
parser.add_argument('--recording', required=True, type=Path)
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
names = info['features']['action']['names']
state_names = info['features']['observation.state']['names']
table = pq.read_table(args.recording)
action = np.asarray(table['action'].to_pylist(), dtype=np.float64)
state = np.asarray(table['observation.state'].to_pylist(), dtype=np.float64)
time = table['timestamp'].to_numpy().astype(np.float64)
frames = table['frame_index'].to_numpy()
assert len(time) == report['selected_rows']
assert action.shape == state.shape == (len(time), len(names))
assert np.isfinite(action).all() and np.isfinite(state).all()
assert np.array_equal(frames, np.arange(len(frames)))
assert set(table['episode_index'].to_pylist()) == {0}
assert np.allclose(time, frames / 30, rtol=0, atol=4e-6)
assert abs(time[-1] - report['duration_s']) < 1e-9
for name in names:
    values = action[:, names.index(name)]
    actual = [values.min(), np.median(values), np.quantile(values,.95), values.max()]
    archived = [report['actions'][name]['target'][key] for key in ('min','median','p95','max')]
    assert np.allclose(actual, archived, rtol=0, atol=1e-12), name

def distribution(values):
    return {
        'count':len(values), 'min':float(values.min()), 'median':float(np.median(values)),
        'mean':float(values.mean()), 'p95Abs':float(np.quantile(np.abs(values),.95)),
        'max':float(values.max()), 'exactZeroFrames':int(np.count_nonzero(values == 0)),
    }

windows = []
for phase, start, end in [('after_forward',6,10), ('after_turn',24,30), ('right_arm_raised',76,80)]:
    mask = (time >= start) & (time < end)
    channels = {}
    for name in ('x.vel','y.vel','theta.vel'):
        values = action[mask,names.index(name)]
        channels[name] = {'target':distribution(values),
                          'feedback':distribution(state[mask,state_names.index(name)])}
        if name == 'x.vel':
            channels[name]['target']['absAtMost0.001Frames'] = int(np.count_nonzero(np.abs(values)<=.001))
    windows.append({'phase':phase, 'start':start, 'end':end, 'frames':int(mask.sum()), 'channels':channels})

motion_spans = {}
for name, threshold in [('x.vel',.05), ('theta.vel',5)]:
    selected = np.flatnonzero(np.abs(action[:,names.index(name)]) > threshold)
    runs = np.split(selected, np.flatnonzero(np.diff(selected) > 1) + 1)
    motion_spans[name] = {'absoluteThreshold':threshold, 'runs':[
        {'firstFrame':int(run[0]), 'lastFrame':int(run[-1]), 'frames':len(run),
         'start':float(time[run[0]]), 'endInclusive':float(time[run[-1]])}
        for run in runs if len(run)
    ]}

boundary = frames[1:] % 25 == 0
grid_channels = {}
for name in names:
    if not name.startswith('arm_right_'):
        continue
    delta = np.abs(np.diff(action[:,names.index(name)]))
    edge, other = delta[boundary].mean(), delta[~boundary].mean()
    grid_channels[name] = {
        'gridMeanAbsChange':float(edge), 'otherMeanAbsChange':float(other),
        'ratio':float(edge/other), 'gridShareOfTotalVariation':float(delta[boundary].sum()/delta.sum()),
    }

spectra = []
for name, start, end in [('arm_right_wrist_roll.pos',16,26),
                         ('arm_right_wrist_roll.pos',38,50),
                         ('arm_right_wrist_yaw.pos',88,97.84)]:
    mask = (time >= start) & (time < end)
    peaks = {}
    for label, values in [('target',action[mask,names.index(name)]),
                           ('feedback',state[mask,state_names.index(name)])]:
        frequency, power = periodogram(values,fs=30,detrend='linear')
        peak = float(frequency[1 + np.argmax(power[1:])])
        peaks[label] = {'peakHzInRecordedTime':peak, 'periodFrames':30/peak}
    spectra.append({'channel':name, 'start':start, 'end':end, 'frames':int(mask.sum()), **peaks})
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
    'recordingSHA256':hashlib.sha256(args.recording.read_bytes()).hexdigest(),
    'recordedTimeHz':30,
    'stopWindows':windows,
    'mainMotionSpans':motion_spans,
    'windowBasis':'Task phases from archived camera views and motion transitions; half-open [start,end) intervals.',
    'allFrameExactZeroTargets': {name:int(np.count_nonzero(action[:,names.index(name)]==0))
                                  for name in ('x.vel','y.vel','theta.vel')},
    'rightArmGridChanges': {
        'gridFrames':25, 'gridEdges':int(boundary.sum()), 'otherEdges':int((~boundary).sum()),
        'channels':grid_channels,
    },
    'oscillationPeaks':spectra,
    'spectrumMethod':'Periodogram, nominal 30 Hz recording, linear detrend, largest non-DC power bin.',
    'reportSHA256': hashlib.sha256(report_file.read_bytes()).hexdigest(),
    'statsSHA256': hashlib.sha256(stat_file.read_bytes()).hexdigest(),
    'processorFileSHA256':hashlib.sha256(processor_bytes).hexdigest(),
    'processorRevision': subprocess.check_output(['git','-C',str(args.algorithm),'rev-parse','HEAD'],text=True).strip(),
    'testDevice':'cpu', 'torchVersion':torch.__version__,
}
assert processor_file.read_bytes() == processor_bytes, 'Processor changed during verification'
out = Path('content/images/smolvla/stopping-summary.json')
out.write_text(json.dumps(result,indent=2)+'\n')

# Export standalone plots using the shared article palette.
plt.rcParams.update({
    'font.family':'DejaVu Sans', 'font.size':11, 'text.color':'#273b43',
    'axes.labelcolor':'#273b43', 'xtick.color':'#556b73', 'ytick.color':'#556b73',
    'axes.edgecolor':'#dce9e9', 'grid.color':'#dce9e9', 'axes.spines.top':False,
    'axes.spines.right':False, 'svg.fonttype':'none', 'svg.hashsalt':'smolvla-recording',
})
outdir = out.parent
fig, axes = plt.subplots(3,2,figsize=(11.5,8.1),layout='constrained')
phase_labels = ['After forward motion','After turning','Arm raised / transfer']
for row, window in enumerate(windows):
    mask = (time >= window['start']) & (time < window['end'])
    for col, name in enumerate(('x.vel','theta.vel')):
        ax = axes[row,col]
        ax.plot(time[mask],action[mask,names.index(name)],color='#237ab2',lw=1.5)
        ax.axhline(0,color='#556b73',lw=.8,ls='--')
        ax.grid(axis='y',alpha=.8)
        ax.set_title(f"{phase_labels[row]} · {window['start']}–{window['end']} s",loc='left',fontsize=11)
        ax.set_ylabel(f'{name} target')
        ax.set_xlim(window['start'],window['end'])
        ax.ticklabel_format(axis='y',style='plain',useOffset=False)
        if col == 0:
            ax.yaxis.set_major_formatter(matplotlib.ticker.FormatStrFormatter('%.4f'))
        if row == 2:
            ax.set_xlabel('Recorded time (s)')
fig.suptitle('Stopping targets · recorded units',fontsize=15,x=.02,ha='left')
fig.savefig(outdir/'stopping-traces.svg',metadata={'Date':None,'Title':'Forward and angular targets in three stopping windows'})
fig.savefig('/tmp/smolvla-stopping-traces.png',dpi=150)
plt.close(fig)

mask = (time >= 16) & (time < 26)
name = 'arm_right_wrist_roll.pos'
fig, axes = plt.subplots(2,1,figsize=(11.5,6.8),layout='constrained')
for label, source, order, color in [('Target',action,names,'#237ab2'),
                                    ('Pre-request feedback',state,state_names,'#4b9c80')]:
    values = source[mask,order.index(name)]
    axes[0].plot(time[mask],values,label=label,color=color,lw=1.5)
    frequency, power = periodogram(values,fs=30,detrend='linear')
    axes[1].plot(frequency,power/power.max(),label=label,color=color,lw=1.6)
for frame in range(500,781,25):
    axes[0].axvline(frame/30,color='#556b73',alpha=.25,lw=.8,ls='--')
axes[0].set(xlim=(16,26),ylabel='Wrist roll (recorded units)',xlabel='Recorded time (s)')
axes[0].set_title('Wrist roll · 16–26 s',loc='left',fontsize=14)
axes[0].legend(frameon=False,ncol=2,loc='lower right')
axes[1].set(xlim=(0,3),ylim=(0,1.12),xlabel='Frequency in recorded time (Hz)',ylabel='Relative spectral power')
axes[1].annotate('0.60 Hz · 50 frames / cycle',xy=(.6,1),xytext=(1.05,.92),
                 arrowprops={'arrowstyle':'-','color':'#556b73'},color='#273b43')
for ax in axes:
    ax.grid(axis='y',alpha=.8)
fig.savefig(outdir/'wrist-oscillation.svg',metadata={'Date':None,'Title':'Wrist-roll targets and feedback with a 0.6 Hz spectral peak'})
fig.savefig('/tmp/smolvla-wrist-oscillation.png',dpi=150)
plt.close(fig)
for name in ('stopping-traces.svg','wrist-oscillation.svg'):
    asset = outdir / name
    asset.write_text('\n'.join(line.rstrip() for line in asset.read_text().splitlines())+'\n')
print(json.dumps({'frames':result['frames'],'sha256':result['recordingSHA256'],
                  'zeroTargets':result['allFrameExactZeroTargets'],
                  'stopWindowFrames':[w['frames'] for w in windows],
                  'gridEdges':int(boundary.sum()),'oscillationPeaks':spectra},indent=2))
