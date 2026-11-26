import {language,onLanguageChange} from './language.js';
import {latencyBudget,roundingSeries,type FloatFormat} from './smolvla-math.js';
import {fastWeightsSVG,latencySVG,roundingSVG} from './smolvla-figures.js';
import {mountAnchorReveal,mountTooltips} from './sv-tooltip.js';

const root=document.querySelector<HTMLElement>('.sv-article');
if(root){
 const zh=()=>language==='zh';
 const chapterDetails=()=>[...root.querySelectorAll<HTMLDetailsElement>('details.sv-chapter')];
 mountAnchorReveal(root);
 for(const detail of chapterDetails())detail.addEventListener('toggle',()=>{
  for(const video of detail.querySelectorAll<HTMLVideoElement>('video'))if(!detail.open)video.pause();
 });

 const rounding=root.querySelector<HTMLElement>('[data-sv-figure="rounding"]');
 function updateRounding(){
  if(!rounding)return;
  const format=rounding.querySelector<HTMLSelectElement>('[data-round-format]')!.value as FloatFormat;
  const weight=Number(rounding.querySelector<HTMLSelectElement>('[data-round-weight]')!.value),delta=10**Number(rounding.querySelector<HTMLInputElement>('[data-round-delta]')!.value);
  rounding.querySelector('.sv-diagram-scroll')!.innerHTML=roundingSVG(format,weight,delta);
  const p=roundingSeries(weight,delta,format),last=p.at(-1)!;
  const unchanged=p.slice(1).filter((v,i)=>v.direct===p[i].direct).length;
  rounding.querySelector('[data-round-readout]')!.textContent=zh()?`每步减去 ${delta.toExponential(2)} · ${unchanged}/100 次直接写回未改变值。最终：直接写回 ${last.direct.toPrecision(7)}；FP32 累计 ${last.master.toPrecision(7)}。`:`Decrement ${delta.toExponential(2)} · ${unchanged}/100 direct writes unchanged. Final: direct ${last.direct.toPrecision(7)}; FP32 accumulation ${last.master.toPrecision(7)}.`;
 }
 rounding?.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',updateRounding));
 const latency=root.querySelector<HTMLElement>('[data-sv-figure="latency"]');
 function updateLatency(){
  if(!latency)return;
  const ms=Number(latency.querySelector<HTMLInputElement>('[data-latency-ms]')!.value),g=Number(latency.querySelector<HTMLInputElement>('[data-latency-g]')!.value),b=latencyBudget(50,30,g,ms);
  latency.querySelector('.sv-diagram-scroll')!.innerHTML=latencySVG(50,30,g,ms);
  latency.querySelector('[data-latency-readout]')!.textContent=zh()?`延迟 ${ms} ms · g=${g.toFixed(2)} · 缓冲 ${(b.buffer*1000).toFixed(0)} ms · 已过去 ${b.elapsedSteps} 步 · 队列等待 ${(b.idle*1000).toFixed(0)} ms。`:`Latency ${ms} ms · g=${g.toFixed(2)} · buffer ${(b.buffer*1000).toFixed(0)} ms · ${b.elapsedSteps} elapsed steps · queue wait ${(b.idle*1000).toFixed(0)} ms.`;
 }
 latency?.querySelectorAll('input').forEach(el=>el.addEventListener('input',updateLatency));
 const fw=root.querySelector<HTMLElement>('[data-sv-figure="fastweights"]');
 if(fw){
  let fwStep=0,fwTimer=0;
  const fwNotes:[string,string][]=[
   ['Odd CA layers map 305 frozen VLM K/V through FP32 W_K, W_V into a 305-wide scene-specific MLP.','奇数 CA 层将冻结 VLM 的 305 个 K/V 经 FP32 W_K, W_V 映射为 305 宽场景专属快权重 MLP。'],
   ['Splitting the 305 units by source: the single state token carries 20.4% CA mass (40% at L01); wrist_right carries 25.2%.','305 个单元拆成 6 路并行子网：仅 1 位的 state 承载 20.4% 权重（L01 达 40%），wrist_right 占 25.2%。'],
   ['Odd CA reuses one fixed 305-wide observation MLP over all 10 Euler steps; even SA appends a causal (t+1) action sub-MLP.','奇数 CA 在 10 步去噪中反复复用同一张 305 宽网络；偶数 SA 额外拼上因果动作子网络。'],
   ['Without retraining, 4 temporal summaries (Agent) retain 98% accuracy, and MiTA (budget 16) matches full 305-token CA.','免重训对照中，4 个时序地标压缩即可保住 98% 精度；MiTA 仅用预算 16 即可追平全量 305 注意力。'],
  ];
  const playBtn=fw.querySelector<HTMLButtonElement>('[data-fw-play]')!;
  const stepBtns=[...fw.querySelectorAll<HTMLButtonElement>('[data-fw-step]')];
  const setPlay=(on:boolean)=>{
   if(fwTimer){window.clearInterval(fwTimer);fwTimer=0;}
   playBtn.setAttribute('aria-pressed',String(on));
   playBtn.innerHTML=on?'<span lang="en">Pause</span><span lang="zh-CN">暂停</span>':'<span lang="en">Play</span><span lang="zh-CN">播放</span>';
   if(on)fwTimer=window.setInterval(()=>renderFw((fwStep+1)%4),3600);
  };
  const renderFw=(idx:number)=>{
   fwStep=idx;
   fw.querySelector('.sv-diagram-scroll')!.innerHTML=fastWeightsSVG(fwStep);
   stepBtns.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===fwStep)));
   const [en,z]=fwNotes[fwStep];
   fw.querySelector('[data-fw-readout]')!.textContent=zh()?z:en;
  };
  stepBtns.forEach((b,i)=>b.addEventListener('click',()=>{setPlay(false);renderFw(i);}));
  playBtn.addEventListener('click',()=>setPlay(playBtn.getAttribute('aria-pressed')!=='true'));
  onLanguageChange(()=>renderFw(fwStep));
  renderFw(0);
 }
 onLanguageChange(()=>{updateRounding();updateLatency();});
 updateRounding();updateLatency();

 // Only visible clips loop; user pauses and reduced-motion/data preferences win.
 const videos=[...root.querySelectorAll<HTMLVideoElement>('[data-sv-video]')];
 const userPaused=new WeakSet<HTMLVideoElement>(),automaticPause=new WeakSet<HTMLVideoElement>();
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const saveData=Boolean((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData);
 const pause=(video:HTMLVideoElement)=>{if(!video.paused){automaticPause.add(video);video.pause();}};
 const visibility=new IntersectionObserver(entries=>entries.forEach(entry=>{
  const video=entry.target as HTMLVideoElement;
  if(entry.isIntersecting&&entry.intersectionRatio>.25&&!document.hidden&&!reduceMotion.matches&&!saveData&&!userPaused.has(video)){
   video.muted=true;void video.play().catch(()=>{});
  }else if(!entry.isIntersecting)pause(video);
 }),{threshold:[0,.25]});
 for(const video of videos){visibility.observe(video);
  video.addEventListener('pause',()=>{if(automaticPause.has(video))automaticPause.delete(video);else userPaused.add(video);});
  video.addEventListener('play',()=>{userPaused.delete(video);for(const other of videos)if(other!==video&&other.closest('.sv-media-grid')!==video.closest('.sv-media-grid'))pause(other);});
 }
 reduceMotion.addEventListener('change',()=>{if(reduceMotion.matches)videos.forEach(pause);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)videos.forEach(pause);});

 mountTooltips();
}
