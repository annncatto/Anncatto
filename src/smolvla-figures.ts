import {C} from './theme.js';
import {roundingSeries} from './smolvla-math.js';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const text=(x:number,y:number,en:string,zh=en,size=19,cls='')=>`<text x="${x}" y="${y}" font-size="${size}" class="${cls}"><tspan lang="en">${en}</tspan><tspan lang="zh-CN">${zh}</tspan></text>`;
const box=(x:number,y:number,w:number,h:number,title:string,zh:string,line:string,lineZh=line,tone='blue',extra:readonly [string,string,number?][]=[])=>{
 const rows:readonly [string,string,number?][]=[[title,zh,19],[line,lineZh,16],...extra];
 return `<g class="sv-box sv-${tone}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>${rows.map((r,i)=>text(x+w/2,y+h/2+(i-(rows.length-1)/2)*28,r[0],r[1],r[2]??16,i===0?'sv-svg-title':'')).join('')}</g>`;
};
const arrow=(id:string,x1:number,y1:number,x2:number,y2:number)=>`<path class="sv-arrow" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#sv-${id}-arrow)"/>`;
const svgNames:Record<string,string>={features:'Observation features',batch:'Flow-matching training',sampling:'Action sampling',comparison:'Action attention',normalization:'Action normalization paths',latency:'Inference and execution timing',rounding:'Weight-update rounding',dataset:'Demonstration durations'};
const svg=(id:string,h:number,body:string)=>`<svg viewBox="0 0 1000 ${h}" role="img" aria-labelledby="sv-${id}-title"><title id="sv-${id}-title">${svgNames[id]}</title><defs><marker id="sv-${id}-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="${C.muted}"/></marker></defs>${body}</svg>`;
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
 const delay=ms/1000,oldEnd=h/f,request=(1-g)*oldEnd,ready=request+delay;
 const buffer=g*oldEnd,dropped=Math.min(h,Math.ceil(f*delay));
 const start=155,end=2*oldEnd+delay+.08,scale=810/end,x=(t:number)=>start+t*scale;
 const bar=(y:number,t:number,duration:number,tone:string)=>duration>0?`<rect class="sv-time-${tone}" x="${x(t)}" y="${y}" width="${duration*scale}" height="34" rx="3"/>`:'';
 const guide=(t:number,y1:number,y2:number)=>`<path class="sv-timing-guide" d="M${x(t)} ${y1}V${y2}"/>`;
 const tick=Array.from({length:Math.floor(end*2)+1},(_,i)=>i*.5);
 const sync=bar(99,0,oldEnd,'act')+bar(99,oldEnd,delay,'wait')+bar(99,oldEnd+delay,oldEnd,'new');
 const async=bar(238,0,Math.min(ready,oldEnd),'act')+bar(238,oldEnd,Math.max(0,ready-oldEnd),'wait')+bar(238,ready,(h-dropped)/f,'new');
 const cells=Array.from({length:h},(_,i)=>`<rect x="${155+i*810/h}" y="445" width="${810/h-2}" height="30" rx="2" fill="${i<dropped?C.grid:C.target}"/>`).join('');
 return svg('latency',530,
  text(10,28,`H = ${h} · f = ${f} Hz`,undefined,19)+
  `<rect x="440" y="12" width="18" height="13" fill="${C.target}"/>`+text(466,24,'Execute','动作执行',16)+
  `<rect x="620" y="12" width="18" height="13" fill="${C.accent}"/>`+text(646,24,'Inference','推理',16)+
  `<rect x="818" y="12" width="18" height="13" fill="${C.grid}"/>`+text(844,24,'Wait','等待',16)+
  text(10,121,'Synchronous','同步执行',19)+sync+
  text(155,76,`Queue empty → request → wait ${ms} ms`,`队列耗尽 → 请求 → 等待 ${ms} ms`,17)+
  guide(oldEnd,87,146)+guide(oldEnd+delay,87,146)+
  text(10,260,'Asynchronous','异步执行',19)+async+
  text(155,183,`Remaining queue: ${(buffer*1000).toFixed(0)} ms`,`触发时的队列缓冲：${(buffer*1000).toFixed(0)} ms`,17)+
  `<path class="sv-buffer-bracket" d="M${x(request)} 218V207H${x(oldEnd)}V218"/>`+
  guide(request,218,342)+guide(ready,228,342)+
  text(10,320,'Prediction','预测计算',19)+bar(298,request,delay,'infer')+
  text(155,368,`Request at ${request.toFixed(2)} s → ready at ${ready.toFixed(2)} s`,`请求 ${request.toFixed(2)} s → 返回 ${ready.toFixed(2)} s`,17)+
  `<path class="sv-axis" d="M155 393H965"/>`+
  tick.map(t=>`<path class="sv-axis" d="M${x(t)} 389V398"/>`+text(x(t)-8,419,t.toFixed(1),undefined,14)).join('')+
  text(10,418,'Time (s)','时间（s）',16)+
  cells+text(155,511,`New chunk: skip ${dropped} elapsed actions; ${h-dropped} remain`,`新动作块：跳过已过时的 ${dropped} 步，保留 ${h-dropped} 步`,18));
}

