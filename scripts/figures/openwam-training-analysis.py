"""Reproduce training-cost and wrist-pose figures from private archived evidence.

Usage: python scripts/figures/openwam-training-analysis.py EVIDENCE_DIR GRASP_DIR
EVIDENCE_DIR contains the sources/ archive; no raw paths or credentials are exported.
"""
from pathlib import Path
import collections
import hashlib
import json
import math
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root = Path(sys.argv[1]) / 'sources'
grasp = Path(sys.argv[2])
out = Path(__file__).resolve().parents[2] / 'content/images/openwam-slots'
blue, green, gray = '#3263d9', '#79a948', '#64748b'
plt.rcParams.update({'font.family':'DejaVu Sans', 'font.size':10, 'svg.fonttype':'none',
                     'svg.hashsalt':'openwam-training-analysis', 'axes.spines.top':False,
                     'axes.spines.right':False, 'axes.edgecolor':'#cbd5e1', 'text.color':'#334155',
                     'axes.labelcolor':'#334155'})
source_hashes = {}
def read_json(p):
    return json.loads(p.read_text())
def metrics(p):
    return [json.loads(x) for x in p.read_text().splitlines()]
def record_hash(label, p):
    source_hashes[label] = hashlib.sha256(p.read_bytes()).hexdigest()
jobs = [
 ('OpenWAM · 3 cameras', 'openwam_color_sort_4gpu_20261028_b8', 300, 'metrics-from-300-1793180460080378383.jsonl', 115),
 ('π0.5 · 4 cameras', 'pi05_full_flow_230_4gpu_b32_20261028', None, None, 230),
 ('π0.5 · 3 cameras', 'pi05_module_to_shape_12_flow_full_3cam_90train6val_b32_span035_20261101', None, None, 96),
 ('π0.5 · 3 cameras / batch 4', 'pi05_whiteboard50_full_fsdp2_4gpu_10k_01', 6000, 'metrics-from-6000-1793093834902573065.jsonl', 50),
]
training = []
for label, folder, boundary, resumed, episodes in jobs:
    d = root / 'runs' / folder
    rows = metrics(d/'metrics.jsonl')
    record_hash(label+' initial metrics', d/'metrics.jsonl')
    if resumed:
        rows = [r for r in rows if r['step'] <= boundary] + metrics(d/resumed)
        record_hash(label+' resumed metrics', d/resumed)
    assert [r['step'] for r in rows] == list(range(1, 10001))
    stable = [r for r in rows if 500 <= r['step'] <= 10000]
    a = np.array([r['update_s'] for r in stable])
    cfg = read_json(d/'train.json'); record_hash(label+' configuration', d/'train.json')
    assert cfg['batch_size'] * cfg['num_processes'] * cfg['gradient_accumulation_steps'] == 32
    assert cfg['distributed_backend'] == 'fsdp2'
    training.append(dict(label=label, total_demonstrations=episodes, steps=10000,
        stable_steps=[500,10000], stable_count=len(a), update_median_s=float(np.median(a)),
        update_p10_p90_s=np.percentile(a,[10,90]).tolist(), update_mean_s=float(a.mean()),
        update_sum_h=sum(r['update_s'] for r in rows)/3600,
        data_median_s=float(np.median([r['dataloading_s'] for r in stable])),
        peak_allocated_gib=max(r['gpu_mem_gb'] for r in rows),
        per_gpu_batch=cfg['batch_size'], accumulation=cfg['gradient_accumulation_steps'],
        gpu_count=cfg['num_processes'], effective_batch=32,
        mixed_precision=cfg['mixed_precision'],
        gradient_checkpointing=cfg['model']['gradient_checkpointing']))

