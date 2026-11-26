import {language,onLanguageChange} from './language.js';

/** Reveal any ancestor <details> when jumping to an internal anchor inside an article. */
export function mountAnchorReveal(root:HTMLElement){
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
}

/** Floating precision tooltip for inline metrics (.sv-tip) and interactive SVG groups (.sv-svg-tip). */
export function mountTooltips(){
 if(document.querySelector('.sv-tooltip'))return;
 const zh=()=>language==='zh';
 const tip=document.createElement('div');
 tip.className='sv-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;
 let activeTip:Element|null=null,shownY=0;
 const tipText=(el:Element)=>zh()?(el.getAttribute('data-tip-zh')??el.getAttribute('data-tip')??''):(el.getAttribute('data-tip-en')??el.getAttribute('data-tip')??'');
 const hideTip=()=>{tip.hidden=true;activeTip=null;};
 const placeTip=(el:Element)=>{
  const r=el.getBoundingClientRect(),t=tip.getBoundingClientRect(),pad=12;
  const left=Math.max(pad,Math.min(innerWidth-t.width-pad,r.left+(r.width-t.width)/2));
  const top=r.top-t.height-8>=pad?r.top-t.height-8:Math.min(innerHeight-t.height-pad,r.bottom+8);
  tip.style.left=`${Math.round(left)}px`;tip.style.top=`${Math.round(top)}px`;
 };
 const showTip=(el:Element)=>{
  const text=tipText(el);if(!text){hideTip();return;}
  const host=el.closest('dialog')??document.body;
  if(tip.parentElement!==host)host.append(tip);
  tip.textContent=text;tip.hidden=false;activeTip=el;shownY=scrollY;
  placeTip(el);
 };
 const findTip=(target:EventTarget|null)=>target instanceof Element?target.closest('[data-tip],[data-tip-zh],[data-tip-en]'):null;
 document.addEventListener('pointerover',e=>{if((e as PointerEvent).pointerType==='touch')return;const el=findTip(e.target);if(el)showTip(el);});
 document.addEventListener('pointerout',e=>{const el=findTip(e.target);if(el&&el===activeTip&&!(e.relatedTarget instanceof Element&&el.contains(e.relatedTarget)))hideTip();});
 document.addEventListener('focusin',e=>{const el=findTip(e.target);if(el)showTip(el);});
 document.addEventListener('focusout',e=>{if(activeTip&&findTip(e.target)===activeTip)hideTip();});
 document.addEventListener('click',e=>{const el=findTip(e.target);if(el){if(activeTip===el)hideTip();else showTip(el);}else if(activeTip)hideTip();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeTip)hideTip();});
 addEventListener('scroll',()=>{if(!activeTip)return;if(Math.abs(scrollY-shownY)>32)hideTip();else placeTip(activeTip);},{passive:true});
 onLanguageChange(()=>{if(activeTip)showTip(activeTip);});
}
