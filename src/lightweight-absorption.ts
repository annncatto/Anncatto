import {FONT} from './theme.js';

type Lang='en'|'zh';
export interface IdealPlasticMaterial {modulus:number;yieldStress:number;density:number}
/** Uniform uniaxial engineering stress/strain; energies are per reference mass. */
export function elasticPlasticEnergy(material:IdealPlasticMaterial,totalStrain:number){
 const {modulus:E,yieldStress:sy,density:rho}=material;
 if(![E,sy,rho].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(totalStrain)||totalStrain<0)throw new Error('Positive material properties and nonnegative total strain are required');
 const yieldStrain=sy/E,stress=Math.min(E*totalStrain,sy),plasticStrain=Math.max(0,totalStrain-yieldStrain);
 const recoverable=stress*stress/(2*E*rho),dissipated=sy*plasticStrain/rho;
 return {yieldStrain,stress,plasticStrain,loading:recoverable+dissipated,recoverable,dissipated};
}
/** Rigid-perfectly-plastic approximation, with the elastic interval neglected. */
export function idealPlasticSEA(yieldStress:number,terminalStrain:number,density:number){
 if(![yieldStress,density].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(terminalStrain)||terminalStrain<0)throw new Error('Positive strength and density and nonnegative terminal strain are required');
 return yieldStress*terminalStrain/density;
}

export const absorptionFigures=['absorptioncycle'] as const;
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const ink='#181818',grid='#dce4e5',load='#286d7b',returned='#a66b45',plastic='#42816c';
const text=(x:number,y:number,en:string,zh:string,l:Lang,size=17,anchor='middle')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${ink}" text-anchor="${anchor}">${l==='en'?en:zh}</text>`;
const line=(d:string,color=ink,width=1.5,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
export function absorptionFigure(id:string):string|undefined{
 if(id!=='absorptioncycle')return undefined;
 const normalized={modulus:1,yieldStress:1,density:1},end=4,result=elasticPlasticEnergy(normalized,end);
 const draw=(l:Lang)=>{
  const X=(u:number)=>72+342*u/4.3,Y=(s:number)=>350-225*s;
  const R=(u:number)=>550+288*u/4,S=(w:number)=>350-230*w/3.5;
  let body=text(250,35,'Loading and elastic unloading','加载与弹性卸载',l,21)+text(700,35,'Energy at each end strain','不同终止应变下的能量',l,21);
  body+=text(72,73,'σ / σy','σ / σy',l,18,'start')+text(550,73,'w / (σy εy)','w / (σy εy)',l,18,'start');
  for(const s of [0,.5,1])body+=line(`M${X(0)} ${Y(s)}H${X(4)}`,grid,1)+text(59,Y(s)+5,String(s),String(s),l,15,'end');
  for(const w of [0,1,2,3])body+=line(`M${R(0)} ${S(w)}H${R(4)}`,grid,1)+text(536,S(w)+5,String(w),String(w),l,15,'end');
  body+=`<path d="M${X(0)} ${Y(0)}L${X(1)} ${Y(1)}L${X(4)} ${Y(1)}L${X(3)} ${Y(0)}Z" fill="#dceee5"/>`;
  body+=`<path d="M${X(3)} ${Y(0)}L${X(4)} ${Y(1)}L${X(4)} ${Y(0)}Z" fill="#f4dfce"/>`;
  body+=line(`M${X(0)} ${Y(0)}L${X(1)} ${Y(1)}H${X(4)}`,load,3.5)+line(`M${X(4)} ${Y(1)}L${X(3)} ${Y(0)}`,returned,2.5,'stroke-dasharray="6 4"');
  body+=line(`M${X(1)} ${Y(1)}V${Y(0)}M${X(4)} ${Y(1)}V${Y(0)}`,grid,1.5,'stroke-dasharray="4 4"');
  body+=text(X(2.25),181,'Loading','加载',l,17)+text(X(2),274,'Plastic work','塑性功',l,18)+text(452,224,'Unloading','卸载',l,16);
  body+=line(`M418 229H395L${X(3.6)} ${Y(.6)}`,returned,1.4);
  body+=text(X(3.5),321,'Elastic','弹性',l,15);
  for(const [key,color,dash] of [['loading',load,''],['dissipated',plastic,'stroke-dasharray="7 4"'],['recoverable',returned,'stroke-dasharray="3 4"']] as const){
   const curve=Array.from({length:121},(_,i)=>{const u=end*i/120,v=elasticPlasticEnergy(normalized,u)[key];return `${i?'L':'M'}${R(u).toFixed(3)} ${S(v).toFixed(3)}`;}).join('');body+=line(curve,color,3,dash);
  }
  body+=text(850,S(result.loading)+5,result.loading.toFixed(1),result.loading.toFixed(1),l,16,'start')+text(850,S(result.dissipated)+5,result.dissipated.toFixed(1),result.dissipated.toFixed(1),l,16,'start')+text(850,S(result.recoverable)+5,result.recoverable.toFixed(1),result.recoverable.toFixed(1),l,16,'start');
  body+=line('M72 95V350H420M550 95V350H840');
  for(const u of [0,1,2,3,4])body+=text(X(u),375,String(u),String(u),l,15)+text(R(u),375,String(u),String(u),l,15);
  body+=text(250,409,'Total strain ε / εy','总应变 ε / εy',l,18)+text(695,409,'End strain εf / εy','终止应变 εf / εy',l,18);
  const items=[{x:165,en:'Input work',zh:'输入功',value:result.loading,color:load},{x:450,en:'Plastic dissipation',zh:'塑性耗能',value:result.dissipated,color:plastic},{x:735,en:'Elastic return',zh:'卸载返还能量',value:result.recoverable,color:returned}];
  for(const item of items)body+=line(`M${item.x-95} 454H${item.x-73}`,item.color,3)+text(item.x+6,460,item.en,item.zh,l,17)+text(item.x,496,item.value.toFixed(1),item.value.toFixed(1),l,25);
  body+=text(450,534,'εf = 4 εy: input 3.5 = dissipated 3.0 + returned 0.5','εf = 4 εy：输入 3.5 = 耗散 3.0 + 返还 0.5',l,18);
  return body;
 };
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 555" role="img" aria-label="Ideal elastic–plastic loading, unloading and energy partition" style="font-family:${FONT}"><title>Ideal elastic–plastic loading, unloading and energy partition</title><g lang="en">${draw('en')}</g><g lang="zh-CN">${draw('zh')}</g></svg>`;
 return `<figure class="course-figure" data-course-figure="${id}">${svg}<figcaption><span class="figure-title">${bi('Elastic storage and plastic dissipation','弹性储能与塑性耗能')}</span><span class="figure-description">${bi('Calculated for a uniform, ideal elastic–perfectly-plastic bar. Strain is normalized by εy = σy/E; energy per reference volume w is normalized by σyεy. The green loop area is dissipated, and the orange unloading triangle is returned.','均匀拉杆的理想弹性—完全塑性模型计算。应变以 εy = σy/E 归一化，单位初始体积能量 w 以 σyεy 归一化。绿色循环面积为耗能，橙色卸载三角形为返还能量。')}</span></figcaption></figure>`;
}
