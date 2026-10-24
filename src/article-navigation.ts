import {language,onLanguageChange} from './language.js';

/** Keep enlarged figures inside the article, with a persistent escape route. */
export function mountArticleNavigation(){
 const article=document.querySelector<HTMLElement>('[data-reading-article]');if(!article)return;
 const dialog=document.createElement('dialog');dialog.className='figure-viewer';dialog.setAttribute('aria-labelledby','figure-viewer-title');
 dialog.innerHTML='<header class="figure-viewer-bar"><span id="figure-viewer-title"></span><button type="button" class="figure-viewer-close" data-viewer-close></button></header><div class="figure-viewer-content" tabindex="0"></div>';
 document.body.append(dialog);
 const title=dialog.querySelector<HTMLElement>('#figure-viewer-title')!,closeButton=dialog.querySelector<HTMLButtonElement>('[data-viewer-close]')!,content=dialog.querySelector<HTMLElement>('.figure-viewer-content')!;
 let origin:HTMLElement|undefined,openFigure:HTMLElement|undefined,lockedOverflow='';let serial=0;
 const updateLanguage=()=>{
  closeButton.textContent=language==='en'?'Close ×':'关闭 ×';closeButton.setAttribute('aria-label',language==='en'?'Close enlarged figure':'关闭放大图');
  for(const button of article.querySelectorAll<HTMLButtonElement>('[data-enlarge-figure]')){button.textContent=language==='en'?'Enlarge ↗':'放大 ↗';button.setAttribute('aria-label',language==='en'?'Enlarge figure':'放大图片');}
  if(openFigure){
   const lang=language==='en'?'en':'zh-CN';
   const label=openFigure.querySelector<HTMLElement>(`.figure-title [lang="${lang}"]`)??openFigure.querySelector<HTMLElement>(`figcaption [lang="${lang}"]`)??openFigure.querySelector<HTMLElement>('.figure-title');
   title.textContent=label?.textContent?.trim()||openFigure.querySelector('img')?.alt||(language==='en'?'Figure':'图片');
  }
 };
 const close=()=>dialog.close();closeButton.addEventListener('click',close);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 dialog.addEventListener('close',()=>{document.documentElement.style.overflow=lockedOverflow;content.replaceChildren();openFigure=undefined;origin?.focus({preventScroll:true});});
 const open=(figure:HTMLElement,trigger:HTMLElement,source:Element|null=figure.querySelector('svg,img:not([hidden])'))=>{
  if(!source)return;
  origin=trigger;openFigure=figure;const clone=source.cloneNode(true) as HTMLElement;
  if(source instanceof HTMLImageElement){const img=clone as HTMLImageElement;img.src=source.currentSrc||source.src;img.removeAttribute('loading');}
  // Marker and label IDs in a cloned SVG must remain local to that copy.
  const suffix=`-viewer-${++serial}`,ids=new Map<string,string>();
  for(const el of clone.querySelectorAll('[id]')){const id=el.id;ids.set(id,id+suffix);el.id=id+suffix;}
  for(const el of [clone,...clone.querySelectorAll('*')])for(const attr of [...el.attributes]){let value=attr.value;for(const [a,b] of ids){value=value.replaceAll(`url(#${a})`,`url(#${b})`);if((attr.name==='href'||attr.name==='aria-labelledby')&&(value===`#${a}`||value===a))value=value.replace(a,b);}if(value!==attr.value)el.setAttribute(attr.name,value);}
  content.replaceChildren(clone);updateLanguage();lockedOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();content.scrollTo(0,0);closeButton.focus();
 };
 for(const figure of article.querySelectorAll<HTMLElement>('figure')){
  if(!figure.querySelector('img,svg'))continue;
  const button=document.createElement('button');button.type='button';button.className='figure-enlarge';button.dataset.enlargeFigure='';
  const caption=figure.querySelector('figcaption');if(caption)caption.append(button);else figure.append(button);
  button.addEventListener('click',()=>open(figure,button));
  figure.addEventListener('click',event=>{const mouse=event as MouseEvent;if(mouse.button!==0||mouse.metaKey||mouse.ctrlKey||mouse.shiftKey||mouse.altKey)return;const target=event.target as Element;if(target.closest('button,input,select,a:not(:has(img))'))return;
   // Interactive plots keep their own click behavior; all raster pictures open here.
   if(target.closest('img')||figure.matches('.course-figure')&&target.closest('svg')){event.preventDefault();open(figure,button,target.closest('img,svg'));}
  });
 }
 const home=article.querySelector<HTMLAnchorElement>('[data-article-home]');
 home?.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||matchMedia('(prefers-reduced-motion: reduce)').matches)return;event.preventDefault();if(home.dataset.leaving)return;home.dataset.leaving='true';setTimeout(()=>location.assign(home.href),170);});
 window.addEventListener('pageshow',()=>{if(home)delete home.dataset.leaving;});
 onLanguageChange(updateLanguage);updateLanguage();
}
