import {FONT} from './theme.js';
import {designCost,valueTangent,costMinimumMass,valueAdjustedMass} from './lightweight-cost.js';
type Lang='en'|'zh';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x:number,y:number,lines:string[],size=17,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#344954">${lines.map((s,i)=>`<tspan x="${x}" dy="${i?size*1.55:0}">${esc(s)}</tspan>`).join('')}</text>`;
const box=(x:number,y:number,w:number,h:number,lines:string[],size=17)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fcfdfc" stroke="#617780" stroke-width="1.6"/>${text(x+w/2,y+h/2-(lines.length-1)*size*.775+size*.35,lines,size)}`;
const path=(id:string,d:string,arrow=true,dash=false)=>`<path d="${d}" fill="none" stroke="#617780" stroke-width="1.6"${dash?' stroke-dasharray="6 5"':''}${arrow?` marker-end="url(#fw-${id})"`:''}/>`;
const choose=(l:Lang,en:string[],zh:string[])=>l==='en'?en:zh;
export function frameworkDrawing(id:string):string|undefined{
 let height=600,draw:((l:Lang)=>string)|undefined;
 if(id==='framework'){
 height=835;draw=l=>{
  let s=text(450,25,choose(l,['Lighter necessary parts · fewer necessary parts'],['必要零件更轻 · 必要零件更少']),20);
  s+=box(15,53,870,58,choose(l,['Minimum mass subject to stiffness, strength, dynamics and safety'],['在满足刚度、强度、动力学与安全要求的前提下质量最小']),19);
  s+=text(220,157,choose(l,['Traditional methods: lighter parts'],['传统方法：让每个零件更轻']),20)+text(665,157,choose(l,['Integrated methods: fewer parts'],['集成方法：需要更少的零件']),20);
  const left=[
   [['Material lightweighting','Higher E/ρ and σ/ρ: Al, Mg, Ti, CFRP, hybrids','Choose the index for the load case'],['材料轻量化','更高的 E/ρ 与 σ/ρ：铝、镁、钛、CFRP、混合材料','按载荷工况的性能指数选材']],
   [['Structural lightweighting','Topology, size and shape optimization','Thin walls, sandwich, proximal mass placement'],['结构设计轻量化','拓扑、尺寸与形状优化','薄壁、夹层结构、质量近端布置']],
   [['Manufacturing lightweighting','Metal AM, composite tubes, thin-wall casting','Merge parts; remove joints and fasteners'],['制造轻量化','金属增材制造、复合材料管、薄壁铸造','零件合并，消除连接与紧固件']]];
  left.forEach(([en,zh],i)=>s+=box(15,185+i*145,415,125,choose(l,en!,zh!),15));
  s+=box(465,185,420,205,choose(l,['Passive integration','One part shares functions without control','Structure + spring, fluid, cables, heat path','Cassie leaf springs · Atlas hydraulic passages','Fewer parts and interfaces'],['被动功能集成','一个零件承担多种功能，无需控制','结构 + 弹簧、流道、线缆、散热','Cassie 板簧 · Atlas 集成油路','收益：零件和接口更少']),16);
  s+=box(465,415,420,205,choose(l,['Active integration','Actuators, sensors and electronics in structure','Joint modules, torque sensing, SEA, tactile skin','LWR III joints · Mini Cheetah actuators','Less wiring; control supports lighter links'],['主动功能集成','执行器、传感器、电子器件集成于结构中','关节模组、扭矩传感、SEA、触觉皮肤','LWR III 关节 · Mini Cheetah 执行器','收益：线束更少，控制支持更轻连杆']),16);
  s+=box(15,660,870,78,choose(l,['Theory: robot dynamics (M, g, I = mr²), material indices (Ashby),','structural mechanics and optimization'],['理论基础：机器人动力学（M、g、I = mr²）、材料性能指数（Ashby）','结构力学与优化']),17);
  s+=box(15,766,870,58,choose(l,['Evaluation: payload / mass · transport cost · reflected inertia · modes · impact energy'],['对照目标评价：负载自重比 · 运输代价 · 反射惯量 · 固有频率 · 冲击能量']),16);
  for(const x of [220,675])s+=path(id,`M${x} 111V135`)+path(id,`M${x} 660V635`);
  return s+path(id,'M885 795H896V82H885');
 };
 }else if(id==='cost'){
 height=545;draw=l=>{
  const X=(m:number)=>110+700*m,Y=(c:number)=>400-80*c,A={x:X(costMinimumMass),y:Y(designCost(costMinimumMass))},B={x:X(valueAdjustedMass),y:Y(designCost(valueAdjustedMass))};
  let s=path(id,'M95 425V28')+path(id,'M95 425H850');
  let curve='';for(let i=0;i<=98;i++){const m=.02+i/100;curve+=`${i?'L':'M'}${X(m).toFixed(2)} ${Y(designCost(m)).toFixed(2)} `;}
  s+=`<path data-cost-curve d="${curve}" fill="none" stroke="#3f738c" stroke-width="3"/>`;
  s+=path(id,`M${X(.16)} ${Y(valueTangent(.16))}L${X(.62)} ${Y(valueTangent(.62))}`,false,true);
  for(const [name,p] of [['A',A],['B',B]] as const){s+=path(id,`M${p.x} ${p.y+6}V425`,false,true)+`<circle data-cost-point="${name}" cx="${p.x}" cy="${p.y}" r="5" fill="#3f738c"/>`+text(p.x-13,p.y-13,[name],20);}
  s+=text(95,20,choose(l,['Cost'],['成本']),18)+text(830,455,choose(l,['Structural mass m →'],['结构质量 m →']),17,'end');
  s+=text(B.x,451,['mB'],15)+text(A.x,451,['mA'],15);
  s+=text(152,54,choose(l,['Extreme lightweighting'],['极限减重']),16,'start')+path(id,`M220 66L${X(.09)} ${Y(designCost(.09))}`,false);
  s+=text(530,80,choose(l,['Design and manufacturing cost C(m)'],['设计、制造等成本 C(m)']),17,'start');
  s+=text(530,110,choose(l,['A: minimum of C(m)'],['A：C(m) 的最低点']),16,'start');
  s+=text(530,140,choose(l,['B: includes the value of lower mass'],['B：进一步计入减重价值']),16,'start');
  s+=text(170,245,choose(l,['Tangent at B','Slope set by the value per unit mass'],['B 点切线','斜率对应单位质量的等价成本']),15,'start');
  s+=text(450,505,choose(l,['Reducing mass ←     A and B lie on the same design-cost curve'],['← 质量减小     A、B 均位于同一条设计成本曲线上']),16);
  return s;
 };
 }else if(id==='indexbars'){
 height=440;draw=l=>{
  let s='';const names=choose(l,['Steel','Ti-6Al-4V','Al 7075','Mg AZ91','CFRP QI','CFRP UD'],['钢','钛合金','铝 7075','镁 AZ91','CFRP 准各向','CFRP 单向']);
  for(let j=0;j<2;j++){
   const vals=j===0?[27,26,26,25,39,90]:[1.9,2.4,3.0,3.7,5.0,7.6],max=j===0?100:8,start=35+j*450;
   s+=text(start+190,27,[j===0?'E / ρ':'E¹ᐟ² / ρ'],20);
   for(let k=0;k<=4;k++)s+=path(id,`M${start} ${340-k*68}H${start+410}`,false);
   vals.forEach((v,i)=>{const x=start+12+i*66,h=v/max*272;s+=`<rect x="${x}" y="${340-h}" width="40" height="${h}" fill="${i>3?'#5d9e88':i>1&&j===1?'#cc8755':'#92999c'}"/>`+text(x+20,330-h,[j===0?String(v):v.toFixed(1)],16)+text(x+20,370,[names[i]!],12);});
  }
  return s+text(450,422,choose(l,['E in GPa · ρ in g/cm³ · QI: quasi-isotropic · UD: longitudinal'],['E：GPa · ρ：g/cm³ · 准各向同性与单向纵向 CFRP']),15);
 };
 }else if(id==='forcepaths'){
 height=300;draw=l=>{
  let s='';for(const x of [40,495]){
   s+=path(id,`M${x} 190H${x+340}V80H${x}`,false)+path(id,`M${x} 65V215`,false);
   for(let y=72;y<210;y+=15)s+=path(id,`M${x-12} ${y+12}L${x} ${y}`,false);
   s+=path(id,`M${x+340} 30V75`)+text(x+340,25,['F'],18);
  }
  s+=path(id,'M495 190L835 80',false)+text(220,250,choose(l,['Frame: bending through joints'],['框架：经过接头的弯曲传力']),17)+text(665,250,choose(l,['Braced path: axial force in diagonal'],['斜撑路径：斜杆传递轴力']),17);
  return s+text(450,290,choose(l,['Equal applied load; actual stiffness depends on sections and joint behavior'],['相同外载荷；实际刚度取决于截面与接头行为']),15);
 };
 }else if(id==='verification'){
 height=665;draw=l=>{
  let s=box(250,40,345,570,[],17)+text(422,85,choose(l,['Lightweight structure'],['轻量化结构']),20);
  s+=box(270,125,305,160,choose(l,['Stiffness verification','Load-capacity verification','Residual-strength verification'],['刚度验算','承载能力验算','残余强度验算']),16);
  s+=box(270,330,305,115,choose(l,['Service-life verification','Crack-growth behavior'],['使用寿命验算','裂纹扩展行为']),17);
  s+=box(270,495,305,85,choose(l,['Structural reliability'],['结构可靠性']),18);
  s+=box(12,286,195,95,choose(l,['Static force transfer','Dynamic force transfer'],['静态力传递','动态力传递']),16)+path(id,'M207 333H250');
  const groups=[[['Construction','Geometry · stiffness'],['构造','几何形状 · 刚度']],[['Material','Strength · fracture toughness'],['材料','强度 · 断裂韧性']],[['Technology','Manufacturing · surface'],['技术','制造 · 表面']],[['Environment','Climate · temperature'],['环境','气候 · 温度']]];
  groups.forEach(([en,zh],i)=>{const y=25+i*156;s+=box(674,y,215,112,choose(l,en!,zh!),14)+path(id,`M674 ${y+56}H635`,false);});
  return s+path(id,'M635 81V549',false)+path(id,'M635 333H595')+text(450,648,choose(l,['Verification methods for lightweight structures'],['用于轻量化结构的验算方法']),17);
 };
 }else if(id==='workflow'){
 height=940;draw=l=>{
  let s='<path d="M295 20H615L580 70H260Z" fill="#fcfdfc" stroke="#617780" stroke-width="1.6"/>'+text(437,51,choose(l,['Lightweight project'],['轻量化项目']),19)+path(id,'M437 70V110');
  const labels=[['Clarify boundary conditions','解释边界条件'],['Find a scheme','寻找方案'],['Develop a plan','转换成计划'],['Prepare production documents','整理为生产档案']];
  const ys=[110,225,450,635];
  labels.forEach(([en,zh],i)=>{const y=ys[i]!;s+=box(265,y,335,58,choose(l,[en!],[zh!]),17)+box(265,y,35,58,[String(i+1)]);if(i<3)s+=path(id,`M437 ${y+58}V${ys[i+1]}`);});
  s+=box(40,112,165,585,choose(l,['Lightweight experts','Construction','Materials','Elastic behavior','Basic-unit design','Load performance','Working performance'],['轻量化专家','构造','材料','弹性力学行为','基本单元设计','载荷性能','工作性能']),16);
  for(const y of [254,479,664])s+=path(id,`M205 ${y}H265`);
  s+=box(622,305,268,119,choose(l,['Determine: forces, materials','Select: structure, units, joining','Design: preliminary dimensions','Conditions: environment,','assembly and production'],['确定：力、材料','选择：结构、单元、连接技术','设计：预设几何尺寸','条件：环境、装配、生产']),14)+path(id,'M756 305V254H600');
  s+=box(622,535,268,64,choose(l,['Processing: geometry,','function and parameters'],['加工：几何形状、功能、参数']),15)+path(id,'M756 535V479H600');
  s+=box(622,723,268,78,choose(l,['Modify: structure, manufacturing','Verify: load-bearing strength'],['修改：结构、制造','验证：承载强度']),15)+path(id,'M756 723V664H600');
  s+=path(id,'M265 254H233V139H265')+path(id,'M437 693V756');
  s+=box(305,756,265,45,choose(l,['Prototype manufacture'],['原型制造']),17)+path(id,'M437 801V831')+box(305,831,265,45,choose(l,['Trial production'],['试制']),17)+path(id,'M437 876V900')+box(305,900,265,36,choose(l,['Delivery'],['交付']),17);
  s+=path(id,'M305 778H234V664H265')+text(220,733,choose(l,['Optimize'],['优化']),15)+path(id,'M305 853H264V778H305');return s;
 };
 }else if(id==='modeling'){
 height=635;draw=l=>{
  let s=box(242,30,420,60,choose(l,['Real-world practical problem'],['实际工程问题']),19);
  s+=box(545,180,343,145,choose(l,['Construct / refine mathematical model','Fixed parameters: vector p','Design variables: vector x'],['构建／改进数学模型','固定参数：向量 p','设计变量：向量 x']),17);
  s+=box(230,395,440,78,choose(l,['Mathematical solution to model','x*(p)'],['数学模型求解','x*(p)']),19);
  s+=box(15,180,360,145,choose(l,['Practical implementation and','evaluation of x*(p)','Adjust p? Refine the model?'],['实施与评价 x*(p)','是否调整参数 p？','是否改进模型？']),18);
  s+=path(id,'M662 60H720V180')+path(id,'M720 325V434H670')+path(id,'M230 434H195V325')+path(id,'M195 180V60H242');
  s+=box(100,550,700,78,choose(l,['Optimization algorithms','Mathematical methods and computer programs'],['优化算法','数学方法与计算机程序']),19);
  for(const x of [280,360,440,520,600])s+=path(id,`M${x} 550V473`,true,true)+path(id,`M${x+12} 473V550`,true,true);
  return s;
 };
 }else if(id==='virtual'){
 height=470;draw=l=>{
  let s='<rect x="25" y="70" width="330" height="330" rx="30" fill="none" stroke="#79a8a2" stroke-dasharray="7 5"/><rect x="493" y="70" width="390" height="330" rx="30" fill="none" stroke="#79a8a2" stroke-dasharray="7 5"/>';
  s+=box(36,184,90,125,choose(l,['Analysis','model and','test-rig','setup'],['分析模型','建立及','试验台','搭建']),17);
  s+=box(146,115,185,95,choose(l,['Component finite-','element model'],['零件有限元','分析模型建立']),17)+box(146,281,185,85,choose(l,['Component bench-','test scheme'],['零件台架','试验方案设计']),17);
  s+=path(id,'M355 235H382')+box(382,159,84,152,choose(l,['Baseline','scheme','analysis','and','comparison'],['原方案','分析','对标及','摸底']),17)+path(id,'M466 235H493');
  s+=box(515,106,346,58,choose(l,['Structural-performance simulation'],['结构性能仿真分析']),18)+box(515,205,146,102,choose(l,['Sensor and','strain-gauge','placement'],['传感器和','应变片','布置指导']),16)+box(717,205,144,102,choose(l,['CAE model','fidelity','comparison'],['CAE 分析','模型精度','对标复现']),16)+box(515,340,346,48,choose(l,['Component bench test'],['零件台架试验']),18);
  s+=path(id,'M678 164V340')+path(id,'M699 340V164');return s;
 };
 }
 if(!draw)return;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${height}" role="img" aria-label="${id}" style="font-family:${FONT}"><title>${id}</title><defs><marker id="fw-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#617780"/></marker></defs><g lang="en">${draw('en')}</g><g lang="zh-CN">${draw('zh')}</g></svg>`;
}
