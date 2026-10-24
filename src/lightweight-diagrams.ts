import {FONT} from './theme.js';
import {materials} from './lightweight-mechanics.js';
import type {Language} from './i18n.js';
export type LightFigure='ashby'|'strength'|'beam'|'reflection'|'simp'|'section';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const tr=(en:string,zh:string,l:Language)=>l==='en'?en:zh;
const text=(x:number,y:number,t:string,size=14,anchor='middle',color='#536d79')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${color}">${t}</text>`;
const line=(x1:number,y1:number,x2:number,y2:number,color='#dce8e9',width=1)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
function svg(id:string,body:string,title:string){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" role="img" aria-labelledby="lw-${id}-title" style="font-family:${FONT}"><title id="lw-${id}-title">${title}</title>${body}</svg>`;}
export const indexPowers=[1,.5,1/3] as const;
export function relativeMaterialIndex(E:number,rho:number,power:number){return (E/materials.aluminium.E)**power/(rho/materials.aluminium.rho);}
export function lightweightMessage(id:LightFigure,choice=0,language:Language='en'){
  if(id==='section') {const phi=[1,3/Math.PI,3*(5+1/20)/Math.PI,3*(10+1/40)/Math.PI][choice]!;return tr(`At equal area and modulus, the selected section has ${phi.toFixed(2)} × the square’s bending stiffness. Its curvature under the same moment is ${(1/phi).toFixed(3)} × the reference.`,`截面积与模量相同时，所选截面的抗弯刚度为实心方形的 ${phi.toFixed(2)} 倍，相同弯矩下的曲率为参考值的 ${(1/phi).toFixed(3)} 倍。`,language);}
  if(id==='strength')return tr(`Strength index exponent: ${[1,2/3,.5][choice]!.toFixed(3)}. Compare metal yield strengths with one consistent geometric freedom.`,`强度指数幂次：${[1,2/3,.5][choice]!.toFixed(3)}。按相同的几何自由度比较金属屈服强度。`,language);
  if(id==='beam')return choice===0?tr('A transverse tip load gives δ = FL³/(3EI). Bending moment is largest at the clamp.','横向末端集中力对应 δ = FL³/(3EI)，固支端弯矩最大。',language):tr('With the same total force distributed uniformly, δ = FL³/(8EI), or 3/8 of the tip-load displacement.','相同总力均匀分布时，δ = FL³/(8EI)，为末端集中力挠度的 3/8。',language);
  if(id==='ashby') {const p=indexPowers[choice]!,best=Object.entries(materials).map(([name,m])=>({name,...m,value:relativeMaterialIndex(m.E,m.rho,p)})).sort((a,b)=>b.value-a.value)[0]!;
    return tr(`Constant-index slope: ${(1/p).toFixed(0)}. Highest index among these five reference materials: ${best.en}, ${best.value.toFixed(2)} × aluminium.`,`等指数线斜率为 ${(1/p).toFixed(0)}。五种参考材料中指数最高：${best.zh}，为铝合金的 ${best.value.toFixed(2)} 倍。`,language);}
  if(id==='reflection'){const N=[6,10,30,50,100][choice]!;return tr(`At ${N}:1, N²Jₘ = ${(N*N*.0001).toFixed(4)} kg·m² for Jₘ = 10⁻⁴ kg·m². Only the reduction is varied.`,`转子惯量固定为 10⁻⁴ kg·m²，减速比 ${N}:1 时，N²Jₘ = ${(N*N*.0001).toFixed(4)} kg·m²。只改变减速比。`,language);}
  const p=[1,3][choice]!;return tr(`At relative density 0.5, the normalized stiffness contribution is 0.5^${p} = ${(.5**p).toFixed(3)} (neglecting the small minimum modulus).`,`相对密度为 0.5 时，归一化刚度贡献为 0.5^${p} = ${(.5**p).toFixed(3)}，忽略很小的最小模量。`,language);
}
export function lightweightDiagram(id:LightFigure,choice=0,l:Language='en'){
  let b='';
  if(id==='ashby'||id==='strength') {
    const strength=id==='strength',base=strength?240:69,powers=strength?[1,2/3,.5]:indexPowers;
    const X=(rho:number)=>80+Math.log10(rho/.8)/Math.log10(10/.8)*530;
    const Y=(E:number)=>strength?327-Math.log10(E/100)/Math.log10(1000/100)*275:327-Math.log10(E/.5)/Math.log10(300/.5)*275;
    b=`<defs><clipPath id="lw-${id}-clip"><rect x="80" y="52" width="530" height="275"/></clipPath></defs>`;
    for(const v of [1,2,5,10]) {const x=X(v);b+=line(x,52,x,327)+text(x,349,String(v));}
    for(const v of strength?[100,200,500,1000]:[1,10,100]){const y=Y(v);b+=line(80,y,610,y)+text(66,y+5,String(v),13,'end');}
    const a=powers[choice]!;let path='';for(let i=0;i<=100;i++){const rho=.8*(10/.8)**(i/100),E=base*(rho/2.7)**(1/a);path+=`${i?'L':'M'}${X(rho).toFixed(1)},${Y(E).toFixed(1)} `;}
    b+=`<path d="${path}" clip-path="url(#lw-${id}-clip)" stroke="#73b598" stroke-width="2" stroke-dasharray="6 4" fill="none"/>`;
    const labels={aluminium:['Al 6061-T6',0,-18],steel:['Steel',-12,-15],titanium:['Ti-6Al-4V',8,24],carbon:['CFRP',-25,-18],magnesium:['Mg AZ31B',25,24]} as const;
    for(const [key,m] of Object.entries(materials)){if(strength&&key==='carbon')continue;const [label,dx,dy]=labels[key as keyof typeof labels];const x=X(m.rho/1000),y=Y(strength?m.strength/1e6:m.E/1e9);b+=`<circle cx="${x}" cy="${y}" r="7" fill="${key==='carbon'?'#7bbda3':'#327da9'}" stroke="white" stroke-width="2"/>`+text(x+dx,y+dy,label,13);}
    b+=text(345,384,tr('Density ρ · Mg/m³ (log scale)','密度 ρ · Mg/m³（对数）',l))+text(80,25,strength?tr('Yield strength · MPa (log scale)','屈服强度 · MPa（对数）',l):tr('Young’s modulus E · GPa (log scale)','杨氏模量 E · GPa（对数）',l),14,'start');
    b+=text(608,25,`${strength?'σ': 'E'}${choice===0?'':strength?(choice===1?'²ᐟ³':'¹ᐟ²'):(choice===1?'¹ᐟ²':'¹ᐟ³')}/ρ`,15,'end','#2d8a65');
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
  const labels=id==='section'?[['Square','方形'],['Circle','圆形'],['r/t = 5','r/t = 5'],['r/t = 10','r/t = 10']]:id==='ashby'?[['Tie · E/ρ','拉杆 · E/ρ'],['Beam · E¹ᐟ²/ρ','梁 · E¹ᐟ²/ρ'],['Plate · E¹ᐟ³/ρ','板 · E¹ᐟ³/ρ']]:id==='strength'?[['Tie · σ/ρ','拉杆 · σ/ρ'],['Beam · σ²ᐟ³/ρ','梁 · σ²ᐟ³/ρ'],['Plate · σ¹ᐟ²/ρ','板 · σ¹ᐟ²/ρ']]:id==='beam'?[['Tip load','末端集中力'],['Distributed load','均布载荷']]:id==='reflection'?[6,10,30,50,100].map(n=>[`${n}:1`,`${n}:1`]):[['p = 1','p = 1'],['p = 3','p = 3']];
  const titles=id==='section'?['Section shape at equal mass','等质量截面形状']:id==='ashby'?['Material indices on logarithmic axes','对数坐标中的材料指数']:id==='strength'?['Strength and density','强度与密度']:id==='beam'?['Cantilever loading','悬臂梁载荷']:id==='reflection'?['Reduction and reflected inertia','减速比与反射惯量']:['SIMP stiffness interpolation','SIMP 刚度插值'];
  const desc=id==='section'?['Mean radius r; wall thickness t. Values use the exact annulus second moment.','r 为平均半径，t 为壁厚；数值按圆环精确二次矩计算。']:id==='ashby'||id==='strength'?['Representative teaching values; the dashed line passes through aluminium.','采用教学代表值；虚线经过铝合金参考点。']:id==='beam'?['The support, load location and load distribution define the bending problem.','支承、载荷位置与载荷分布共同确定弯曲工况。']:id==='reflection'?['The values follow N²Jₘ for one fixed rotor.','固定同一转子，按 N²Jₘ 计算。']:['An interpolation law used inside an optimization model; the curve is not a solved structure.','这是优化模型中的插值关系，曲线本身不代表已求解的结构。'];
  return `<figure class="lightweight-figure" data-lightweight-figure="${id}"><div class="lw-chart-controls" role="group" aria-label="Chart parameters">${labels.map((v,i)=>`<button type="button" data-lw-choice="${i}" aria-pressed="${i===0}">${bi(v[0]!,v[1]!)}</button>`).join('')}</div><div class="lw-chart-frame" data-lw-plot>${lightweightDiagram(id)}</div><figcaption><span class="figure-title">${bi(...titles as [string,string])}</span><p class="lw-chart-message" data-lw-message aria-live="polite">${bi(lightweightMessage(id,0,'en'),lightweightMessage(id,0,'zh'))}</p><span class="figure-description">${bi(...desc as [string,string])}</span></figcaption></figure>`;
}