parameter_groups = {}
for name in ['openwam','pi05_4cam']:
    p=root/'headers'/name/'model.safetensors.json'; record_hash(name+' checkpoint tensor header',p)
    header=read_json(p); counts=collections.Counter(); dtypes=collections.Counter()
    for key, v in header.items():
        if key == '__metadata__': continue
        n=math.prod(v['shape']); dtypes[v['dtype']]+=n
        if name=='openwam':
            group = ('text_encoder' if '.text_encoder.' in key else 'vae' if '.vae.' in key
                     else 'video_dit' if '.dit.' in key else 'state_projection' if '.proprio_encoder.' in key else 'action_dit')
        else:
            group = ('unused_expert_vocabulary_head' if 'gemma_expert.lm_head' in key else
                     'vision' if any(s in key for s in ['vision_tower','multi_modal_projector']) else
                     'language' if key.startswith('paligemma_with_expert.paligemma.') else 'action_expert')
        counts[group]+=n
    frozen = counts['text_encoder']+counts['vae'] if name=='openwam' else counts['unused_expert_vocabulary_head']
    parameter_groups[name] = dict(groups=dict(counts),total=sum(counts.values()),trainable=sum(counts.values())-frozen,frozen=frozen,storage_dtypes=dict(dtypes))
assert parameter_groups['openwam']['trainable']==6020774098
assert parameter_groups['pi05_4cam']['trainable']==3353433872

fig,axes=plt.subplots(1,2,figsize=(11.5,4.8),gridspec_kw={'width_ratios':[1.45,1]},layout='constrained')
y=np.arange(4);med=np.array([r['update_median_s'] for r in training]);limits=np.array([r['update_p10_p90_s'] for r in training])
axes[0].barh(y,med,color=[blue,green,green,gray],alpha=.85,height=.6)
axes[0].errorbar(med,y,xerr=[med-limits[:,0],limits[:,1]-med],fmt='none',ecolor='#334155',capsize=3,lw=1)
axes[0].set_yticks(y,[r['label'].replace(' · ','\n') for r in training]);axes[0].invert_yaxis()
for i,v in enumerate(med):axes[0].text(limits[i,1]+.5,i,f'{v:.2f}',va='center',fontsize=10)
axes[0].set_xlim(0,39);axes[0].set_xlabel('Seconds per optimizer update · median, P10–P90')
axes[0].set_title('4 GPUs · effective batch 32',loc='left');axes[0].grid(axis='x',alpha=.15);axes[0].set_axisbelow(True)
for i,(name,label) in enumerate([('openwam','OpenWAM'),('pi05_4cam','π0.5 full')]):
    p=parameter_groups[name];a=p['trainable']/1e9;b=p['frozen']/1e9
    axes[1].barh(i,a,color=blue,label='Trainable' if i==0 else None,height=.5)
    axes[1].barh(i,b,left=a,color=green,label='Frozen' if i==0 else None,height=.5)
    axes[1].text(a/2,i,f'{a:.2f}B',color='white',ha='center',va='center')
    axes[1].text(a+b+.15,i,f'{a+b:.2f}B',va='center',fontsize=9)
axes[1].set_yticks([0,1],['OpenWAM','π0.5 full']);axes[1].invert_yaxis();axes[1].set_xlim(0,14.5)
axes[1].set_ylim(1.8,-.7);axes[1].legend(loc='lower right',frameon=False,fontsize=9)
axes[1].set_xlabel('Stored parameters (billions)');axes[1].set_title('Parameter scope',loc='left');axes[1].grid(axis='x',alpha=.15);axes[1].set_axisbelow(True)
fig.savefig(out/'training-cost.svg',metadata={'Date':None});plt.close(fig)

findings=read_json(grasp/'findings.json');events=read_json(grasp/'closing-events.json')
for name in ['findings.json','closing-events.json','replay-transition-results.npz']:
    record_hash('wrist diagnostic '+name,grasp/name)
