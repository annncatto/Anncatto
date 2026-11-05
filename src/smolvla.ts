import {language,onLanguageChange} from './language.js';
import {latencyBudget,roundingSeries,type FloatFormat} from './smolvla-math.js';
import {latencySVG,roundingSVG} from './smolvla-figures.js';

const root=document.querySelector<HTMLElement>('.sv-article');
if(root){
 const zh=()=>language==='zh';
 const chapterDetails=()=>[...root.querySelectorAll<HTMLDetailsElement>('details.sv-chapter')];
 const reveal=(id:string)=>{
  const el=document.getElementById(id);if(!el||!root.contains(el))return;
  let parent:HTMLElement|null=el;
  while(parent&&parent!==root){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}
  requestAnimationFrame(()=>el.scrollIntoView({block:'start'}));
 };
 document.addEventListener('click',event=>{
  const a=(event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');if(!a)return;
  const id=decodeURIComponent(a.hash.slice(1));if(!id||!root.querySelector(`[id="${CSS.escape(id)}"]`))return;
  reveal(id);
 });
 addEventListener('hashchange',()=>reveal(decodeURIComponent(location.hash.slice(1))));
 if(location.hash)reveal(decodeURIComponent(location.hash.slice(1)));
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
}
