import {C,FONT} from './theme.js';
const B='#eaf3f8',G='#edf6f1',gray='#f3f6f6',orange='#b97c58';
type Lang='en'|'zh';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const t=(x:number,y:number,en:string,zh:string,l:Lang,size=17,anchor='middle',color=C.ink)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${l==='en'?en:zh}</text>`;
const rect=(x:number,y:number,w:number,h:number,fill=gray,stroke=C.grid)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}" stroke="${stroke}"/>`;
const path=(d:string,color=C.ink,width=2,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const arrow=(id:string,d:string,color=C.accent)=>path(d,color,2,`marker-end="url(#${id}-a)"`);
const circle=(x:number,y:number,r:number,fill:string)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
function svg(id:string,height:number,title:string,draw:(l:Lang)=>string){return `<svg viewBox="0 0 900 ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}" style="font-family:${FONT}"><title>${title}</title><defs><marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs><g lang="en">${draw('en')}</g><g lang="zh-CN">${draw('zh')}</g></svg>`;}
export const foundationFigures=['designloop','jointsection','seapath','sectionloads','strainbasics','planesections','cantileverfields','shearmodels','yieldloci','capacityindices','leglayout','legspring'] as const;
export type FoundationFigure=typeof foundationFigures[number];
export function shearDeflectionRatio(slenderness:number,poisson=.3,shearFactor=5/6){return (1+poisson)/(2*shearFactor*slenderness**2);}
export const foundationMaterials=[{en:'Stainless steel',zh:'不锈钢',E:195,rho:7.8,yield:393},{en:'Aluminium',zh:'铝合金',E:74,rho:2.75,yield:364},{en:'Titanium',zh:'钛合金',E:105,rho:4.7,yield:750}];
export function normalizedFoundationIndices(){const st=foundationMaterials[0];return foundationMaterials.map(m=>({strength:(m.yield/m.rho)/(st.yield/st.rho),axial:(m.E/m.rho)/(st.E/st.rho),buckling:(Math.sqrt(m.E)/m.rho)/(Math.sqrt(st.E)/st.rho)}));}
export function foundationFigure(id:string):string|undefined {
 let title=['',''],desc=['',''],body='';
 if(id==='designloop'){
  title=['The lightweight design loop','轻量化设计流程'];
  const items=[['Requirements','要求','Payload, workspace, speed, life, safety','负载、工作空间、速度、寿命、安全'],['Dynamic loads','动载荷','Trajectory, braking, landing, contact','轨迹、制动、落地、接触'],['Mass layout','质量布置','Motors, battery, electronics, transmission','电机、电池、电子器件、传动'],['Material selection','选材','Match indices to the governing constraints','按主导约束选择材料指数'],['Structural optimization','结构优化','Topology → sizing → shape','拓扑 → 尺寸 → 形状'],['Manufacturing','工艺实现','Walls, fillets, joints, tool access','壁厚、圆角、连接、刀具空间'],['Analysis and test','分析与试验','Stress, stiffness, modes, fatigue','应力、刚度、模态、疲劳'],['System iteration','系统迭代','Update inertia, loads and actuator sizing','更新惯量、载荷与执行器选型']];
  body='<ol class="foundation-flow">'+items.map(([en,zh,de,dz])=>`<li><strong>${bi(en,zh)}</strong><span>${bi(de,dz)}</span></li>`).join('')+'</ol>';
  desc=['Changes in mass or transmission return to the dynamic-load calculation.','质量或传动改变后，返回动载荷计算，重新校核整机。'];
 }else if(id==='jointsection'){
  title=['Functions inside an integrated joint','集成关节中的功能分配'];desc=['Generic functional section, not a scale drawing of a specific robot. Blue: drive; green: sensing; grey: supporting structure.','通用功能剖面，非特定机器人比例图。蓝色为驱动，绿色为感知，灰色为支承结构。'];
  body=svg(id,480,title[0],l=>{
   let b=rect(55,98,770,208,'#e9eff0','#9bb2ba')+rect(88,127,705,150,'white');
   b+=rect(105,142,83,115,G)+rect(196,158,16,87,G,'#77a995')+rect(220,128,175,35,B)+rect(220,242,175,35,B)+rect(247,174,120,57,'#86b7d3','#3984ac');
   for(let x=234;x<390;x+=20)b+=path(`M${x} 132V159M${x} 246V273`,C.accent,4);
   b+=rect(435,146,105,116,B)+circle(488,203,44,'#b7d4e3')+circle(488,203,24,'white');
   for(let i=0;i<12;i++){const a=i*Math.PI/6;b+=path(`M${488+37*Math.cos(a)} ${203+37*Math.sin(a)}L${488+48*Math.cos(a)} ${203+48*Math.sin(a)}`,C.accent,4);}
   b+=rect(580,162,60,82,G,'#77a995')+rect(682,132,50,140,gray,'#879ba3');
   for(const y of [151,180,232,258])b+=circle(706,y,8,'white');
   b+=rect(772,134,38,140,'#b5c7cd')+rect(50,192,785,26,'white','#b6cbd0')+path('M38 205H850',C.target,2,'stroke-dasharray="7 5"');
   b+=arrow(id,'M847 255V295H740',C.muted)+t(846,327,'Output load','输出载荷',l,16);
   const labels:[[number,number,string,string],...Array<[number,number,string,string]>]=[[145,54,'1 · Electronics','1 · 电子器件'],[145,365,'2 · Encoder','2 · 编码器'],[308,54,'3 · Motor','3 · 电机'],[489,54,'4 · Reduction','4 · 减速机构'],[650,54,'5 · Torque sensing','5 · 力矩感知'],[730,365,'Output bearing','输出轴承'],[790,397,'6 · Flange','6 · 输出法兰']];
   labels.forEach(([x,y,en,zh])=>{b+=t(x,y,en,zh,l,16);});
   b+=path('M145 63V138M308 63V125M489 63V142M650 63V130H610V157M205 280V337H145V346M706 280V345H730M790 280V378',C.muted,1);
   b+=t(420,352,'Central passage · power and communication','中心通道 · 供电与通信',l,17)+t(325,442,'7 · Housing: load support and heat flow','7 · 壳体：承载与导热',l,17);
   b+=path('M70 309V410H325V423',C.muted,1);return b;
  });
 }else if(id==='seapath'){
  title=['Series elastic transmission and torque measurement','串联弹性传动与力矩测量'];desc=['Spring deflection gives torque; finite stiffness also introduces relative motion and resonance.','弹性变形用于测力，有限刚度同时引入相对运动与共振。'];
  body=svg(id,275,title[0],l=>{
   let b=rect(30,66,155,88,B)+rect(239,66,155,88,B)+rect(655,66,205,88,gray);
   b+=t(107,116,'Motor','电机',l,20)+t(316,116,'Reduction','减速机构',l,20)+t(758,116,'Link / load','连杆／负载',l,20);
   b+=arrow(id,'M185 110H234')+arrow(id,'M610 110H650');
   b+=path('M394 110H430L442 88L466 132L490 88L514 132L538 88L562 132L574 110H610',C.target,3);
   b+=t(505,52,'Spring kθ','弹簧 kθ',l,19)+path('M425 143V190H580V143',C.muted,1,'stroke-dasharray="4 4"');
   b+=t(505,218,'Δθ → τ = kθ Δθ','Δθ → τ = kθ Δθ',l,20)+t(505,252,'Measure the relative angle across the spring','测量弹簧两端相对转角',l,16);return b;
  });
 }else if(id==='sectionloads'){
  title=['Axial, torsional and transverse loading','轴向、扭转与横向载荷'];desc=['Cut sections carry normal force, shear force and moments that balance the removed part.','切开截面上的轴力、剪力与力矩，与被移去部分保持平衡。'];
  body=svg(id,330,title[0],l=>{
   let b='';
   for(let k=0;k<3;k++){const x=30+k*295;b+=rect(x,35,275,270,'white');}
   b+=rect(80,126,155,48,B)+arrow(id,'M80 150H45')+arrow(id,'M235 150H270')+path('M158 111V190',C.target,2,'stroke-dasharray="5 4"');
   b+=t(168,76,'Axial tension','轴向拉伸',l,20)+t(167,228,'N → normal stress','N → 正应力',l,17);
   b+=rect(365,126,155,48,B)+path('M385 108C347 102 344 196 385 193',C.accent,2,`marker-end="url(#${id}-a)"`)+path('M504 108C542 102 545 196 504 193',C.accent,2,`marker-end="url(#${id}-a)"`);
   b+=t(463,76,'Torsion','扭转',l,20)+t(463,228,'T → shear stress','T → 剪应力',l,17);
   b+=path('M635 113V185',C.muted,7)+rect(638,137,195,24,B)+arrow(id,'M821 91V135')+path('M711 122V179',C.target,2,'stroke-dasharray="5 4"');
   b+=t(756,76,'Transverse force','横向力',l,20)+t(756,228,'V + M → shear + bending','V＋M → 剪切与弯曲',l,17);
   b+=t(450,284,'Robot links usually combine several load components','机器人连杆通常承受多种载荷分量',l,17);return b;
  });
 }else if(id==='strainbasics'){
  title=['Normal strain, shear strain and the tensile curve','正应变、剪应变与拉伸曲线'];desc=['Small-strain geometry and a qualitative ductile-material curve.','小应变几何与延性材料定性拉伸曲线。'];
  body=svg(id,390,title[0],l=>{
   let b=rect(25,30,415,330,'white')+rect(460,30,415,330,'white');
   b+=t(230,66,'Extension and simple shear','伸长与简单剪切',l,20);
   b+=rect(65,105,185,26,gray)+rect(65,142,235,26,B)+arrow(id,'M302 155H360');
   b+=t(160,98,'L₀','L₀',l,16)+t(279,194,'ΔL','ΔL',l,16)+path('M250 178V190H300V178',C.muted,1);
   b+=path('M95 314V242H190V314Z',C.muted,1,'stroke-dasharray="4 4"')+`<path d="M95 314L125 242H220L190 314Z" fill="${G}" stroke="${C.target}" stroke-width="2"/>`;
   b+=arrow(id,'M130 232H216',C.target)+t(173,220,'Δx','Δx',l,16)+t(78,283,'h','h',l,16)+t(322,280,'γ ≈ Δx / h','γ ≈ Δx / h',l,18);
   b+=t(670,66,'Elastic → plastic → fracture','弹性 → 塑性 → 断裂',l,19);
   b+=path('M512 109V311H835',C.muted,1.5)+path('M512 311L569 187C615 186 654 121 733 126C780 127 800 163 815 183',C.accent,3);
   b+=t(535,111,'σ','σ',l,18)+t(840,331,'ε','ε',l,18)+t(546,224,'E','E',l,19)+t(598,177,'Yield','屈服',l,16)+t(793,215,'Fracture','断裂',l,16);return b;
  });
 }else if(id==='planesections'){
  title=['Plane sections and linear bending strain','平截面与线性弯曲应变'];desc=['Sections rotate with the centreline normal; strain changes sign across the neutral axis.','截面随中心线法线转动，应变在中性轴两侧变号。'];
  body=svg(id,370,title[0],l=>{
   let b=rect(20,30,535,302,'white')+rect(575,30,305,302,'white');
   b+=t(285,68,'Plane sections remain plane','变形后截面保持平面',l,20);
   const cy=(x:number)=>150+.00052*(x-70)**2;
   const beam=(offset:number)=>Array.from({length:61},(_,i)=>{let x=70+i*7;return `${i?'L':'M'}${x} ${cy(x)+offset}`;}).join('');
   b+=path(beam(-24),C.accent,3)+path(beam(24),C.accent,3)+path(beam(0),C.muted,1.5,'stroke-dasharray="6 4"');
   for(const x of [90,190,290,390,480]){const slope=.00104*(x-70),nx=-slope/Math.hypot(1,slope),nz=1/Math.hypot(1,slope);b+=path(`M${x-27*nx} ${cy(x)-27*nz}L${x+27*nx} ${cy(x)+27*nz}`,C.target,2);}
   b+=t(285,307,'ux = −z w′     εx = −z w″','ux = −z w′     εx = −z w″',l,20);
   b+=t(730,68,'Linear strain through depth','截面高度上的线性应变',l,18)+path('M600 181H850M725 109V272',C.muted,1.5)+arrow(id,'M725 118V91',C.muted);
   b+=path('M785 112L665 252',C.accent,3)+path('M785 112H725M665 252H725',C.accent,1,'stroke-dasharray="4 3"');
   b+=t(742,103,'z','z',l,16)+t(851,170,'εx','εx',l,16)+t(730,307,'εx = 0 at z = 0','z = 0 处 εx = 0',l,18);return b;
  });
 }else if(id==='cantileverfields'){
  title=['Cantilever force, moment and deflection fields','悬臂梁的剪力、弯矩与挠度'];desc=['Downward tip force; diagrams show magnitudes. Bending stress is linear and transverse shear stress parabolic through a rectangular section.','端部向下集中力，内力与挠度图显示大小。矩形截面弯曲正应力线性分布，横向剪应力抛物线分布。'];
  body=svg(id,565,title[0],l=>{
   let b=path('M170 50V115',C.muted,7)+path('M175 84H550',C.accent,12)+arrow(id,'M550 30V77')+t(571,41,'F','F',l,20)+t(171,132,'0','0',l,16)+t(550,132,'L','L',l,16);
   const names=[['|V|','|V|'],['|M|','|M|'],['|w|','|w|']];
   for(let j=0;j<3;j++){const y=235+j*125;b+=path(`M175 ${y-78}V${y}H570`,C.muted,1.2)+t(100,y-28,names[j][0],names[j][1],l,21);}
   b+=`<path d="M175 235V171H550V235Z" fill="${B}"/>`+path('M175 171H550',C.accent,3)+t(589,177,'F','F',l,17);
   b+=`<path d="M175 360V292L550 360Z" fill="${G}"/>`+path('M175 292L550 360',C.target,3)+t(165,283,'FL','FL',l,17);
   let d='';for(let i=0;i<=60;i++){const u=i/60;d+=`${i?'L':'M'}${175+375*u} ${485-70*u*u*(3-u)/2}`;}b+=path(d,C.accent,3)+t(530,519,'FL³ / (3EI)','FL³ / (3EI)',l,18);
   b+=rect(636,53,239,220,'white')+t(755,85,'Bending σx','弯曲正应力 σx',l,18)+path('M672 172H847M754 107V244',C.muted,1)+path('M809 116L699 235',C.accent,3)+t(755,257,'σx ∝ z','σx ∝ z',l,17);
   b+=rect(636,302,239,220,'white')+t(755,334,'Shear τxz','横向剪应力 τxz',l,18)+path('M670 416H848M694 355V482',C.muted,1);
   let d2='';for(let i=0;i<=40;i++){const z=-1+i/20;d2+=`${i?'L':'M'}${694+125*(1-z*z)} ${416+60*z}`;}b+=path(d2,C.target,3)+t(757,505,'τmax = 1.5 V/A','τmax = 1.5 V/A',l,16);return b;
  });
 }else if(id==='shearmodels'){
  title=['Shear deformation and slenderness','剪切变形与长细比'];desc=['Homogeneous rectangular cantilever, tip force, ν = 0.30, ks = 5/6. Percentages are relative to bending deflection.','均质矩形悬臂梁，端部集中力，ν＝0.30，ks＝5/6。百分比以弯曲挠度为分母。'];
  body=svg(id,410,title[0],l=>{
   let b=rect(20,30,367,345,'white')+rect(407,30,473,345,'white');
   b+=t(203,66,'Rotation and centreline slope','截面转角与中心线斜率',l,19);
   b+=path('M80 158L310 204',C.accent,4)+path('M190 131V230',C.target,3)+path('M200 132L180 230',C.muted,1.5,'stroke-dasharray="4 3"')+t(220,138,'γ','γ',l,18)+t(285,236,'w′ − θ','w′ − θ',l,17);
   b+=t(204,264,'Euler–Bernoulli: γ = 0','Euler–Bernoulli：γ = 0',l,16)+t(204,298,'Timoshenko: γ ≠ 0','Timoshenko：γ ≠ 0',l,16)+t(204,339,'Levinson: warping through depth','Levinson：截面沿高度翘曲',l,16);
   b+=t(651,66,'δs / δb (%)','δs / δb（%）',l,20);
   const X=(v:number)=>475+(v-2)/18*350,Y=(v:number)=>311-v/20*200;
   for(const y of [0,5,10,15,20])b+=path(`M475 ${Y(y)}H825`,C.grid,1)+t(460,Y(y)+6,String(y),String(y),l,14,'end');
   let d='';for(let i=0;i<=90;i++){const x=2+i*.2;d+=`${i?'L':'M'}${X(x)} ${Y(100*shearDeflectionRatio(x))}`;}b+=path(d,C.accent,3);
   for(const x of [2,5,10,20])b+=t(X(x),337,String(x),String(x),l,14);
   for(const x of [2,5,10]){const y=100*shearDeflectionRatio(x);b+=circle(X(x),Y(y),4,C.target)+t(X(x)+6,Y(y)-12,`${y.toFixed(2)}%`,`${y.toFixed(2)}%`,l,14,'start');}
   b+=t(651,367,'Slenderness L/h','长细比 L/h',l,17);return b;
  });
 }else if(id==='yieldloci'){
  title=['Von Mises and Tresca yield boundaries','von Mises 与 Tresca 屈服边界'];desc=['Plane stress in principal axes; both axes normalized by the tensile yield stress. Points inside satisfy the respective initial-yield criterion.','主应力平面应力状态，两轴均以单轴屈服强度归一化。边界内满足对应的初始屈服条件。'];
  body=svg(id,470,title[0],l=>{
   let b='';const X=(v:number)=>305+130*v,Y=(v:number)=>241-130*v;
   b+=arrow(id,'M103 241H508',C.muted)+arrow(id,'M305 435V43',C.muted);
   let d='';for(let i=0;i<=240;i++){const a=i*Math.PI/120,c=Math.cos(a),s=Math.sin(a),r=1/Math.sqrt(1-c*s);d+=`${i?'L':'M'}${X(r*c)} ${Y(r*s)}`;}b+=path(d+'Z',C.accent,3);
   const pts=[[1,1],[1,0],[0,-1],[-1,-1],[-1,0],[0,1]];b+=path(pts.map(([x,y],i)=>`${i?'L':'M'}${X(x)} ${Y(y)}`).join('')+'Z',C.target,2,'stroke-dasharray="7 4"');
   for(const v of [-1,1])b+=t(X(v),262,String(v),String(v),l,15)+t(293,Y(v)+5,String(v),String(v),l,15,'end');
   b+=t(485,275,'σ₁ / σy','σ₁ / σy',l,17)+t(347,37,'σ₂ / σy','σ₂ / σy',l,17)+path('M575 115H630',C.accent,3)+t(646,121,'von Mises','von Mises',l,19,'start');
   b+=path('M575 166H630',C.target,2,'stroke-dasharray="7 4"')+t(646,172,'Tresca','Tresca',l,19,'start');
   b+=t(706,247,'Pure shear yield','纯剪切屈服',l,19)+t(706,289,'von Mises: τy = σy / √3','von Mises：τy = σy / √3',l,17)+t(706,329,'Tresca: τy = σy / 2','Tresca：τy = σy / 2',l,17);return b;
  });
 }else if(id==='capacityindices'){
  title=['One material set, three governing constraints','同一组材料与三种主导约束'];desc=['Example property table above; each index is normalized to stainless steel = 1. Larger values give lower mass under the stated geometric freedom.','采用上方示例性能表，各指数以不锈钢＝1 归一化。在各自规定几何自由度下，数值越大，所需质量越低。'];
  body=svg(id,435,title[0],l=>{
   const values=normalizedFoundationIndices(),colors=[C.target,C.accent,orange],names=[['Yield / density','屈服强度／密度'],['Modulus / density','模量／密度'],['√Modulus / density','√模量／密度']];let b='';
   for(let k=0;k<3;k++){const x=30+k*293;b+=path(`M${x+35} 95V330H${x+252}`,C.muted,1.2)+t(x+143,42,...names[k] as [string,string],l,18);
    for(const v of [1,2,3])b+=path(`M${x+35} ${330-v*65}H${x+252}`,C.grid,1)+t(x+25,335-v*65,String(v),String(v),l,13,'end');
    values.forEach((v,i)=>{const a=[v.strength,v.axial,v.buckling][k],bx=x+54+i*67;b+=`<rect x="${bx}" y="${330-a*65}" width="40" height="${a*65}" fill="${colors[i]}"/>`+t(bx+20,319-a*65,a.toFixed(2),a.toFixed(2),l,15)+t(bx+20,357,['Steel','Al','Ti'][i],['钢','铝','钛'][i],l,16);});
   }
   b+=t(450,409,'Strength → Ti     Axial stiffness → Al     Similar-section buckling → Al','强度 → 钛合金    轴向刚度 → 铝合金    相似截面屈曲 → 铝合金',l,18);return b;
  });
 }else if(id==='leglayout'){
  title=['Hip inertia under two motor placements','两种电机布置的髋轴惯量'];
  desc=['Straight 0.30 m + 0.30 m leg; links are point masses at their midpoints. Added transmission inertia is excluded.','0.30 m＋0.30 m 伸直腿，连杆按中点点质量计算，未计新增传动惯量。'];
  body=svg(id,560,title[0],l=>{
   let b='';
   for(const [x,remote] of [[225,false],[660,true]] as const){
    b+=t(x,35,remote?'Motor near hip':'Motor at knee',remote?'电机位于髋部附近':'电机位于膝部',l,21);
    b+=rect(x-53,65,106,27,gray)+path(`M${x} 107V425`,C.muted,9)+circle(x,107,12,C.target)+`<circle cx="${x}" cy="266" r="8" fill="white" stroke="${C.muted}" stroke-width="2"/>`+circle(x,425,6,C.ink);
    b+=circle(x,186,7,C.target)+circle(x,346,7,C.target)+t(x-25,191,'0.5 kg','0.5 kg',l,18,'end')+t(x-25,351,'0.3 kg','0.3 kg',l,18,'end');
    const my=remote?107:266;b+=circle(x,my,20,C.accent)+t(x+35,my+6,'0.6 kg','0.6 kg',l,18,'start');
    if(remote)b+=path(`M${x+12} 125V256H${x}`,C.target,2,'stroke-dasharray="5 4"');
    b+=t(x,475,remote?'I₁ = 0.072 kg·m²':'I₀ = 0.126 kg·m²',remote?'I₁ = 0.072 kg·m²':'I₀ = 0.126 kg·m²',l,22);
   }
   b+=path('M95 107V266M85 107H105M85 266H105M95 266V425M85 425H105',C.grid,2)+t(79,191,'0.30 m','0.30 m',l,16,'end')+t(79,351,'0.30 m','0.30 m',l,16,'end');
   b+=t(450,532,'Same mass · ΔI = 0.054 kg·m² · 42.9% lower','质量不变 · ΔI = 0.054 kg·m² · 降低 42.9%',l,21);return b;
  });
 }else if(id==='legspring'){
  title=['Equivalent spring–mass leg and energy transfer','等效弹簧—质量腿与能量转换'];
  desc=['Equivalent leg model. Compression stores elastic energy and unloading returns part of it; damping and actuator work affect the complete balance.','等效腿模型。压缩储存弹性能，卸载时返回部分能量，完整平衡还包含阻尼与执行器做功。'];
  body=svg(id,365,title[0],l=>{
   let b=rect(55,45,200,65,B)+t(155,85,'Body mass','躯干质量',l,21);
   b+=path('M155 110V132L139 141L171 154L139 167L171 180L139 193L171 206L139 219L171 232L155 241V275',C.target,3)+path('M30 275H300',C.muted,3);
   for(let x=40;x<290;x+=20)b+=path(`M${x} 276L${x+10} 288`,C.muted,1);
   b+=arrow(id,'M307 133V238',C.target)+t(323,193,'x','x',l,20,'start');
   b+=rect(400,35,470,112,B)+rect(400,173,470,112,G);
   b+=t(635,71,'Compression','压缩储能',l,21)+t(635,115,'Body motion → spring deflection → Es ↑','躯干运动 → 弹簧变形 → Es ↑',l,19);
   b+=t(635,211,'Unloading','卸载回弹',l,21)+t(635,255,'Es ↓ → spring work → body motion','Es ↓ → 弹簧做功 → 躯干运动',l,19);
   b+=t(450,340,'Elastic energy: Es = ½ kx²','弹性储能：Es = ½ kx²',l,22);return b;
  });
 }else return undefined;
 return `<figure class="course-figure" data-course-figure="${id}">${body}<figcaption><span class="figure-title">${bi(title[0],title[1])}</span><span class="figure-description">${bi(desc[0],desc[1])}</span></figcaption></figure>`;
}
