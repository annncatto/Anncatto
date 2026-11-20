"""Export SmolVLA empirical findings from archived evidence.

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
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('evidence',type=Path)
parser.add_argument('--note-output',type=Path)
args=parser.parse_args()
root=args.evidence
out=Path(__file__).resolve().parents[2]/'content/images/smolvla'
out.mkdir(exist_ok=True)
if args.note_output:args.note_output.mkdir(exist_ok=True)
read=lambda name:json.loads((root/name).read_text())
w=read('precision/weights.json')
sw=read('precision/layer-swaps.json')
cont=read('continuation/evaluation.json')
cw=read('continuation/weight-changes.json')
boundary=read('continuation/boundary-analysis.json')
ev=read('deployment/evaluation.json')
inter=read('deployment/input-interventions.json')
series=np.load(root/'deployment/evaluation-series.npz')
with (root/'precision/parameter_inventory.csv').open() as f:inventory=list(csv.DictReader(f))
names={r['name'] for r in inventory if r['version']=='mixed' and r['trainable']=='True' and r['dtype']=='BF16'}
assert len(names)==129
matrix={}
for version in ['mixed','fp32']:
    rows=[r for r in inventory if r['version']==version and r['name'] in names]
    count=sum(int(r['numel']) for r in rows)
    assert count==96607440
    matrix[version]=sum(int(r['last_5k_changed']) for r in rows)/count
matrix['fp32_120k']=cw['fp32_120k']['aggregates']['same_matrix_names']['changed_fraction']
flow={m:float(np.mean(sw['baselines'][m])) for m in ['A','B']}
flow['C']=cont['fp32_120k']['flow_loss']
assert abs(flow['A']-cont['old']['flow_loss'])<1e-12
cases=['demo_images_eval_state','eval_images_demo_state','replace_motor2','replace_other_arm_joints','replace_base','replace_wrist_right']
input_values=[[next(r['mean_absolute_change_vs_eval'] for r in inter['records'] if r['observation']==i and r['case']==case) for i in range(3)] for case in cases]
assert len(inter['records'])==39
summary=dict(schema=1,compiled_on='2026-11-20',
    task='Pick up floor toys and place them into the box held by the left arm',
    protocol=dict(dataset_episodes=150,dataset_frames=155727,validation_episodes=0,
                  same_task_initialization=True,cameras=4,state_action_dim=18,internal_action_dim=32,
                  loss_supervised_dim=18,flow_windows=16,flow_draws=32,prediction_windows=90,
                  uniform_comparison_compute='FP32 weights and compute; autocast and TF32 disabled',
                  precision_comparison='A/B change training storage, optimizer moments and compute recipe together',
                  continuation='C adds 20k updates to B at constant learning rate 5e-7'),
    parameter_scope=dict(total=450046176,trainable=99880992,frozen=350165184,
                         expert=98245840,external_projections=1635152,
                         matrix_comparison_elements=96607440,last_5k_changed_fraction=matrix,
                         frozen_numeric_change=0),
    uniform_fp32_flow_loss=flow,
    checkpoint_sha256=dict(A=w['mixed']['sha256'],B=w['fp32']['sha256'],C=cont['fp32_120k']['checkpoint_sha256']),
    original_recipe_replay=[{k:r[k] for k in ['version','step','flow_loss_mean','precision']} for r in read('precision/replay.json')],
    module_swaps=[{k:r[k] for k in ['base','donor','swapped','mean_loss','relative_loss_reduction_pct']} for r in sw['records']],
    continuation_fit={m:{k:r[k] for k in ['training_step','flow_loss','mean_standardized_arm_mae','mae_by_action','gripper_open_first_prediction_count','gripper_open_windows']} for m,r in cont.items()},
    boundary={m:{k:r[k] for k in ['prediction_positions','outside_count','outside_fraction','phase_counts','windows_with_outside_predictions','mean_overshoot','max_overshoot','corresponding_target_min','corresponding_target_max','raw_mae','clipped_mae','mae_reduction_after_clipping_pct']} for m,r in boundary['models'].items()},
    deployment=dict(model='B · FP32 100k',frames=ev['frames'],span_s=ev['recorded_span_s'],
                    recording_hz=ev['effective_recording_hz'],motor2=ev['joints'][8],gripper=ev['joints'][13],
                    accepted_motor2_range=[float(series['accepted'][:,8].min()),float(series['accepted'][:,8].max())],
                    holding_frames=ev['holds']['arm_right_gripper']),
    input_interventions=dict(observation_times_s=[next(r['time_s'] for r in inter['records'] if r['observation']==i) for i in range(3)],
                             cases=cases,mean_absolute_motor2_change=input_values,
                             queries=117,noise_seeds_per_case=3,predicted_positions_used=25,
                             donor='Nearest demonstrated arm state after train-std scaling with std floor 1',
                             scope='Saved-observation re-prediction, compared with its matched new baseline; not the cached executed action'),
    source_sha256={})
runtime=read('continuation/boundary-source-audit.json')
summary['runtime_checks']={k:runtime[k] for k in ['runtime_model_sha256','frozen_snapshot_hash_matches','real_action_dim','max_action_dim','feature_padding_dims','loss_truncates_to_real_action_dim','sampler_updates_all_dims','sampler_contains_action_clamp','methods']}
for name in ['precision/weights.json','precision/parameter_inventory.csv','precision/layer-swaps.json','precision/replay.json',
             'continuation/evaluation.json','continuation/weight-changes.json','continuation/boundary-analysis.json',
             'continuation/boundary-source-audit.json','deployment/evaluation.json','deployment/evaluation-series.npz',
             'deployment/input-interventions.json','deployment/intervention-inputs.json']:
    summary['source_sha256'][name]=hashlib.sha256((root/name).read_bytes()).hexdigest()
(out/'precision-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
assert not any(s in (out/'precision-summary.json').read_text() for s in ['/home/','192.168.','password','anncatto@'])

BLUE,GREEN,GRAY='#3263d9','#79a948','#94a3b8'
plt.rcParams.update({'font.family':['Noto Sans CJK JP','DejaVu Sans'],'font.size':10,
                     'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'semibold',
                     'svg.fonttype':'none','svg.hashsalt':'smolvla-precision-20261120',
                     'axes.unicode_minus':False})


def figure(language,name,note_name):
    tr=lambda zh,en:zh if language=='zh' else en
    if name=='precision-fit':
        fig,ax=plt.subplots(1,2,figsize=(10.6,4.5),layout='constrained')
        labels=[tr('A · 混合 100k','A · Mixed 100k'),tr('B · FP32 100k','B · FP32 100k'),tr('C · FP32 120k','C · FP32 120k')]
        values=np.array(list(matrix.values()))*100
        bars=ax[0].bar(range(3),values,color=[GRAY,BLUE,GREEN],width=.6)
        ax[0].bar_label(bars,labels=[f'{x:.5f}%' for x in values],padding=4,fontsize=9)
        ax[0].set(xticks=range(3),xticklabels=labels,ylim=(0,122),ylabel=tr('末 5k 步端点不同的矩阵元素（%）','Changed matrix elements over final 5k (%)'),title=tr('同名 96,607,440 个矩阵参数','Same 96,607,440 matrix parameters'))
        bars=ax[1].bar(range(3),list(flow.values()),color=[GRAY,BLUE,GREEN],width=.6)
        ax[1].bar_label(bars,fmt='%.6f',padding=4,fontsize=9)
        ax[1].set(xticks=range(3),xticklabels=labels,ylim=(0,.034),ylabel=tr('配对 flow loss','Matched flow loss'),title=tr('统一 FP32 回放，16 窗口 × 2 抽样','Uniform FP32 replay · 16 windows × 2 draws'))
        fig.suptitle(tr('FP32 保留更多更新，固定训练窗口拟合更好','FP32 retains more updates and improves training-window fit'),fontsize=14)
        for a in ax:a.grid(axis='y',alpha=.18);a.set_axisbelow(True);a.tick_params(axis='x',labelsize=8)
    elif name=='module-swaps':
        fig,ax=plt.subplots(1,2,figsize=(10.6,4.5),layout='constrained')
        values=[flow['A'],flow['B'],next(r['mean_loss'] for r in sw['records'] if r['base']=='A' and r['swapped']=='expert'),next(r['mean_loss'] for r in sw['records'] if r['base']=='A' and r['swapped']=='projections')]
        names_=[tr('A 原配','A native'),tr('B 原配','B native'),tr('B 专家\nA 投影','B expert\nA projections'),tr('A 专家\nB 投影','A expert\nB projections')]
        bars=ax[0].bar(range(4),values,color=[GRAY,BLUE,GREEN,'#bfd19e'],width=.6)
        ax[0].bar_label(bars,fmt='%.5f',padding=4,fontsize=9)
        ax[0].set(xticks=range(4),xticklabels=names_,ylim=(0,.09),ylabel='Flow loss',title=tr('整组交换破坏共同适配','Whole-module swaps disrupt co-adaptation'))
        for model,color in [('A',BLUE),('B',GREEN)]:
            rows=[r for r in sw['records'] if r['base']==model and r['swapped'].startswith('layer_')]
            ratio=[r['mean_loss']/float(np.mean(sw['baselines'][model])) for r in rows]
            ax[1].plot(range(16),ratio,'o-',color=color,markersize=3,label=tr(f'{model} 接收另一版层',f'{model} receives donor layer'))
        ax[1].axhline(1,color=GRAY,ls='--',lw=1)
        ax[1].set(xticks=range(0,16,2),xlabel=tr('被替换的专家层（从 0 开始）','Replaced expert layer (zero-indexed)'),ylabel=tr('换层 loss / 本模型基线 loss','Swap loss / native baseline loss'),ylim=(.85,2.2),title=tr('16 层双向交换；A 的第 6 层改善 7.43%','16 bidirectional layer swaps; A layer 6 improves 7.43%'))
        ax[1].legend(fontsize=8)
        for a in ax:a.grid(axis='y',alpha=.18);a.set_axisbelow(True)
    elif name=='boundary-replay':
        fig,ax=plt.subplots(1,2,figsize=(10.6,4.5),layout='constrained')
        x=np.arange(3)
        for offset,key,color,label in [(0,'old',GRAY,tr('A · 混合 100k','A · Mixed 100k')),(1,'fp32_120k',GREEN,tr('C · FP32 120k','C · FP32 120k'))]:
            values=list(boundary['models'][key]['phase_counts'].values())
            bars=ax[0].bar(x+(offset-.5)*.3,values,width=.28,color=color,label=label)
            ax[0].bar_label(bars,padding=3,fontsize=9)
        ax[0].set(xticks=x,xticklabels=[tr('起始','Start'),tr('夹爪张开','Gripper open'),tr('肩抬最高','Shoulder raised')],ylim=(0,480),ylabel=tr('越界预测位置数','Out-of-range prediction positions'),title=tr('90 窗口 × 50 步；每模型 4,500 个位置','90 windows × 50 steps · 4,500 positions/model'))
        ax[0].legend(fontsize=8)
        data=boundary['models']['fp32_120k'];values=[data['raw_mae'],data['clipped_mae']]
        bars=ax[1].bar([0,1],values,color=[GREEN,BLUE],width=.5)
        ax[1].bar_label(bars,fmt='%.4f',padding=4,fontsize=11)
        ax[1].set(xticks=[0,1],xticklabels=[tr('原始预测','Original'),tr('仅肩抬离线限幅','Shoulder-only offline clip')],ylim=(0,1.6),ylabel=tr('右肩抬 MAE（Host 坐标单位）','Shoulder MAE (Host units)'),title=tr('C：单关节限幅后的 MAE 改善 0.64%','C: shoulder-only clipping reduces MAE by 0.64%'))
        fig.suptitle(tr('FP32 120k 的 153 个越界预测全部位于起始窗口','All 153 crossings by FP32 120k occur in start windows'),fontsize=14)
        for a in ax:a.grid(axis='y',alpha=.18);a.set_axisbelow(True)
    elif name=='deployment-traces':
        fig,ax=plt.subplots(2,1,figsize=(10.6,5.5),sharex=True,layout='constrained')
        t=series['time_s']
        for data,color,label in [(series['requested'][:,8],BLUE,tr('模型请求','Policy request')),(series['accepted'][:,8],GREEN,tr('Host 接受目标','Host accepted')),(series['state'][:,8],GRAY,tr('请求前反馈','Pre-request feedback'))]:ax[0].plot(t,data,color=color,lw=.8,label=label)
        ax[0].axhline(-100,color='#b9544f',ls='--',lw=.8,label=tr('标定下限 -100','Calibrated lower bound -100'))
        ax[0].set(ylabel=tr('右肩抬 · Host 坐标','Shoulder · Host units'),title=tr('B · FP32 100k 的 299.88 秒真机记录','B · FP32 100k · 299.88-second robot record'))
        ax[0].legend(ncols=4,fontsize=8,loc='upper center')
        for data,color,label in [(series['requested'][:,13],BLUE,tr('夹爪请求','Gripper request')),(series['state'][:,13],GREEN,tr('请求前反馈','Pre-request feedback'))]:ax[1].plot(t,data,color=color,lw=.8,label=label)
        ax[1].set(xlabel=tr('Host 时间（秒）','Host time (s)'),ylabel=tr('右夹爪开度 · 0–100','Right gripper · 0–100'))
        ax[1].legend(fontsize=8)
        for a in ax:a.grid(alpha=.15);a.set_xlim(0,300)
    else:
        fig,ax=plt.subplots(figsize=(10.3,4.6),layout='constrained')
        data=np.array(input_values)
        im=ax.imshow(data,cmap='YlGnBu',norm=LogNorm(vmin=.001,vmax=100),aspect='auto')
        for i in range(6):
            for j in range(3):
                red,green,blue,_=im.cmap(im.norm(data[i,j]))
                luminance=.2126*red+.7152*green+.0722*blue
                ax.text(j,i,f'{data[i,j]:.3f}',ha='center',va='center',color='white' if luminance<.55 else '#17324d',fontsize=11)
        ax.set(xticks=range(3),xticklabels=['0.36 s','10.76 s','251.12 s'],yticks=range(6),yticklabels=[tr('替换全部图像','All images'),tr('替换全部状态','All state'),tr('替换肩抬自身状态','Shoulder state only'),tr('替换其他双臂状态','Other arm state'),tr('替换底盘状态','Base state'),tr('替换右腕图像','Right wrist image')],title=tr('同一肩抬通道，对输入替换的响应随观测改变','Input-replacement responses vary by observation'))
        bar=fig.colorbar(im,ax=ax,shrink=.9)
        bar.set_label(tr('前 25 步输出的平均绝对变化（Host 单位，对数色标）','Mean absolute change over first 25 steps (Host units, log color)'))
    if language=='en':
        target=out/f'{name}.svg'
        fig.savefig(target,metadata={'Date':None},facecolor='white')
        target.write_text('\n'.join(line.rstrip() for line in target.read_text().splitlines())+'\n')
    elif args.note_output:fig.savefig(args.note_output/f'SmolVLA-{note_name}.png',dpi=180,facecolor='white')
    plt.close(fig)


for name,note in [('precision-fit','精度拟合'),('module-swaps','模块交换'),('boundary-replay','边界预测'),('deployment-traces','真机轨迹'),('input-responses','输入响应')]:
    for language in ['en','zh']:figure(language,name,note)
print('Exported five scientific figures and a whitelist-only empirical summary.')
