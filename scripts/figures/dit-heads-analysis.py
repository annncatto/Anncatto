"""Generate path-free evaluation evidence and standalone training figures."""
import argparse,csv,hashlib,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
p=argparse.ArgumentParser();p.add_argument('--report',type=Path,required=True);args=p.parse_args()
out=Path('content/images/dit-heads');train=json.loads((out/'training-summary.json').read_text())
report_file=args.report/'summary.json';events_file=args.report/'events.csv'
r=json.loads(report_file.read_text())
with events_file.open(encoding='utf-8-sig') as f:events=list(csv.DictReader(f))
selected=[x for x in events if x['kind']=='largest_recorded_action_change' and x['field'].startswith('arm_right_')]
result={'model':'Multi-Task DiT','demonstrations':150,'checkpointStep':200000,'recordingDate':'2026-10-23','recordingId':'20261023_101851','episode':0,'frames':r['selected_rows'],'durationSeconds':r['duration_s'],'recordedHz':r['recorded_frame_hz'],'targets':{k:r['actions'][k]['target'] for k in ['x.vel','y.vel','theta.vel','arm_right_gripper.pos']},'largestRightArmChanges':{'events':len(selected),'on25FrameGrid':sum(int(x['frame_index'])%25==0 for x in selected),'selection':'Three largest adjacent target changes per right-arm channel; archived event selection, not a full edge distribution.'},'sourceHashes':{'report':hashlib.sha256(report_file.read_bytes()).hexdigest(),'events':hashlib.sha256(events_file.read_bytes()).hexdigest()},'rawNormalizedPredictionsRecorded':False}
(out/'evaluation-summary.json').write_text(json.dumps(result,indent=2)+'\n')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'text.color':'#273b43','axes.labelcolor':'#273b43','xtick.color':'#556b73','ytick.color':'#556b73','grid.color':'#dce9e9','axes.edgecolor':'#dce9e9','axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none','svg.hashsalt':'dit-heads'})
fig,ax=plt.subplots(figsize=(10,4),layout='constrained')
curve=train['lossCurve'];ax.semilogy([x['endStep']/1000 for x in curve],[x['meanLoss'] for x in curve],color='#237ab2',lw=1.7)
ax.set(xlabel='Optimizer updates (thousands)',ylabel='Mean diffusion loss',title='MTD training · mean over 1,000 logged optimizer updates')
ax.grid(axis='y',alpha=.8)
fig.savefig(out/'training-loss.svg',metadata={'Date':None,'Title':'Multi-Task DiT training loss over 200k optimizer updates'});fig.savefig('/tmp/dit-training-loss.png',dpi=150);plt.close(fig)
f=out/'training-loss.svg';f.write_text('\n'.join(x.rstrip() for x in f.read_text().splitlines())+'\n')
print(json.dumps(result,indent=2))
