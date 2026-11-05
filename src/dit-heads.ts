import './smolvla.js';
import {language,onLanguageChange} from './language.js';
const figure=document.querySelector<HTMLElement>('[data-dit-window]');
if(figure){
 const input=figure.querySelector<HTMLInputElement>('[data-dit-nas]')!;
 const readout=figure.querySelector<HTMLElement>('[data-dit-window-readout]')!;
 const update=()=>{
  const n=Number(input.value),unused=31-n;
  for(const cell of figure.querySelectorAll<HTMLElement>('[data-position]')){
   const position=Number(cell.dataset.position);
   cell.className=position===0?'dit-history':position<=n?'dit-executed':'dit-unused';
  }
  readout.textContent=language==='zh'
   ? `执行 aₜ 至 aₜ₊${n-1}，共 ${n} 步；30 Hz 下为 ${(n/30).toFixed(3)} s。预测尾部 ${unused} 步留在本次执行窗口之外。`
   : `Execute aₜ through aₜ₊${n-1}: ${n} actions, ${(n/30).toFixed(3)} s at 30 Hz. ${unused} tail predictions remain outside this window.`;
 };
 input.addEventListener('input',update);onLanguageChange(update);update();
}
