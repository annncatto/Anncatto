import {mountTopology} from './lightweight-topology.js';
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
for(const figure of document.querySelectorAll<HTMLElement>('[data-course-figure="topology"]'))mountTopology(figure);
