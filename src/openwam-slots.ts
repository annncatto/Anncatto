import {mountAnchorReveal,mountTooltips} from './sv-tooltip.js';

const root=document.querySelector<HTMLElement>('.sv-article');
if(root){
 mountAnchorReveal(root);
 mountTooltips();
}

const demo=document.querySelector<HTMLElement>('[data-rotation-demo]');
if(demo){
 const input=demo.querySelector<HTMLInputElement>('input')!;
 const update=()=>{
  const angle=Number(input.value),radians=angle*Math.PI/180;
  const f=(n:number)=>Math.abs(n)<.00005?'0.0000':n.toFixed(4);
  demo.querySelector('[data-unwrapped]')!.textContent=angle.toFixed(1)+'°';
  demo.querySelector('[data-wrapped]')!.textContent=(((angle+180)%360+360)%360-180).toFixed(1)+'°';
  demo.querySelector('[data-column-one]')!.textContent=`[${f(Math.cos(radians))}, ${f(Math.sin(radians))}, 0]`;
  demo.querySelector('[data-column-two]')!.textContent=`[${f(-Math.sin(radians))}, ${f(Math.cos(radians))}, 0]`;
 };
 input.addEventListener('input',update);update();
}

// Interactive 5-layer video -> action masking sweep
const maskFigure=document.querySelector<HTMLElement>('[data-pathway-mask-interactive]');
if(maskFigure){
 const groups=[
  {range:'0–4',old:12.38,ft:14.23,base:14.77,zh:'浅层入口 · 后续 25 层可部分补偿',en:'Early entry · 25 later layers partly compensate'},
  {range:'5–9',old:5.87,ft:3.61,base:3.90,zh:'前段低谷 · 全网视觉依赖最低',en:'Early-mid lull · lowest visual reliance'},
  {range:'10–14',old:21.60,ft:25.28,base:28.02,zh:'中段主融合前半 · 动作开始集中读视频',en:'Mid-network band I · actions start heavy visual read'},
  {range:'15–19',old:27.03,ft:26.90,base:30.49,zh:'中段主融合后半 · 重训 10k 达中段次峰值',en:'Mid-network band II · secondary peak for Restarted'},
  {range:'20–24',old:11.61,ft:8.07,base:7.95,zh:'中后段低谷 · 跨模态敏感度回落至 ~8%',en:'Late-mid dip · sensitivity drops back to ~8%'},
  {range:'25–29',old:33.02,ft:35.05,base:32.50,zh:'末段输出前峰值 · 紧邻动作读出，冲击最大',en:'Pre-readout peak · directly precedes velocity head'},
 ];
 const stepBtns=[...maskFigure.querySelectorAll<HTMLButtonElement>('[data-mask-step]')];
 const playBtn=maskFigure.querySelector<HTMLButtonElement>('[data-step-play]');
 const svgGroups=[...maskFigure.querySelectorAll<SVGGElement>('[data-mask-group]')];
 const subZh=maskFigure.querySelector('[data-mask-sub-zh]');
 const subEn=maskFigure.querySelector('[data-mask-sub-en]');
 const titleZh=maskFigure.querySelector('[data-mask-title-zh]');
 const titleEn=maskFigure.querySelector('[data-mask-title-en]');
 const noteZh=maskFigure.querySelector('[data-mask-note-zh]');
 const noteEn=maskFigure.querySelector('[data-mask-note-en]');
 const valOld=maskFigure.querySelector('[data-mask-val="old"]');
 const valFt=maskFigure.querySelector('[data-mask-val="ft"]');
 const valBase=maskFigure.querySelector('[data-mask-val="base"]');
 const barOld=maskFigure.querySelector<HTMLElement>('[data-mask-bar="old"]');
 const barFt=maskFigure.querySelector<HTMLElement>('[data-mask-bar="ft"]');
 const barBase=maskFigure.querySelector<HTMLElement>('[data-mask-bar="base"]');
 let current=5;
 let timer:number|null=null;

 const stopPlay=()=>{
  if(timer!==null){window.clearInterval(timer);timer=null;}
  if(playBtn){
   playBtn.setAttribute('aria-pressed','false');
   const zh=playBtn.querySelector('[lang="zh-CN"]');
   const en=playBtn.querySelector('[lang="en"]');
   if(zh) zh.textContent='▶ 动画巡检';
   if(en) en.textContent='▶ Play sweep';
  }
 };

 const renderGroup=(idx:number)=>{
  current=(idx+groups.length)%groups.length;
  const g=groups[current];
  stepBtns.forEach((b,i)=>b.setAttribute('aria-pressed',i===current?'true':'false'));
  svgGroups.forEach((node,i)=>{
   const active=i===current;
   node.classList.toggle('is-active',active);
   const bg=node.querySelector<SVGRectElement>('.ow-mg-bg');
   if(bg){
    bg.setAttribute('fill',active?'#faf1ef':'white');
    bg.setAttribute('stroke',active?'#dfb8b0':'transparent');
   }
   node.querySelectorAll<SVGTextElement>('.ow-mg-label').forEach(t=>t.setAttribute('fill',active?'#b55d4c':'#61747b'));
   node.querySelectorAll<SVGTextElement>('.ow-mg-val').forEach(t=>{
    t.setAttribute('fill',active?'#b55d4c':'#556b73');
    t.setAttribute('font-weight',active?'600':'500');
   });
   const cut=node.querySelector<SVGPathElement>('.ow-mg-cut-arrow');
   if(cut){
    cut.setAttribute('stroke',active?'#b55d4c':'#556b73');
    cut.setAttribute('marker-end',active?'url(#mask-arrow-b55d4c)':'url(#mask-arrow-556b73)');
    if(active) cut.setAttribute('stroke-dasharray','6 5');
    else cut.removeAttribute('stroke-dasharray');
   }
   const ret=node.querySelector<SVGPathElement>('.ow-mg-ret-arrow');
   if(ret){
    ret.setAttribute('stroke',active?'#4b9c80':'#556b73');
    ret.setAttribute('marker-end',active?'url(#mask-arrow-4b9c80)':'url(#mask-arrow-556b73)');
   }
   const cross=node.querySelector<SVGGElement>('.ow-mg-cross');
   if(cross) cross.setAttribute('opacity',active?'1':'0');
  });
  if(subZh) subZh.textContent=`当前选中：仅屏蔽第 ${g.range} 层；每次恢复基线再测试下一组（全部 30 层继续运行）`;
  if(subEn) subEn.textContent=`Active cut: mask layers ${g.range} only; reset to baseline before each group (all 30 layers run)`;
  if(titleZh) titleZh.textContent=`切断第 ${g.range} 层视频→动作`;
  if(titleEn) titleEn.textContent=`Cut video→action at layers ${g.range}`;
  if(noteZh) noteZh.textContent=g.zh;
  if(noteEn) noteEn.textContent=g.en;
  if(valOld) valOld.textContent=`${g.old.toFixed(1)}%`;
  if(valFt) valFt.textContent=`${g.ft.toFixed(1)}%`;
  if(valBase) valBase.textContent=`${g.base.toFixed(1)}%`;
  if(barOld) barOld.style.width=`${Math.min(100,g.old/40*100).toFixed(1)}%`;
  if(barFt) barFt.style.width=`${Math.min(100,g.ft/40*100).toFixed(1)}%`;
  if(barBase) barBase.style.width=`${Math.min(100,g.base/40*100).toFixed(1)}%`;
 };

 stepBtns.forEach((btn,i)=>btn.addEventListener('click',()=>{stopPlay();renderGroup(i);}));
 svgGroups.forEach((node,i)=>{
  node.addEventListener('click',e=>{e.stopPropagation();stopPlay();renderGroup(i);});
  node.addEventListener('keydown',e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();stopPlay();renderGroup(i);}
  });
 });
 playBtn?.addEventListener('click',()=>{
  if(timer!==null){stopPlay();return;}
  playBtn.setAttribute('aria-pressed','true');
  const zh=playBtn.querySelector('[lang="zh-CN"]');
  const en=playBtn.querySelector('[lang="en"]');
  if(zh) zh.textContent='❚❚ 暂停巡检';
  if(en) en.textContent='❚❚ Pause sweep';
  renderGroup(current===5?0:current+1);
  timer=window.setInterval(()=>renderGroup(current+1),1800);
 });
 window.addEventListener('pagehide',stopPlay);
 renderGroup(5);
}

