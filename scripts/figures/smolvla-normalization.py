"""Extract the actual vx support and one stop/move/stop demonstration.

Uses the existing analysis environment; never runs a policy or invents outputs.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

parser = argparse.ArgumentParser()
parser.add_argument('dataset', type=Path)
args = parser.parse_args()
meta = json.loads((args.dataset / 'meta/info.json').read_text())
stats = json.loads((args.dataset / 'meta/stats.json').read_text())
index = meta['features']['action']['names'].index('x.vel')
frames = pd.concat([pd.read_parquet(f, columns=['action', 'episode_index', 'frame_index', 'timestamp'])
                    for f in sorted((args.dataset / 'data').rglob('*.parquet'))], ignore_index=True)
vx = np.stack(frames['action'])[:, index].astype(np.float64)
values, counts = np.unique(vx, return_counts=True)
mean, std = float(stats['action']['mean'][index]), float(stats['action']['std'][index])
eps = 1e-8
episode = frames[frames.episode_index == 0].sort_values('frame_index')
episode = episode[(episode.timestamp >= 1.5) & (episode.timestamp <= 10)]
raw = np.stack(episode.action)[:, index].astype(np.float64)
z = (raw - mean) / (std + eps)
reconstructed = z * std + mean
data = {
    'field': 'x.vel', 'actionIndex': index, 'frames': len(vx),
    'values': [{'value': float(v), 'frames': int(n), 'fraction': float(n/len(vx))}
               for v, n in zip(values, counts)],
    'mean': mean, 'std': std, 'eps': eps,
    'normalization': '(raw - mean) / (std + eps)',
    'unnormalization': 'prediction_normalized * std + mean',
    'modelPredictionsRecorded': False,
    'episode': 0,
    'transitionTimes': [71/30, 249/30],
    'roundTripMaxAbsError': float(np.abs(raw-reconstructed).max()),
    'samples': [{'frame': int(i), 'time': float(t), 'rawReference': float(a), 'normalizedReference': float(b)}
                for i, t, a, b in zip(episode.frame_index, episode.timestamp, raw, z)]}
out = Path('content/images/smolvla')
(out / 'normalization-vx.json').write_text(json.dumps(data, indent=2)+'\n')

# Standalone SVG: genuine demonstration traces, separate physical/numerical axes.
def line(x1,y1,x2,y2,color='#dfe8e7',dash=''):
    return f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="1" fill="none" {dash}/>'
def text(x,y,label,size=15,color='#425b65'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}">{label}</text>'
left,right=105,930
xx=lambda t:left+(t-1.5)/(10-1.5)*(right-left)
parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 560" role="img" aria-labelledby="title desc"><title id="title">A real stop, forward, stop demonstration</title><desc id="desc">Episode zero, 1.5 to 10 seconds. Raw vx is zero, then 0.15, then zero. Its normalized reference is about minus 0.439, then 2.276, then minus 0.439. No model predictions are shown.</desc><rect width="1000" height="560" fill="white"/><g font-family="sans-serif">']
parts += [text(105,30,'Demonstration only: raw and normalized targets',20),text(105,58,'Same action samples; no model output is available.',14,'#6c8187')]
for top,lo,hi,key,label,color,ticks in [
    (90,-.02,.18,'rawReference','Raw vx (recorded units)','#4084a5',[0,.05,.10,.15]),
    (330,-.7,2.6,'normalizedReference','Normalized vx (dimensionless)','#4d937b',[-.4393873397384022,0,1,2.27588826910138])]:
    yy=lambda v:top+160-(v-lo)/(hi-lo)*160
    parts.append(text(105,top-9,label,16))
    parts.append(f'<rect x="{xx(71/30)}" y="{top}" width="{xx(249/30)-xx(71/30)}" height="160" fill="#f0f7f2"/>')
    for tick in ticks:
        y=yy(tick);parts.extend([line(left,y,right,y),text(25,y+5,f'{tick:.3f}',14)])
    for t in [71/30,249/30]:parts.append(line(xx(t),top,xx(t),top+160,'#8da49c','stroke-dasharray="5 5"'))
    points=' '.join(f'{xx(s["time"]):.3f},{yy(s[key]):.3f}' for s in data['samples'])
    parts.append(f'<polyline points="{points}" stroke="{color}" stroke-width="3" fill="none"/>')
    for t in [2,4,6,8,10]:parts.append(text(xx(t)-5,top+184,str(t),14))
parts.extend([text(395,547,'Dataset time (s)',16),text(xx(71/30)+5,145,'Forward begins',13),text(xx(249/30)+5,145,'Stop',13),'</g></svg>'])
(out / 'normalization-vx.svg').write_text(''.join(parts)+'\n')
print(json.dumps({k:v for k,v in data.items() if k!='samples'},indent=2))
