import {roundingSeries} from './smolvla-math.js';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const text=(x:number,y:number,en:string,zh=en,size=19,cls='')=>`<text x="${x}" y="${y}" font-size="${size}" class="${cls}"><tspan lang="en">${en}</tspan><tspan lang="zh-CN">${zh}</tspan></text>`;
const box=(x:number,y:number,w:number,h:number,title:string,zh:string,line:string,lineZh=line,tone='blue')=>`<g class="sv-box sv-${tone}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>${text(x+16,y+29,title,zh,19,'sv-svg-title')}${text(x+16,y+56,line,lineZh,16)}</g>`;
const arrow=(id:string,x1:number,y1:number,x2:number,y2:number)=>`<path class="sv-arrow" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#sv-${id}-arrow)"/>`;
const svg=(id:string,h:number,body:string)=>`<svg viewBox="0 0 1000 ${h}" role="img" aria-labelledby="sv-${id}-title"><title id="sv-${id}-title">${id}: SmolVLA computation</title><defs><marker id="sv-${id}-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#65818b"/></marker></defs>${body}</svg>`;
const cap=(en:string,zh:string)=>`<figcaption><span class="figure-title">${bi(en,zh)}</span></figcaption>`;
const frame=(s:string)=>`<div class="sv-diagram-scroll" tabindex="0">${s}</div>`;
const control=(label:string,zh:string,input:string)=>`<label>${bi(label,zh)} ${input}</label>`;

export function roundingSVG(format:'fp32'|'fp16'|'bf16'='bf16',weight=.01,delta=.00001){
 const points=roundingSeries(weight,delta,format),values=points.flatMap(p=>[p.direct,p.master,p.compute]);
 let lo=Math.min(...values),hi=Math.max(...values);const pad=Math.max((hi-lo)*.12,Math.abs(weight)*.00002);lo-=pad;hi+=pad;
 const x=(n:number)=>100+n*8.5,y=(n:number)=>260-(n-lo)/(hi-lo)*205;
 const path=(key:'direct'|'master'|'compute')=>points.map((p,i)=>`${i?'L':'M'}${x(p.step).toFixed(2)},${y(p[key]).toFixed(2)}`).join(' ');
 return svg('rounding',350,`${[0,1,2,3,4].map(i=>{const yy=55+i*205/4;return`<path d="M100 ${yy}H950" class="sv-grid"/>${text(15,yy+5,(hi-i*(hi-lo)/4).toPrecision(5),undefined,14)}`;}).join('')}${[0,25,50,75,100].map(n=>text(x(n)-8,286,String(n),undefined,15)).join('')}<path d="${path('master')}" class="sv-line sv-master"/><path d="${path('compute')}" class="sv-line sv-compute"/><path d="${path('direct')}" class="sv-line sv-direct"/>${text(100,320,'Updates','更新次数',16)}${text(100,26,'Direct low-precision writes','直接写回所选类型',16,'sv-direct-label')}${text(405,26,'FP32 accumulation','FP32 累计值',16,'sv-master-label')}${text(690,26,'Rounded compute copy','转换后的计算副本',16,'sv-compute-label')}`);
}

export function latencySVG(h=50,f=30,g=.4,ms=200){
 const end=h/f+ms/1000+.18,scale=790/end,start=165,trigger=(1-g)*h/f,finish=trigger+ms/1000;
 const bar=(y:number,t:number,duration:number,tone:string,label:string,zh:string)=>`<rect class="sv-time-${tone}" x="${start+t*scale}" y="${y}" width="${Math.max(2,duration*scale)}" height="40" rx="4"/>${text(start+t*scale+8,y+26,label,zh,15)}`;
 return svg('latency',270,`${text(10,73,'Synchronous','同步',18)}${bar(45,0,h/f,'act','Execute chunk','执行动作块')}${bar(45,h/f,ms/1000,'wait','','')}${text(10,160,'Asynchronous','异步',18)}${bar(132,0,h/f,'act','Old actions continue','旧动作继续执行')}${bar(184,trigger,ms/1000,'infer','Predict','预测')}${text(10,210,'Inference','推理',18)}<path class="sv-timing-guide" d="M${start+trigger*scale} 116V230 M${start+finish*scale} 116V230"/>${text(165,252,`H=${h} · f=${f} Hz · g=${g.toFixed(2)} · latency=${ms} ms`,undefined,16)}`);
}

