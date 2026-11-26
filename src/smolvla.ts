import {language,onLanguageChange} from './language.js';
import {latencyBudget,roundingSeries,type FloatFormat} from './smolvla-math.js';
import {fastWeightsSVG,handoffSVG,latencySVG,roundingSVG} from './smolvla-figures.js';
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
   ['Full CA keeps all 280 valid observation units active across 10 Euler steps (state 20%, wrist_right 25%).','全量 CA 在 10 步去噪中激活全部 280 个有效观测单元（单 1 位 state 占 20%，wrist_right 占 25%）。'],
   ['Hard Top-16 drops over 94% of prefix units, hurting deep layer L15 (effective width 53.7) and raising loss +18%.','硬 Top-16 剪掉超 94% 前缀单元，伤及宽背景末层 L15（有效宽度 53.7），loss 升 18%。'],
   ['4 temporal landmarks compress the full 305-wide strip into 4 summaries, retaining 98% accuracy (+1.5% loss).','4 个时序地标把整条 305 宽前缀压成 4 个摘要，免重训即可保住 98% 精度（loss 仅 +1.5%）。'],
   ['MiTA combines 4 shared summaries with 12 routed raw units (budget 16), beating full 305 CA (loss 0.0126).','MiTA 把 4 个共享摘要与 12 个路由原始单元拼在同一 softmax 下（预算 16），loss 降至 0.0126。'],
  ];
  const playBtn=fw.querySelector<HTMLButtonElement>('[data-fw-play]')!;
  const stepBtns=[...fw.querySelectorAll<HTMLButtonElement>('[data-fw-step]')];
  const setPlay=(on:boolean)=>{
   if(fwTimer){window.clearInterval(fwTimer);fwTimer=0;}
   playBtn.setAttribute('aria-pressed',String(on));
   playBtn.innerHTML=on?'<span lang="en">Pause</span><span lang="zh-CN">暂停</span>':'<span lang="en">Play</span><span lang="zh-CN">播放</span>';
   if(on)fwTimer=window.setInterval(()=>renderFw((fwStep+1)%4),3400);
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
 const ho=root.querySelector<HTMLElement>('[data-sv-figure="handoff"]');
 if(ho){
  let hoMode:'sync'|'blend'='sync';
  const hoBtns=[...ho.querySelectorAll<HTMLButtonElement>('[data-ho-mode]')];
  const renderHo=(mode:'sync'|'blend')=>{
   hoMode=mode;
   ho.querySelector('.sv-diagram-scroll')!.innerHTML=handoffSVG(hoMode);
   hoBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-ho-mode')===hoMode)));
   const en=hoMode==='sync'
    ?'Executing the old chunk to step 24 (−11) then hard-switching to a freshly replanned chunk (−79) produces the ~0.9 s sawtooth while the arm lags out of phase.'
    :'Conditioning the new chunk on the committed prefix (RTC) or blending overlapping steps removes the abrupt step-25 drop and lets the arm track smoothly.';
   const z=hoMode==='sync'
    ?'旧块执行到第 24 步（−11）后硬切入按现场视角重规划的新块起点（−79），造成每 ~0.9 s 的锯齿骤降与物理臂反相滞后。'
    :'将旧块已确定前缀作为新块条件（RTC）或对重叠步平滑聚合，可消除第 25 步的阶跃断层，使物理臂连续跟踪。';
   ho.querySelector('[data-ho-readout]')!.textContent=zh()?z:en;
  };
  hoBtns.forEach(b=>b.addEventListener('click',()=>renderHo(b.getAttribute('data-ho-mode') as 'sync'|'blend')));
  onLanguageChange(()=>renderHo(hoMode));
  renderHo('sync');
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
