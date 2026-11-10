import {mountWorkVideoViewer} from './work-video-viewer.js';
import {language,onLanguageChange,setLanguage} from './language.js';
const requestedLanguage=new URLSearchParams(location.search).get('lang');
if(requestedLanguage==='zh'||requestedLanguage==='en')setLanguage(requestedLanguage);
for (const group of document.querySelectorAll<HTMLElement>('[data-work-tabs]')) {
  const bar=group.querySelector<HTMLElement>('[role="tablist"]')!;
  const buttons=[...bar.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels=buttons.map(b=>document.getElementById(b.getAttribute('aria-controls')!)!);
  const select=(index:number,focus=false)=>{
    buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;if(i!==index)for(const v of panels[i].querySelectorAll('video'))v.pause();});
    if(focus)buttons[index].focus();
    window.dispatchEvent(new Event('resize'));
  };
  buttons.forEach((b,i)=>b.addEventListener('click',()=>select(i)));
  bar.addEventListener('keydown',e=>{
    const event=e as KeyboardEvent;let i=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    i=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;select(i,true);
  });
}
for (const controls of document.querySelectorAll<HTMLElement>('[data-work-path-controls]')) {
  const slide=controls.closest<HTMLElement>('[data-slide]')!;
  for (const button of controls.querySelectorAll<HTMLButtonElement>('[data-work-path]'))button.addEventListener('click',()=>{
    slide.dataset.trace=button.dataset.workPath;
    for(const other of controls.querySelectorAll('[data-work-path]'))other.setAttribute('aria-pressed',String(other===button));
  });
}
window.addEventListener('slidechange',()=>{for(const v of document.querySelectorAll<HTMLVideoElement>('.work-deck .slide:not(.is-active) video'))v.pause();});
const localizeWorkDiagrams=()=>{
  for(const node of document.querySelectorAll<SVGTextElement>('[data-work-diagram-en]')){
    node.textContent=language==='zh'?node.dataset.workDiagramZh!:node.dataset.workDiagramEn!;
  }
};
localizeWorkDiagrams();
onLanguageChange(()=>{localizeWorkDiagrams();window.dispatchEvent(new Event('resize'));});

const workDeck=document.querySelector<HTMLElement>('.work-deck');
if(workDeck)mountWorkVideoViewer(workDeck);
