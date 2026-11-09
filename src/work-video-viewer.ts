import {language,onLanguageChange} from './language.js';

/** Enlarge the existing player so its time, buffering and playback controls survive. */
export function mountWorkVideoViewer(deck:HTMLElement){
  const dialog=document.createElement('dialog');
  dialog.className='work-video-viewer';
  dialog.setAttribute('aria-labelledby','work-video-viewer-title');
  dialog.innerHTML='<header class="work-video-viewer-bar"><span id="work-video-viewer-title"></span><div><button type="button" data-video-fullscreen></button><button type="button" data-video-close></button></div></header><div class="work-video-stage"></div>';
  document.body.append(dialog);
  const stage=dialog.querySelector<HTMLElement>('.work-video-stage')!;
  const title=dialog.querySelector<HTMLElement>('#work-video-viewer-title')!;
  const close=dialog.querySelector<HTMLButtonElement>('[data-video-close]')!;
  const fullscreen=dialog.querySelector<HTMLButtonElement>('[data-video-fullscreen]')!;
  const buttons:HTMLButtonElement[]=[];
  let current:HTMLVideoElement|undefined,figure:HTMLElement|undefined,origin:HTMLElement|undefined,placeholder:HTMLSpanElement|undefined,previousOverflow='';
  const updateLanguage=()=>{
    for(const button of buttons){button.textContent=language==='zh'?'放大播放 ↗':'Enlarge ↗';button.setAttribute('aria-label',language==='zh'?'放大播放视频':'Enlarge video');}
    close.textContent=language==='zh'?'关闭 ×':'Close ×';
    fullscreen.textContent=language==='zh'?'全屏':'Fullscreen';
    title.textContent=figure?.querySelector(`figcaption [lang="${language==='zh'?'zh-CN':'en'}"]`)?.textContent?.trim()||(language==='zh'?'视频':'Video');
  };
  const open=(video:HTMLVideoElement,trigger:HTMLElement)=>{
    if(dialog.open)return;
    current=video;figure=video.closest<HTMLElement>('figure')!;origin=trigger;
    placeholder=document.createElement('span');placeholder.hidden=true;video.before(placeholder);
    stage.append(video);updateLanguage();
    previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
    dialog.showModal();close.focus();
    // Native controls may toggle playback on the originating click; play afterwards.
    requestAnimationFrame(()=>{if(dialog.open&&current===video)void video.play().catch(()=>{});});
  };
  const restorePlayer=()=>{
    if(!current)return;
    placeholder?.replaceWith(current);
    if(!current.closest('.slide.is-active'))current.pause();
    document.documentElement.style.overflow=previousOverflow;
    current=undefined;figure=undefined;placeholder=undefined;
    origin?.focus({preventScroll:true});origin=undefined;
  };
  const dismiss=()=>{if(dialog.open)dialog.close();restorePlayer();};
  close.addEventListener('click',dismiss);
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  fullscreen.hidden=!document.fullscreenEnabled;
  fullscreen.addEventListener('click',()=>{if(current)void current.requestFullscreen().catch(()=>{});});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dismiss();
  });
  dialog.addEventListener('close',()=>{if(!dialog.open)restorePlayer();});
  for(const video of deck.querySelectorAll<HTMLVideoElement>('video')){
    const figure=video.closest('figure')!;
    const button=document.createElement('button');button.type='button';button.className='figure-enlarge work-video-enlarge';
    button.dataset.enlargeVideo='';buttons.push(button);
    (figure.querySelector('figcaption')??figure).append(button);
    button.addEventListener('click',()=>open(video,button));
    video.addEventListener('click',event=>{
      if(dialog.contains(video))return;
      // Keep the native timeline, volume and playback controls clickable inline.
      const bounds=video.getBoundingClientRect();
      if(event.clientY>=bounds.bottom-48)return;
      event.preventDefault();event.stopPropagation();open(video,button);
    });
  }
  window.addEventListener('slidechange',()=>{if(dialog.open)dismiss();});
  onLanguageChange(updateLanguage);updateLanguage();
}
