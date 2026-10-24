import {FONT} from './theme.js';
import {frameworkDrawing} from './lightweight-frameworks.js';
const bi=(en:string,zh:string)=>`<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const card=(en:string,zh:string,detailEn:string,detailZh:string)=>`<div class="course-card"><strong>${bi(en,zh)}</strong><p>${bi(detailEn,detailZh)}</p></div>`;
const arrow='<span class="course-arrow" aria-hidden="true">→</span>';
const flow=(steps:string[])=>`<div class="course-flow">${steps.join(arrow)}</div>`;
const note=(en:string,zh:string)=>`<p class="course-diagram-note">${bi(en,zh)}</p>`;
function plot(id:string,height:number,en:string,zh:string,draw:(l:'en'|'zh')=>string){
 return `<svg viewBox="0 0 680 ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${en}" style="font-family:${FONT}"><title>${en}</title><defs><marker id="course-${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#648795"/></marker></defs><g lang="en">${draw('en')}</g><g lang="zh-CN">${draw('zh')}</g></svg>`;
}
const label=(x:number,y:number,en:string,zh:string,l:'en'|'zh',size=14,anchor='middle')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="#3e5d6a">${l==='en'?en:zh}</text>`;
export const courseFigures=['framework','cost','verification','workflow','virtual','modeling','materials','selection','stressstrain','energy','loadpaths','sandwich','rtm','integration','storage','monitoring','guidedwave','stages','topology','spiral','placement','transmission','payload','indexbars','forcepaths'] as const;
export type CourseFigure=typeof courseFigures[number];
export function renderCourseFigure(id:CourseFigure){
 let body='',title=['',''],desc=['',''];
 const c=card;
 if(id==='framework'){
  title=['Lightweight design framework','轻量化设计技术框架'];
  body=note('Same required performance · lower complete assembly mass','相同功能要求 · 更低的完整装配质量')+`<div class="course-branches"><section><h4>${bi('Lighter components','零件更轻')}</h4>${c('Material','材料','Choose properties for the load and dimensions.','按载荷与尺寸自由度选材。')}${c('Structure','结构','Place material along efficient load paths.','沿高效传力路径分配材料。')}${c('Manufacturing','制造','Produce thin, integrated, repeatable geometry.','实现薄壁、集成与稳定成形。')}</section><section><h4>${bi('Fewer components','零件更少')}</h4>${c('Passive integration','被动功能集成','Share support, protection, routing and heat flow.','共用承载、防护、走线与导热。')}${c('Active integration','主动功能集成','Combine structure with sensing, actuation or storage.','将结构与感知、驱动或储能结合。')}</section></div>`+note('Compare stiffness, strength, life, dynamics, environment and cost.','按刚度、强度、寿命、动力学、环境与成本共同评价。');
 }else if(id==='cost'){
  title=['Cost and structural mass','成本与结构质量'];desc=['',''];
  body=plot(id,350,...title as [string,string],l=>{
   let b='<path d="M70 35V245H625" fill="none" stroke="#7a959e" stroke-width="1.5"/>';
   b+='<path d="M95 45 C135 200 230 226 355 227 C465 228 540 215 615 135" fill="none" stroke="#2b7fa4" stroke-width="3"/>';
   b+='<path d="M355 205V250M205 160V250" stroke="#86bfa5" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M115 166L355 239" stroke="#86bfa5" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="355" cy="227" r="5" fill="#40936e"/><circle cx="205" cy="194" r="5" fill="#40936e"/>';
   b+=label(350,282,'Structural mass →','结构质量 →',l)+label(72,22,'Cost','成本',l,14,'start')+label(155,58,'Extreme lightweighting','极限轻量化',l)+label(365,195,'A','A',l,16)+label(216,177,'B','B',l,16)+label(545,119,'Unnecessary mass','冗余质量',l);
   b+=label(340,315,'A: design/cost balance · B: value assigned to saving mass','A：设计成本平衡 · B：计入减重价值后的取舍',l,14);
   return b;
  });
 }else if(id==='verification'){
  title=['The structural verification framework','结构验算框架'];
  body=note('Static and dynamic force transfer → structural verification','静态与动态传力 → 结构验算')+`<div class="course-triple">${c('Capacity and deformation','承载与变形','Stiffness · load capacity · remaining strength','刚度 · 承载能力 · 残余强度')}${c('Durability','耐久性','Service life · crack growth','使用寿命 · 裂纹扩展')}${c('Reliability','可靠性','Scatter, defects and failure probability','离散性、缺陷与失效概率')}</div><div class="course-inputs">${c('Construction','构造','Geometry · structural stiffness','几何形状 · 结构刚度')}${c('Material','材料','Strength · fracture toughness','强度 · 断裂韧性')}${c('Technology','技术','Manufacturing · surface condition','制造 · 表面状态')}${c('Environment','环境','Climate · temperature','气候 · 温度')}</div>`+note('The four input groups affect the verification together.','四组输入共同影响上述验算。');
 }else if(id==='workflow'||id==='stages'){
  title=id==='workflow'?['From requirements to delivery','从要求到交付']:['Decisions at each design stage','各设计阶段的决策'];
  body=flow([c('Requirements','设计要求','Loads, life, space, cost','载荷、寿命、空间、成本'),c('Concept and scheme','概念与方案','Functions, materials, load paths','功能、材料、传力'),c('Detail and production','详细与生产','Dimensions, process, tolerances','尺寸、工艺、公差'),c('Prototype and test','原型与试验','Check, update, deliver','检查、更新、交付')])+note('↶ Test evidence can revise the model, dimensions or the concept itself.','↶ 试验结果可以反馈到模型、尺寸，乃至概念本身。');
 }else if(id==='modeling'){
  title=['Engineering problem and numerical model','工程问题与数值模型'];
  body=flow([c('Physical problem','实际问题','Loads, functions and boundaries','载荷、功能与边界'),c('Mathematical model','数学模型','Variables, objective and constraints','变量、目标与约束'),c('Numerical solution','数值求解','Analysis and optimization algorithm','分析与优化算法'),c('Interpretation','结果解释','Engineering meaning and test evidence','工程含义与试验证据')])+note('↶ Revisit assumptions when the result and the physical behavior disagree.','↶ 结果与实际行为不符时，返回检查模型假设。');
 }else if(id==='virtual'){
  title=['The virtual–physical loop','虚实结合'];
  body=`<div class="course-pair">${c('Analysis','仿真分析','Build the model; select loads and measurement locations.','建立模型，选择载荷和测点。')}<span aria-hidden="true">↔</span>${c('Physical test','实物试验','Measure deformation, strain, modes and damage.','测量变形、应变、模态和损伤。')}</div>`+note('Comparison → model calibration → a new design prediction','对比 → 模型校准 → 新的设计预测');
 }else if(id==='materials'){
  title=['Processing, structure, properties and performance','工艺、组织、性能与使用'];
  body=`<div class="course-material-map">${c('Composition and structure','成分与结构','Microstructure, fibres, pores, interfaces','组织、纤维、孔隙、界面')}${c('Synthesis and processing','合成与加工','Forming, casting, heat treatment, consolidation','成形、铸造、热处理、固结')}${c('Properties','性能','Mechanical, physical, chemical','力学、物理、化学')}${c('Service behavior','使用行为','Static, cyclic, thermal and environmental','静态、循环、热与环境')}</div>`+note('↔ Each choice constrains the others: processing changes structure and properties; service requirements guide composition and process.','↔ 各项相互约束：工艺改变组织与性能，使用要求又指导成分与加工选择。');
 }else if(id==='selection'){
  title=['From a requirement to a material index','从设计要求到材料指数'];
  body=flow([c('Requirement','要求','Load and allowable response','载荷与允许响应'),c('Free dimension','自由尺寸','Area, depth, wall or thickness','面积、高度、壁厚或板厚'),c('Mass expression','质量表达式','Substitute the minimum required size','代入满足约束的最小尺寸'),c('Material term','材料相关项','Rank the remaining property group','比较剩余的性能组合')]);
 }else if(id==='stressstrain'){
  title=['Elastic slope, yield and fracture','弹性斜率、屈服与断裂'];desc=['Qualitative tensile curve for a ductile material; no grade-specific data.','延性材料的定性拉伸曲线，不对应某一牌号的实测数据。'];
  body=plot(id,300,...title as [string,string],l=>'<path d="M75 30V245H625" stroke="#7895a0" fill="none"/><path d="M75 245L145 125C180 126 260 64 400 65C470 65 530 100 565 135" stroke="#287fab" stroke-width="3" fill="none"/><path d="M145 125L145 245M400 65L400 245" stroke="#b9d9cb" stroke-dasharray="4 4"/>'+label(78,20,'Stress σ','应力 σ',l,14,'start')+label(350,282,'Strain ε','应变 ε',l)+label(107,155,'E','E',l,16)+label(170,109,'Yield','屈服',l)+label(400,48,'Ultimate stress','极限应力',l)+label(565,119,'Fracture','断裂',l));
 }else if(id==='energy'){
  title=['Absorbed work on a load–displacement curve','力—位移曲线中的吸收功'];desc=['The shaded area represents work. Elastic storage and irreversible absorption depend on the loading cycle.','阴影面积表示功，弹性储存与不可逆耗散需要结合加载循环区分。'];
  body=plot(id,270,...title as [string,string],l=>'<path d="M80 25V220H620" fill="none" stroke="#79949f"/><path d="M80 220L150 95C260 68 400 85 570 110L570 220Z" fill="#dceee5"/><path d="M80 220L150 95C260 68 400 85 570 110" fill="none" stroke="#2d859b" stroke-width="3"/>'+label(82,18,'Force','力',l,14,'start')+label(350,255,'Displacement','位移',l)+label(350,155,'Area = work','面积 = 功',l,17));
 }else if(id==='loadpaths'){
  title=['Three structural-efficiency principles','结构效率的三项原则'];
  body=`<div class="course-triple">${c('Efficient section','高效截面','Place material away from the neutral axis where useful.','在有效方向上，将材料移离中性轴。')}${c('Direct load path','直接传力','Reduce unnecessary offsets and load detours.','减少不必要的偏置与传力绕行。')}${c('Appropriate utilization','合理利用材料','Size for all governing cases, including stability.','按完整主导工况设计，也包括稳定性。')}</div>`;
 }else if(id==='sandwich'){
  title=['Faces and core in a sandwich','夹层结构中的面板与芯材'];
  body=plot(id,215,...title as [string,string],l=>'<rect x="65" y="70" width="420" height="15" fill="#3c86a3"/><rect x="65" y="85" width="420" height="65" fill="#dceee5"/><path d="M65 150L85 85L105 150L125 85L145 150L165 85L185 150L205 85L225 150L245 85L265 150L285 85L305 150L325 85L345 150L365 85L385 150L405 85L425 150L445 85L465 150L485 85" stroke="#8cbfa9" fill="none"/><rect x="65" y="150" width="420" height="15" fill="#3c86a3"/>'+label(520,83,'Faces: bending','面板：抗弯',l,14,'start')+label(520,121,'Core: shear','芯材：剪切',l,14,'start')+label(275,195,'Separation increases bending leverage','间距增大抗弯力臂',l));
 }else if(id==='rtm'){
  title=['The RTM manufacturing chain','RTM 制造工艺链'];
  body=`<ol class="course-process"><li>${bi('Cut and store reinforcement','裁切与储存')}</li><li>${bi('Drape, tack, pre-consolidate','铺覆、定位、预压实')}</li><li>${bi('Place preform and close mold','放置预成形体、合模')}</li><li>${bi('Inject resin and cure','树脂注射与固化')}</li><li>${bi('Demold and trim','脱模与修边')}</li><li>${bi('Inspect geometry and quality','检测几何与质量')}</li></ol>`+note('Fibre placement + wetting + consolidation determine the resulting material.','纤维布置、浸润与固结共同决定制成材料的性能。');
 }else if(id==='integration'){
  title=['Functional sharing at system level','系统层面的功能共用'];
  body=`<div class="course-pair">${c('Separate parts','分离零件','Load-bearing part + cover + duct + heat spreader','承力件 + 外罩 + 线槽 + 导热件')}<span aria-hidden="true">→</span>${c('Integrated structure','集成结构','One geometry satisfies several functions.','一套几何同时满足多项功能。')}</div>`+note('Include interfaces, added protection, inspection and repair in the comparison.','比较应包含接口、新增防护、检测与维修。');
 }else if(id==='storage'){
  title=['Two storage metrics, plus a structural requirement','两项储能指标与结构要求'];
  body=`<div class="course-triple">${c('Specific energy','比能量','Stored energy per mass · endurance','单位质量储能 · 持续时间')}${c('Specific power','比功率','Delivered power per mass · short pulses','单位质量输出功率 · 短时脉冲')}${c('Mechanical function','机械功能','Stiffness, strength and damage tolerance','刚度、强度与损伤容限')}</div>`+note('Compare complete separate and multifunctional systems at equal required functions.','在所需功能相同的条件下，比较分离系统与多功能系统。');
 }else if(id==='monitoring'){
  title=['Why observability can affect structural mass','可观测性如何影响结构质量'];
  body=flow([c('Damage and uncertainty','损伤与不确定性','Defects, impact, environment','缺陷、冲击、环境'),c('Detection and response','检测与响应','Signals, coverage, inspection, repair','信号、覆盖、检查、维修'),c('Design allowance','设计许用值','Evidence supports the chosen margin.','用证据支持所采用的余量。')])+note('Sensor and protection mass remain in the complete system budget.','传感器与防护质量仍需进入系统预算。');
 }else if(id==='guidedwave'){
  title=['A debond changes a guided wave’s path','脱粘改变导波传播'];desc=['Principle schematic. Arrows indicate transmission and reflection, not a simulated or measured wave field.','原理示意。箭头表示传播与反射，不代表仿真或实测波场。'];
  body=plot(id,365,...title as [string,string],l=>{
   let b='';for(const [y,damaged] of [[72,false],[237,true]] as const){
    b+=`<rect x="85" y="${y}" width="510" height="20" fill="#dceee5" stroke="#91b6a4"/><path d="M325 ${y+23}V${y+76}M285 ${y+76}H365" stroke="#789ca6" stroke-width="12" fill="none"/><circle cx="130" cy="${y-9}" r="8" fill="#347fa2"/><circle cx="550" cy="${y-9}" r="8" fill="#69a78b"/>`;
    b+=`<path d="M152 ${y+10}H${damaged?320:527}" stroke="#347fa2" stroke-width="2" marker-end="url(#course-guidedwave-arrow)"/>`;
    if(damaged)b+=`<path d="M310 ${y+22}H340" stroke="white" stroke-width="8"/><path d="M310 ${y+24}H340" stroke="#347fa2" stroke-width="2" stroke-dasharray="3 2"/><path d="M318 ${y-30}H220" stroke="#69a78b" stroke-width="2" marker-end="url(#course-guidedwave-arrow)"/><path d="M350 ${y+10}H527" stroke="#347fa2" stroke-width="1" stroke-dasharray="5 4" marker-end="url(#course-guidedwave-arrow)"/>`;
    b+=label(340,y-48,damaged?'Debonded interface':'Intact interface',damaged?'局部脱粘':'完好界面',l)+label(130,y+47,'Send','激励',l,13)+label(550,y+47,'Receive','接收',l,13);
   }
   b+=label(265,220,'Reflected component','反射分量',l,13)+label(325,352,'Stiffener–skin bond','桁条—蒙皮胶接',l,13);return b;
  });
 }else if(id==='topology'){
  title=['Material redistribution under fixed supports and load','固定支承和载荷下的材料重分配'];desc=['120 × 36 plane-stress elements · p = 3 · material fraction 0.4.','120 × 36 平面应力单元 · p = 3 · 材料体积分数 0.4。'];
  body=`<div class="course-topology-controls" role="group" aria-label="Optimization iteration">${[0,15,40,80].map((n,i)=>`<button type="button" data-topology-step="${n}" aria-pressed="${i===0}">${bi(`Iteration ${n}`,`迭代 ${n}`)}</button>`).join('')}<button type="button" data-topology-play aria-pressed="false">${bi('Play evolution','播放演化')}</button></div><img data-topology-image src="/assets/content/lightweight/topology-00.png" width="1800" height="700" loading="lazy" alt="Simply supported beam density distribution, central downward load, pin and roller supports">`;
 }else if(id==='placement'){
  title=['Moving an actuator toward the supporting joint','将执行器移向支承关节'];desc=['The offset mass contribution changes with mr²; the new transmission must also be included.','偏置质量的惯量贡献随 mr² 改变，新增传动也需计入。'];
  body=plot(id,330,...title as [string,string],l=>{
   let b='';for(const x of [160,455])b+=`<path d="M${x-40} 65H${x+40}" stroke="#a5bbc3" stroke-width="10"/><path d="M${x} 80L${x+35} 180L${x+60} 270" fill="none" stroke="#587382" stroke-width="10" stroke-linecap="round"/><circle cx="${x}" cy="80" r="13" fill="#a4d4bc"/><circle cx="${x+35}" cy="180" r="6" fill="white" stroke="#587382" stroke-width="2"/>`;
   b+='<circle cx="195" cy="180" r="18" fill="#347fa2"/><circle cx="455" cy="80" r="18" fill="#347fa2"/><path d="M447 83L482 183M463 77L498 177" stroke="#8dbda7" stroke-width="2" stroke-dasharray="5 3"/>';
   b+=label(170,30,'Motor at the knee','电机在膝部',l)+label(470,30,'Motor near the hip','电机移到髋部',l)+label(200,309,'Long mass lever arm','质量力臂较长',l)+label(485,309,'Motion transmitted outward','向远端传递运动',l);
   b+='<path d="M265 165H367" stroke="#648795" stroke-width="1.5" marker-end="url(#course-placement-arrow)"/>';
   return b;
  });
 }else if(id==='spiral'){
  title=['The mass spiral','质量螺旋'];
  body=flow([c('Lighter distal member','末端构件更轻','Less moving mass at a long lever arm','较长力臂处的运动质量减少'),c('Lower joint demand','关节需求下降','Required torque can decrease.','所需力矩可能降低。'),c('Smaller drive and support','驱动与支承更轻','Resize to realize the second saving.','重新选型，兑现第二轮收益。')])+note('↶ Upstream links, base and energy system can then be reconsidered.','↶ 随后重新考虑上游连杆、基座与供能系统。');
 }else if(id==='payload'){
  title=['Published payload relative to arm mass','公布负载与臂体质量之比'];desc=['Model versions and load conditions are listed below. Filled and outlined bars retain different published load conditions.','具体型号和工况列于下表，实心与空心柱保留不同的公布负载条件。'];
  body=plot(id,390,...title as [string,string],l=>{
   const X=(v:number)=>225+380*v;let b='';
   for(const v of [0,.25,.5,.75,1])b+=`<path d="M${X(v)} 30V335" stroke="#e2eceb"/>`+label(X(v),358,String(v),String(v),l,13);
   const rows=[['DLR LWR III',14/14,null],['Gen3 · 7 DoF',4/8.2,2/8.2],['LBR iiwa 14 R820',14/29.9,null],['UR5e',5/20.7,null],['Franka Research 3',3/18,null],['KR 6 R900 sixx',3/52,6/52]] as const;
   rows.forEach(([name,v,other],i)=>{const y=45+i*48;b+=label(212,y+16,name,name,l,13,'end')+`<rect x="225" y="${y}" width="${380*v}" height="22" fill="#a4d4bc"/>`;
    if(other!==null)b+=`<rect x="225" y="${y+3}" width="${380*other}" height="16" fill="none" stroke="#327e9f" stroke-width="2"/>`;
    const a=other===null?v:Math.max(v,other);b+=label(X(a)+9,y+16,other===null?v.toFixed(2):`${v.toFixed(2)} / ${other.toFixed(2)}`,other===null?v.toFixed(2):`${v.toFixed(2)} / ${other.toFixed(2)}`,l,12,'start');
   });return b;
  });
 }else if(id==='transmission'){
  title=['Three ways to transmit a proximal actuator’s motion','三种近端驱动传递方式'];
  body=`<div class="course-triple">${c('Belt or cable','同步带或绳索','Low moving mass; tension, stretch and routing matter.','运动质量低；关注张紧、伸长与走线。')}${c('Rigid linkage','刚性连杆','Geometry sets a varying transmission ratio.','几何决定随姿态变化的传动比。')}${c('Screw and rocker','丝杆与摇杆','Rotary → linear → joint motion.','旋转 → 直线 → 关节运动。')}</div>`;
 }else if(id==='indexbars'){title=['Material indices under different dimensional freedoms','不同尺寸自由度下的材料指数'];body=frameworkDrawing(id)!;}else if(id==='forcepaths'){title=['Bending and triangulated load paths','弯曲与三角化传力路径'];body=frameworkDrawing(id)!;}else throw Error(`Unknown course figure: ${id}`);
 body=(frameworkDrawing(id)??body).replace(`<title>${id}</title>`,`<title>${title[0]}</title>`);
 return `<figure class="course-figure" data-course-figure="${id}">${body}<figcaption><span class="figure-title">${bi(title[0]!,title[1]!)}</span><span class="figure-description">${bi(desc[0]!,desc[1]!)}</span></figcaption></figure>`;
}