export function renderSmolFigure(id:string):string{
 let body='',controls='',en='',zh='';
 if(id==='features'){
  en='Tracing image, text, state and per-layer KV';zh='图像、文字、状态与逐层 KV 的传递';
  body=svg(id,690,
   box(20,35,240,90,'N camera views','N 路相机','[B,N,3,512,512]')+
   box(300,35,300,90,'Image encoder + shuffle','视觉编码 + 空间重排','1024 patches → 64 tokens / view','1024 patch → 每视角 64 token')+
   box(20,175,240,90,'Language IDs','语言编号','[B,L]')+box(300,175,300,90,'Embedding','词嵌入','[B,L,960]')+
   box(20,315,240,90,'Robot state','机器人状态','[B,32] (padded)','[B,32]（补齐后）')+box(300,315,300,90,'State projection','状态投影','[B,1,960]')+
   box(660,105,320,190,'Concatenate prefix','拼接 prefix','P = 64N + L + 1','P = 64N + L + 1','green')+
   text(678,200,'[B,P,960]',undefined,22)+text(678,236,'N=4, L=48 → P=305',undefined,17)+
   box(660,365,320,95,'VLM layers 0…15','VLM 第 0…15 层','Images/text do not read actions','图像/文字不读动作')+
   box(660,545,320,100,'Layerwise KV cache','逐层 KV 缓存','Logical: [B,P,5,64]','逻辑形状：[B,P,5,64]','green')+
   box(20,520,550,125,'Action expert, 16 layers','16 层动作专家','Noisy actions + time → [B,H,720]','噪声动作 + 时间 → [B,H,720]','warm')+
   text(36,612,'Even layers: SA · Odd layers: CA','偶数层 SA · 奇数层 CA',18)+
   [[260,80,300,80],[260,220,300,220],[260,360,300,360],[600,80,660,150],[600,220,660,220],[600,360,660,270],[820,295,820,365],[820,460,820,545],[660,590,570,590]].map(a=>arrow(id,...a as [number,number,number,number])).join('')+
   text(20,470,'The observation is fixed during one sampling call.','一次采样内，观察条件保持不变。',19));
 }else if(id==='batch'){
  en='One batch: one sampled flow time, one supervised forward pass';zh='一个 batch：随机流时间与一次监督前向';
  const nodes=[
   [20,25,450,110,'1 · Read B examples','1 · 读取 B 个样本','Images, text, state, future actions','图像、文字、状态、未来动作'],
   [530,25,450,110,'2 · Sample noise and t','2 · 抽取噪声与 t','x_t=(1−t)A+tε · u_t=ε−A','x_t=(1−t)A+tε · u_t=ε−A'],
   [530,220,450,110,'3 · Build prefix and suffix','3 · 构造 prefix 与 suffix','[B,P,960] and [B,H,720]','[B,P,960] 与 [B,H,720]'],
   [20,220,450,110,'4 · Expert → vector field → MSE','4 · 专家 → 向量场 → MSE','One prediction vθ(x_t,t,o)','一次预测 vθ(x_t,t,o)'],
   [20,420,960,100,'5 · Backward → clip → optimizer step','5 · 反向传播 → 梯度裁剪 → 优化器更新','Only trainable parameters receive updates','仅更新可训练参数']
  ] as const;
  body=svg(id,555,nodes.map((n,i)=>`<g data-batch-step="${i}" class="${i===0?'sv-active':''}">${box(n[0],n[1],n[2],n[3],n[4],n[5],n[6],n[7],i===4?'green':'blue')}</g>`).join('')+arrow(id,470,80,530,80)+arrow(id,755,135,755,220)+arrow(id,530,275,470,275)+arrow(id,245,330,245,420)+text(540,376,'No K-step rollout in this batch.','此处不运行 K 步采样循环。',19));
  controls=`<div class="controls sv-step-controls">${[1,2,3,4,5].map((n,i)=>`<button type="button" data-batch-choice="${i}" aria-pressed="${i===0}">${n}</button>`).join('')}</div><p class="sv-readout" data-batch-readout aria-live="polite">${bi('Read the current observation and its future demonstration chunk.','读取当前观察与对应的未来示范动作块。')}</p>`;
 }else if(id==='sampling'){
  en='One observation, ten expert evaluations, one complete action chunk';zh='一次观察、十次专家求值、一段完整动作块';
  body=svg(id,390,box(20,25,960,80,'Observation → prefix prefill → fixed KV','观察 → prefix 预计算 → 固定 KV','Vision/VLM computed once for this call','视觉与 VLM 在这次调用中计算一次','green')+
   box(20,175,205,95,'Gaussian noise','高斯噪声','x₁ ∈ R^[B,H,D]','x₁ ∈ R^[B,H,D]')+
   box(280,175,420,95,'Action expert × 10','动作专家 × 10','x ← x − 0.1 vθ(x,t,o)','x ← x − 0.1 vθ(x,t,o)','warm')+
   box(755,175,225,95,'Action chunk','动作块','Crop → unnormalize','截维 → 反归一化')+arrow(id,225,220,280,220)+arrow(id,700,220,755,220)+arrow(id,490,105,490,175)+
   Array.from({length:11},(_,k)=>`<g data-sample-node="${k}"><circle cx="${65+k*87}" cy="330" r="14" class="${k===0?'sv-sample-current':'sv-sample-idle'}"/>${text(56+k*87,365,String(k),undefined,16)}</g>`).join(''));
  controls=`<div class="controls sv-controls">${control('Integration step','积分步', '<input aria-label="Integration step" data-sampling-step type="range" min="0" max="10" step="1" value="0">')}</div><p class="sv-readout" data-sampling-readout aria-live="polite">${bi('Step 0 · t=1.0 · starting from noise; cached observation unchanged.','第 0 步 · t=1.0 · 从噪声出发，观察缓存不变。')}</p>`;
 }else if(id==='comparison'){
  en='Two attention structures for continuous action generation';zh='两种连续动作生成的注意力结构';
  body=svg(id,520,box(20,25,445,80,'SmolVLA','SmolVLA','16 layers · expert width 720','16 层 · 专家宽度 720')+box(535,25,445,80,'π0.5','π0.5','18 layers · expert width 1024','18 层 · 专家宽度 1024')+
   box(20,150,185,85,'VLM prefix','VLM prefix','Per-layer KV','各层 KV','green')+box(245,150,220,85,'SA → CA → SA…','SA → CA → SA…','Causal action mask','动作因果 mask','warm')+arrow(id,205,192,245,192)+
   box(535,150,445,85,'Joint attention, separate weights','共同注意力，分支独立参数','Action queries read prefix + all actions','动作 query 读 prefix + 整个动作块','warm')+
   box(20,295,445,80,'Time fused at input','时间在输入端融合','MLP(action embedding, time embedding)','MLP（动作 embedding，时间 embedding）')+
   box(535,295,445,80,'Time conditions each layer','时间调制每层','Time MLP → adaptive RMSNorm','时间 MLP → adaptive RMSNorm')+
   text(20,437,'Both: flow matching, parallel chunk generation.','共同点：流匹配，并行生成整个动作块。',22)+text(20,480,'Neither structure alone determines execution pauses.','两种结构本身都不能决定部署时是否停顿。',19));
 }else if(id==='latency'){
  en='Latency, queue buffer and stale actions';zh='延迟、队列缓冲与过时动作';body=latencySVG();
  controls=`<div class="controls sv-controls">${control('Latency (ms)','延迟（ms）','<input data-latency-ms type="range" min="0" max="1500" step="10" value="200">')}${control('Remaining fraction g','剩余比例 g','<input data-latency-g type="range" min="0" max="1" step="0.05" value="0.4">')}</div><p class="sv-readout" data-latency-readout aria-live="polite">${bi('50 actions · 30 Hz · 200 ms latency · buffer 667 ms · 6 elapsed steps.','50 步 · 30 Hz · 延迟 200 ms · 缓冲 667 ms · 已过去 6 步。')}</p>`;
 }else if(id==='rounding'){
  en='Repeated updates: direct writeback versus FP32 accumulation';zh='重复更新：直接写回与 FP32 累计';body=roundingSVG();
  controls=`<div class="controls sv-controls">${control('Stored format','存储类型','<select data-round-format aria-label="Stored format"><option value="bf16">BF16</option><option value="fp16">FP16</option><option value="fp32">FP32</option></select>')}${control('Starting weight','初始权重','<select data-round-weight aria-label="Starting weight"><option value="0.01">0.01</option><option value="0.1">0.1</option><option value="1">1.0</option></select>')}${control('Update magnitude','更新幅度','<input data-round-delta aria-label="Update magnitude exponent" type="range" min="-7" max="-4" step="0.25" value="-5">')}</div><p class="sv-readout" data-round-readout aria-live="polite">${bi('100 decrements of 10⁻⁵: direct BF16 stays unchanged; FP32 retains the accumulation.','每步减去 10⁻⁵，重复 100 次：BF16 直接写回不变；FP32 保留累计更新。')}</p>`;
 }else if(id==='dataset'){
  en='Demonstration duration distribution';zh='示教时长分布';
  // Counts verified from the 120 metadata lengths, using [0,10), [10,20), … [40,50).
  const counts=[1,0,14,91,14];
  body=svg(id,280,counts.map((n,i)=>{const h=n/100*180,x=115+i*172;return `<rect x="${x}" y="${215-h}" width="115" height="${h}" rx="3" class="sv-hist-bar"/>${text(x+44,203-h,String(n),undefined,20)}${text(x+10,246,`${i*10}–${(i+1)*10} s`,undefined,17)}`;}).join('')+text(25,28,'Episodes','轨迹数',17));
 }else throw Error(`Unknown SmolVLA figure: ${id}`);
 return `<figure class="sv-figure" data-sv-figure="${id}">${frame(body)}${controls}${cap(en,zh)}</figure>`;
}

