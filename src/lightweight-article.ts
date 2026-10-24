import {language,onLanguageChange} from './language.js';
import {lightweightDiagram,lightweightMessage,type LightFigure} from './lightweight-diagrams.js';
for(const figure of document.querySelectorAll<HTMLElement>('[data-lightweight-figure]')) {
  const id=figure.dataset.lightweightFigure as LightFigure;let choice=0;
  const update=()=>{
    figure.querySelector('[data-lw-plot]')!.innerHTML=lightweightDiagram(id,choice,language);
    figure.querySelector('[data-lw-message]')!.textContent=lightweightMessage(id,choice,language);
    figure.querySelectorAll<HTMLButtonElement>('[data-lw-choice]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.lwChoice)===choice)));
  };
  figure.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('[data-lw-choice]');if(b){choice=Number(b.dataset.lwChoice);update();}});
  onLanguageChange(update);update();
}
for (const frame of document.querySelectorAll<HTMLIFrameElement>('[data-studio-embed]')) {
  const update=()=>frame.contentWindow?.postMessage({type:'anncatto:language',language},location.origin);
  frame.addEventListener('load',update);onLanguageChange(update);
  addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==frame.contentWindow)return;
    if(event.data?.type==='anncatto:studio-height' && Number.isFinite(event.data.height))frame.style.height=`${Math.max(500,Math.min(4000,event.data.height))}px`;
  });
}
