import {language,onLanguageChange} from './language.js';

interface ArchitectureController {
 setActive(active:boolean):void;
 play():void;
 pause():void;
 replay():void;
 refresh():void;
 getState():{running:boolean;clockMs:number;phase:string;durationMs:number;userPaused:boolean;reducedMotion:boolean;isStatic:boolean};
}

export function mountNativeArchitecture(){
 const wrapper=document.querySelector<HTMLElement>('[data-native-architecture]');
 if(!wrapper)return;
 const root=wrapper.querySelector<HTMLElement>('[data-architecture-root]')!;
 const dock=wrapper.querySelector<HTMLElement>('.g-architecture-frame')!;
 const slide=wrapper.closest<HTMLElement>('[data-slide]')!;
 const encoding=slide.querySelector<HTMLDetailsElement>('[data-model-encoding]');
 const shortScreen=matchMedia('(min-width:901px) and (max-height:850px)');
 const fitDetails=()=>{if(encoding)encoding.open=!shortScreen.matches;};
 shortScreen.addEventListener('change',fitDetails);fitDetails();
 const toggle=wrapper.querySelector<HTMLButtonElement>('[data-architecture-toggle]')!;
 const replay=wrapper.querySelector<HTMLButtonElement>('[data-architecture-replay]')!;
 const enlarge=wrapper.querySelector<HTMLButtonElement>('[data-architecture-enlarge]')!;
 const dialog=document.createElement('dialog');
 dialog.className='figure-viewer g-architecture-viewer';dialog.dataset.architectureViewer='';
 dialog.setAttribute('aria-labelledby','g-architecture-viewer-title');
 dialog.innerHTML='<header class="figure-viewer-bar"><span id="g-architecture-viewer-title"></span><div class="g-architecture-buttons"><button type="button" data-architecture-viewer-toggle></button><button type="button" data-architecture-viewer-replay></button><button class="figure-viewer-close" type="button" data-architecture-close></button></div></header><div class="figure-viewer-content g-architecture-viewer-content" tabindex="0"></div>';
 document.body.append(dialog);
 const content=dialog.querySelector<HTMLElement>('.g-architecture-viewer-content')!;
 const close=dialog.querySelector<HTMLButtonElement>('[data-architecture-close]')!;
 const toggles=[toggle,dialog.querySelector<HTMLButtonElement>('[data-architecture-viewer-toggle]')!];
 const replays=[replay,dialog.querySelector<HTMLButtonElement>('[data-architecture-viewer-replay]')!];
 let controller:ArchitectureController|null=null,loading:Promise<ArchitectureController>|null=null,overflow='';
 const labels=()=>{
  const zh=language==='zh',playing=controller?.getState().running??false;
  for(const button of toggles){button.textContent=zh?(playing?'暂停':'播放'):(playing?'Pause':'Play');button.setAttribute('aria-pressed',String(playing));button.disabled=controller?.getState().isStatic??false;}
  for(const button of replays){button.textContent=zh?'重播':'Replay';button.disabled=controller?.getState().isStatic??false;}
  enlarge.textContent=zh?'放大 ↗':'Enlarge ↗';
  close.textContent=zh?'关闭 ×':'Close ×';
  dialog.querySelector('#g-architecture-viewer-title')!.textContent=zh?'GR00T 2 · 模型架构':'GR00T 2 · Model architecture';
  root.setAttribute('aria-label',zh?'GR00T 2 官网模型架构动画':'Official GR00T 2 architecture animation');
 };
 const ensure=()=>loading??(loading=(async()=>{
  const url=new URL('./gr00t2-architecture-vendor.js',import.meta.url);
  url.search=new URL(import.meta.url).search;
  const module=await import(url.href) as {mountGr00tArchitecture:(root:HTMLElement)=>ArchitectureController};
  controller=module.mountGr00tArchitecture(root);
  labels();return controller;
 })());
 const active=()=>slide.classList.contains('is-active')&&!document.hidden;
 const sync=async()=>{
  if(!controller&&!active())return;
  const c=await ensure();c.setActive(active());labels();
 };
 root.addEventListener('architectureplaybackchange',labels);
 for(const button of toggles)button.addEventListener('click',async()=>{const c=await ensure();c.setActive(active());if(c.getState().running)c.pause();else c.play();labels();});
 for(const button of replays)button.addEventListener('click',async()=>{const c=await ensure();c.setActive(active());c.replay();labels();});
 enlarge.addEventListener('click',async()=>{
  const c=await ensure();c.setActive(false);content.append(root);
  overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  dialog.showModal();content.scrollTo(0,0);c.refresh();c.setActive(active());close.focus();
 });
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  controller?.setActive(false);dock.append(root);document.documentElement.style.overflow=overflow;
  controller?.refresh();void sync();enlarge.focus({preventScroll:true});
 });
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
 });
 window.addEventListener('slidechange',()=>{if(dialog.open&&!active())dialog.close();void sync();});
 document.addEventListener('visibilitychange',()=>void sync());
 onLanguageChange(labels);labels();void sync();
}
