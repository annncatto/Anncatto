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
for (const figure of document.querySelectorAll<HTMLElement>('[data-course-figure="topology"]')) {
  const picture=figure.querySelector<HTMLImageElement>('[data-topology-image]')!;
  const play=figure.querySelector<HTMLButtonElement>('[data-topology-play]')!;
  const assetBase=picture.src.slice(0,picture.src.lastIndexOf('/')+1);let step=0,playing=false;
  const update=()=>{play.setAttribute('aria-pressed',String(playing));play.textContent=language==='en'?(playing?'Pause evolution':'Play evolution'):(playing?'暂停演化':'播放演化');};
  figure.addEventListener('click',event=>{
    const target=event.target as Element;
    if(target.closest('[data-topology-play]')){playing=!playing;picture.src=assetBase+(playing?'topology-evolution.gif':`topology-${String(step).padStart(2,'0')}.png`);update();return;}
    const button=target.closest<HTMLButtonElement>('[data-topology-step]');if(!button)return;
    playing=false;step=Number(button.dataset.topologyStep);picture.src=assetBase+`topology-${String(step).padStart(2,'0')}.png`;
    figure.querySelectorAll<HTMLButtonElement>('[data-topology-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));update();
  });
  onLanguageChange(update);update();
}
