"""Read-only checkpoint and training audit; emits path-free article evidence."""
import argparse,collections,hashlib,json,math,statistics,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('run',type=Path);args=p.parse_args();run=args.run
train_file=run/'train.json';config_file=run/'checkpoints/200000/pretrained_model/config.json'
train=json.loads(train_file.read_text());cfg=json.loads(config_file.read_text());metrics=run/'metrics.jsonl'
bins=collections.defaultdict(list);last=None;updates={}
hasher=hashlib.sha256()
with metrics.open('rb') as stream:
 for raw in stream:
  hasher.update(raw)
  try:row=json.loads(raw)
  except ValueError:continue
  if row.get('optimizer_step') is not True:continue
  step=int(row['step']);updates[step]=float(row['loss']);last=row
for step,loss in updates.items():bins[(step-1)//1000].append(loss)
info=json.loads((Path(train['dataset'])/'meta/info.json').read_text())
header_file=config_file.parent/'model.safetensors'
with header_file.open('rb') as stream:
 n=struct.unpack('<Q',stream.read(8))[0];header_bytes=stream.read(n);header=json.loads(header_bytes)
dtypes=collections.Counter();modules=collections.Counter()
for name,t in header.items():
 if name=='__metadata__':continue
 count=math.prod(t['shape']);dtypes[t['dtype']]+=count;modules[name.split('.')[0]]+=count
keys=['n_obs_steps','horizon','n_action_steps','objective','noise_scheduler_type','num_train_timesteps','num_inference_steps','hidden_dim','num_layers','num_heads','normalization_mapping','input_features','output_features','drop_n_last_frames']
result={
 'model':'Multi-Task DiT','checkpointStep':200000,
 'dataset':{'episodes':info['total_episodes'],'frames':info['total_frames'],'fps':info['fps']},
 'training':{k:train[k] for k in ['steps','batch_size','gradient_accumulation_steps','mixed_precision','optimizer','scheduler','ema','seed']},
 'checkpointConfig':{k:cfg[k] for k in keys},
 'checkpointTensorElements':{'dtype':dict(dtypes),'module':dict(modules)},
 'lossCurve':[{'endStep':(k+1)*1000,'meanLoss':statistics.mean(v),'loggedUpdates':len(v)} for k,v in sorted(bins.items())],
 'lastMetrics':{k:last[k] for k in ['step','loss','grad_norm','lr']},
 'sourceHashes':{'trainConfig':hashlib.sha256(train_file.read_bytes()).hexdigest(),'modelConfig':hashlib.sha256(config_file.read_bytes()).hexdigest(),'metrics':hasher.hexdigest(),'tensorHeader':hashlib.sha256(header_bytes).hexdigest()},
 'confirmedEvaluation':{'nas30':{'successes':4,'trials':10},'nas25':'Release failure in supplied clip'},
}
print(json.dumps(result,indent=2))
