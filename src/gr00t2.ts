import {mountNativeArchitecture} from './gr00t2-architecture.js';
import {language,onLanguageChange,setLanguage} from './language.js';
const requested=new URLSearchParams(location.search).get('lang');
if(requested==='en'||requested==='zh')setLanguage(requested);
mountNativeArchitecture();
const controls=document.querySelector<HTMLElement>('[data-denoise-controls]');
if(controls){
 let step=0;
 const buttons=[...controls.querySelectorAll<HTMLButtonElement>('[data-denoise-step]')];
 const description=controls.querySelector<HTMLElement>('[data-denoise-explanation]')!;
 const update=()=>{
  for(const button of buttons)button.setAttribute('aria-pressed',String(Number(button.dataset.denoiseStep)===step));
  for(const rect of document.querySelectorAll<SVGElement>('[data-denoise-highlight]'))rect.setAttribute('opacity',String(Number(rect.dataset.denoiseHighlight)===step?1:0));
  const joint=step%2===0;
  description.textContent=language==='zh'?(joint?'更新视频与动作潜变量，刷新视频／状态 K、V。':'只更新动作；复用前一次联合计算的视频／状态 K、V。'):(joint?'Update video and action latents; refresh video/state K/V.':'Update actions only; reuse video/state K/V from the preceding joint pass.');
 };
 for(const button of buttons)button.addEventListener('click',()=>{step=Number(button.dataset.denoiseStep);update();});
 onLanguageChange(update);update();
}
const queue=document.querySelector<HTMLElement>('.g-queue-inspector');
if(queue){
 let delay=4;
 const update=()=>{
  for(const button of queue.querySelectorAll<HTMLButtonElement>('[data-queue-delay]'))button.setAttribute('aria-pressed',String(Number(button.dataset.queueDelay)===delay));
  for(const cell of queue.querySelectorAll<HTMLElement>('[data-command-index]')){const committed=Number(cell.dataset.commandIndex)<delay;cell.className=committed?'committed':'generated';}
  queue.querySelector<HTMLElement>('[data-queue-description]')!.textContent=language==='zh'?`前 ${delay} 条已确定的指令作为条件，预测后续动作；每格代表 40 ms。`:`${delay} committed commands condition the continuation; each grid cell represents 40 ms.`;
 };
 for(const button of queue.querySelectorAll<HTMLButtonElement>('[data-queue-delay]'))button.addEventListener('click',()=>{delay=Number(button.dataset.queueDelay);update();});
 onLanguageChange(update);update();
}