function attentionComparison(){
 const cell=25,gap=4;
 const matrix=(x:number,y:number,mode:'sa'|'ca'|'joint')=>{
  const labels=['V','L','S','a₀','a₁','a₂'];
  let out=labels.map((label,i)=>text(x+i*(cell+gap)+5,y-13,label,undefined,16)).join('');
  for(let r=0;r<3;r++){
   out+=text(x-30,y+r*(cell+gap)+18,`a${['₀','₁','₂'][r]}`,undefined,16);
   for(let c=0;c<6;c++){
    const allowed=c<3||mode==='joint'||(mode==='sa'&&c-3<=r);
    out+=`<rect x="${x+c*(cell+gap)}" y="${y+r*(cell+gap)}" width="${cell}" height="${cell}" rx="3" fill="${allowed?(c<3?C.accent:C.target):'#fff'}" stroke="${allowed?'none':C.grid}"/>`;
   }
  }
  return out;
 };
 return svg('comparison',510,
  text(20,32,'SmolVLA',undefined,27,'sv-svg-title')+text(550,32,'π0.5',undefined,27,'sv-svg-title')+
  text(20,64,'16 layers · width 720','16 层 · 隐藏宽度 720',17)+text(550,64,'18 layers · width 1024','18 层 · 隐藏宽度 1024',17)+
  text(50,115,'SA · even layers','SA · 偶数层',18)+text(300,115,'CA · odd layers','CA · 奇数层',18)+text(650,115,'Joint attention','共同注意力',18)+
  matrix(50,161,'sa')+matrix(300,161,'ca')+matrix(650,161,'joint')+
  text(20,280,'Rows: action queries · Columns: keys','行：动作 query · 列：key',16)+
  `<rect x="20" y="307" width="17" height="17" rx="2" fill="${C.accent}"/>`+text(46,321,'V / L / S: vision, language, state','V / L / S：视觉、语言、状态',16)+
  `<rect x="460" y="307" width="17" height="17" rx="2" fill="${C.target}"/>`+text(486,321,'Action keys','动作 key',16)+
  `<rect x="760" y="307" width="17" height="17" rx="2" fill="white" stroke="${C.grid}"/>`+text(786,321,'Masked','屏蔽',16)+
  `<path class="sv-grid" d="M20 355H980"/>`+
  text(20,389,'Input time conditioning','输入端时间条件',20,'sv-svg-title')+text(550,389,'Layerwise time conditioning','逐层时间条件',20,'sv-svg-title')+
  text(20,428,'Action + time → MLP → expert','动作 + 时间 → MLP → 动作专家',18)+
  text(550,428,'Time → MLP → adaptive RMSNorm','时间 → MLP → adaptive RMSNorm',18)+
  text(20,475,'SA: prefix + causal action keys','SA：prefix + 因果动作 key',17)+
  text(550,475,'Prefix and expert: separate weights','prefix 与专家分支使用独立参数',17));
}

