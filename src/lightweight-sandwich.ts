import {C,FONT} from './theme.js';

type Lang='en'|'zh';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const text=(x:number,y:number,en:string,zh:string,l:Lang,size=17,anchor='middle',color=C.ink)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${l==='en'?en:zh}</text>`;
const path=(d:string,color=C.ink,width=2,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const box=(x:number,y:number,w:number,h:number,fill='#fff')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${C.grid}"/>`;
const arrow=(id:string,d:string,color=C.ink)=>path(d,color,2,`marker-end="url(#${id}-arrow)"`);
const orange='#b97c58',face='#e4eff8',core='#edf6f1';
function svg(id:string,height:number,title:string,draw:(l:Lang)=>string){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" role="img" aria-label="${title}" style="font-family:${FONT}"><title>${title}</title><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><g lang="en">${draw('en')}</g><g lang="zh-CN">${draw('zh')}</g></svg>`;}

/** Symmetric, perfectly bonded section; SI inputs, rigidity in N and N·m². */
export function sandwichSection(b:number,t:number,c:number,faceE:number,coreE:number){
 if(![b,t,c,faceE].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(coreE)||coreE<0)throw Error('Invalid sandwich section');
 const distance=c+t,height=c+2*t,faceI=b*(t**3/6+t*distance**2/2),coreI=b*c**3/12;
 return{distance,height,faceI,coreI,axial:2*faceE*b*t+coreE*b*c,faceBending:faceE*faceI,coreBending:coreE*coreI,bending:faceE*faceI+coreE*coreI};
}
/** Effective shear rigidity is supplied explicitly, rather than inferred from EA. */
export function sandwichBuckling(eulerLoad:number,shearRigidity:number){
 if(![eulerLoad,shearRigidity].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid buckling rigidity');
 return 1/(1/eulerLoad+1/shearRigidity);
}
export function sandwichWrinkling(faceE:number,coreNormalE:number,coreShearG:number,coefficient=.5){
 if(![faceE,coreNormalE,coreShearG,coefficient].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid wrinkling input');
 return coefficient*Math.cbrt(faceE*coreNormalE*coreShearG);
}
export interface SandwichSizingInput {
 length:number;width:number;load:number;faceDensity:number;coreDensity:number;
 faceE:number;coreE:number;coreG:number;faceAllow:number;coreShearAllow:number;
 wrinkleCoefficient:number;faceMinimum:number;coreMinimum:number;coreMaximum:number;
}
/** Teaching inputs, not grade-specific material allowables. All values are SI. */
export const sandwichSizingExample:Readonly<SandwichSizingInput>=Object.freeze({
 length:1,width:.1,load:500,faceDensity:2700,coreDensity:80,
 faceE:70e9,coreE:80e6,coreG:30e6,faceAllow:150e6,coreShearAllow:.8e6,
 wrinkleCoefficient:.5,faceMinimum:.0003,coreMinimum:.001,coreMaximum:.06,
});
/** Closed-form reduction to one dimension, with all physical/production bounds retained. */
export function sandwichSizingData(overrides:Partial<SandwichSizingInput>={},sampleCount=241){
 const parameters={...sandwichSizingExample,...overrides};
 if(!Object.values(parameters).every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(sampleCount)||sampleCount<2)throw Error('Invalid sandwich sizing input');
 const p=parameters,moment=p.load*p.length/4,shear=p.load/2;
 const wrinkling=sandwichWrinkling(p.faceE,p.coreE,p.coreG,p.wrinkleCoefficient),faceLimit=Math.min(p.faceAllow,wrinkling),K=moment/(p.width*faceLimit);
 const lowerCore=Math.max(p.coreMinimum,shear/(p.width*p.coreShearAllow));
 if(lowerCore>p.coreMaximum)throw Error('No feasible core thickness');
 // Rationalized quadratic root avoids subtracting nearly equal numbers.
 const requiredFace=(c:number)=>2*K/(c+Math.sqrt(c*c+4*K));
 const evaluate=(c:number)=>{const required=requiredFace(c),t=Math.max(p.faceMinimum,required);return{core:c,face:t,requiredFace:required,mass:p.width*p.length*(2*p.faceDensity*t+p.coreDensity*c),faceStress:moment/(p.width*t*(c+t)),coreShear:shear/(p.width*c)};};
 const a=1-p.coreDensity/p.faceDensity,stationary=a>0?2*Math.sqrt(K)*a/Math.sqrt(1-a*a):0;
 const manufacturingIntersection=K/p.faceMinimum-p.faceMinimum;
 const candidates=[lowerCore,p.coreMaximum,stationary,manufacturingIntersection].filter(c=>c>=lowerCore&&c<=p.coreMaximum).map(evaluate);
 const optimum=candidates.reduce((best,item)=>item.mass<best.mass?item:best);
 const samples=Array.from({length:sampleCount},(_,i)=>evaluate(lowerCore+(p.coreMaximum-lowerCore)*i/(sampleCount-1)));
 const section=sandwichSection(p.width,optimum.face,optimum.core,p.faceE,p.coreE),effectiveShear=p.coreG*p.width*optimum.core;
 return{parameters,moment,shear,wrinkling,faceLimit,K,lowerCore,stationary,manufacturingIntersection,optimum,samples,
  check:{bendingRigidity:section.bending,shearRigidity:effectiveShear,bendingDeflection:p.load*p.length**3/(48*section.bending),shearDeflection:p.load*p.length/(4*effectiveShear)}};
}

export const sandwichFigures=['sandwichsection','sandwichfailures','sandwichsizing'] as const;
export function sandwichFigure(id:string):string|undefined{
 let title:[string,string],description:[string,string],body:string;
 if(id==='sandwichsection'){
  title=['Sandwich load sharing and section fields','夹层传力与截面分布'];
  description=['Thin faces carry the bending couple; the core transfers shear. The normalized field sketch uses Ec/Ef = 0.05 to show the interface stress jump.','薄面板承担弯曲力偶，芯材传递剪力。归一化分布图取 Ec/Ef＝0.05，以显示界面处的正应力跳变。'];
  body=svg(id,440,title[0],l=>{
   let b=text(176,35,'Load path','传力分工',l,21)+text(500,35,'Normal stress','正应力',l,21)+text(746,35,'Axial strain','轴向应变',l,21);
   const faceHeight=200/22,topCentre=110+faceHeight/2,bottomCentre=310-faceHeight/2;
   b+=box(82,110,180,faceHeight,face)+box(82,110+faceHeight,180,20*faceHeight,core)+box(82,310-faceHeight,180,faceHeight,face);
   b+=path('M69 210H286',C.muted,1,'stroke-dasharray="5 4"')+text(171,173,'Core','芯材',l,18)+text(171,200,'Shear V','剪力 V',l,17)+arrow(id,'M171 225V272',C.target);
   b+=arrow(id,`M340 ${topCentre}H268`,C.accent)+arrow(id,`M268 ${bottomCentre}H340`,C.accent)+text(304,102,'N = M/d','N = M/d',l,15)+text(306,328,'N = M/d','N = M/d',l,15);
   b+=text(172,83,'Compression face','受压面板',l,17)+path('M172 89V107',C.muted,1)+text(172,351,'Tension face','受拉面板',l,17)+path('M172 313V333',C.muted,1);
   b+=path('M40 110V310M32 110H48M32 310H48',C.muted,1.5)+text(24,216,'h','h',l,18);
   b+=path(`M59 ${topCentre}V${bottomCentre}M53 ${topCentre}H65M53 ${bottomCentre}H65`,orange,1.5)+text(57,340,'d','d',l,18);
   b+=text(175,388,'h = hc + 2tf','h = hc + 2tf',l,19)+text(175,416,'d = hc + tf','d = hc + tf',l,19);
   for(const x of [500,746]){
    b+=arrow(id,`M${x-99} 210H${x+103}`,C.muted)+arrow(id,`M${x} 323V86`,C.muted)+text(x+15,86,'z','z',l,16);
    for(const z of [-20/22,20/22])b+=path(`M${x-94} ${210-100*z}H${x+94}`,C.grid,1,'stroke-dasharray="4 3"');
   }
   const Z=(z:number)=>210-100*z,S=(s:number)=>500+80*s;
   const stress=[[-1,1],[-20/22,20/22],[-20/22,.05*20/22],[20/22,-.05*20/22],[20/22,-20/22],[1,-1]];
   b+=path(stress.map(([z,s],i)=>`${i?'L':'M'}${S(s)} ${Z(z)}`).join(''),C.accent,3);
   b+=path(`M${746+80} 310L${746-80} 110`,C.target,3);
   b+=text(500,355,'σx = −E(z) κz','σx = −E(z) κz',l,19)+text(746,355,'εx = −κz','εx = −κz',l,19);
   b+=text(500,391,'Stress jumps at interfaces','界面正应力发生跳变',l,16)+text(746,391,'Strain stays continuous','轴向应变保持连续',l,16);
   return b;
  });
 }else if(id==='sandwichfailures'){
  title=['Four material and local failure modes','四种材料与局部失效'];
  description=['Face yielding, core shear failure, face wrinkling and intracell dimpling are different checks. Global column buckling is treated separately. Schematics are not predicted deformation amplitudes.','面板屈服、芯剪切破坏、面板皱褶和胞格凹陷需要分别检查；整体压杆屈曲另行校核。变形幅度为示意。'];
  body=svg(id,510,title[0],l=>{
   let b='';for(const [x,y]of [[20,15],[460,15],[20,265],[460,265]])b+=box(x,y,420,230);
   b+=text(230,49,'Face yielding','面板屈服',l,21)+box(78,111,301,60,core)+box(78,103,301,8,'#f5d6bd')+box(78,171,301,8,face);
   b+=arrow(id,'M42 107H73',orange)+arrow(id,'M416 107H384',orange)+arrow(id,'M73 175H42',C.accent)+arrow(id,'M384 175H416',C.accent);
   b+=text(230,215,'Face stress reaches material strength','面板应力达到材料强度',l,17);
   b+=text(670,49,'Core shear failure','芯材剪切破坏',l,21)+`<path d="M520 172L543 112H814L791 172Z" fill="${core}" stroke="${C.target}"/>`;
   b+=path('M543 108H814M520 176H791',C.accent,7)+arrow(id,'M615 87H726',orange)+arrow(id,'M704 193H593',orange);
   b+=path('M572 123L554 159M606 123L588 159M640 123L622 159M674 123L656 159M708 123L690 159M742 123L724 159',C.target,1);
   b+=text(670,228,'Core shear reaches its allowable','芯材剪应力达到许用值',l,17);
   b+=text(230,300,'Face wrinkling','面板皱褶',l,21)+box(78,366,301,60,core)+path('M78 426H379',C.accent,5);
   let wave='';for(let i=0;i<=120;i++){const x=78+301*i/120;wave+=`${i?'L':'M'}${x} ${366-13*Math.sin(i/120*6*Math.PI)}`;}b+=path(wave,orange,4)+arrow(id,'M42 365H72',orange)+arrow(id,'M416 365H385',orange);
   b+=text(230,466,'Local buckling on the elastic core','受压面板在芯材支承上局部失稳',l,17);
   b+=text(670,300,'Intracell dimpling','胞格凹陷',l,21)+box(518,366,301,60,'#f7f9fa');
   for(let i=0;i<=5;i++)b+=path(`M${518+i*60.2} 366V426`,C.target,2);
   let dimpling='';for(let i=0;i<=120;i++){const x=518+301*i/120;dimpling+=`${i?'L':'M'}${x} ${366+12*Math.sin(i/120*5*Math.PI)**2}`;}b+=path(dimpling,orange,4)+path('M518 426H819',C.accent,5);
   b+=path('M638.4 343V353H698.6V343',C.muted,1)+text(668.5,336,'Cell size s','胞格尺寸 s',l,15);
   b+=text(670,466,'Face buckling between cell walls','面板在相邻胞壁之间局部屈曲',l,17);return b;
  });
 }else if(id==='sandwichsizing'){
  title=['Minimum mass on the feasible thickness boundary','可行厚度边界上的最小质量'];
  description=['Computed for the stated 500 N simply supported beam. The optimum is tangent to the face-stress boundary; the minimum face thickness and core-shear bounds are inactive there.','按文中跨中载荷 500 N 的简支梁计算。最优点位于面板应力边界与等质量线的切点，此处最小面板厚度和芯剪切约束均未取等号。'];
  const data=sandwichSizingData(),p=data.parameters,opt=data.optimum;
  body=svg(id,530,title[0],l=>{
   const X=(m:number)=>80+m/p.coreMaximum*520,Y=(m:number)=>390-m/.002*280;
   let b='';
   const feasible=`M${X(data.lowerCore)} 110H600`+data.samples.slice().reverse().map(s=>`L${X(s.core)} ${Y(s.face)}`).join('')+'Z';
   b+=`<path d="${feasible}" fill="${core}"/>`;
   for(const mm of [0,.5,1,1.5,2])b+=path(`M80 ${Y(mm/1000)}H600`,C.grid,1)+text(65,Y(mm/1000)+6,String(mm),String(mm),l,15,'end');
   for(const mm of [0,10,20,30,40,50,60])b+=path(`M${X(mm/1000)} 110V390`,C.grid,1)+text(X(mm/1000),416,String(mm),String(mm),l,15);
   b+=path('M80 100V390H608',C.muted,1.5)+text(340,456,'Core thickness hc (mm)','芯材厚度 hc（mm）',l,19)+text(82,65,'Face thickness tf (mm)','单层面板厚度 tf（mm）',l,19,'start');
   b+=path(data.samples.map((s,i)=>`${i?'L':'M'}${X(s.core)} ${Y(s.requiredFace)}`).join(''),C.accent,3);
   b+=path(`M80 ${Y(p.faceMinimum)}H600`,orange,2,'stroke-dasharray="7 4"')+path(`M${X(data.lowerCore)} 110V390`,C.muted,1.5,'stroke-dasharray="4 4"');
   // The plotted objective contour and the marker use the same optimum data.
   const faceAtZero=opt.mass/(p.width*p.length*2*p.faceDensity),coreAtZero=opt.mass/(p.width*p.length*p.coreDensity);
   b+=path(`M${X(0)} ${Y(faceAtZero)}L${X(coreAtZero)} ${Y(0)}`,C.ink,2,'stroke-dasharray="3 4"');
   b+=`<circle cx="${X(opt.core)}" cy="${Y(opt.face)}" r="6" fill="${C.ink}"/>`+text(X(opt.core)+13,Y(opt.face)-14,'Minimum','最小值',l,16,'start');
   b+=text(478,174,'Feasible region','可行域',l,20,undefined,C.target);
   b+=text(745,112,'Computed optimum','计算所得最优尺寸',l,21)+text(745,158,`hc = ${(opt.core*1000).toFixed(3)} mm`,`hc = ${(opt.core*1000).toFixed(3)} mm`,l,20)+text(745,196,`tf = ${(opt.face*1000).toFixed(3)} mm`,`tf = ${(opt.face*1000).toFixed(3)} mm`,l,20)+text(745,240,`m = ${opt.mass.toFixed(4)} kg`,`m = ${opt.mass.toFixed(4)} kg`,l,24);
   b+=text(745,292,`σf = ${(opt.faceStress/1e6).toFixed(0)} MPa`,`σf = ${(opt.faceStress/1e6).toFixed(0)} MPa`,l,18)+text(745,329,`τc = ${(opt.coreShear/1e6).toFixed(3)} MPa`,`τc = ${(opt.coreShear/1e6).toFixed(3)} MPa`,l,18)+text(745,380,'Mass contour tangent to stress limit','等质量线与应力边界相切',l,16);
   b+=path('M55 492H91',C.accent,3)+text(102,498,'Face stress','面板应力',l,16,'start')+path('M267 492H303',orange,2,'stroke-dasharray="7 4"')+text(314,498,'Minimum tf','最小面板厚度',l,16,'start')+path('M515 492H551',C.ink,2,'stroke-dasharray="3 4"')+text(562,498,'Equal mass','等质量线',l,16,'start');return b;
  });
 }else return undefined;
 return `<figure class="course-figure" data-course-figure="${id}">${body}<figcaption><span class="figure-title">${bi(...title)}</span><span class="figure-description">${bi(...description)}</span></figcaption></figure>`;
}
