import {FONT} from './theme.js';
import {materials} from './lightweight-mechanics.js';
import type {Language} from './i18n.js';
export type LightFigure='indices'|'beam'|'reflection'|'simp'|'section'|'kinetic';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const tr=(en:string,zh:string,l:Language)=>l==='en'?en:zh;
const text=(x:number,y:number,t:string,size=14,anchor='middle',color='#536d79')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${color}">${t}</text>`;
const line=(x1:number,y1:number,x2:number,y2:number,color='#dce8e9',width=1)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
function svg(id:string,body:string,title:string){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" role="img" aria-labelledby="lw-${id}-title" style="font-family:${FONT}"><title id="lw-${id}-title">${title}</title>${body}</svg>`;}
export const indexPowers=[1,.5,1/3] as const;
export function relativeMaterialIndex(E:number,rho:number,power:number){return (E/materials.aluminium.E)**power/(rho/materials.aluminium.rho);}
export function lightweightMessage(id:LightFigure,choice=0,language:Language='en'){
  if(id==='section') {const phi=[1,3/Math.PI,3*(5+1/20)/Math.PI,3*(10+1/40)/Math.PI][choice]!;return tr(`At equal area and modulus, the selected section has ${phi.toFixed(2)} × the square’s bending stiffness. Its curvature under the same moment is ${(1/phi).toFixed(3)} × the reference.`,`截面积与模量相同时，所选截面的抗弯刚度为实心方形的 ${phi.toFixed(2)} 倍，相同弯矩下的曲率为参考值的 ${(1/phi).toFixed(3)} 倍。`,language);}
  if(id==='indices')return tr(`Geometric freedom: ${['tie area','similar beam section','plate thickness'][choice]}. Bars show minimum mass relative to aluminium for the same specified stiffness.`,`几何自由度：${['拉杆面积','梁截面相似缩放','板厚'][choice]}。柱条比较相同规定刚度下，以铝为基准的最小质量。`,language);
  if(id==='beam')return tr(choice===0?'A tip force produces FL³/(3EI) tip displacement.':'Distributing the same total force uniformly produces FL³/(8EI) tip displacement, or 3/8 of the tip-load result.',choice===0?'末端集中力对应的端部位移为 FL³/(3EI)。':'将相同总力均布，端部位移为 FL³/(8EI)，即末端集中力工况的 3/8。',language);
  if(id==='kinetic'){const m=[2,5,10][choice]!;return tr(`At 1.5 m/s, an effective mass of ${m} kg corresponds to ${(m*1.5**2/2).toFixed(2)} J. Doubling speed quadruples energy for a fixed effective mass.`,`速度为 1.5 m/s、等效质量为 ${m} kg 时，相应动能为 ${(m*1.5**2/2).toFixed(2)} J。等效质量不变，速度加倍，动能变为四倍。`,language);}
  if(id==='reflection'){const N=[6,10,30,50,100][choice]!;return tr(`At ${N}:1, N²Jₘ = ${(N*N*.0001).toFixed(4)} kg·m² for Jₘ = 10⁻⁴ kg·m². Only the reduction is varied.`,`转子惯量固定为 10⁻⁴ kg·m²，减速比 ${N}:1 时，N²Jₘ = ${(N*N*.0001).toFixed(4)} kg·m²。只改变减速比。`,language);}
  const p=[1,3][choice]!;return tr(`At relative density 0.5, the normalized stiffness contribution is 0.5^${p} = ${(.5**p).toFixed(3)} (neglecting the small minimum modulus).`,`相对密度为 0.5 时，归一化刚度贡献为 0.5^${p} = ${(.5**p).toFixed(3)}，忽略很小的最小模量。`,language);
}
export function lightweightDiagram(id:LightFigure,choice=0,l:Language='en'){
  let b='';
  if(id==='indices') {
    const samples=[{en:'Al 6061',zh:'铝 6061',E:69e9,rho:2700},{en:'Mg AZ91',zh:'镁 AZ91',E:45e9,rho:1810},{en:'Steel',zh:'钢',E:210e9,rho:7850},{en:'Ti-6Al-4V',zh:'Ti-6Al-4V',E:114e9,rho:4430},{en:'CFRP · QI',zh:'CFRP · 准各向同性',E:60e9,rho:1550},{en:'CFRP · UD',zh:'CFRP · 单向',E:140e9,rho:1550}];
    const p=indexPowers[choice]!,values=samples.map(m=>1/relativeMaterialIndex(m.E,m.rho,p));
    const X=(v:number)=>165+v*215;
    for(const v of [0,.5,1,1.5,2])b+=line(X(v),50,X(v),320)+text(X(v),345,String(v),13);
    samples.forEach((m,i)=>{const y=58+i*43,v=values[i]!;b+=`<rect x="165" y="${y}" width="${215*v}" height="25" rx="2" fill="${i===0?'#347fa2':'#b1d9c5'}"/>`+text(150,y+18,l==='en'?m.en:m.zh,13,'end')+text(X(v)+10,y+18,v.toFixed(2),13,'start');});
    b+=text(165,25,tr('Mass needed at equal specified stiffness','满足相同规定刚度所需质量',l),14,'start')+text(370,384,tr('Relative mass · aluminium = 1','相对质量 · 铝合金 = 1',l));
  } else if(id==='section') {
    const A=1000,scale=1.65,cy=175;
    const factors=[1,3/Math.PI,3*(5+1/20)/Math.PI,3*(10+1/40)/Math.PI];
    const labels=[tr('Solid square','实心方形',l),tr('Solid circle','实心圆形',l),'r/t = 5','r/t = 10'];
    for(let i=0;i<4;i++) {
      const x=95+i*163,color=i===choice?'#337fa4':'#a9d8c2';
      if(i===0){const a=Math.sqrt(A)*scale;b+=`<rect x="${x-a/2}" y="${cy-a/2}" width="${a}" height="${a}" fill="${color}"/>`;}
      else if(i===1)b+=`<circle cx="${x}" cy="${cy}" r="${Math.sqrt(A/Math.PI)*scale}" fill="${color}"/>`;
      else {const rt=i===2?5:10,r=Math.sqrt(A*rt/(2*Math.PI)),t=r/rt;b+=`<circle cx="${x}" cy="${cy}" r="${r*scale}" fill="none" stroke="${color}" stroke-width="${t*scale}"/>`;}
      b+=text(x,285,labels[i]!,14)+text(x,315,`${factors[i]!.toFixed(2)} ×`,17,'middle',i===choice?'#246783':'#536d79');
    }
    b+=line(35,cy,645,cy,'#b5cbd1')+text(40,40,tr('Same material area · relative bending stiffness','相同材料面积 · 相对抗弯刚度',l),15,'start')+text(340,370,tr('Thin tubes also require a local buckling check','薄壁管还需检查局部屈曲',l),14);
  } else if(id==='beam') {
    b='<defs><marker id="lw-beam-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#237ab2"/></marker></defs>';
    b+='<rect x="64" y="68" width="26" height="180" fill="#d9e6e6"/><rect x="90" y="129" width="490" height="24" fill="#d9edf5" stroke="#377b9c"/>';
    for(let y=72;y<245;y+=12)b+=line(64,y+12,88,y,'#8eabb5');
    const drop=choice===0?65:65*3/8;let path='';for(let i=0;i<=60;i++){const u=i/60,v=choice===0?u*u*(3-u)/2:u*u*(6-4*u+u*u)/3;path+=`${i?'L':'M'}${90+490*u},${141+drop*v} `;}
    b+=`<path d="${path}" stroke="#2385b7" stroke-width="2.5" fill="none" stroke-dasharray="6 4"/>`;
    for(const x of choice===0?[580]:[130,205,280,355,430,505,580])b+=`<path d="M${x} 75 V125" stroke="#237ab2" stroke-width="2" marker-end="url(#lw-beam-arrow)"/>`;
    b+=text(370,55,choice===0?tr('Tip force F','末端集中力 F',l):tr('Uniform pressure · same total F','均布载荷 · 相同总力 F',l),16);
    b+=line(90,275,580,275,'#688896')+line(90,266,90,284,'#688896')+line(580,266,580,284,'#688896')+text(335,298,'L',15);
    b+=text(350,345,tr('Dashed curve: enlarged bending displacement','虚线：放大后的弯曲位移',l),14);
  } else if(id==='kinetic') {
    for(const v of [0,.5,1,1.5]){const x=85+v/1.5*475;b+=line(x,56,x,326)+text(x,350,String(v),13);}
    for(const e of [0,3,6,9,12]){const y=326-e/12*270;b+=line(85,y,560,y)+text(71,y+5,String(e),13,'end');}
    [2,5,10].forEach((m,i)=>{let path='';for(let j=0;j<=60;j++){const v=j/60*1.5;path+=`${j?'L':'M'}${85+v/1.5*475},${326-m*v*v/2/12*270} `;}const active=i===choice;b+=`<path d="${path}" fill="none" stroke="${active?'#237ab2':'#8fb6a9'}" stroke-width="${active?3:1.6}" stroke-dasharray="${active?'none':i===0?'3 4':'7 4'}"/>`+text(575,326-m*1.5**2/2/12*270+5,`${m} kg`,14,'start');});
    b+=text(85,25,tr('Kinetic energy · J','动能 · J',l),14,'start')+text(340,384,tr('Contact speed · m/s','接触速度 · m/s',l));
  } else if(id==='reflection') {
    for(const v of [0,.25,.5,.75,1]) {const y=326-v*270;b+=line(80,y,625,y)+text(66,y+5,String(v),13,'end');}
    [6,10,30,50,100].forEach((N,i)=>{const x=104+i*105,value=N*N*.0001,h=value*270;b+=`<rect x="${x}" y="${326-h}" width="64" height="${Math.max(1,h)}" rx="2" fill="${i===choice?'#297da7':'#b8dccb'}"/>`+text(x+32,Math.max(45,315-h),value.toFixed(value<.01?4:2),13)+text(x+32,350,`${N}:1`,14);});
    b+=text(80,25,tr('Reflected rotor inertia · kg·m²','转子反射惯量 · kg·m²',l),14,'start')+text(350,384,tr('Reduction N','减速比 N',l));
  } else {
    for(const v of [0,.25,.5,.75,1]){const x=85+v*520,y=326-v*270;b+=line(x,56,x,326)+line(85,y,605,y)+text(x,350,String(v),13)+text(71,y+5,String(v),13,'end');}
    for(const p of [1,3]) {let path='';for(let i=0;i<=100;i++){const x=i/100;path+=`${i?'L':'M'}${85+520*x},${326-270*x**p} `;}b+=`<path d="${path}" stroke="${p===[1,3][choice]?'#237ab2':'#b4d6c7'}" stroke-width="${p===[1,3][choice]?3:1.5}" fill="none"/>`;}
    const power=[1,3][choice]!;b+=`<circle cx="345" cy="${326-270*.5**power}" r="6" fill="#237ab2"/>`+text(85,25,tr('Normalized elastic modulus','归一化弹性模量',l),14,'start')+text(345,384,tr('Relative density θ','相对密度 θ',l));
  }
  return svg(id,b,lightweightMessage(id,choice,l));
}
export function renderLightweightFigure(id:LightFigure){
  const labels=id==='section'?[['Square','方形'],['Circle','圆形'],['r/t = 5','r/t = 5'],['r/t = 10','r/t = 10']]:id==='indices'?[['Tie · E/ρ','拉杆 · E/ρ'],['Beam · E¹ᐟ²/ρ','梁 · E¹ᐟ²/ρ'],['Plate · E¹ᐟ³/ρ','板 · E¹ᐟ³/ρ']]:id==='beam'?[['Tip load','末端集中力'],['Distributed load','均布载荷']]:id==='reflection'?[6,10,30,50,100].map(n=>[`${n}:1`,`${n}:1`]):id==='kinetic'?[2,5,10].map(m=>[`${m} kg`,`${m} kg`]):[['p = 1','p = 1'],['p = 3','p = 3']];
  const titles=id==='section'?['Section shape at equal mass','等质量截面形状']:id==='indices'?['Geometry changes a material ranking','几何约束改变材料排序']:id==='beam'?['Cantilever loading','悬臂梁载荷']:id==='reflection'?['Reduction and reflected inertia','减速比与反射惯量']:id==='kinetic'?['Mass, speed and contact energy','质量、速度与接触动能']:['SIMP stiffness interpolation','SIMP 刚度插值'];
  const desc=id==='section'?['Mean radius r; wall thickness t. Values use the exact annulus second moment.','r 为平均半径，t 为壁厚；数值按圆环精确二次矩计算。']:id==='indices'?['Rounded properties; QI = quasi-isotropic, UD = unidirectional CFRP. These bars illustrate the index.','采用取整示例参数；QI 为准各向同性，UD 为单向 CFRP。柱条用于解释指数。']:id==='beam'?['The support, load location and load distribution define the bending problem.','支承、载荷位置与载荷分布共同确定弯曲工况。']:id==='reflection'?['The values follow N²Jₘ for one fixed rotor.','固定同一转子，按 N²Jₘ 计算。']:id==='kinetic'?['Energy follows ½mv² for the stated effective masses. Force and pressure also require contact conditions.','曲线按给定等效质量和 ½mv² 计算；接触力与压强还需要接触条件。']:['An interpolation law used inside an optimization model; the curve is not a solved structure.','这是优化模型中的插值关系，曲线本身不代表已求解的结构。'];
  return `<figure class="lightweight-figure" data-lightweight-figure="${id}"><div class="lw-chart-controls" role="group" aria-label="Chart parameters">${labels.map((v,i)=>`<button type="button" data-lw-choice="${i}" aria-pressed="${i===0}">${bi(v[0]!,v[1]!)}</button>`).join('')}</div><div class="lw-chart-frame" data-lw-plot>${lightweightDiagram(id)}</div><figcaption><span class="figure-title">${bi(...titles as [string,string])}</span><p class="lw-chart-message" data-lw-message aria-live="polite">${bi(lightweightMessage(id,0,'en'),lightweightMessage(id,0,'zh'))}</p><span class="figure-description">${bi(...desc as [string,string])}</span></figcaption></figure>`;
}
