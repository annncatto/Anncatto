import { language, onLanguageChange } from './language.js';
import { denoisingPoint, type DenoisingMode } from './slides-state.js';
export function mountOpenwamSlides(deck: HTMLElement) {
 const mask = deck.querySelector<HTMLElement>('[data-mask-demo]');
 if (mask) {
  const select = mask.querySelector<HTMLSelectElement>('select')!;
  const update = () => {
   const kind = select.value;
   const va = kind === 'video-sees-action' || kind === 'mutual';
   const av = kind === 'action-sees-video' || kind === 'mutual';
   for (let r=0;r<3;r++) for(let c=0;c<3;c++) {
    const allow = r===c||c===0||(r===1&&c===2&&va)||(r===2&&c===1&&av);
    mask.querySelector(`[data-mask-cell="${r},${c}"]`)?.setAttribute('fill',allow?'#d7e9e1':'#f1f4f4');
    const mark=mask.querySelector(`[data-mask-mark="${r},${c}"]`)!;
    mark.textContent=allow?'✓':'—';mark.setAttribute('fill',allow?'#4b9c80':'#8b9da2');
   }
   mask.querySelector('[data-mask-edge="va"]')?.setAttribute('opacity',va?'1':'0');
   mask.querySelector('[data-mask-edge="av"]')?.setAttribute('opacity',av?'1':'0');
   const labels:Record<string,[string,string]>={
    isolated:['Future world and action streams are isolated. Actions can still read the observed frame.','未来世界流与动作流隔离；动作仍可读取当前观测帧。'],
    'video-sees-action':['World queries read action keys; actions cannot read future world tokens.','世界 Query 读取动作 Key；动作不能读取未来世界 token。'],
    'action-sees-video':['Action queries read world keys; future world tokens do not read actions.','动作 Query 读取世界 Key；未来世界 token 不读取动作。'],
    mutual:['Both future world and action tokens can read each other. The observed frame remains clean.','未来世界与动作 token 互相可读；当前观测帧保持干净。']};
   mask.querySelector('[data-mask-readout]')!.textContent=labels[kind][language==='en'?0:1];
   for(const row of deck.querySelectorAll<HTMLElement>('[data-mask-result]'))row.classList.toggle('is-selected',row.dataset.maskResult===kind);
  };select.addEventListener('change',update);onLanguageChange(update);update();
 }
 const schedule=deck.querySelector<HTMLElement>('[data-schedule-demo]');
 if(schedule){
  const mode=schedule.querySelector<HTMLSelectElement>('[data-schedule-mode]')!;
  const alpha=schedule.querySelector<HTMLSelectElement>('[data-schedule-alpha]')!;
  const offset=schedule.querySelector<HTMLSelectElement>('[data-schedule-offset]')!;
  const step=schedule.querySelector<HTMLInputElement>('[data-schedule-step]')!;
  const play=schedule.querySelector<HTMLButtonElement>('[data-schedule-play]')!;
  let timer:ReturnType<typeof setInterval>|undefined;
  const stop=()=>{clearInterval(timer);timer=undefined;play.textContent=language==='en'?'Play 10 steps':'播放 10 步';play.setAttribute('aria-pressed','false');};
  const points=()=>Array.from({length:11},(_,i)=>denoisingPoint(i/10,mode.value as DenoisingMode,Number(alpha.value),Number(offset.value)));
  const update=()=>{
   const grid=points(),i=Number(step.value),point=grid[i];
   schedule.querySelector('[data-schedule-path]')!.setAttribute('d',grid.map((p,i)=>`${i?'L':'M'}${160+p.video*580} ${370-p.action*320}`).join(''));
   schedule.querySelector('[data-schedule-gridpoints]')!.innerHTML=grid.map((p,k)=>`<circle cx="${160+p.video*580}" cy="${370-p.action*320}" r="3.5" fill="${k<=i?'#237ab2':'#bfced3'}" stroke="white" stroke-width="1"><title>${k}: tᵥ=${p.video.toFixed(4)}, tₐ=${p.action.toFixed(4)}</title></circle>`).join('');
   const dot=schedule.querySelector('[data-schedule-dot]')!;dot.setAttribute('cx',String(160+point.video*580));dot.setAttribute('cy',String(370-point.action*320));
   schedule.querySelector('[data-schedule-readout]')!.textContent=`${language==='en'?'Step':'积分步'} ${i}/10 · tᵥ = ${point.video.toFixed(4)} · tₐ = ${point.action.toFixed(4)}`;
   const deltas=grid.slice(1).map((p,j)=>p.action-grid[j].action),updates=deltas.filter(d=>d>1e-10).length,max=Math.max(...deltas);
   schedule.querySelector('[data-schedule-metrics]')!.textContent=language==='en'?`Nonzero action updates: ${updates}/10 · largest Δtₐ = ${max.toFixed(4)}`:`动作有效更新：${updates}/10 次 · 最大 Δtₐ = ${max.toFixed(4)}`;
   alpha.disabled=!mode.value.includes('variance');offset.disabled=!mode.value.includes('offset');
  };
  [mode,alpha,offset].forEach(el=>el.addEventListener('change',()=>{stop();step.value='0';update();}));
  step.addEventListener('input',()=>{stop();update();});
  play.addEventListener('click',()=>{
   if(timer){stop();return;}step.value='0';update();play.textContent=language==='en'?'Pause':'暂停';play.setAttribute('aria-pressed','true');
   timer=setInterval(()=>{step.value=String(Number(step.value)+1);update();if(Number(step.value)>=10)stop();},360);
  });
  window.addEventListener('slidechange',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  onLanguageChange(()=>{stop();update();});update();
 }
}