export function renderSmolFigure(id:string):string{
 let body='',controls='',en='',zh='';
 if(id==='features'){
  en='Observation features';zh='观察特征编码';
  body=svg(id,690,
   box(20,35,240,90,'N camera views','N 路相机','[B,N,3,512,512]')+
   box(300,35,300,90,'Image encoder + shuffle','视觉编码 + 空间重排','1024 patches → 64 tokens / view','1024 patch → 每视角 64 token')+
   box(20,175,240,90,'Language IDs','语言编号','[B,L]')+box(300,175,300,90,'Embedding','词嵌入','[B,L,960]')+
   box(20,315,240,90,'Robot state','机器人状态','[B,32] (padded)','[B,32]（补齐后）')+box(300,315,300,90,'State projection','状态投影','[B,1,960]')+
   box(660,105,320,190,'Concatenate prefix','拼接 prefix','P = 64N + L + 1','P = 64N + L + 1','green',[['[B,P,960]','[B,P,960]',22],['N=4, L=48 → P=305','N=4, L=48 → P=305',17]])+
   box(660,365,320,95,'VLM layers 0…15','VLM 第 0…15 层','Images/text do not read actions','图像/文字不读动作')+
   box(660,545,320,100,'Layerwise KV cache','逐层 KV 缓存','Logical: [B,P,5,64]','逻辑形状：[B,P,5,64]','green')+
   box(20,520,550,125,'Action expert, 16 layers','16 层动作专家','Noisy actions + time → [B,H,720]','噪声动作 + 时间 → [B,H,720]','warm',[['Even layers: SA · Odd layers: CA','偶数层 SA · 奇数层 CA',18]])+
   [[260,80,300,80],[260,220,300,220],[260,360,300,360],[600,80,660,150],[600,220,660,220],[600,360,660,270],[820,295,820,365],[820,460,820,545],[660,590,570,590]].map(a=>arrow(id,...a as [number,number,number,number])).join('')+
   text(20,470,'The observation is fixed during one sampling call.','一次采样内，观察条件保持不变。',19));
 }else if(id==='batch'){
  en='Flow-matching training';zh='流匹配训练';
  const nodes=[
   [20,25,450,110,'1 · Read B examples','1 · 读取 B 个样本','Images, text, state, future actions','图像、文字、状态、未来动作'],
   [530,25,450,110,'2 · Sample noise and t','2 · 抽取噪声与 t','x_t=(1−t)A+tε · u_t=ε−A','x_t=(1−t)A+tε · u_t=ε−A'],
   [530,220,450,110,'3 · Build prefix and suffix','3 · 构造 prefix 与 suffix','[B,P,960] and [B,H,720]','[B,P,960] 与 [B,H,720]'],
   [20,220,450,110,'4 · Expert → vector field → MSE','4 · 专家 → 向量场 → MSE','One prediction vθ(x_t,t,o)','一次预测 vθ(x_t,t,o)'],
   [20,420,960,100,'5 · Backward → clip → optimizer step','5 · 反向传播 → 梯度裁剪 → 优化器更新','Only trainable parameters receive updates','仅更新可训练参数']
  ] as const;
  body=svg(id,555,nodes.map((n,i)=>`<g data-batch-step="${i}" >${box(n[0],n[1],n[2],n[3],n[4],n[5],n[6],n[7],i===4?'green':'blue')}</g>`).join('')+arrow(id,470,80,530,80)+arrow(id,755,135,755,220)+arrow(id,530,275,470,275)+arrow(id,245,330,245,420));
 }else if(id==='sampling'){
  en='Action sampling';zh='动作采样';
  body=svg(id,300,box(20,25,960,80,'Observation → prefix prefill → fixed KV','观察 → prefix 预计算 → 固定 KV','Vision/VLM computed once for this call','视觉与 VLM 在这次调用中计算一次','green')+
   box(20,175,205,95,'Gaussian noise','高斯噪声','x₁ ∈ R^[B,H,D]','x₁ ∈ R^[B,H,D]')+
   box(280,175,420,95,'Action expert × 10','动作专家 × 10','x ← x − 0.1 vθ(x,t,o)','x ← x − 0.1 vθ(x,t,o)','warm')+
   box(755,175,225,95,'Action chunk','动作块','Crop → unnormalize','截维 → 反归一化')+arrow(id,225,220,280,220)+arrow(id,700,220,755,220)+arrow(id,490,105,490,175));
 }else if(id==='comparison'){
  en='Action attention';zh='动作注意力';body=attentionComparison();
 }else if(id==='normalization'){
  en='Four diagnostic streams, two independent branches';zh='四组诊断数值、两条独立路径';
  body=svg(id,560,
   text(20,35,'Demonstration reference branch','示教参考路径',21)+
   box(20,70,350,110,'Raw reference action','原始参考动作','a_ref at the intended target time','目标动作时刻的 a_ref')+
   box(600,70,380,110,'Normalized reference','归一化参考标签','z_ref = (a_ref − μ) / (σ + ε)','z_ref = (a_ref − μ) / (σ + ε)','green')+
   arrow(id,370,125,600,125)+text(485,107,'Normalize','标准化',17,'sv-center')+
   text(20,275,'Prediction branch: observation o_t, no future labels','预测路径：输入观察 o_t，不输入未来标签',21)+
   box(20,320,350,110,'Restored prediction','反归一化预测','a_hat = σ z_hat + μ','a_hat = σ z_hat + μ','warm')+
   box(600,320,380,110,'Model output before restoration','模型反归一化前的输出','z_hat[t,j] = Model(o_t)[j]','z_hat[t,j] = Model(o_t)[j]','warm')+
   arrow(id,600,375,370,375)+text(485,354,'Restore','反归一化',17,'sv-center')+
   text(20,492,'Raw panel: a_ref ↔ a_hat','原始域面板：a_ref ↔ a_hat',18)+
   text(535,492,'Normalized panel: z_ref ↔ z_hat','归一化面板：z_ref ↔ z_hat',18)+
   text(20,534,'Align by observation, chunk ID, j and intended action time.','按观察、chunk ID、j 与目标动作时刻对齐。',17));
 }else if(id==='latency'){
  en='Inference and execution timing';zh='推理与执行时序';body=latencySVG();
  controls=`<div class="controls sv-controls">${control('Latency (ms)','延迟（ms）','<input data-latency-ms type="range" min="0" max="1500" step="10" value="200">')}${control('Remaining fraction g','剩余比例 g','<input data-latency-g type="range" min="0" max="1" step="0.05" value="0.4">')}</div><p class="sv-readout" data-latency-readout aria-live="polite">${bi('50 actions · 30 Hz · 200 ms latency · buffer 667 ms · 6 elapsed steps.','50 步 · 30 Hz · 延迟 200 ms · 缓冲 667 ms · 已过去 6 步。')}</p>`;
 }else if(id==='rounding'){
  en='Weight-update rounding';zh='权重更新舍入';body=roundingSVG();
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
 'success-left':['Left','左'], 'success-center':['Center','中'], 'success-right':['Right','右'],
 'failure-grasp':['Failed grasp','抓取失败'], 'failure-base':['Excessive advance','前进过量'],
 'initial-pose-a':['Changed initial placement A','初始位置变化 A'], 'initial-pose-b':['Changed initial placement B','初始位置变化 B'],
 'continued-missed-grasp':['Missed grasp','漏抓'], 'continued-retreat':['Excessive retreat','后退过量'],
 'continued-success':['150-episode model','150 条模型'], 'pi05-rollout':['π0.5: collection rollout','π0.5：抓取与投放'],
 'two-toys-a':['Test A','测试 A'], 'two-toys-b':['Test B','测试 B']
};
export function renderSmolMedia(names:string){
 const ids=names.split('|'),twoToys=names==='two-toys-a|two-toys-b';
 return `<div class="sv-media-grid sv-${ids.length===3?'three':ids.length===2?'two':'one'}${twoToys?' sv-two-toys':''}">${ids.map(id=>{
  const label=clips[id];if(!label)throw Error(`Unknown clip: ${id}`);
  const wide=['initial-pose-a','initial-pose-b','continued-success','pi05-rollout','two-toys-b'].includes(id);
  return `<figure class="sv-clip"><video width="${wide?568:480}" height="${wide?320:480}" controls muted loop playsinline preload="none" poster="/assets/content/smolvla/${id}.webp" aria-label="${label[0]}" data-sv-video><source src="/assets/content/smolvla/${id}.mp4" type="video/mp4"></video><figcaption><span class="figure-title">${bi(...label)}</span></figcaption></figure>`;
 }).join('')}</div>`;
}
