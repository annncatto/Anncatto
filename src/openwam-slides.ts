import { language, onLanguageChange } from './language.js';
import { denoisingPoint } from './slides-state.js';
export function mountOpenwamSlides(deck: HTMLElement) {
 const joint=deck.querySelector<HTMLElement>('[data-joint-demo]');
 if(joint){
  const step=joint.querySelector<HTMLInputElement>('[data-joint-step]')!;
  const play=joint.querySelector<HTMLButtonElement>('[data-joint-play]')!;
  let timer:ReturnType<typeof setInterval>|undefined;
  const update=()=>{
   const index=Number(step.value), point=denoisingPoint(index/10,'sync');
   joint.querySelector('[data-joint-readout]')!.textContent=`${language==='en'?'Step':'积分步'} ${index}/10 · tᵥ = tₐ = ${point.video.toFixed(4)}`;
   for(const tick of joint.querySelectorAll<SVGCircleElement>('[data-joint-tick]')){
    const i=Number(tick.dataset.jointTick), t=denoisingPoint(i/10,'sync').video;
    tick.setAttribute('cx',String(320+t*600));
    tick.setAttribute('fill',i<=index?'#4b9c80':'#d5e1e2');
    tick.setAttribute('r',i===index?'10':'5');
    tick.innerHTML=`<title>${i}/10 · tᵥ = tₐ = ${t.toFixed(4)}</title>`;
   }
  };
  const stop=()=>{clearInterval(timer);timer=undefined;joint.classList.remove('is-playing');play.textContent=language==='en'?'Play 10 steps':'播放 10 步';play.setAttribute('aria-pressed','false');};
  step.addEventListener('input',()=>{stop();update();});
  play.addEventListener('click',()=>{
   if(timer){stop();return;}
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){step.value=String((Number(step.value)+1)%11);update();return;}
   step.value='0';update();joint.classList.add('is-playing');play.textContent=language==='en'?'Pause':'暂停';play.setAttribute('aria-pressed','true');
   timer=setInterval(()=>{step.value=String(Number(step.value)+1);update();if(Number(step.value)===10)stop();},650);
  });
  window.addEventListener('slidechange',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  onLanguageChange(()=>{stop();update();});update();
 }
}
