import {C,FONT} from './theme.js';

type Lang='en'|'zh';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const text=(x:number,y:number,en:string,zh:string,l:Lang,size=17,anchor='middle',fill=C.ink)=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${l==='en'?en:zh}</text>`;
const path=(d:string,stroke=C.ink,width=2,extra='')=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const line=(x1:number,y1:number,x2:number,y2:number,stroke=C.grid,width=1)=>path(`M${x1} ${y1}L${x2} ${y2}`,stroke,width);
const rect=(x:number,y:number,w:number,h:number,fill:string)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
function svg(id:string,height:number,title:string,draw:(l:Lang)=>string){
 return `<svg viewBox="0 0 900 ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}" style="font-family:${FONT}"><title>${title}</title><defs><marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><g lang="en">${draw('en')}</g><g lang="zh-CN">${draw('zh')}</g></svg>`;
}
const curve=(f:(s:number)=>[number,number],a=0,b=1,n=80)=>Array.from({length:n+1},(_,i)=>{const [x,y]=f(a+(b-a)*i/n);return `${i?'L':'M'}${x.toFixed(3)} ${y.toFixed(3)}`;}).join('');

/** Euler–Bernoulli cantilever, constant EI; SI inputs and outputs. */
export function cantileverEnergy(force:number,length:number,rigidity:number){
 return {energy:force**2*length**3/(6*rigidity),deflection:force*length**3/(3*rigidity),rotation:force*length**2/(2*rigidity)};
}
/** Symmetric sharp-corner I-section; units follow the four dimensions. */
export function iSectionProperties(width:number,height:number,flange:number,web:number){
 const area=2*width*flange+web*(height-2*flange);
 const secondMoment=(width*height**3-(width-web)*(height-2*flange)**3)/12;
 return {area,secondMoment,sectionModulus:2*secondMoment/height};
}
/** Uniform bar in pure axial tension; no compression or shell-buckling load. */
export function tensionArea(force:number,allowableStress:number,modulus:number,length:number,allowedExtension=Infinity){
 return Math.max(force/allowableStress,force*length/(modulus*allowedExtension));
}
export const energyFigures=['strainenergyfields','isectioncomparison','tubefeasible'] as const;
export function energyFigure(id:string):string|undefined {
 let title=['',''],desc=['',''],body='';
 if(id==='strainenergyfields'){
  title=['Cantilever deformation and stored bending energy','悬臂梁挠曲与弯曲应变能'];
  desc=['Constant EI, tip force F. Both curves follow the beam equations; vertical deformation is magnified. The root half stores 87.5% of the bending energy.','等抗弯刚度 EI、端部集中力 F。曲线由梁方程计算，挠度竖向放大；根部半跨储存 87.5% 的弯曲应变能。'];
  body=svg(id,570,title[0],l=>{
   let b=rect(50,60,32,105,'#e5eded')+line(82,60,82,165,C.muted,4)+line(82,85,810,85,C.muted,2);
   for(let y=65;y<165;y+=15)b+=line(53,y+15,80,y,C.muted);
   b+=path(curve(s=>[82+728*s,85+70*s*s*(3-s)/2]),C.accent,4);
   b+=path('M810 22V76',C.target,2,`marker-end="url(#${id}-a)"`)+text(834,47,'F','F',l,22);
   b+=text(449,55,'Constant bending rigidity EI','等抗弯刚度 EI',l,20)+text(814,181,'δ','δ',l,20);
   b+=path('M88 200H804',C.muted,1.5,`marker-start="url(#${id}-a)" marker-end="url(#${id}-a)"`)+text(446,227,'Length L · x measured from the clamp','梁长 L · x 自固支端量起',l,17);
   const panels=[{x:90,w:320,en:'Energy density / root value',zh:'单位长度能量／根部值',f:(s:number)=>(1-s)**2},{x:540,w:310,en:'Deflection w / tip deflection δ',zh:'挠度 w／端挠度 δ',f:(s:number)=>s*s*(3-s)/2}];
   for(const [index,p] of panels.entries()){
    const X=(s:number)=>p.x+p.w*s,Y=(v:number)=>470-170*v;
    for(const v of [0,.5,1])b+=line(X(0),Y(v),X(1),Y(v))+text(X(0)-12,Y(v)+5,String(v),String(v),l,15,'end');
    b+=text(p.x+p.w/2,275,p.en,p.zh,l,18);
    if(index===0){b+=`<path d="${curve(s=>[X(s),Y(p.f(s))],0,.5)}L${X(.5)} 470L${X(0)} 470Z" fill="#c9e5db"/>`;}
    b+=path(curve(s=>[X(s),Y(p.f(s))]),index===0?C.target:C.accent,3)+line(X(0),Y(0),X(1),Y(0),C.muted);
    for(const s of [0,.5,1])b+=text(X(s),497,String(s),String(s),l,16);
    b+=text(p.x+p.w/2,526,'Position x / L','位置 x / L',l,17);
    if(index===0)b+=text(X(.3),438,'87.5% of U','总能量的 87.5%',l,16);
   }
   return b;
  });
 }else if(id==='isectioncomparison'){
  title=['Equal-area square and I-section','等面积方形与工字截面'];
  desc=['Both sections contain 400 mm² and use the same drawing scale. The I-section has 10.336 times the square’s strong-axis second moment and 4.307 times its section modulus.','两截面积均为 400 mm²，按同一比例绘制。工字截面的强轴二次矩为方形的 10.336 倍，截面模量为 4.307 倍。'];
  const shape=iSectionProperties(30,48,4,4),squareI=20**4/12;
  body=svg(id,475,title[0],l=>{
   const scale=4.5,cy=200;
   let b=text(240,45,'Solid square','实心正方形',l,22)+text(650,45,'Symmetric I-section','双对称工字截面',l,22);
   b+=rect(195,cy-45,90,90,'#cfe4ed');
   b+=rect(650-15*scale,cy-24*scale,30*scale,4*scale,'#d7eade')+rect(650-2*scale,cy-20*scale,4*scale,40*scale,'#d7eade')+rect(650-15*scale,cy+20*scale,30*scale,4*scale,'#d7eade');
   b+=path('M150 200H330M545 200H754',C.muted,1.5,'stroke-dasharray="6 5"')+text(450,204,'y','y',l,19);
   b+=path('M195 268H285',C.muted,1.3,`marker-start="url(#${id}-a)" marker-end="url(#${id}-a)"`)+text(240,294,'20 mm','20 mm',l,17);
   b+=path('M582.5 78H717.5',C.muted,1.3,`marker-start="url(#${id}-a)" marker-end="url(#${id}-a)"`)+text(650,69,'b = 30 mm','b = 30 mm',l,17);
   b+=path('M775 92V308',C.muted,1.3,`marker-start="url(#${id}-a)" marker-end="url(#${id}-a)"`)+text(793,204,'48 mm','48 mm',l,16,'start');
   b+=text(650,335,'Flanges and web: 4 mm','翼缘与腹板厚度：4 mm',l,17);
   b+=text(240,335,'A = 400 mm²','A = 400 mm²',l,19);
   b+=text(240,378,`Iᵧ = ${squareI.toFixed(1)} mm⁴`,`Iᵧ = ${squareI.toFixed(1)} mm⁴`,l,19)+text(650,378,`Iᵧ = ${shape.secondMoment.toFixed(1)} mm⁴`,`Iᵧ = ${shape.secondMoment.toFixed(1)} mm⁴`,l,19);
   b+=text(240,415,`Zᵧ = ${(squareI/10).toFixed(1)} mm³`,`Zᵧ = ${(squareI/10).toFixed(1)} mm³`,l,19)+text(650,415,`Zᵧ = ${shape.sectionModulus.toFixed(1)} mm³`,`Zᵧ = ${shape.sectionModulus.toFixed(1)} mm³`,l,19);
   b+=text(450,459,'Greater depth needs space and separate stability checks','更大的高度需要空间，并须另行校核稳定性',l,17);
   return b;
  });
 }else if(id==='tubefeasible'){
  title=['A tensile tube’s feasible dimensions','受拉圆管的尺寸可行域'];
  desc=['F = 10 kN, L = 0.5 m, E = 70 GPa, allowable stress 100 MPa. Plot domain: mean diameter 20–80 mm; minimum wall 0.5 mm; t ≤ dₘ/9. Green shading also satisfies extension ≤ 0.5 mm.','F = 10 kN、L = 0.5 m、E = 70 GPa、许用应力 100 MPa。图示范围：平均直径 20–80 mm、最小壁厚 0.5 mm、t ≤ dₘ/9；绿色区域还满足伸长不超过 0.5 mm。'];
  const a0=tensionArea(10000,100e6,70e9,.5)*1e6,a1=tensionArea(10000,100e6,70e9,.5,.0005)*1e6;
  body=svg(id,590,title[0],l=>{
   const X=(d:number)=>100+(d-20)*11.5,Y=(t:number)=>460-t*100;
   const lower=(d:number)=>Math.max(.5,a1/(Math.PI*d)),upper=(d:number)=>Math.min(3.2,d/9);
   let b='';
   for(const wall of [0,1,2,3])b+=line(100,Y(wall),790,Y(wall))+text(82,Y(wall)+5,String(wall),String(wall),l,16,'end');
   for(const d of [20,30,40,50,60,70,80])b+=line(X(d),140,X(d),460)+text(X(d),487,String(d),String(d),l,16);
   const firstFeasible=Math.max(20,Math.sqrt(9*a1/Math.PI));
   const top=curve(d=>[X(d),Y(upper(d))],firstFeasible,80),bottom=curve(d=>[X(d),Y(lower(d))],80,firstFeasible).replace(/^M/,'L');
   b+=`<path d="${top}${bottom}Z" fill="#dcefe4"/>`;
   b+=path(curve(d=>[X(d),Y(a0/(Math.PI*d))],20,80),'#b27950',2.5,'stroke-dasharray="7 5"');
   b+=path(curve(d=>[X(d),Y(a1/(Math.PI*d))],20,80),C.target,3);
   b+=path(curve(d=>[X(d),Y(d/9)],20,28.8),C.muted,2)+line(100,Y(.5),790,Y(.5),C.muted,1.5);
   b+=line(100,140,100,460,C.muted)+line(100,460,790,460,C.muted);
   b+=text(100,35,'Wall thickness t · mm','壁厚 t · mm',l,19,'start');
   b+=path('M100 68H142','#b27950',2.5,'stroke-dasharray="7 5"')+text(155,74,'Strength: A = 100 mm²','强度：A = 100 mm²',l,17,'start');
   b+=path('M100 103H142',C.target,3)+text(155,109,'Extension limit: A = 142.86 mm²','伸长约束：A = 142.86 mm²',l,17,'start');
   b+=text(580,210,'Feasible with both limits','同时满足强度与伸长约束',l,18)+text(164,169,'t = dₘ / 9','t = dₘ / 9',l,15,'start');
   for(const [d,name] of [[40,'A'],[60,'B']] as const){const y=Y(a1/(Math.PI*d));b+=`<circle cx="${X(d)}" cy="${y}" r="5" fill="${C.target}"/>`+text(X(d)+14,y-13,name,name,l,18,'start');}
   b+=text(778,Y(.5)-9,'t ≥ 0.5 mm','t ≥ 0.5 mm',l,16,'end');
   b+=text(445,523,'Mean diameter dₘ · mm','平均直径 dₘ · mm',l,18);
   b+=text(445,563,'A and B: same minimum mass 0.193 kg','A、B 两点的最小质量相同：0.193 kg',l,19);
   return b;
  });
 }else return undefined;
 return `<figure class="course-figure" data-course-figure="${id}">${body}<figcaption><span class="figure-title">${bi(title[0],title[1])}</span><span class="figure-description">${bi(desc[0],desc[1])}</span></figcaption></figure>`;
}