// Interactive lift-axis min/max normalization simulator
const liftSim=document.querySelector<HTMLElement>('[data-lift-sim]');
if(liftSim){
 type ScaleMode='old'|'merged'|'floor';
 const OLD_LO=599.5425,OLD_HI=599.7344,ADD_LO=599.8623,ADD_HI=599.9263;
 const modes:Record<ScaleMode,{lo:number;hi:number;spanLabel:string;shiftZh:string;shiftEn:string;alert:boolean}>={
  old:{lo:OLD_LO,hi:OLD_HI,spanLabel:'0.19 mm',shiftZh:'+2.00（新增高度越界至 +3.0）',shiftEn:'+2.00 (added data OOD to +3.0)',alert:true},
  merged:{lo:OLD_LO,hi:ADD_HI,spanLabel:'0.38 mm',shiftZh:'+1.00（实测状态 token ΔL2 = 49.5%）',shiftEn:'+1.00 (measured token ΔL2 = 49.5%)',alert:true},
  floor:{lo:0,hi:600,spanLabel:'600.0 mm',shiftZh:'+0.0006（几乎无变化）',shiftEn:'+0.0006 (negligible shift)',alert:false},
 };
 const modeBtns=[...liftSim.querySelectorAll<HTMLButtonElement>('[data-lift-mode]')];
 const slider=liftSim.querySelector<HTMLInputElement>('[data-lift-slider]')!;
 const heightOut=liftSim.querySelector<HTMLElement>('[data-lift-height]')!;
 const oldBand=liftSim.querySelector<HTMLElement>('[data-lift-band="old"]')!;
 const addBand=liftSim.querySelector<HTMLElement>('[data-lift-band="added"]')!;
 const dot=liftSim.querySelector<HTMLElement>('[data-lift-dot]')!;
 const spanEl=liftSim.querySelector<HTMLElement>('[data-lift-span]')!;
 const coordEl=liftSim.querySelector<HTMLElement>('[data-lift-coord]')!;
 const deltaZh=liftSim.querySelector<HTMLElement>('[data-lift-delta-zh]')!;
 const deltaEn=liftSim.querySelector<HTMLElement>('[data-lift-delta-en]')!;
 const deltaWrap=liftSim.querySelector<HTMLElement>('[data-lift-delta-wrap]')!;
 let activeMode:ScaleMode='merged';

 const norm=(h:number,lo:number,hi:number)=>2*(h-lo)/(hi-lo)-1;
 const toPct=(v:number)=>Math.max(3,Math.min(97,((v+1)/2)*88+6));

 const render=()=>{
  const m=modes[activeMode];
  const h=Number(slider.value);
  const val=norm(h,m.lo,m.hi);
  modeBtns.forEach(b=>b.setAttribute('aria-pressed',b.dataset.liftMode===activeMode?'true':'false'));
  heightOut.textContent=`${h.toFixed(2)} mm`;
  const o1=toPct(norm(OLD_LO,m.lo,m.hi)),o2=toPct(norm(OLD_HI,m.lo,m.hi));
  oldBand.style.left=`${Math.min(o1,o2).toFixed(1)}%`;
  oldBand.style.width=`${Math.max(1.8,Math.abs(o2-o1)).toFixed(1)}%`;
  const a1=toPct(norm(ADD_LO,m.lo,m.hi)),a2=toPct(norm(ADD_HI,m.lo,m.hi));
  addBand.style.left=`${Math.min(a1,a2).toFixed(1)}%`;
  addBand.style.width=`${Math.max(1.8,Math.abs(a2-a1)).toFixed(1)}%`;
  dot.style.left=`${toPct(val).toFixed(1)}%`;
  dot.classList.toggle('is-stable',!m.alert);
  spanEl.textContent=m.spanLabel;
  const sign=val>=0?'+':'−';
  coordEl.textContent=activeMode==='floor'?`${sign}${Math.abs(val).toFixed(4)}`:`${sign}${Math.abs(val).toFixed(2)}`;
  deltaZh.textContent=m.shiftZh;
  deltaEn.textContent=m.shiftEn;
  deltaWrap.classList.toggle('is-alert',m.alert);
  deltaWrap.classList.toggle('is-ok',!m.alert);
 };

 modeBtns.forEach(b=>b.addEventListener('click',()=>{
  activeMode=(b.dataset.liftMode as ScaleMode)||'merged';
  render();
 }));
 slider.addEventListener('input',render);
 render();
}