const clips:Record<string,[string,string]>={
 'success-left':['Left-position success','左侧位置成功'], 'success-center':['Center-position success','中间位置成功'], 'success-right':['Right-position success','右侧位置成功'],
 'failure-grasp':['Unsuccessful grasp','抓取失败片段'], 'failure-base':['Close approach / base proximity','靠近底盘 / 接近过多'],
 'initial-pose-a':['Changed initial placement A','初始位置变化 A'], 'initial-pose-b':['Changed initial placement B','初始位置变化 B'],
 'continued-missed-grasp':['Continued training: missed grasp','继续训练后：漏抓'], 'continued-retreat':['Continued training: excessive retreat','继续训练后：后退过大'],
 'continued-success':['150 episodes: hesitant success','150 条：勉强成功'], 'pi05-rollout':['π0.5: collection rollout','π0.5：抓取与投放'],
 'two-toys-a':['After expansion: failure A','双玩偶扩展后：失败 A'], 'two-toys-b':['After expansion: failure B','双玩偶扩展后：失败 B']
};
export function renderSmolMedia(names:string){
 const ids=names.split('|');
 return `<div class="sv-media-grid sv-${ids.length===3?'three':ids.length===2?'two':'one'}">${ids.map(id=>{
  const label=clips[id];if(!label)throw Error(`Unknown clip: ${id}`);
  const wide=['initial-pose-a','initial-pose-b','continued-success','pi05-rollout','two-toys-b'].includes(id);
  return `<figure class="sv-clip"><video width="${wide?568:480}" height="${wide?320:480}" controls muted loop playsinline preload="none" poster="/assets/content/smolvla/${id}.webp" aria-label="${label[0]}" data-sv-video><source src="/assets/content/smolvla/${id}.mp4" type="video/mp4"></video><figcaption><span class="figure-title">${bi(...label)}</span><span class="figure-description">${bi('Original speed · silent loop · pause anytime','原速 · 无声循环 · 可暂停')}</span></figcaption></figure>`;
 }).join('')}</div>`;
}