z=np.load(grasp/'replay-transition-results.npz');index=int(np.flatnonzero(np.all(z['cases']==[0,50],axis=1))[0])
# arm_right_wrist_flex.pos is coordinate 10 in the declared 18-coordinate order.
target=z['targets'][index,:,10];samples=z['predictions'][index,:,:,10];mean=samples.mean(axis=0)
np.testing.assert_allclose([target[0],target[-1],mean[0],mean[-1]], [42.77511978149414,15.023923873901367,41.568233489990234,17.323938369750977],rtol=1e-6)
poses={}
for src in ['training','evaluation']:
    poses[src]={}
    for side in ['left','right']:
        selected=[e for e in events[src] if e['side']==side and e['z']<.51]
        if src=='training':assert all(e['ep'] not in [3,14,31,35,81,94] for e in selected)
        angle=np.array([e['down_deg'] for e in selected]);summary=findings['pose_summary']['results'][src][side]
        assert len(angle)==summary['candidate_count']
        np.testing.assert_allclose(np.median(angle),summary['downward_angle_median_deg'])
        poses[src][side]=dict(candidate_count=len(angle),median_deg=float(np.median(angle)),p10_p90_deg=np.percentile(angle,[10,90]).tolist())
fig,axes=plt.subplots(1,2,figsize=(10.5,4.2),layout='constrained')
x=np.arange(32)
axes[0].plot(x,target,color=green,lw=1.8,label='Demonstration target')
axes[0].plot(x,mean,color=blue,lw=1.8,label='Model · 3-seed mean')
axes[0].fill_between(x,samples.min(0),samples.max(0),color=blue,alpha=.16,label='3-seed range')
axes[0].set_xlabel('Prediction offset (steps)');axes[0].set_ylabel('Right wrist flex · Host coordinate');axes[0].set_title('Replay of a demonstrated wrist transition',loc='left',fontsize=10)
axes[0].legend(frameon=False,fontsize=8);axes[0].grid(alpha=.15)
for i,side in enumerate(['left','right']):
    for source,color,offset,label in [('training',green,-.12,'Demonstrations'),('evaluation',blue,.12,'Live rollout')]:
        p=poses[source][side];m=p['median_deg'];lo,hi=p['p10_p90_deg'];yy=i+offset
        axes[1].errorbar(m,yy,xerr=[[m-lo],[hi-m]],fmt='o',color=color,capsize=4,label=label if i==0 else None)
        axes[1].text(93,yy,f"{m:.1f}° · n={p['candidate_count']}",va='center',fontsize=9,color=color)
axes[1].set_yticks([0,1],['Left arm','Right arm']);axes[1].set_xlim(30,115);axes[1].set_xticks([30,45,60,75,90]);axes[1].set_ylim(1.65,-.6)
axes[1].set_xlabel('Tool downward angle (°) · median, P10–P90');axes[1].set_title('Automatically selected closing candidates',loc='left',fontsize=10)
axes[1].legend(loc='lower left',frameon=False,fontsize=8);axes[1].grid(axis='x',alpha=.15)
fig.savefig(out/'wrist-pose-analysis.svg',metadata={'Date':None});plt.close(fig)
public={'training':training,'parameter_groups':parameter_groups,
        'timing_scope':'Optimizer-update intervals include processing, forward/backward, synchronization and update; exclude data wait, validation, checkpointing and startup.',
        'wrist':{'evaluation_date':'2026-11-02','evaluation_frames':4938,'replay_states':10,'seeds_per_state':3,
                 'selected_transition':{'target':target.tolist(),'prediction_mean':mean.tolist(),'prediction_min':samples.min(0).tolist(),'prediction_max':samples.max(0).tolist()},
                 'poses':poses,'selection':'Gripper >35 then <15; up to 11 preceding samples; median TCP z <0.51 m in base_link with fixed lift zero reference; calibrated FK upright_forward preset.',
                 'scope':'Automatic candidates, not manually labeled successes or independent trials; replay uses demonstration observations.'},
        'source_sha256':source_hashes}
(out/'training-pose-summary.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'training':training,'parameters':parameter_groups,'poses':poses},ensure_ascii=False,indent=2))

# Keep generated SVGs free of trailing whitespace for repository checks.
for name in ['training-cost.svg', 'wrist-pose-analysis.svg']:
    path = out / name
    if path.exists():
        path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()).rstrip() + '\n')
