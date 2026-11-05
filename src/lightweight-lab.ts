import {language,onLanguageChange} from './language.js';
import {materials,type Material,type RobotType} from './lightweight-mechanics.js';
import {initialConcept,copyDesign,generateRobot,exportMJCF,exportConceptURDF,exportConceptJSON,fk,jointTorqueLimit,isSourceDesign,hasElasticModel,type ConceptDesign,type Node} from './concept-model.js';
import {analyzeDesign,defaultMember,initialConditions,type DesignConditions,type DesignAnalysis} from './design-analysis.js';
import {motionFrame,motionDuration,motionSettings,armCircleSettings,footSole,type MotionFrame} from './design-motion.js';
import {packingConflicts} from './design-packing.js';
import {createDesignViewer,prepareDesignMeshes} from './design-viewer.js';
import {createDesignDiagram,type DiagramView} from './design-diagram.js';
import {compareMemberMaterials,type MaterialCandidate,type MaterialComparisonMode} from './design-materials.js';
import type {DynamicsFrame} from './design-dynamics.js';
import type {MemberLoad} from './design-member-loads.js';
import type {SimulationReport,SimulationSample} from './design-validation.js';
import {property} from './concept-model.js';
import {createCADPanel} from './source-structure-panel.js';
import {sourceDesignControls} from './design-source-controls.js';
import {sourceParameterDefinitions,editSourceDimension} from './design-source-parameters.js';
import {sourceMemberDefinitions} from './design-source-members.js';

const root=document.querySelector<HTMLElement>('[data-design-workbench]');
if(root){
 const $=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const tr=(en:string,zh:string)=>language==='en'?en:zh;
 const fmt=(x:number,n=2)=>Number.isFinite(x)?x.toFixed(n):'—';
 const sourceName=(d:ConceptDesign)=>d.armModel==='aloha'?'Alohamini':d.legModel==='go2'?'Unitree Go2':d.legModel==='rp1'?'RoboParty RP1':'';
 const sourceMassNote=(d:ConceptDesign)=>d.sourceMode==='derived'?tr('Member mass follows material density, section and length. The remaining assembly budget stays fixed; joint limits retain the source values.','杆件质量随材料密度、截面与长度调整，其余总成保持预算；关节限值沿用源模型。'):d.armModel==='aloha'?(d.armInertia==='urdf'?tr('Original URDF mass budget: 2.0 kg.','旧 URDF 总质量预算：2.0 kg。'):tr('LIBERO CAD nominal mass: 1.84962 kg, including the camera once. Link COMs and full inertia tensors use the same bundle.','LIBERO CAD 名义总质量 1.84962 kg，摄像头计入一次；质心与完整惯量采用同一物性包。')):tr('Link masses and full inertia tensors are taken from the published URDF; they have not been identified on hardware here.','连杆质量与完整惯量张量沿用公开 URDF；本工具未进行实机辨识。');
 const sourceDriveNote=(d:ConceptDesign)=>d.legModel==='rp1'?tr('The source URDF supplies torque and speed limits, reflected inertia, viscous damping and joint friction; these are included. RoboLab also publishes a torque–speed actuator model and rated operating points. That additional model is not enabled here.','已采用原 URDF 的转矩、转速限值，以及反射惯量、黏性阻尼和关节摩擦。官方 RoboLab 另有转矩—转速模型与额定工作点，当前尚未启用这套执行器模型。'):d.legModel==='go2'?tr('Torque and speed limits use the Unitree ROS URDF. It does not specify reflected rotor inertia or joint friction. Unitree also publishes an mjlab actuator configuration for a different rigid-body model; using it requires a matched model profile.','转矩与转速限值采用 Unitree ROS 的 URDF；该文件没有声明转子反射惯量和关节摩擦。宇树另有 mjlab 执行器配置，但配套刚体模型不同，需要成套匹配后采用。'):tr('Torque and speed limits use the local URDF. The local BOM identifies the servos, allowing manufacturer ratings to be added by model. Reflected rotor inertia, transmission friction and stiffness are not defined in the current model.','转矩与转速限值采用本地 URDF。本地 BOM 已列出舵机型号，可以按型号补充厂家额定参数；当前模型尚未定义转子反射惯量、传动摩擦和刚度。');
  const defaults=(robot:RobotType):ConceptDesign=>({...copyDesign(initialConcept),robot,bodyLength:robot==='quadruped'?.46:.22,bodyWidth:robot==='biped'?.22:.23,bodyMass:robot==='arm'?3:5,...(robot==='arm'?{armModel:'aloha' as const,toolMass:0,armCirclePlane:'yz' as const,armCircleRadius:.06}:{legModel:robot==='quadruped'?'go2' as const:'rp1' as const,payload:0})});
 type Profile='source'|'derived'|'generic';
 type ProfileSnapshot={design:ConceptDesign;conditions:DesignConditions;selected:string;materialSelected?:string;hasReference:boolean;referenceDesign:ConceptDesign;referenceConditions:DesignConditions};
 const profileOf=(d:ConceptDesign):Profile=>isSourceDesign(d)?d.sourceMode==='derived'?'derived':'source':'generic';
 const profileKey=(robot:RobotType,profile:Profile)=>robot+':'+profile;
 const profileDefaults=(robot:RobotType,profile:Profile)=>{const d=defaults(robot);if(profile==='derived'){d.sourceMode='derived';d.sourceDimensions={};d.armBeamEquivalent=false;}else if(profile==='generic'){if(robot==='arm')d.armModel='concept';else d.legModel='concept';}return d;};
 const profiles:{entries:Record<string,ProfileSnapshot>;last:Partial<Record<RobotType,Profile>>}={entries:{},last:{}};
 try{const saved=JSON.parse(localStorage.getItem('anncatto.lightweight-profiles.v1')??'null');if(saved?.entries&&saved?.last){profiles.entries=saved.entries;profiles.last=saved.last;}}catch{}
 let design=defaults('quadruped'),conditions={...initialConditions},selected='',materialSelected='',referenceDesign=copyDesign(design),referenceConditions={...conditions},symmetric=true,hasReference=false;
 try{
  const stored=localStorage.getItem('anncatto.lightweight-design.v3'),saved=JSON.parse(stored||'null');
  if(saved){
   if(saved.design?.robot==='arm'&&!saved.design.armModel){localStorage.setItem('anncatto.lightweight-design.v3.concept-arm-backup',JSON.stringify(saved));saved.design={...saved.design,armModel:'aloha',toolMass:0,parts:{},joints:{}};delete saved.design.armCircleCenter;}
   if(!saved.modelSelectionVersion&&['quadruped','biped'].includes(saved.design?.robot)&&!['go2','rp1'].includes(saved.design.legModel)){
    localStorage.setItem('anncatto.lightweight-design.v3.before-source-defaults',stored!);
    saved.design=defaults(saved.design.robot);
   }
   if(saved.design?.robot==='arm'&&!saved.design.armCirclePlane){
    const previous=generateRobot(saved.design),p=fk(previous,previous.home).tool!.p,c=saved.design.armCircleCenter,r=saved.design.armCircleRadius??.025;
    if(Math.abs(r-.025)<1e-9&&(!c||Math.hypot(c[0]-p[0],c[1]-p[1]-.025,c[2]-p[2])<1e-8)){
     localStorage.setItem('anncatto.lightweight-design.v3.before-circle-controls',stored!);saved.design.armCircleRadius=.06;delete saved.design.armCircleCenter;
    }
    saved.design.armCirclePlane='yz';
   }
   const savedConditions={...conditions,...saved.conditions};analyzeDesign(generateRobot(saved.design),savedConditions);
   design=saved.design;conditions=savedConditions;referenceDesign=copyDesign(design);referenceConditions={...conditions};
  }
 }catch{}
 const activeSnapshot=profiles.entries[profileKey(design.robot,profileOf(design))];if(activeSnapshot&&JSON.stringify(activeSnapshot.design)===JSON.stringify(design)){selected=activeSnapshot.selected;materialSelected=activeSnapshot.materialSelected??'';hasReference=activeSnapshot.hasReference;referenceDesign=copyDesign(activeSnapshot.referenceDesign);referenceConditions={...activeSnapshot.referenceConditions};}
 let model=generateRobot(design),analysis:DesignAnalysis,comparison:DesignAnalysis,scene:ReturnType<typeof createDesignViewer>|undefined,playing=false,mode='pose',time=0,last=0,lastStatus=0,renderPending:ReturnType<typeof setTimeout>|undefined;
 let diagramView:DiagramView='spatial',materialMode:MaterialComparisonMode='fixed',materialCandidates:MaterialCandidate[]=[],materialCacheKey='',referenceCacheKey='',geometryCacheKey='',viewerModelKey='';
 if(!model.nodes.some(n=>n.id===selected&&n.joint?.active))selected=defaultMember(model);
 const cadPanel=createCADPanel($('[data-cad-structure]'),tr,value=>{design.tipForce=value;model=generateRobot(design);clearValidation();persistWorkbench();calculate();controls();});
 const diagram=createDesignDiagram($('[data-design-diagram]'),selectMember);
 let sceneReady=false,viewGeneration=0;
 let workerToken=0,frameBusy=false,loadSource='cycle',liveGroup=design.robot==='biped'?'legs':'all',loadsReady=false,lastLoadRequest=0,validation:SimulationReport|undefined,live: {frame:DynamicsFrame;load:MemberLoad}|undefined;
 let referenceIssue:DynamicsFrame['referenceIssue'],frameRequestId=0,pendingFrame:{id:number;time:number;moving:boolean}|undefined;
 let envelope:{peak:Record<string,number>;rms:Record<string,number>;worst:MemberLoad;maxDeflection:MemberLoad;maxBuckling:number;invalid:number;overloaded:string[];samples:number}|undefined;
 const workerURL=new URL('./design-load-worker.js',import.meta.url);workerURL.search=new URL(import.meta.url).search;const loadWorker=new Worker(workerURL,{type:'module'});
 const duration=()=>mode==='simulation'&&validation?validation.duration:motionDuration(model);
 function persistWorkbench(){
  const profile=profileOf(design);profiles.entries[profileKey(design.robot,profile)]={design:copyDesign(design),conditions:{...conditions},selected,materialSelected,hasReference,referenceDesign:copyDesign(referenceDesign),referenceConditions:{...referenceConditions}};profiles.last[design.robot]=profile;
  try{localStorage.setItem('anncatto.lightweight-profiles.v1',JSON.stringify(profiles));localStorage.setItem('anncatto.lightweight-design.v3',JSON.stringify({design,conditions,modelSelectionVersion:1}));}catch{}
 }
 function selectProfile(profile:Profile,robot:RobotType=design.robot){
  if(robot===design.robot&&profile===profileOf(design))return;
  persistWorkbench();const previous=profiles.entries[profileKey(design.robot,profileOf(design))]!,saved=profiles.entries[profileKey(robot,profile)],next=saved?copyDesign(saved.design):profileDefaults(robot,profile),nextConditions=saved?{...saved.conditions}:{...initialConditions};
  try{const nextModel=generateRobot(next);analyzeDesign(nextModel,nextConditions);design=next;conditions=nextConditions;selected=saved?.selected&&nextModel.nodes.some(n=>n.id===saved.selected)?saved.selected:defaultMember(nextModel);materialSelected=saved?.materialSelected??'';hasReference=saved?.hasReference??false;referenceDesign=saved?.referenceDesign?copyDesign(saved.referenceDesign):copyDesign(design);referenceConditions={...(saved?.referenceConditions??conditions)};referenceCacheKey='';liveGroup=robot==='biped'?'legs':'all';time=0;rebuild(true,true);}
  catch{design=copyDesign(previous.design);conditions={...previous.conditions};selected=previous.selected;materialSelected=previous.materialSelected??'';hasReference=previous.hasReference;referenceDesign=copyDesign(previous.referenceDesign);referenceConditions={...previous.referenceConditions};referenceCacheKey='';rebuild(true,true);$('[data-form-status]').textContent=tr('The saved design could not be opened. Its stored parameters have been retained.','保存的方案暂时无法打开，原有参数仍已保留。');}
 }
 const liveGroupLabel=(g:string)=>({fl:tr('Front left','左前腿'),fr:tr('Front right','右前腿'),rl:tr('Rear left','左后腿'),rr:tr('Rear right','右后腿'),left:tr('Left leg','左腿'),right:tr('Right leg','右腿'),left_arm:tr('Left arm','左臂'),right_arm:tr('Right arm','右臂'),arm:tr('Arm','机械臂'),tool:tr('Gripper','夹爪'),torso:tr('Torso','躯干')} as Record<string,string>)[g]||g;
 const liveGroups=()=>{const order=['fl','fr','rl','rr','left','right','left_arm','right_arm','arm','tool','torso'];return[...new Set(model.active.map(j=>j.group))].sort((a,b)=>(order.indexOf(a)<0?order.length:order.indexOf(a))-(order.indexOf(b)<0?order.length:order.indexOf(b)));};
 function refreshLiveGroups(){
  const groups=liveGroups();if(liveGroup!=='all'&&!(liveGroup==='legs'&&design.robot==='biped')&&!groups.includes(liveGroup))liveGroup='all';
  $<HTMLSelectElement>('[data-live-group]').innerHTML=[...(design.robot==='biped'?[['legs',tr('Both legs','双腿')]]:[]),['all',tr('All joint groups','全部关节组')],...groups.map(g=>[g,liveGroupLabel(g)])].map(([g,label])=>`<option value="${g}" ${g===liveGroup?'selected':''}>${label}</option>`).join('');
 }
 function clearValidation(){
  validation=undefined;$('[data-replay]').hidden=$('[data-export-validation]').hidden=true;
  root!.querySelector('[data-motion-mode] option[value="simulation"]')?.remove();
  const status=$('[data-validation-status]');delete status.dataset.failed;status.removeAttribute('title');
  const wasReplay=mode==='simulation';if(wasReplay){mode='pose';playing=false;time=0;}
  $<HTMLSelectElement>('[data-motion-mode]').value=mode;
  if(wasReplay){updatePlayLabel();drawMotion();}
 }
 function referenceMessage(){
  return referenceIssue?.kind==='ik'?(design.robot==='arm'?tr('Trajectory IK did not converge. Adjust the radius or circle centre.','轨迹逆解未收敛，请调整半径或圆心。'):tr('Trajectory IK did not converge. Adjust the stride or geometry.','轨迹逆解未收敛，请调整步长或构型。')):referenceIssue?.kind==='derivative'?tr('Trajectory velocity or acceleration did not converge. Loads are unavailable.','轨迹速度／加速度未收敛，载荷暂不可用。'):tr('Trajectory calculation is invalid. Adjust the motion parameters.','轨迹计算无效，请调整动作参数。');
 }
 function invalidateFrameRequest(){frameRequestId++;pendingFrame=undefined;frameBusy=false;live=undefined;scene?.loads();}
 function setReferenceIssue(issue:NonNullable<DynamicsFrame['referenceIssue']>){
  referenceIssue=issue;envelope=undefined;invalidateFrameRequest();
  if(validation)clearValidation();
  if(mode==='move'){playing=false;updatePlayLabel();}
  $<HTMLButtonElement>('[data-validate]').disabled=true;
  $('[data-live-scope]').hidden=false;$('[data-live-scope]').textContent=referenceMessage();
  $('[data-form-status]').textContent=referenceMessage();
  $('[data-validation-status]').textContent=referenceMessage();delete $('[data-validation-status]').dataset.failed;
  $('[data-live-member]').innerHTML='';$('[data-live-balance]').textContent='';
  results();
 }
 function requestLoads(defer=false){
  workerToken++;invalidateFrameRequest();loadsReady=false;referenceIssue=undefined;envelope=undefined;clearValidation();
  $<HTMLButtonElement>('[data-validate]').disabled=true;
  $('[data-validation-status]').textContent=tr('Simulation not tested · hardware not validated.','闭环仿真尚未测试 · 尚未实机验证。');delete $('[data-validation-status]').dataset.failed;
  refreshLiveGroups();
  $('[data-live-scope]').hidden=false;$('[data-live-scope]').textContent=defer?tr('Release to update loads','松开后更新载荷'):tr('Calculating…','计算中…');$('[data-live-joints]').innerHTML='';$('[data-live-member]').innerHTML='';$('[data-live-balance]').textContent='';
  results();
  if(!defer)loadWorker.postMessage({type:'model',token:workerToken,design,conditions,member:selected,driver:analysis.driver.id});
 }
 function drawLive(simulation?:SimulationSample,pose?:MotionFrame){
  const f=live?.frame,load=live?.load;if(!f&&!simulation&&!pose)return;
  const usable=!!simulation||!pose&&f?.referenceValid===true;
  const q=pose?.q??simulation?.frame.q??f!.q,torque:Record<string,number>=usable?(simulation?.torque??f!.torque):{},velocity:Record<string,number>=usable?(simulation?.velocity??f!.velocity):{};
  $('[data-live-scope]').hidden=!referenceIssue;$('[data-live-scope]').textContent=referenceIssue?referenceMessage():'';
  const groups=liveGroups().filter(g=>liveGroup==='all'||g===liveGroup||liveGroup==='legs'&&['left','right'].includes(g));
  $('[data-live-joints]').dataset.robot=design.robot;
  $('[data-live-joints]').innerHTML=groups.map(g=>{
   const joints=model.active.filter(j=>j.group===g),slide=joints.every(j=>j.kind==='slide'),unit=slide?'N':'N·m';
   const rows=joints.map(j=>{
    const position=q[j.id]!,speed=velocity[j.id]??NaN,value=torque[j.id]??NaN,limit=jointTorqueLimit(model,j),linear=j.kind==='slide',positionScale=linear?1000:180/Math.PI,speedScale=linear?1000:1,positionUnit=linear?'mm':'°',speedUnit=linear?'mm/s':'rad/s',effortUnit=linear?'N':'N·m';
    const speedLimit=j.velocityLimit??(isSourceDesign(design)?NaN:design.outputSpeedLimit??8),knownSpeedLimit=Number.isFinite(speedLimit)&&speedLimit>0,positionUse=(position-j.min)/(j.max-j.min),speedUse=knownSpeedLimit?Math.abs(speed)/speedLimit:NaN,torqueUse=Math.abs(value)/limit;
    const fill=(fraction:number)=>Number.isFinite(fraction)?Math.max(0,Math.min(100,fraction*100)):0;
    const positionTitle=tr(`Position ${fmt(position*positionScale,1)} ${positionUnit}; range ${fmt(j.min*positionScale,1)} to ${fmt(j.max*positionScale,1)} ${positionUnit}. Fill shows position within this interval.`,`位置 ${fmt(position*positionScale,1)} ${positionUnit}；范围 ${fmt(j.min*positionScale,1)} 至 ${fmt(j.max*positionScale,1)} ${positionUnit}。填充表示在该行程区间内的位置。`);
    const speedTitle=knownSpeedLimit?tr(`Speed ${fmt(speed*speedScale,2)} ${speedUnit}; absolute speed limit ${fmt(speedLimit*speedScale,2)} ${speedUnit}; ${fmt(speedUse*100,1)}% of the limit.`,`速度 ${fmt(speed*speedScale,2)} ${speedUnit}；速度绝对值限值 ${fmt(speedLimit*speedScale,2)} ${speedUnit}，当前为限值的 ${fmt(speedUse*100,1)}%。`):tr(`Speed ${fmt(speed*speedScale,2)} ${speedUnit}; the source does not specify a speed limit.`,`速度 ${fmt(speed*speedScale,2)} ${speedUnit}；源模型未提供速度限值。`);
    const effortTitle=tr(`${linear?'Force':'Torque'} ${fmt(value,2)} ${effortUnit}; absolute output limit ${fmt(limit,2)} ${effortUnit}; ${fmt(torqueUse*100,1)}% of the limit.`,`${linear?'驱动力':'转矩'} ${fmt(value,2)} ${effortUnit}；输出绝对值限值 ${fmt(limit,2)} ${effortUnit}，当前为限值的 ${fmt(torqueUse*100,1)}%。`);
    const samples=simulation&&validation?validation.samples.map(s=>s.torque[j.id]??0):undefined,peak=samples?Math.max(...samples.map(Math.abs)):referenceIssue?undefined:envelope?.peak[j.id],rms=samples?Math.sqrt(samples.reduce((sum,t)=>sum+t*t,0)/samples.length):referenceIssue?undefined:envelope?.rms[j.id];
    return`<tr data-joint="${j.id}"><th scope="row">${j.label[language==='en'?0:1]}</th><td data-meter="position" data-over="${position<j.min||position>j.max}" style="--use:${fill(positionUse)}%" title="${positionTitle}" aria-label="${positionTitle}">${fmt(position*positionScale,1)}</td><td data-meter="speed" data-over="${knownSpeedLimit&&Math.abs(speed)>speedLimit}" style="--use:${fill(speedUse)}%" title="${speedTitle}" aria-label="${speedTitle}">${fmt(speed*speedScale,2)}</td><td data-meter="torque" data-utilization="${torqueUse}" data-over="${Math.abs(value)>limit}" style="--use:${fill(torqueUse)}%" title="${effortTitle}" aria-label="${effortTitle}">${fmt(value,2)}</td><td>${fmt(limit,1)}</td><td title="RMS ${fmt(rms??NaN,2)} ${unit}">${fmt(peak??NaN,2)}</td></tr>`;
   }).join('');
   return`<section class="design-live-group" data-group="${g}" aria-label="${liveGroupLabel(g)}"><h3>${liveGroupLabel(g)}</h3><div class="design-table-scroll"><table class="design-live-table"><thead><tr><th>${tr('Joint','关节')}</th><th title="${tr('Joint position within its lower and upper limits','关节位置及其上下限区间')}">q<small>${slide?'mm':'°'}</small></th><th title="${tr('Absolute speed divided by its limit; the value retains direction','填充为速度绝对值与限值之比，数值保留方向')}">${slide?'v':'ω'}<small>${slide?'mm/s':'rad/s'}</small></th><th title="${tr('Absolute output effort divided by its limit; the value retains direction','填充为输出力或转矩绝对值与限值之比，数值保留方向')}">${slide?'F':'τ'}<small>${unit}</small></th><th title="${tr('Fixed output force or torque limit','固定的输出力或转矩限值')}">${tr('Limit','限值')}<small>${unit}</small></th><th title="${tr('Maximum absolute effort over the sampled motion','抽样动作中输出力或转矩的绝对值峰值')}">${tr('Peak','峰值')}<small>${unit}</small></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('');
  const balance=$('[data-live-balance]');
  if(!usable){balance.hidden=true;balance.textContent='';delete balance.dataset.failed;$('[data-load-diagnostics]').textContent=referenceIssue?referenceMessage():'';$('[data-live-member]').innerHTML='';return;}
  balance.dataset.failed=String(!simulation&&!f!.feasible);
  $('[data-load-diagnostics]').textContent=!simulation&&design.robot==='arm'?tr(`Fixed-base inverse dynamics · source effort / entered torque limits · Newton–Euler cross-check ${fmt(f!.engineError,5)} N·m.`,`固定基座逆动力学 · 按源 effort／输入转矩限值校核 · Newton–Euler 交叉误差 ${fmt(f!.engineError,5)} N·m。`):simulation?tr(`Actual contacts: ${simulation.frame.contacts.length} · hardware not validated.`,`实际接触足 ${simulation.frame.contacts.length} 个 · 尚未实机验证。`):tr(`Force balance residual ${fmt(f!.forceResidual,3)} N / ${fmt(f!.momentResidual,3)} N·m · friction use ${fmt(f!.frictionUse*100,0)}% · ${f!.feasible?'contact wrench feasible':'contact wrench infeasible'}.`,`力平衡残差 ${fmt(f!.forceResidual,3)} N / ${fmt(f!.momentResidual,3)} N·m · 摩擦利用率 ${fmt(f!.frictionUse*100,0)}% · ${f!.feasible?'接触载荷可实现':'接触载荷不可实现'}。`);
  balance.hidden=!simulation&&design.robot==='arm';balance.textContent=simulation?tr(`Contact feet ${simulation.frame.contacts.length}`,`接触足 ${simulation.frame.contacts.length}`):tr(`Friction use ${fmt(f!.frictionUse*100,0)}%${f!.feasible?'':' · contact constraints unmet'}`,`摩擦利用率 ${fmt(f!.frictionUse*100,0)}%${f!.feasible?'':' · 接触约束未满足'}`);
  $('[data-live-member]').innerHTML=simulation||!hasElasticModel(design)||!analysis.member.member?'':load?[[tr('Axial force','轴力'),fmt(load.normal,1)+' N'],[tr('Shear force','剪力'),fmt(load.shear,1)+' N'],[tr('Bending moment','弯矩'),fmt(load.bending,2)+' N·m'],[tr('Torsion','扭矩'),fmt(load.torsion,2)+' N·m'],[tr('Normal stress','正应力'),fmt(load.stress/1e6,2)+' MPa'],[tr('Tip deflection','端部变形'),fmt(load.deflection*1000,3)+' mm'],[tr('Twist','扭转角'),fmt(load.twist*1000,2)+' mrad'],[tr('Euler buckling use','Euler 屈曲利用率'),fmt(load.bucklingUse*100,1)+'%']].map(([label,value])=>`<span>${label}<b>${value}</b></span>`).join(''):'';
 }
 loadWorker.onmessage=e=>{
  const v=e.data;if(v.token!==workerToken)return;
  if(v.type==='ready'){loadsReady=true;if(!referenceIssue)envelope=v;$<HTMLButtonElement>('[data-validate]').disabled=!!referenceIssue;$('[data-live-scope]').hidden=!referenceIssue;$('[data-live-scope]').textContent=referenceIssue?referenceMessage():'';results();drawMotion();}
  else if(v.type==='reference-invalid'){loadsReady=true;setReferenceIssue(v.issue);drawMotion();}
  else if(v.type==='frame'){
   const pending=pendingFrame;
   if(!pending||v.requestId!==pending.id||v.time!==pending.time||v.moving!==pending.moving)return;
   pendingFrame=undefined;frameBusy=false;
   if(mode==='simulation'||v.moving!==(mode==='move')||!playing&&v.time!==time||referenceIssue&&v.moving){drawMotion();return;}
   if(!v.frame.referenceValid){setReferenceIssue(v.frame.referenceIssue??{kind:'nonfinite',time:v.time,trackingError:NaN,orientationError:NaN});drawLive(undefined,motionFrame(model,time,mode==='move'));return;}
   live=v;if(sceneReady)scene?.loads(v.frame);drawLive();
  }
  else if(v.type==='validation'){
   clearValidation();$<HTMLButtonElement>('[data-validate]').disabled=!!referenceIssue||!envelope;
   if(referenceIssue){$('[data-validation-status]').textContent=referenceMessage();return;}
   const r:SimulationReport|undefined=v.report,status=$('[data-validation-status]');
   if(!r?.passed||!r.completed||r.fingerprint!==model.fingerprint){status.dataset.failed='true';status.textContent=tr('Current parameters have not passed simulation verification. Adjust them and test again.','当前参数尚未通过仿真校核，请调整后重新测试。');return;}
   validation=r;$('[data-replay]').hidden=$('[data-export-validation]').hidden=false;
   status.textContent=tr(`Rigid-body simulation test passed · ${fmt(r.duration,2)} s · ${design.robot==='arm'?'TCP position':'body position'} RMS ${fmt(r.positionRms*1000,1)} mm · max tilt ${fmt(r.maxTilt*180/Math.PI,2)}° · ${r.engine}. Hardware not validated.`,`刚体仿真测试通过 · ${fmt(r.duration,2)} s · ${design.robot==='arm'?'TCP 位置':'躯干位置'} RMS ${fmt(r.positionRms*1000,1)} mm · 最大倾角 ${fmt(r.maxTilt*180/Math.PI,2)}° · ${r.engine}。尚未实机验证。`);
   status.textContent+=tr(` Speed use ${fmt(r.maxSpeedUse*100,0)}%; contact tangential peak ${fmt(r.maxContactSlipSpeed*1000,1)} mm/s.`,` 速度利用率 ${fmt(r.maxSpeedUse*100,0)}%；接触切向速度峰值 ${fmt(r.maxContactSlipSpeed*1000,1)} mm/s。`);
   const option=document.createElement('option');option.value='simulation';option.textContent=tr('Simulation replay','仿真结果回放');$('[data-motion-mode]').append(option);
  }else if(v.type==='error'){
   if(v.operation==='frame'&&v.requestId!==pendingFrame?.id)return;
   invalidateFrameRequest();loadsReady=false;envelope=undefined;results();drawLive(undefined,motionFrame(model,time,mode==='move'));
   $('[data-live-scope]').hidden=false;$('[data-live-scope]').textContent=tr('Current parameters could not be evaluated. Adjust them and try again.','当前参数尚无法完成校核，请调整后重试。');$<HTMLButtonElement>('[data-validate]').disabled=true;
  }
 };

 const pretty=(n:Node)=>{if(isSourceDesign(design)&&(!hasElasticModel(design)||!n.member))return liveGroupLabel(n.group)+' · '+n.label[language==='en'?0:1];const prefix=n.group==='fl'?tr('Front left','左前'):n.group==='fr'?tr('Front right','右前'):n.group==='rl'?tr('Rear left','左后'):n.group==='rr'?tr('Rear right','右后'):n.group==='left'?tr('Left leg','左腿'):n.group==='right'?tr('Right leg','右腿'):n.group==='left_arm'?tr('Left arm','左臂'):n.group==='right_arm'?tr('Right arm','右臂'):'';const label=design.robot==='arm'?({j2:tr('Upper arm','上臂'),j3:tr('Forearm','前臂'),j5:tr('Wrist link','腕段')} as Record<string,string>)[n.id]||n.label[language==='en'?0:1]:design.legModel==='rp1'&&n.member?(n.id.endsWith('_yaw')?tr('thigh','大腿'):tr('shank','小腿')):n.id.endsWith('_pitch')?tr('thigh','大腿'):n.id.endsWith('_knee')?tr('shank','小腿'):n.id.endsWith('_yaw')?tr('upper arm','上臂'):tr('forearm','前臂');return prefix?prefix+' · '+label:label;};
 function materialNode(){const members=model.nodes.filter(n=>n.member);let node=members.find(n=>n.id===materialSelected);if(!node){node=members.find(n=>n.id===selected)??members[0];materialSelected=node?.id??'';}return node;}
 const input=(name:string,label:string,value:number,unit:string,min:number,max:number,step:number,range=false)=>`<label class="design-field"><span>${label}</span><span class="design-value-input"><input type="number" name="${name}" value="${Number(value.toFixed(name==='p:width'||name==='p:height'?2:name==='p:wall'?3:['d:strideLength','d:stepHeight'].includes(name)?1:5))}" min="${min}" max="${max}" step="${step}" aria-label="${label}"><small>${unit}</small></span>${range?`<input class="design-range" type="range" data-for="${name}" value="${value}" min="${min}" max="${max}" step="${step}" aria-label="${label}">`:''}</label>`;
 const choices=(name:string,label:string,values:[string,string][],value:string)=>`<label class="design-field design-select"><span>${label}</span><select name="${name}" aria-label="${label}">${values.map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('')}</select></label>`;
 const group=(title:string,body:string)=>`<section class="design-control-group"><h2>${title}</h2>${body}</section>`;
 function controls(){
  const openDetails=[...root!.querySelectorAll<HTMLDetailsElement>('details.design-details')].map(d=>d.open);
  const d=design,isArm=d.robot==='arm',sourceModel=isSourceDesign(d),members=model.nodes.filter(n=>n.member),selectable=sourceModel?model.nodes.filter(n=>n.joint?.active):members.filter(n=>n.joint?.active),current=selectable.find(n=>n.id===selected)??selectable[0]??analysis.member;
  const lengths=isArm?d.armLengths.map((v,i)=>input(`arm:${i}`,[tr('Upper arm length','上臂长度'),tr('Forearm length','前臂长度'),tr('Wrist link length','腕段长度')][i]!,v*1000,'mm',i===2?90:140,i===2?350:650,1,true)).join(''):
   input('d:l1',tr('Thigh · axis spacing','大腿关节间距'),d.l1*1000,'mm',140,650,1,true)+input('d:l2',tr('Shank · axis spacing','小腿关节间距'),d.l2*1000,'mm',140,650,1,true);
  const custom=members.map(n=>input(`part:${n.id}`,pretty(n),n.member!.length*1000,'mm',90,1000,1)).join('');
  const gaps=model.nodes.filter(n=>n.joint&&n.parent&&!model.nodes.find(p=>p.id===n.parent)?.member&&Math.hypot(...n.offset)>.045&&n.group==='arm').map(n=>input(`gap:${n.id}`,n.label[language==='en'?0:1],Math.hypot(...n.offset)*1000,'mm',45,300,1)).join('');
  const dof=isArm?choices('dof',tr('Arm axes','机械臂轴数'),[['4',tr('4 axes','4 轴')],['6',tr('6 axes','6 轴')]],model.active.filter(j=>j.kind==='hinge').length===4?'4':'6'):
   d.robot==='quadruped'?choices('dof',tr('Leg configuration','腿部自由度'),[['2',tr('2 axes / leg','每腿 2 轴')],['3',tr('3 axes / leg','每腿 3 轴')],['4',tr('4 axes / leg','每腿 4 轴')]],model.nodes.some(n=>n.id==='fl_ankle')?'4':model.nodes.find(n=>n.id==='fl_roll')?.joint?.active?'3':'2'):
   choices('dof',tr('Leg configuration','腿部自由度'),[['10',tr('10 leg axes','腿部 10 轴')],['12',tr('12 leg axes','腿部 12 轴')]],model.nodes.find(n=>n.id==='left_yaw')?.joint?.active?'12':'10');
  $('[data-member-control]').innerHTML=choices('member',!sourceModel&&current.member&&hasElasticModel(d)?tr('Selected member','选中杆件'):tr('Selected joint','选中关节'),selectable.map(n=>[n.id,sourceModel?liveGroupLabel(n.group)+' · '+n.label[language==='en'?0:1]:pretty(n)]),current.id);
  const stance=d.robot==='biped'?input('d:stanceWidth',tr('Lateral foot spacing','足底横向中心距'),(d.stanceWidth??.26)*1000,'mm',100,600,5,true):'';
  const quadPosture=d.robot==='quadruped'&&!sourceModel?group(tr('Design stance','设计站姿'),
   input('d:quadHipPitch',tr('Thigh rearward tilt','大腿后倾角'),(d.quadHipPitch??.48)*180/Math.PI,'°',0,80,1,true)+
   input('d:quadKneeFlexion',tr('Knee included angle','膝部内夹角'),180-(d.quadKneeFlexion??.96)*180/Math.PI,'°',50,160,1,true)+
   `<p class="design-control-note">${tr('Thigh tilt is measured from vertical. A 180° knee is straight. These angles define the design stance and change during walking.','大腿相对竖直方向向后倾斜；膝内夹角 180° 表示伸直。这两个角度定义设计站姿，行走时随动作变化。')}</p><p class="design-control-note" data-stance-measures></p>`):'';
  const baselineName=isArm?'Alohamini':d.robot==='quadruped'?'Go2':'RP1';const modelChoice=choices('model-profile',tr('Robot model','机器人模型'),[['source',tr('Original model','原模型')+' · '+baselineName],['derived',tr('Parametric design','参数化概念设计')+' · '+baselineName],['generic',tr('Generic beam model','通用梁构型')]],profileOf(d));
  const sourceURL=model.source?(model.source.id==='aloha'?new URL('./models/alohamini-left/source.urdf',import.meta.url).href:model.source.id==='go2'?`https://github.com/unitreerobotics/unitree_ros/blob/${model.source.commit}/robots/go2_description/urdf/go2_description.urdf`:`https://github.com/Roboparty/rp1_description/blob/${model.source.commit}/urdf/rp1_24dof.urdf`):'';
  const sourceGeometry=(d.armModel==='aloha'?choices('d:armReference',tr('Evaluation posture','评估姿态'),[['bent',tr('Bent','屈肘')],['extended',tr('Extended','水平伸展')]],d.armReference??'bent'):'')+`${model.source?`<p class="design-control-note"><a href="${sourceURL}">${tr('Source model','模型来源')} · ${model.source.commit.slice(0,8)}</a></p>`:''}${d.armModel==='aloha'&&d.sourceMode!=='derived'?`<label class="design-check"><input type="checkbox" name="d:armBeamEquivalent" ${hasElasticModel(d)?'checked':''}>${tr('Custom equivalent beam (assumed section)','自定义等效梁（假设截面）')}</label>`:''}`;
  $('[data-model-control]').innerHTML=modelChoice;
  const geometry=(d.sourceMode==='derived'?sourceDesignControls(model,tr):sourceModel?sourceGeometry:lengths+stance+dof+`<details class="design-details"><summary>${tr('Individual lengths and joint spacing','单独设置连杆与关节间距')}</summary><label class="design-check"><input type="checkbox" name="symmetric" ${symmetric?'checked':''}>${tr('Keep symmetric members linked','对称构件同步')}</label><div class="design-two-fields">${custom}${gaps}</div></details>`);
  const materialOwner=d.sourceMode==='derived'?materialNode()??current:current,member=materialOwner.member,p=member?.prop;
  if(member)materialSelected=materialOwner.id;
  const memberChoice=d.sourceMode==='derived'?choices('material-member',tr('Design member','设计杆件'),members.map(n=>[n.id,pretty(n)]),materialOwner.id):'';
  const material=member&&p?choices('p:material',tr('Material for this member','所选杆件材料'),Object.entries(materials).map(([k,m])=>[k,m[language==='en'?'en':'zh']]),member.material)+
   `<div class="design-material-values"><span>ρ <b>${fmt(p.rho/1000,2)}</b><small>g/cm³</small></span><span>E <b>${fmt(p.E/1e9,2)}</b><small>GPa</small></span><span>σlim <b>${fmt(p.strength/1e6,1)}</b><small>MPa</small></span></div>`+
   choices('p:section',tr('Section for this member','所选杆件截面'),[['box',tr('Rectangular hollow','矩形薄壁管')],['tube',tr('Circular hollow','圆形薄壁管')],['solid',tr('Solid rectangle','实心矩形')]],member.section)+
   `<div class="design-two-fields design-section-dimensions">${member.section!=='tube'?input('p:width',tr('Width b','宽度 b'),member.width*1000,'mm',8,120,.1):''}${input('p:height',member.section==='tube'?tr('Outer diameter D','外径 D'):tr('Height h','高度 h'),member.height*1000,'mm',8,120,.1)}${member.section!=='solid'?input('p:wall',tr('Wall thickness t','壁厚 t'),member.wall*1000,'mm',.2,30,.01):''}</div>`+
   `<button type="button" data-material-all>${tr('Apply material to all design members','将材料用于全部设计杆件')}</button>`+
   `<details class="design-details"><summary>${tr('Property inputs & manufacturing limit','材料参数与制造下限')}</summary><div class="design-two-fields">${input('p:prop:rho',tr('Density','密度'),p.rho,'kg/m³',100,30000,1)}${input('p:prop:E',tr('Young’s modulus','杨氏模量'),p.E/1e9,'GPa',.1,500,.01)}${input('p:prop:G',tr('Shear modulus','剪切模量'),p.G/1e9,'GPa',.001,500,.01)}${input('p:prop:strength',tr('Strength limit','强度限值'),p.strength/1e6,'MPa',.1,3000,.1)}${input('d:minWall',tr('Minimum sized wall','定尺寸最小壁厚'),d.minWall*1000,'mm',.2,12,.1)}</div><p class="design-control-note">${tr('Preset values are editable screening inputs. Printed ABS needs effective properties for its process and direction; CFRP also needs layup and joint checks.','预设值为可修改的初筛输入。打印 ABS 需按工艺和方向确定有效参数；CFRP 还需校核铺层与接头。')}</p></details>`:'';
  $('[data-structure-controls]').innerHTML=group(tr('Mechanism & dimensions','机构与尺寸'),geometry)+quadPosture+(sourceModel?'':`<details class="design-details"><summary>${tr('Body dimensions & mass budget','机身尺寸与质量预算')}</summary><div class="design-two-fields">${input('d:bodyMass',tr('Body mass','机身质量'),d.bodyMass,'kg',.2,100,.1)}${input('d:bodyWidth',tr('Body width','机身宽度'),d.bodyWidth*1000,'mm',150,500,1)}${input('d:bodyLength',tr('Body length','机身长度'),d.bodyLength*1000,'mm',150,800,1)}</div></details>`);
  updateStanceMeasures();
  const derivedMaterial=d.sourceMode==='derived',definition=derivedMaterial?sourceMemberDefinitions(model).find(item=>item.nodeId===materialOwner.id):undefined;
  const materialBasis=definition?`<details class="design-details"><summary>${tr('Reference section and mass allocation','基准截面与质量分配')}</summary><p class="design-control-note">${tr(`The initial ${fmt(definition.reference.width*1000,1)} × ${fmt(definition.reference.height*1000,1)} × ${fmt(definition.reference.wall*1000,1)} mm box is a concept section, not the original CAD. Its reference cut length is ${fmt(definition.reference.cutLength*1000,1)} mm.`,`初始 ${fmt(definition.reference.width*1000,1)} × ${fmt(definition.reference.height*1000,1)} × ${fmt(definition.reference.wall*1000,1)} mm 箱形截面用于概念设计，并非原 CAD 截面；基准下料长度为 ${fmt(definition.reference.cutLength*1000,1)} mm。`)}</p><p class="design-control-note">${tr(`Current member ${fmt(definition.currentMass*1000,1)} g; reference member ${fmt(definition.reference.mass*1000,1)} g; fixed assembly remainder ${fmt(definition.residualMass*1000,1)} g. This remainder has not been identified as separate motors or fittings.`,`当前杆件 ${fmt(definition.currentMass*1000,1)} g；基准杆件 ${fmt(definition.reference.mass*1000,1)} g；其余总成预算 ${fmt(definition.residualMass*1000,1)} g。余项没有被辨识为独立电机或连接件。`)}</p></details>`:'';
  const deriveMaterialButton=`<button type="button" data-derive-material>${tr('Derive and edit materials','派生并编辑材料')}</button>`;
  const supportControls=choices('c:rootSupport',tr('Structural boundary','结构校核边界'),[['spring',tr('Member + connection flexibility','杆件与连接柔度')],['clamped',tr('Clamped member','固支杆件')]],conditions.rootSupport??'spring')+`<p class="design-control-note">${conditions.rootSupport==='clamped'?tr('The member root is fixed for the structural comparison. Connection rotation is excluded.','按杆根固定的边界校核杆件，连接转动位移不计入。'):tr(`Connection stiffness ${fmt(conditions.outputStiffness,0)} N·m/rad. This entered assumption also contributes to displacement.`,`连接刚度 ${fmt(conditions.outputStiffness,0)} N·m/rad；这一输入假设产生的位移也计入校核。`)}</p>`;
  if(derivedMaterial)$('[data-material-controls]').innerHTML=memberChoice+material+supportControls+materialBasis;
  else if(sourceModel)$('[data-material-controls]').innerHTML=`<p class="design-control-note">${tr('Create a parametric design to edit member materials and sections while keeping the source joint arrangement.','保留原关节构型，进入参数化设计后修改杆件材料与截面。')}</p>${deriveMaterialButton}${hasElasticModel(d)&&member?material:''}`;
  else $('[data-material-controls]').innerHTML=material+supportControls;
  const drive=choices('d:remote',tr('Knee / elbow actuator','膝部 / 肘部电机'),[['false',tr('At the driven joint','布置在被驱动关节')],['true',tr('Proximal + synchronous belt','近端布置 + 同步带')]],String(d.remote))+
   `<div class="design-two-fields">${input('d:motorMass',tr('Motor package mass','基准电机质量'),d.motorMass,'kg',.05,3,.01)}${input('c:motorShaftTorque',tr('Base motor shaft torque','基准电机轴转矩'),conditions.motorShaftTorque,'N·m',.1,50,.1)}${input('d:outputSpeedLimit',tr('Output speed limit','输出角速度限值'),d.outputSpeedLimit??8,'rad/s',.1,30,.1)}${input('d:ratio',tr('Reduction N','减速比 N'),d.ratio,': 1',1,160,1)}${input('d:rotorInertia',tr('Selected rotor inertia','所选轴转子惯量'),d.rotorInertia*1e5,'×10⁻⁵ kg·m²',.01,500,.1)}</div>`+
   `<details class="design-details"><summary>${tr('Motor envelope, stiffness and friction','电机包络、传动刚度与摩擦')}</summary><div class="design-two-fields">${input('d:motorRadius',tr('Motor radius','电机包络半径'),(d.motorRadius??.033)*1000,'mm',15,100,1)}${input('d:motorLength',tr('Motor axial length','电机轴向长度'),(d.motorLength??.045)*1000,'mm',20,140,1)}${conditions.rootSupport==='clamped'?'':input('c:outputStiffness',tr('Output torsional stiffness','输出转动刚度'),conditions.outputStiffness,'N·m/rad',50,100000,100)}${input('c:motorFriction',tr('Motor friction torque','电机轴摩擦'),conditions.motorFriction,'N·m',0,3,.005)}${input('c:gearFriction',tr('Output gear friction','输出端齿轮摩擦'),conditions.gearFriction,'N·m',0,10,.01)}${input('c:efficiency',tr('Forward efficiency','正向效率'),conditions.efficiency,'',.05,1,.01)}${input('c:reverseEfficiency',tr('Reverse efficiency','反向效率'),conditions.reverseEfficiency,'',.05,1,.01)}</div><p class="design-control-note">${tr('These friction inputs are for the breakaway screen. The rigid-body simulation uses its stated viscous damping; Coulomb friction and elasticity are uncalibrated.','这些摩擦输入用于反驱初筛。刚体仿真采用明示黏性阻尼；库仑摩擦与弹性耦合尚未标定。')}</p></details><p class="design-control-note">${tr('Torque, speed, inertia and motor mass are design inputs, not a matched actuator catalogue selection.','转矩、转速、惯量与电机质量为设计输入，尚未绑定匹配的执行器型号。')}</p>`;
  const motionInputs=motionSettings(model);
  const gait=isArm?choices('d:armCirclePlane',tr('Circle plane','画圆平面'),[['xz','XZ'],['yz','YZ']],d.armCirclePlane??'yz')+`<div class="design-two-fields">${input('d:armCircleRadius',tr('Circle radius','圆轨迹半径'),(d.armCircleRadius??.025)*1000,'mm',5,150,1,true)}${input('d:gaitPeriod',tr('Circle duration','圆轨迹周期'),d.gaitPeriod??5,'s',2,10,.5)}${armCircleSettings(model).centre.map((v,i)=>input('circle:'+i,tr('Circle centre ','圆心 ')+['X','Y','Z'][i],v*1000,'mm',-1000,1000,1)).join('')}</div>`:`<div class="design-two-fields">${input('d:gaitPeriod',tr('Gait period','步态周期'),motionInputs.period,'s',1.5,8,.1)}${input('d:strideLength',tr('Stride per cycle','每周期前进距离'),motionInputs.stride*1000,'mm',20,250,5)}${input('d:stepHeight',tr('Foot clearance','抬足高度'),motionInputs.lift*1000,'mm',5,100,1)}</div>`;
  const loads=gait+`<div class="design-two-fields">${input('d:tipForce',tr('Transverse force F','横向校核力 F'),d.tipForce,'N',0,2000,5)}${input('c:acceleration',tr('Joint acceleration α','关节角加速度 α'),conditions.acceleration,'rad/s²',0,200,1)}${input('c:bandwidth',tr('Target bandwidth fb','目标带宽 fb'),conditions.bandwidth,'Hz',.5,100,.5)}${input('d:allowDeflection',tr('Tip error limit','端部变形限值'),d.allowDeflection*1000,'mm',.05,20,.05)}${sourceModel?'':isArm?input('d:toolMass',tr('Tool mass','末端工具质量'),d.toolMass,'kg',0,15,.05):input('d:footMass',tr('Mass per foot','单个足端质量'),d.footMass??(d.robot==='biped'?.25:.08),'kg',.01,3,.01)}${input('d:payload',isArm?tr('Workpiece mass','工件负载质量'):d.robot==='biped'?tr('Back payload mass','背部负载质量'):tr('Body payload mass','机身负载质量'),d.payload,'kg',0,30,.1)}</div><details class="design-details"><summary>${tr('Speed, safety and separation','速度、安全系数与频率间隔')}</summary><div class="design-two-fields">${input('d:groundFriction',tr('Contact friction μ','地面接触摩擦 μ'),d.groundFriction??.7,'',.05,2,.05)}${input('c:angularSpeed',tr('Joint speed ω','关节角速度 ω'),conditions.angularSpeed,'rad/s',0,30,.1)}${input('d:safety',tr('Strength safety factor','强度安全系数'),d.safety,'',1,5,.1)}${input('c:separation',tr('Required fn / fb','初筛频率间隔'),conditions.separation,'×',1.5,10,.5)}</div></details>`;
  $('[data-drive-controls]').innerHTML=group(tr('Actuation & placement','驱动与质量布置'),sourceModel?`<p class="design-control-note">${sourceDriveNote(d)}</p>${hasElasticModel(d)&&conditions.rootSupport!=='clamped'?input('c:outputStiffness',tr('Assumed output torsional stiffness','假设输出转动刚度'),conditions.outputStiffness,'N·m/rad',50,100000,100):''}`:drive);
  const sourceLoads=gait+`<div class="design-two-fields">${input('d:payload',isArm?tr('Workpiece mass','工件负载质量'):tr('Added payload mass','附加负载质量'),d.payload,'kg',0,30,.1)}${!isArm?input('d:groundFriction',tr('Contact friction μ','地面接触摩擦 μ'),d.groundFriction??.7,'',.05,2,.05):''}${isArm||hasElasticModel(d)?input('d:allowDeflection',isArm?tr('TCP position error limit','TCP 位置误差限值'):tr('Tip deflection limit','端部变形限值'),d.allowDeflection*1000,'mm',.05,20,.05):''}${hasElasticModel(d)?input('d:tipForce',tr('Manual transverse force F','手动横向校核力 F'),d.tipForce,'N',0,2000,5)+input('d:safety',tr('Strength safety factor','强度安全系数'),d.safety,'',1,5,.1)+input('c:bandwidth',tr('Target bandwidth fb','目标带宽 fb'),conditions.bandwidth,'Hz',.5,100,.5)+input('c:separation',tr('Required fn / fb','初筛频率间隔'),conditions.separation,'×',1.5,10,.5):''}</div>`;
  $('[data-task-controls]').innerHTML=group(tr('Task & verification constraints','任务与校核约束'),sourceModel?sourceLoads:loads);
  for(const b of root!.querySelectorAll<HTMLButtonElement>('[data-architecture]'))b.setAttribute('aria-pressed',String(b.dataset.architecture===d.robot));
  $<HTMLElement>('.design-motion-note').textContent=isArm?tr(`TCP: ${(d.armCirclePlane??'yz').toUpperCase()} circle${d.armModel==='aloha'||model.active.filter(j=>j.kind==='hinge').length>=6?' · fixed orientation':''}`,`TCP：${(d.armCirclePlane??'yz').toUpperCase()} 平面圆轨迹${d.armModel==='aloha'||model.active.filter(j=>j.kind==='hinge').length>=6?' · 固定姿态':''}`):tr('X forward · Y left · Z up','X 前方 · Y 左侧 · Z 竖直');
  $('[data-model-label]').textContent=sourceModel?sourceName(d)+(d.sourceMode==='derived'?tr(' · parametric',' · 参数化'):''):tr(isArm?'Manipulator':d.robot==='biped'?'Humanoid':'Quadruped',isArm?'机械臂':d.robot==='biped'?'人形':'四足');
  $('[data-selection-label]').textContent=tr(sourceModel?'Selected joint':'Selected member',sourceModel?'选中关节':'选中杆件');$('[data-foot-legend]').hidden=sourceModel;$('.design-model-legend').hidden=sourceModel;
  $('[data-payload-legend]').hidden=d.payload===0;$('[data-transmission-legend]').hidden=sourceModel||!d.remote;const hingeCount=model.active.filter(j=>j.kind==='hinge').length;$('[data-dof]').textContent=isArm?tr(`${model.active.filter(j=>j.group==='arm').length} arm axes · gripper`,`${model.active.filter(j=>j.group==='arm').length} 个机械臂转轴 · 夹爪`):tr(`${hingeCount} actuated axes`,`${hingeCount} 个主动转轴`);$('[data-motor-legend]').hidden=sourceModel;
  const source=$<HTMLSelectElement>('[data-load-source]');source.options[0]!.text=tr('Reference-motion envelope','参考动作包络');source.options[1]!.text=tr('Manual transverse load','手动横向工况');source.options[1]!.disabled=!hasElasticModel(d)||!current.member;source.value=loadSource;
  const motion=$<HTMLSelectElement>('[data-motion-mode]');motion.innerHTML=`<option value="move">${tr(isArm?'Cartesian circle':d.robot==='quadruped'?'Crawl reference':'Walking reference',isArm?'笛卡尔圆轨迹':d.robot==='quadruped'?'缓步爬行参考':'步行参考')}</option><option value="pose">${tr('Design pose','设计姿态')}</option>${validation?`<option value="simulation">${tr('Simulation replay','仿真结果回放')}</option>`:''}`;motion.value=mode;
  $<HTMLSelectElement>('[data-export]').options[0]!.text=tr('Export model','导出模型');root!.querySelectorAll<HTMLDetailsElement>('details.design-details').forEach((d,i)=>d.open=openDetails[i]??false);refreshLiveGroups();updatePlayLabel();
 }
 function updatePlayLabel(){
  $('[data-play]').textContent=tr(playing?'Pause':'Preview motion',playing?'暂停':'预览运动');
  $('[data-play]').setAttribute('aria-pressed',String(playing));
  $('[data-pose-label]').textContent=mode==='pose'?tr('Design pose','设计姿态'):tr('Kinematic preview','运动学预览');
 }
 function updateStanceMeasures(){
  const out=root!.querySelector<HTMLElement>('[data-stance-measures]');if(!out||design.robot!=='quadruped'||isSourceDesign(design))return;
  const poses=fk(model,model.home),hip=poses.fl_pitch!.p,foot=model.nodes.find(n=>n.group==='fl'&&n.tip==='foot')!,p=footSole(foot,poses[foot.id]!),x=(p[0]-hip[0])*1000;
  out.textContent=tr(`Front-left hip height: ${fmt(hip[2]*1000,1)} mm. The foot is ${fmt(Math.abs(x),1)} mm ${x>=0?'ahead of':'behind'} the hip.`,`左前髋轴离地 ${fmt(hip[2]*1000,1)} mm，足端位于髋轴${x>=0?'前方':'后方'} ${fmt(Math.abs(x),1)} mm。`);
 }
 function calculate(current?:DesignAnalysis){
  analysis=current??analyzeDesign(model,conditions,selected);selected=analysis.member.id;
  if(hasReference){
   const rd=copyDesign(referenceDesign);Object.assign(rd,{tipForce:design.tipForce,payload:design.payload,allowDeflection:design.allowDeflection,safety:design.safety});
   const rc={...referenceConditions,acceleration:conditions.acceleration,angularSpeed:conditions.angularSpeed,bandwidth:conditions.bandwidth,separation:conditions.separation};
   const key=JSON.stringify([rd,rc,selected]);
   if(key!==referenceCacheKey){comparison=analyzeDesign(generateRobot(rd),rc,selected);referenceCacheKey=key;}
  }else comparison=analysis;
  results();explanations();materialStudy();
 }
 const change=(value:number,ref:number)=>{if(!hasReference)return tr('No saved reference','尚未设置对照');if(ref===0)return value===0?tr('Matches reference','与对照相同'):tr('Reference is zero','对照值为零');const p=(value/ref-1)*100;return Math.abs(p)<.05?tr('Matches reference','与对照相同'):`${p>0?'+':''}${fmt(p,1)}% ${tr('vs reference','相对对照')}`;};
 function results(){
  const beamKnown=hasElasticModel(design)&&!!analysis.member.member,derived=design.sourceMode==='derived';
  const a=analysis,r=comparison,cycle=loadSource==='cycle',dynamic=cycle?envelope:undefined;
  const displacementLabel=conditions.rootSupport==='clamped'?tr('Member deflection','杆件变形'):tr('Total displacement','总位移');
  const beamDisplacement=cycle?dynamic?.maxDeflection.beamDeflection??NaN:a.beamDeflection,connectionDisplacement=cycle?dynamic?.maxDeflection.connectionDeflection??NaN:design.tipForce*a.driveCompliance;
  const displacementDetail=beamKnown?tr(`Limit ${fmt(design.allowDeflection*1000,2)} mm · member ${fmt(beamDisplacement*1000,3)}, connection ${fmt(connectionDisplacement*1000,3)} mm${cycle?' (same-instant magnitudes; combined by direction)':''}`,`限值 ${fmt(design.allowDeflection*1000,2)} mm · 杆件 ${fmt(beamDisplacement*1000,3)}，连接 ${fmt(connectionDisplacement*1000,3)} mm${cycle?'（同一时刻，按方向合成）':''}`):tr('Member section is missing','缺少杆件截面');
  const deflection=!beamKnown?NaN:cycle?dynamic?.maxDeflection.deflection??NaN:a.deflection,strengthUse=!beamKnown?NaN:cycle?dynamic?.worst.strengthUse??NaN:a.strengthUse,torque=cycle?dynamic?.peak[a.driver.id]??NaN:a.requestedTorque,deflectionUse=deflection/design.allowDeflection,torqueUse=torque/a.availableTorque;
  const check=(label:string,value:string,detail:string,use:number,id:string)=>`<button type="button" class="design-check-result" data-open-basis="${id}" data-state="${!Number.isFinite(use)?'unknown':use>1?'warn':'normal'}"><span>${label}<b>${value}</b></span><i><b style="width:${Number.isFinite(use)?Math.min(100,Math.max(0,use*100)):0}%"></b></i><small>${detail}</small></button>`;
  $('[data-key-results]').innerHTML=`<div class="design-assembly-result"><span>${tr('ASSEMBLY · INCLUDING PAYLOAD','全机 · 含负载')}</span><strong>${fmt(a.mass,2)} <small>kg</small></strong><p>${isSourceDesign(design)?(design.sourceMode==='derived'?tr('Design members + assembly budget','设计杆件 + 总成预算'):(model.physicalSource?tr('LIBERO CAD nominal assembly','LIBERO CAD 名义总成'):tr('Source URDF assembly','原 URDF 总成'))):tr('Structural members','全部杆件')+' '+fmt(a.structures,2)+' kg'}</p><em>${change(a.mass,r.mass)}</em></div><div class="design-local-results"><p class="design-result-scope">${!beamKnown?tr('SELECTED JOINT · MOTION ENVELOPE','所选关节 · 参考动作包络'):cycle?(derived?tr('CONCEPT MEMBER · MOTION ENVELOPE','概念杆件 · 参考动作包络'):tr('SELECTED MEMBER · MOTION ENVELOPE','所选杆件 · 参考动作包络')):(derived?tr('CONCEPT MEMBER · MANUAL LOAD','概念杆件 · 手动横向工况'):tr('SELECTED MEMBER · MANUAL LOAD','所选杆件 · 手动横向工况'))}</p><h2>${pretty(a.member)}</h2>${check(displacementLabel,fmt(deflection*1000,3)+' mm',displacementDetail,deflectionUse,cycle?'motion-loads':'stiffness-frequency')}${check(tr('Normal-stress use','正应力利用率'),fmt(strengthUse*100,0)+'%',beamKnown?tr('With safety factor','已计安全系数')+' '+fmt(design.safety,1):tr('Structural check unavailable','结构校核尚未定义'),strengthUse,cycle?'motion-loads':'drive-sizing')}${check(tr('Output torque','输出力矩'),fmt(torque,1)+' N·m',isSourceDesign(design)?'URDF effort · '+fmt(a.availableTorque,1)+' N·m':tr('Input limit','输入限值')+' '+fmt(a.availableTorque,1)+' N·m',torqueUse,cycle?'motion-loads':'drive-sizing')}${check(derived?tr('Estimated mode separation','模态估算间隔'):tr('Mode separation','频率间隔'),fmt(beamKnown?a.resonanceRatio:NaN,1)+'×',beamKnown?tr('Target ≥','目标 ≥')+' '+fmt(conditions.separation,1)+'× · fn '+fmt(a.frequency,1)+' Hz':tr('Elastic dynamics not identified','弹性动力学尚未辨识'),beamKnown?conditions.separation/a.resonanceRatio:NaN,'stiffness-frequency')}<div class="design-inertia-results"><span>JL <b>${fmt(a.loadInertia,4)}</b></span><span>${isSourceDesign(design)?a.driver.joint?.armature!==undefined?tr('Jbearing · upper bound','Jbearing · 轴承上界'):'Jarmature':'N²Jm'} <b>${fmt(a.driver.joint?.armature??a.rotorReflection,5)}</b></span><small>kg·m²</small></div><p class="design-backdrive-result">${tr('Breakaway','反驱门槛')} <b>${isSourceDesign(design)?tr('Uncalibrated','未标定'):fmt(a.breakawayTorque,3)+' N·m'}</b></p></div>`;
  if(!beamKnown){root!.querySelectorAll('.design-local-results .design-check-result[data-state=unknown]').forEach(el=>{if(el.getAttribute('data-open-basis')!=='motion-loads'&&el.getAttribute('data-open-basis')!=='drive-sizing'||el.textContent?.includes(displacementLabel)||el.textContent?.includes(tr('Normal-stress use','正应力利用率')))el.remove();});$('.design-backdrive-result').remove();}
  $('[data-motion-envelope-description]').textContent=!beamKnown?tr('The motion envelope reports joint loads. The CAD segment study, when available, uses its separately specified manual force and support positions.','运动包络报告关节载荷；已接入的 CAD 截段校核使用单独设定的横向力和夹持位置。'):dynamic?tr(`Selected member ${pretty(a.member)}: maximum normal stress ${fmt(dynamic.worst.stress/1e6,2)} MPa at t=${fmt(dynamic.worst.time,2)} s; maximum deflection ${fmt(dynamic.maxDeflection.deflection*1000,3)} mm at t=${fmt(dynamic.maxDeflection.time,2)} s. ${dynamic.invalid}/${dynamic.samples} contact cases infeasible.`,`所选杆件 ${pretty(a.member)}：最大正应力 ${fmt(dynamic.worst.stress/1e6,2)} MPa，t = ${fmt(dynamic.worst.time,2)} s；最大变形 ${fmt(dynamic.maxDeflection.deflection*1000,3)} mm，t = ${fmt(dynamic.maxDeflection.time,2)} s。${dynamic.invalid}/${dynamic.samples} 帧接触载荷不可实现。`):tr('Choose the motion envelope to evaluate the prescribed motion.','选择参考动作包络后求解对应工况。');
  $('[data-calculation-context]').dataset.failed=String(!!dynamic&&(dynamic.invalid>0||dynamic.overloaded.length>0));
  $('[data-envelope-diagnostics]').textContent=cycle?(dynamic?tr(`Motion envelope · ${dynamic.samples} samples · ${dynamic.invalid} infeasible contact frames · ${dynamic.overloaded.length} joints exceed input torque limits.`,`参考动作包络 · ${dynamic.samples} 帧 · ${dynamic.invalid} 帧接触不可实现 · ${dynamic.overloaded.length} 个关节超过输入转矩限值。`):tr('Solving the reference-motion envelope…','正在求解参考动作包络…')):tr(`Selected: ${pretty(a.member)} · driving axis: ${a.driver.label[0]} · F ${fmt(design.tipForce,0)} N · α ${fmt(conditions.acceleration,0)} rad/s².`,`选中：${pretty(a.member)} · 驱动轴：${a.driver.label[1]} · F ${fmt(design.tipForce,0)} N · α ${fmt(conditions.acceleration,0)} rad/s²。`);
  const hasIssue=!!dynamic&&(dynamic.invalid>0||dynamic.overloaded.length>0);$('[data-calculation-context]').hidden=cycle&&!hasIssue;$('[data-calculation-context]').textContent=cycle?(hasIssue?tr(`Contact constraints: ${dynamic!.invalid} frames unmet · torque limits: ${dynamic!.overloaded.length} joints exceeded`,`接触约束未满足 ${dynamic!.invalid} 帧 · 转矩超限 ${dynamic!.overloaded.length} 个关节`):''):$('[data-envelope-diagnostics]').textContent;
  if(cycle&&referenceIssue){for(const selector of ['[data-motion-envelope-description]','[data-envelope-diagnostics]','[data-calculation-context]'])$(selector).textContent=referenceMessage();$('[data-calculation-context]').hidden=false;$('[data-calculation-context]').dataset.failed='true';}
 }
 function materialStudy(){
  const derived=design.sourceMode==='derived',cad=design.robot==='arm'&&design.armModel==='aloha'||design.robot==='biped'&&design.legModel==='rp1';
  const target=derived?materialNode():analysis.member,enabled=!!target?.member&&hasElasticModel(design)&&(!isSourceDesign(design)||derived);
  const study=$('[data-study-panel="materials"]'),cadHost=$('[data-cad-structure]');
  if(derived&&study.lastElementChild!==cadHost)study.append(cadHost);
  else if(!derived&&study.firstElementChild!==cadHost)study.prepend(cadHost);
  cadHost.dataset.reference=String(derived);
  void cadPanel.update(model);$('.design-study-heading').hidden=cad&&!enabled;$('[data-material-rule]').hidden=!enabled;
  if(!enabled){
   materialCandidates=[];materialCacheKey='';
   $('[data-material-scope]').textContent=tr('Use Derive and edit materials in the Material tab to design member materials and sections while keeping this joint arrangement.','在左侧“材料”页点击“派生并编辑材料”，保留当前关节构型并设计杆件材料与截面。');
   $('[data-material-comparison]').hidden=true;$('[data-material-comparison]').innerHTML='';$<HTMLElement>('.design-material-interpretation').hidden=true;$('[data-material-interpretation]').innerHTML='';
   root!.querySelectorAll<HTMLButtonElement>('[data-material-mode]').forEach(b=>b.disabled=true);return;
  }
  root!.querySelectorAll<HTMLButtonElement>('[data-material-mode]').forEach(b=>b.disabled=false);
  const memberId=target!.id,key=JSON.stringify([design,conditions,memberId,materialMode]);
  if(key!==materialCacheKey){materialCandidates=compareMemberMaterials(model,conditions,memberId,materialMode);materialCacheKey=key;}
  const a=memberId===analysis.member.id?analysis:analyzeDesign(model,conditions,memberId),m=a.member.member!;
  $('[data-material-scope]').textContent=derived?tr(`${pretty(a.member)} · concept member. Other members, the remaining assembly budget, payload and joint origins stay fixed.`,`${pretty(a.member)} · 概念杆件。其余杆件、总成余项、负载与关节原点保持不变。`):tr(`${pretty(a.member)} only · other members, motors, payload and joint centres stay fixed.`,`比较对象：${pretty(a.member)}。其余杆件、电机、负载与关节中心保持不变。`);
  const boundary=conditions.rootSupport==='clamped'?tr('clamped member','固支杆件'):tr(`connection stiffness ${fmt(conditions.outputStiffness,0)} N·m/rad`,`连接刚度 ${fmt(conditions.outputStiffness,0)} N·m/rad`);
  $('[data-material-rule]').textContent=tr(`Manual transverse check: F = ${fmt(design.tipForce,0)} N; displacement limit ${fmt(design.allowDeflection*1000,2)} mm; ${boundary}. `,`手动横向校核：F = ${fmt(design.tipForce,0)} N；位移限值 ${fmt(design.allowDeflection*1000,2)} mm；${boundary}。`)+(materialMode==='fixed'?tr('Keep the current section. Motion-envelope results use the prescribed motion separately.','保持当前截面尺寸。右侧参考动作包络另按运动载荷计算。'):tr(`Size similar sections; outer size ≤120 mm and hollow wall ≥${fmt(design.minWall*1000,2)} mm. Motion loads are recalculated after applying a candidate.`,`按相似截面定尺寸，外尺寸≤120 mm、空心壁厚≥${fmt(design.minWall*1000,2)} mm；采用后重新求运动载荷。`));
  const rows=[...materialCandidates].sort((x,y)=>Number(y.feasible)-Number(x.feasible)||x.memberMass-y.memberMass);
  const section=(c:MaterialCandidate)=>{const p=c.analysis.member.member!;return p.section==='tube'?`Ø${fmt(p.height*1000,1)} × ${fmt(p.wall*1000,2)}`:p.section==='solid'?`${fmt(p.width*1000,1)} × ${fmt(p.height*1000,1)}`:`${fmt(p.width*1000,1)} × ${fmt(p.height*1000,1)} × ${fmt(p.wall*1000,2)}`;};
  $('[data-material-comparison]').hidden=false;$<HTMLElement>('.design-material-interpretation').hidden=false;
  $('[data-material-comparison]').innerHTML=`<div class="design-table-scroll"><table class="design-material-table"><thead><tr><th>${tr('Preset material','材料预设')}</th><th>${tr('Section / mm','截面 / mm')}</th><th>${tr('Member / kg','杆件 / kg')}</th><th>${tr('Member / mm','杆件变形 / mm')}</th><th>${tr('Connection / mm','连接位移 / mm')}</th><th>${tr('Total / mm','总位移 / mm')}</th><th>${tr('Strength use','强度利用率')}</th><th>${tr('Screening','约束初筛')}</th><th><span class="sr-only">${tr('Apply candidate','采用方案')}</span></th></tr></thead><tbody>${rows.map(c=>{const p=c.analysis.member.member!,isCurrent=m.material===c.material&&['rho','E','G','strength'].every(k=>m.prop[k as keyof typeof m.prop]===p.prop[k as keyof typeof p.prop])&&Math.abs(m.width-p.width)+Math.abs(m.height-p.height)+Math.abs(m.wall-p.wall)<1e-8;return`<tr data-material-row="${c.material}" data-current="${isCurrent}"><th scope="row">${materials[c.material][language==='en'?'en':'zh']}<small>ρ ${fmt(p.prop.rho/1000,2)} g/cm³ · E ${fmt(p.prop.E/1e9,2)} GPa</small></th><td>${c.limit?'—':section(c)}</td><td class="design-table-mass">${c.limit?'—':fmt(c.memberMass,3)}</td><td>${fmt(c.analysis.beamDeflection*1000,3)}</td><td data-state="${design.tipForce*c.analysis.driveCompliance>design.allowDeflection?'warn':'normal'}">${fmt(design.tipForce*c.analysis.driveCompliance*1000,3)}</td><td data-state="${c.analysis.deflectionUse>1.00000001?'warn':'normal'}">${fmt(c.analysis.deflection*1000,3)}</td><td data-state="${c.analysis.strengthUse>1.00000001?'warn':'normal'}">${fmt(c.analysis.strengthUse*100,1)+'%'}</td><td>${c.failure==='connection'?tr('Connection displacement limit','连接位移超限'):c.limit==='envelope'?tr('Size / wall limit','尺寸或壁厚受限'):c.failure==='both'?tr('Deflection and strength limits','位移与强度超限'):c.failure==='deflection'?tr('Displacement limit','位移超限'):c.failure==='strength'?tr('Strength limit','强度超限'):tr('Meets both','两项满足')}</td><td><button type="button" data-apply-material="${c.material}" ${isCurrent||materialMode==='sized'&&!c.feasible?'disabled':''}>${isCurrent?tr('Current','当前'):tr('Apply','采用')}</button></td></tr>`;}).join('')}</tbody></table></div>`;
  const connection=a.driveCompliance*design.tipForce,blocked=connection>=design.allowDeflection;
  const diagnosis=conditions.rootSupport==='clamped'?tr('The root is fixed in this member check. Total displacement equals member deformation.','当前按杆根固支校核，总位移就是杆件变形。'):blocked?tr(`Connection rotation alone gives ${fmt(connection*1000,3)} mm, reaching the ${fmt(design.allowDeflection*1000,2)} mm limit. Material or section changes cannot remove this term.`,`仅连接转动产生 ${fmt(connection*1000,3)} mm 位移，已达到 ${fmt(design.allowDeflection*1000,2)} mm 限值；换材或加粗杆件都不能消除这一项。`):tr(`Member deformation ${fmt(a.beamDeflection*1000,3)} mm + connection displacement ${fmt(connection*1000,3)} mm = total ${fmt(a.deflection*1000,3)} mm under this manual load.`,`该手动工况下，杆件变形 ${fmt(a.beamDeflection*1000,3)} mm + 连接位移 ${fmt(connection*1000,3)} mm = 总位移 ${fmt(a.deflection*1000,3)} mm。`);
  $('[data-material-interpretation]').innerHTML=`<p>${diagnosis}</p>${conditions.rootSupport!=='clamped'?`<p><button type="button" data-fix-stiffness>${tr('Edit connection stiffness','查看连接刚度')}</button> <button type="button" data-clamped-comparison>${tr('Compare as clamped members','按固支杆件比较')}</button></p>`:''}<p>${materialMode==='sized'&&blocked?tr('No section-sizing solution exists for this connection setting; displacement columns show the current section. ','此连接条件下没有可行的定尺寸解，位移列保留当前截面的数值。 '):''}${tr('Applying a candidate updates member mass, stiffness and joint loads. The original CAD reference keeps its own support and load inputs.','采用候选后更新杆件质量、刚度和关节载荷；原 CAD 参考继续使用单独的支承与载荷输入。')}</p>`;
  root!.querySelectorAll<HTMLButtonElement>('[data-material-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.materialMode===materialMode)));
 }
 function explanations(){const a=analysis,r=comparison,d=design,c=conditions;
  const set=(selector:string,value:string)=>{$(selector).textContent=value;};
  const beamKnown=hasElasticModel(d)&&!!a.member.member;
  $('[data-motion-envelope-description]').hidden=!beamKnown;
  if(isSourceDesign(d)){
   set('[data-explain="mass"]',tr(`The current ${sourceName(d)} assembly has mass ${fmt(a.mass,2)} kg, including the added payload of ${fmt(d.payload,2)} kg. ${d.sourceMode==='derived'?'Each design member uses m = ρ A Lcut. Its remaining assembly budget stays fixed; material, section and length changes update the combined mass, COM and inertia. The initial partition is a concept allocation, not an identified CAD decomposition.':d.armModel==='aloha'?(d.armInertia==='urdf'?'The arm retains the original 2.0 kg URDF budget.':'Mass, COM and full central tensors use the LIBERO CAD inertia bundle. Its nominal assembly mass is 1.84962 kg; the 45 g camera is included once in the fixed jaw.'):'Link masses, COM locations and inertia tensors are read from the published URDF.'}`,`当前 ${sourceName(d)} 总质量为 ${fmt(a.mass,2)} kg，包含附加负载 ${fmt(d.payload,2)} kg。${d.sourceMode==='derived'?'设计杆件按 m = ρ A Lcut 计算质量，其余总成保持预算；材料、截面与长度修改后重新合成质量、质心和惯量。初始分配为概念假设，并非辨识得到的 CAD 质量拆分。':d.armModel==='aloha'?(d.armInertia==='urdf'?'整臂保留旧 URDF 的 2.0 kg 预算。':'质量、质心与完整中心惯量采用 LIBERO CAD 物性包，原尺寸总质量为 1.84962 kg；45 g 摄像头已并入固定夹爪，不重复计入。'):'各连杆的质量、质心位置和惯量张量读取自公开 URDF。'}`));
   set('[data-judgment="mass"]','');
   $('[data-mass-breakdown]').innerHTML='';
   set('[data-explain="inertia"]',tr(`At the design pose, summing the current link tensors and parallel-axis contributions about ${a.driver.label[0]} gives JL = ${fmt(a.loadInertia,5)} kg·m². This comparison uses the fixed design pose; motion-load calculations evaluate the inertia and gravity terms at each trajectory frame.`,`在设计姿态下，将当前连杆惯量和各平行轴项绕 ${a.driver.label[1]} 求和，得到 JL = ${fmt(a.loadInertia,5)} kg·m²。这里固定采用设计姿态，便于比较构型；运动载荷计算则按每帧姿态更新惯量与重力项。`));
   set('[data-judgment="inertia"]','');
   set('[data-explain="reflection"]',Number.isFinite(a.rotorReflection)?tr(`For this joint, the source directly specifies an output-side added inertia, called armature, of ${fmt(a.rotorReflection,6)} kg·m². Adding it to JL gives Jtotal = ${fmt(a.totalInertia,5)} kg·m²; no further reduction-ratio conversion is applied.`,`源文件直接给出了该关节输出端的附加惯量 armature，数值为 ${fmt(a.rotorReflection,6)} kg·m²。将其与 JL 相加，得到 Jtotal = ${fmt(a.totalInertia,5)} kg·m²；这一数值已在输出端定义，无须再次乘以减速比的平方。`):tr('The source does not specify rotor or output-side added inertia for this joint. That term is omitted in the current rigid-body calculation.','源文件没有给出该关节的转子惯量或输出端附加惯量，当前刚体计算省略这一项。'));
   set('[data-judgment="reflection"]','');
   set('[data-explain="stiffness"]',beamKnown?tr(`The ${d.sourceMode==='derived'?'concept member':'custom equivalent beam'} has I = ${fmt(a.bendingI*1e12,0)} mm⁴ and span L = ${fmt(a.L*1000,1)} mm. Under manual transverse force F = ${fmt(d.tipForce,1)} N and ${c.rootSupport==='clamped'?'a fixed root':`assumed connection stiffness kθ = ${fmt(c.outputStiffness,0)} N·m/rad`}, member deformation is ${fmt(a.beamDeflection*1000,3)} mm and connection displacement is ${fmt(d.tipForce*a.driveCompliance*1000,3)} mm, giving total displacement ${fmt(a.deflection*1000,3)} mm. The modal estimate uses this simplified elastic model; identified whole-chain modes require measured connection stiffness and a complete elastic assembly.`,`当前${d.sourceMode==='derived'?'概念杆件':'自定义等效梁'}取截面二次矩 I = ${fmt(a.bendingI*1e12,0)} mm⁴、跨距 L = ${fmt(a.L*1000,1)} mm。在手动横向力 F = ${fmt(d.tipForce,1)} N、${c.rootSupport==='clamped'?'杆根固支':`假设连接刚度 kθ = ${fmt(c.outputStiffness,0)} N·m/rad`}条件下，杆件变形 ${fmt(a.beamDeflection*1000,3)} mm、连接位移 ${fmt(d.tipForce*a.driveCompliance*1000,3)} mm，总位移 ${fmt(a.deflection*1000,3)} mm。模态估算采用这一简化弹性模型；整链模态辨识还需要实测连接刚度与完整的弹性装配模型。`):d.sourceMode==='derived'?tr('The selected joint has no design member. Select a design member in the Material tab to compare sections and materials; joint loads remain available for every active joint.','当前关节未分配设计杆件。在“材料”页选择设计杆件后可比较截面与材料；所有活动关节仍可查看载荷。'):(d.armModel==='aloha'||d.legModel==='rp1'?tr('Native CAD sections are available in the material/section tab. That study computes a selected clamped segment under a manual transverse force. Full joint-chain modes additionally require connection stiffness and a complete elastic assembly.','材料与截面页已接入原始 CAD 截面，可以修改材料、夹持截面及横向力，计算截段弯曲应力、位移和固支频率。整条关节链的模态还需要连接刚度及完整的弹性装配模型。'):tr('This Go2 source provides rigid-body mass and inertia but no verified load-bearing CAD sections or connection stiffness. Derive a parametric design to enter an explicit concept section.','当前 Go2 源模型提供刚体质量与惯量，尚未找到可核验的承力件 CAD 截面与连接刚度。可派生参数化方案并指定概念截面。')));
   set('[data-judgment="bandwidth"]',beamKnown&&Number.isFinite(a.frequency)?tr(`The modal estimate gives fn = ${fmt(a.frequency,1)} Hz. Against the entered target bandwidth fb = ${fmt(c.bandwidth,1)} Hz, fn / fb = ${fmt(a.resonanceRatio,2)}. It ${a.bandwidthSatisfied?'meets':'does not meet'} the specified separation of ${fmt(c.separation,1)}; this does not establish achievable closed-loop bandwidth.`,`模态估算 fn = ${fmt(a.frequency,1)} Hz；相对于输入的目标带宽 fb = ${fmt(c.bandwidth,1)} Hz，fn / fb = ${fmt(a.resonanceRatio,2)}，${a.bandwidthSatisfied?'满足':'未满足'}设定的 ${fmt(c.separation,1)} 倍间隔。此初筛不代表已实现的闭环带宽。`):'');
   $('[data-check-schematic]').innerHTML='';
   set('[data-explain="drive"]',tr(`For ${a.driver.label[0]}, reference-motion inverse dynamics gives the required output torque at each instant. Its magnitude is compared with the source URDF effort limit of ${fmt(a.availableTorque,2)} N·m. The live joint table shows the instantaneous value and the sampled motion peak.`,`对 ${a.driver.label[1]}，参考动作逆动力学逐帧求出所需输出转矩，再将其绝对值与源 URDF 的 effort 转矩限值 ${fmt(a.availableTorque,2)} N·m 比较。实时关节表显示当前值及抽样动作中的峰值。`));
   set('[data-judgment="strength"]',beamKnown?tr(`For the specified concept section under manual F = ${fmt(d.tipForce,1)} N, bending stress is ${fmt(a.stress/1e6,2)} MPa. With safety factor ${fmt(d.safety,1)}, strength use is ${fmt(a.strengthUse*100,1)}%; total displacement uses ${fmt(a.deflectionUse*100,1)}% of its entered limit.`,`对已指定的概念截面，手动 F = ${fmt(d.tipForce,1)} N 下的弯曲应力为 ${fmt(a.stress/1e6,2)} MPa。计入安全系数 ${fmt(d.safety,1)} 后，强度利用率为 ${fmt(a.strengthUse*100,1)}%；总位移占允许值的 ${fmt(a.deflectionUse*100,1)}%。`):'');
   set('[data-explain="backdrive"]',tr('This breakaway calculation needs separate values for motor-shaft friction, output gearbox friction and reverse efficiency. The source does not provide this set of inputs, so backdrive torque and the corresponding end-force estimate are left blank.','反驱计算需要分别输入电机轴摩擦、输出端减速器摩擦与反向效率。当前源文件未给出这组参数，因此反驱转矩与末端推力数值留空。'));
   set('[data-judgment="backdrive"]','');return;
  }

  const memberMass=a.member.member!.prop.rho*a.section.area*a.cutLength;
  set('[data-explain="mass"]',tr(`For ${pretty(a.member)}, ρ = ${fmt(a.member.member!.prop.rho,0)} kg/m³, A = ${fmt(a.section.area*1e6,1)} mm² and Lcut = ${fmt(a.cutLength*1000,1)} mm give a member mass of ${fmt(memberMass,3)} kg. All structural members total ${fmt(a.structures,2)} kg; adding the remaining components gives assembly mass m = ${fmt(a.mass,2)} kg.`,`所选 ${pretty(a.member)} 的密度 ρ = ${fmt(a.member.member!.prop.rho,0)} kg/m³、截面积 A = ${fmt(a.section.area*1e6,1)} mm²、下料长度 Lcut = ${fmt(a.cutLength*1000,1)} mm，代入后得到该杆件质量 ${fmt(memberMass,3)} kg。全部杆件合计 ${fmt(a.structures,2)} kg，加上其余部件后，装配总质量 m = ${fmt(a.mass,2)} kg。`));
  set('[data-judgment="mass"]',hasReference?tr(`Assembly mass comparison: ${change(a.mass,r.mass)}.`,`装配质量与已保存方案的比较：${change(a.mass,r.mass)}。`):'');
  const components=model.nodes.flatMap(n=>n.components),roles=[['member',tr('Members','杆件')],['motor',tr('Motors','电机主体')],['body',tr('Body','机身')],['tool',tr('Tool','工具')],['rest',tr('Interfaces / feet / load','连接、足端与负载')]];
  $('[data-mass-breakdown]').innerHTML=roles.map(([role,label])=>{const mass=components.filter(c=>role==='rest'?!['member','motor','body','tool'].includes(c.role):c.role===role).reduce((s,c)=>s+c.mass,0);return`<div><span>${label}</span><i><b style="width:${mass/a.mass*100}%"></b></i><strong>${fmt(mass,2)} kg</strong></div>`;}).join('');
  set('[data-explain="inertia"]',tr(`For the driving axis ${a.driver.label[0]}, JL = ${fmt(a.loadInertia,5)} kg·m².${hasReference?` The saved design gives ${fmt(r.loadInertia,5)} kg·m² under the same payload.`:''} Moving a component closer to this axis reduces its parallel-axis contribution in proportion to the squared distance.`,`驱动轴 ${a.driver.label[1]} 对应的 JL = ${fmt(a.loadInertia,5)} kg·m²。${hasReference?`在相同负载下，已保存方案为 ${fmt(r.loadInertia,5)} kg·m²。`:''}将部件移近这根轴，会按垂距的平方关系减小其平行轴惯量。`));
  set('[data-judgment="inertia"]',d.remote?tr('The current proximal-actuation layout includes the belt, pulleys and supports in both mass and inertia.','当前近端电机方案已将同步带、带轮和支承计入质量与惯量。'):tr('The current knee or elbow motor travels with its driven joint, so its mass contributes to the inertia of the joints upstream.','当前膝部或肘部电机随被驱动关节运动，其质量计入上游关节的随动惯量。'));
  set('[data-explain="reflection"]',tr(`With N = ${fmt(d.ratio,0)} and Jm = ${d.rotorInertia.toExponential(2)} kg·m², N²Jm = ${fmt(a.rotorReflection,6)} kg·m². Adding JL gives Jtotal = ${fmt(a.totalInertia,5)} kg·m²; at α = ${fmt(c.acceleration,1)} rad/s², the inertia term is ${fmt(a.totalInertia*c.acceleration,3)} N·m.`,`取 N = ${fmt(d.ratio,0)}、Jm = ${d.rotorInertia.toExponential(2)} kg·m²，得到 N²Jm = ${fmt(a.rotorReflection,6)} kg·m²。与 JL 相加后，Jtotal = ${fmt(a.totalInertia,5)} kg·m²；在 α = ${fmt(c.acceleration,1)} rad/s² 下，惯性力矩为 ${fmt(a.totalInertia*c.acceleration,3)} N·m。`));
  set('[data-judgment="reflection"]',tr(`The reflected term is ${fmt(a.reflectionRatio*100,1)}% of JL. Doubling reduction would multiply this rotor term by four; relocating the motor housing changes JL instead.`,`当前反射惯量相当于 JL 的 ${fmt(a.reflectionRatio*100,1)}%。减速比加倍会使这一转子项增至四倍；移动电机壳体的位置则改变 JL。`));
  set('[data-explain="stiffness"]',tr(`For the selected bending direction, I = ${fmt(a.bendingI*1e12,0)} mm⁴. Beam compliance ${a.beamCompliance.toExponential(3)} m/N and transmission compliance ${a.driveCompliance.toExponential(3)} m/N add to ${a.compliance.toExponential(3)} m/N. At manual F = ${fmt(d.tipForce,1)} N, δ = ${fmt(a.deflection*1000,3)} mm. With modal mass meff = ${fmt(a.modalMass,3)} kg, fn ≈ ${fmt(a.frequency,2)} Hz.`,`所选弯曲方向的 I = ${fmt(a.bendingI*1e12,0)} mm⁴。杆件柔度 ${a.beamCompliance.toExponential(3)} m/N 与传动折算柔度 ${a.driveCompliance.toExponential(3)} m/N 相加，得到总柔度 ${a.compliance.toExponential(3)} m/N。在手动横向力 F = ${fmt(d.tipForce,1)} N 下，δ = ${fmt(a.deflection*1000,3)} mm；结合等效模态质量 meff = ${fmt(a.modalMass,3)} kg，得到 fn ≈ ${fmt(a.frequency,2)} Hz。`));
  set('[data-judgment="bandwidth"]',tr(`Transmission flexibility accounts for ${fmt(a.driveCompliance/a.compliance*100,0)}% of tip displacement. For target fb = ${fmt(c.bandwidth,1)} Hz, fn / fb = ${fmt(a.resonanceRatio,2)}, ${a.bandwidthSatisfied?'meeting':'below'} the requested separation of ${fmt(c.separation,1)}.`,`传动柔度贡献了端部变形的 ${fmt(a.driveCompliance/a.compliance*100,0)}%。目标带宽 fb = ${fmt(c.bandwidth,1)} Hz，因而 fn / fb = ${fmt(a.resonanceRatio,2)}，${a.bandwidthSatisfied?'满足':'低于'}设定的 ${fmt(c.separation,1)} 倍频率间隔。`));
  const mark=fmt(a.L*1000,0);$('[data-check-schematic]').innerHTML=`<svg viewBox="0 0 500 220" role="img" aria-label="${tr('Member and transmission compliance model','杆件与传动柔度模型')}"><path d="M44 60V130M34 65L44 60M34 80L44 75M34 95L44 90M34 110L44 105M34 125L44 120" stroke="#8da2ab"/><path d="${c.rootSupport==='clamped'?'M44 95H116':'M44 95H65l5-10 8 20 8-20 8 20 6-10H116'}" fill="none" stroke="#608ca2" stroke-width="2"/><rect x="116" y="83" width="28" height="24" fill="#b6c6cd"/><rect x="144" y="88" width="260" height="14" fill="#8daebb"/><rect x="404" y="83" width="28" height="24" fill="#b6c6cd"/><path d="M430 40V80M425 70l5 10 5-10" fill="none" stroke="#b28464" stroke-width="2"/><path d="M116 135V155M432 135V155M116 149H432" stroke="#9bacb3"/><g font-family="inherit" font-size="14" fill="#181818"><text x="72" y="143">${c.rootSupport==='clamped'?tr('Fixed','固支'):'kθ'}</text><text x="271" y="77" text-anchor="middle">EI</text><text x="443" y="55">F</text><text x="274" y="176" text-anchor="middle">L = ${mark} mm</text><text x="274" y="204" text-anchor="middle">${tr('Rigid end fixtures · flexible member','刚性连接段 · 可弯曲杆件')}</text></g></svg>`;
  set('[data-explain="drive"]',tr(`Under manual F = ${fmt(d.tipForce,1)} N, σmax = ${fmt(a.stress/1e6,2)} MPa. Multiplying by safety factor ${fmt(d.safety,1)} and dividing by material strength gives ${fmt(a.strengthUse*100,1)}% strength use. The torque sum is τreq = ${fmt(a.requestedTorque,2)} N·m; available torque is ηNτms = ${fmt(c.efficiency,2)} × ${fmt(d.ratio,0)} × ${fmt(c.motorShaftTorque,1)} × ${fmt(a.driver.joint!.motorScale,2)} = ${fmt(a.availableTorque,2)} N·m.`,`手动 F = ${fmt(d.tipForce,1)} N 下，σmax = ${fmt(a.stress/1e6,2)} MPa；乘以安全系数 ${fmt(d.safety,1)}，再除以材料强度，得到强度利用率 ${fmt(a.strengthUse*100,1)}%。各力矩项相加得到 τreq = ${fmt(a.requestedTorque,2)} N·m；可用转矩 ηNτms = ${fmt(c.efficiency,2)} × ${fmt(d.ratio,0)} × ${fmt(c.motorShaftTorque,1)} × ${fmt(a.driver.joint!.motorScale,2)} = ${fmt(a.availableTorque,2)} N·m。`));
  set('[data-judgment="strength"]',tr(`For this manual case, strength is ${a.strengthUse<=1?'within':'above'} its limit, displacement is ${a.deflectionUse<=1?'within':'above'} its limit, and torque demand is ${a.torqueUse<=1?'within':'above'} the available output.`,`这一手动工况的强度${a.strengthUse<=1?'满足要求':'超限'}，变形${a.deflectionUse<=1?'满足要求':'超限'}，转矩需求${a.torqueUse<=1?'在可用输出范围内':'超过可用输出'}。`));
  set('[data-explain="backdrive"]',tr(`The entered gearbox friction ${fmt(c.gearFriction,3)} N·m, motor friction ${fmt(c.motorFriction,3)} N·m and reverse efficiency ${fmt(c.reverseEfficiency,2)} give τbreak = ${fmt(a.breakawayTorque,3)} N·m at N = ${fmt(d.ratio,0)}. At lever arm L = ${fmt(a.L*1000,1)} mm, the perpendicular force estimate is ${fmt(a.breakawayForce,2)} N. At output speed ω = ${fmt(c.angularSpeed,1)} rad/s, Erot = ${fmt(a.kineticEnergy,3)} J.`,`输入的减速器摩擦为 ${fmt(c.gearFriction,3)} N·m、电机摩擦为 ${fmt(c.motorFriction,3)} N·m、反向效率为 ${fmt(c.reverseEfficiency,2)}；取 N = ${fmt(d.ratio,0)} 后，得到 τbreak = ${fmt(a.breakawayTorque,3)} N·m。在力臂 L = ${fmt(a.L*1000,1)} mm 处，垂直施力估计为 ${fmt(a.breakawayForce,2)} N。输出角速度 ω = ${fmt(c.angularSpeed,1)} rad/s 时，Erot = ${fmt(a.kineticEnergy,3)} J。`));
  set('[data-judgment="backdrive"]','');
 }
 function verifyGeometry(){
  const key=JSON.stringify({...design,tipForce:0,ratio:0,motorTorque:0,rotorInertia:0,allowDeflection:0,safety:0});
  if(key===geometryCacheKey)return;
  geometryCacheKey=key;const frames:ReturnType<typeof motionFrame>[]=[],conflicts=new Map<string,ReturnType<typeof packingConflicts>[number]>();let tracking=0,orientation=0,margin=Infinity;
  for(let i=0;i<32;i++){const f=motionFrame(model,i/31*duration());frames.push(f);tracking=Math.max(tracking,f.trackingError);orientation=Math.max(orientation,f.orientationError);if(design.robot!=='arm')margin=Math.min(margin,f.supportMargin);for(const c of packingConflicts(model,f.poses))conflicts.set(c.a+':'+c.b,c);}
  if(sceneReady)scene?.envelope(frames,true);
  const status=$('[data-geometry-status]');status.dataset.failed=String(!!conflicts.size||tracking>.001||orientation>.035);
  status.dataset.orientation=String(orientation);status.dataset.conflicts=String(conflicts.size);status.dataset.tracking=String(tracking);status.dataset.margin=String(margin);geometryStatusText();
  status.title=[...conflicts.values()].map(c=>`${c.a} / ${c.b}: ${fmt(c.depth*1000,1)} mm`).join('\n');
 }
 function geometryStatusText(){
  const s=$('[data-geometry-status]'),count=Number(s.dataset.conflicts),tracking=Number(s.dataset.tracking),orientation=Number(s.dataset.orientation);
  const conflicts=isSourceDesign(design)?0:count;
  s.hidden=!conflicts&&tracking<=.001&&orientation<=.035;s.className=s.hidden?'':'design-geometry-warning';
  s.textContent=conflicts?tr(`${conflicts} envelope conflicts`,`${conflicts} 处包络干涉`):tracking>.001?tr(`Reach error ${fmt(tracking*1000,1)} mm`,`可达误差 ${fmt(tracking*1000,1)} mm`):orientation>.035?tr('Foot orientation exceeds target','足底姿态未满足'):'';
 }

 function rebuild(resetView=false,redoControls=false,sourcePreview=false){
  if(!hasElasticModel(design))loadSource='cycle';
  if(!isSourceDesign(design))design.motorTorque=conditions.motorShaftTorque*design.ratio*conditions.efficiency;
  let next=generateRobot(design);if(design.robot==='arm'&&!design.armCircleCenter){design.armCircleCenter=armCircleSettings(next).centre;next=generateRobot(design);}const current=analyzeDesign(next,conditions,selected);
  model=next;selected=current.member.id;
  playing=false;mode='pose';time=0;
  const viewerKey=JSON.stringify({...design,tipForce:0,ratio:0,motorTorque:0,rotorInertia:0,allowDeflection:0,safety:0});
  if(scene&&viewerKey!==viewerModelKey){
   const generation=++viewGeneration;sceneReady=false;
   if(model.nodes.some(n=>n.components.some(c=>c.shape==='mesh'))){$('[data-design-view]').setAttribute('data-loading',tr('Loading source URDF geometry…','正在读取原 URDF 几何…'));prepareDesignMeshes(model).then(()=>{if(generation!==viewGeneration)return;scene!.build(model,resetView);sceneReady=true;viewerModelKey=viewerKey;$('[data-design-view]').removeAttribute('data-loading');geometryCacheKey='';if(!sourcePreview)verifyGeometry();drawMotion();}).catch(error=>{if(generation!==viewGeneration)return;$('[data-design-view]').setAttribute('data-loading',tr('Unable to load URDF geometry','URDF 几何读取失败'));$('[data-form-status]').textContent=tr('Model assets are unavailable. Reload to try again.','模型资源暂不可用，请重新加载。');});}
   else{scene.build(model,resetView);sceneReady=true;viewerModelKey=viewerKey;$('[data-design-view]').removeAttribute('data-loading');}
  }
  if(sourcePreview){analysis=current;results();}else{calculate(current);verifyGeometry();if(redoControls)controls();updateStanceMeasures();requestLoads();}
  $('[data-form-status]').textContent='';
  if(!sourcePreview)persistWorkbench();updatePlayLabel();drawMotion();
 }
 function drawMotion(){
  const simulation=mode==='simulation'&&validation?validation.samples.reduce((a,b)=>Math.abs(b.time-time)<Math.abs(a.time-time)?b:a):undefined;
  let f=simulation?.frame??motionFrame(model,time,mode==='move');
  const finite=Object.values(f.q).every(Number.isFinite)&&Object.values(f.poses).every(p=>[...p.p,...p.q].every(Number.isFinite))&&Number.isFinite(f.trackingError)&&Number.isFinite(f.orientationError);
  if(!simulation&&mode==='move'&&(!finite||f.ikConverged===false||f.trackingError>.001||f.orientationError>.035))setReferenceIssue({kind:finite?'ik':'nonfinite',time,trackingError:f.trackingError,orientationError:f.orientationError});
  if(!finite&&!simulation)f=motionFrame(model,0,false);
  if(scene&&sceneReady)scene.frame(f,$<HTMLInputElement>('[data-support]').checked);
  else if(!scene)diagram.draw(model,analysis,diagramView,f.poses,language!=='en',$<HTMLInputElement>('[data-support]').checked,pretty(analysis.member));
  if(sceneReady)scene?.select(selected,analysis.driver.id);
  const phase=mode==='move'||mode==='simulation'?Math.min(100,time/duration()*100):0;
  $<HTMLInputElement>('[data-motion-time]').value=String(phase*10);$('[data-motion-phase]').textContent=fmt(phase,0)+'%';
  const marginText=f.supportPolygon.length<3?tr('support region unavailable','支撑区域未形成'):tr(`COM margin ${fmt(f.supportMargin*1000,0)} mm`,`质心投影余量 ${fmt(f.supportMargin*1000,0)} mm`);
  const stage=simulation?tr('Closed-loop simulation','闭环仿真'):f.stage==='pose'?tr('Design pose','设计姿态'):f.stage==='settle'?tr('Stance preparation','姿态调整'):tr(design.robot==='arm'?'Circle reference':design.robot==='quadruped'?'Crawl reference':'Walking reference',design.robot==='arm'?'圆轨迹参考':design.robot==='quadruped'?'缓步爬行参考':'步行参考');
  $('[data-pose-label]').textContent=stage;
  $('[data-view-status]').textContent=simulation?tr(`${fmt(time,2)} s · ${f.contacts.length} contact feet`,`${fmt(time,2)} s · 接触足 ${f.contacts.length}`):design.robot==='arm'?tr(`TCP error ${fmt(f.trackingError*1000,2)} mm`,`末端位置误差 ${fmt(f.trackingError*1000,2)} mm`):tr(`Contact feet ${f.contacts.length} · foot error ${fmt(f.trackingError*1000,2)} mm · ${marginText}`,`接触足 ${f.contacts.length} · 足端误差 ${fmt(f.trackingError*1000,2)} mm · ${marginText}`);
  if(design.robot==='biped'){const feet=model.nodes.filter(n=>n.tip==='foot'),soles=feet.map(n=>footSole(n,f.poses[n.id]!)),spacing=Math.abs(soles[0]![1]-soles[1]![1]);$('[data-view-status]').textContent+=tr(` · foot spacing ${fmt(spacing*1000,0)} mm`,` · 足距 ${fmt(spacing*1000,0)} mm`);}
  if(design.robot==='quadruped'&&mode!=='pose'){const x=f.poses.base!.p[0]+f.travel-fk(model,model.home).base!.p[0];$('[data-view-status]').textContent+=tr(` · +X displacement ${fmt(x*1000,0)} mm`,` · +X 位移 ${fmt(x*1000,0)} mm`);}
  if(simulation){scene?.loads();drawLive(simulation);}
  else if(mode==='move'&&referenceIssue){playing=false;updatePlayLabel();invalidateFrameRequest();drawLive(undefined,f);$('[data-form-status]').textContent=referenceMessage();}
  else{
   if(!live&&loadsReady)drawLive(undefined,f);
   if(loadsReady&&!frameBusy&&(performance.now()-lastLoadRequest>80||!playing)){const requestId=++frameRequestId,moving=mode==='move';pendingFrame={id:requestId,time,moving};frameBusy=true;lastLoadRequest=performance.now();loadWorker.postMessage({type:'frame',token:workerToken,requestId,time,moving});}
  }
 }
 function selectMember(id:string){if(id===selected||!model.nodes.find(n=>n.id===id&&(n.member||isSourceDesign(design))&&n.joint?.active))return;const fromDiagram=document.activeElement?.hasAttribute('data-member');selected=id;if(model.nodes.find(n=>n.id===id)?.member)materialSelected=id;calculate();controls();requestLoads();drawMotion();persistWorkbench();if(fromDiagram)root!.querySelector<SVGElement>(`[data-member="${id}"]`)?.focus({preventScroll:true});}
 function exportScene(){if(!scene||!sceneReady)throw Error('Model geometry is not ready');return scene;}
 function switchTab(group:'panel'|'study',name:string){
  const buttons=root!.querySelectorAll<HTMLButtonElement>(group==='panel'?'[data-panel-tab]':'[data-study-tab]');
  buttons.forEach(b=>{const active=(group==='panel'?b.dataset.panelTab:b.dataset.studyTab)===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  root!.querySelectorAll<HTMLElement>(group==='panel'?'[data-input-panel]':'[data-study-panel]').forEach(p=>p.hidden=(group==='panel'?p.dataset.inputPanel:p.dataset.studyPanel)!==name);
 }
 function updateValue(name:string,value:string,checked=false,sourcePreview=false){const range=root!.querySelector<HTMLInputElement>(`[data-for="${name}"]`);if(range)range.value=value;const old=copyDesign(design),oc={...conditions};let redo=false;
  try{
   if(name==='model-profile'){selectProfile(value as Profile);return;}
   if(name==='member'){selectMember(value);return;}
   if(name==='material-member'){if(!model.nodes.some(n=>n.id===value&&n.member))return;materialSelected=value;if(selected===value){calculate();controls();persistWorkbench();}else selectMember(value);return;}
   if(name.startsWith('source-dimension:')){if(value.trim()==='')throw Error('Empty source dimension');design.sourceDimensions=editSourceDimension(model,name.slice(17),Number(value)/1000);if(design.robot==='arm')delete design.armCircleCenter;redo=!sourcePreview;}
   else if(name==='symmetric'){symmetric=checked;return;}
   else if(name.startsWith('p:')){
    const owner=design.sourceMode==='derived'?materialNode():analysis.member;if(!owner?.member)return;const member=owner.member,part={...design.parts[owner.id]};
    if(name==='p:material'){part.material=value as Material;part.properties=property(value as Material);}
    else if(name==='p:section')part.section=value as ConceptDesign['section'];
    else if(name.startsWith('p:prop:')){const key=name.slice(7) as 'rho'|'E'|'G'|'strength';part.properties={...member.prop,...part.properties,[key]:Number(value)*(key==='E'||key==='G'?1e9:key==='strength'?1e6:1)};}
    else (part as Record<string,unknown>)[name.slice(2)]=Number(value)/1000;
    design.parts[owner.id]=part;redo=true;
   }else if(name==='dof'){
    design.joints={};if(design.robot==='arm'){for(const id of ['j4','j6'])design.joints[id]={active:value!=='4'};}
    else if(design.robot==='quadruped'){for(const p of ['fl','fr','rl','rr']){design.joints[`${p}_roll`]={active:value!=='2'};if(value==='4')design.joints[`${p}_ankle`]={active:true};}}
    else for(const p of ['left','right'])design.joints[`${p}_yaw`]={active:value==='12'};
    redo=true;
   }else if(name.startsWith('circle:')){design.armCircleCenter=[...design.armCircleCenter!];design.armCircleCenter[Number(name.slice(7))]=Number(value)/1000;}else if(name.startsWith('arm:')){const i=Number(name.split(':')[1]);design.armLengths[i]=Number(value)/1000;const id=['j2','j3','j5'][i]!;if(design.parts[id])delete design.parts[id]!.length;}
   else if(name.startsWith('part:')){redo=true;const id=name.slice(5);design.parts[id]={...design.parts[id],length:Number(value)/1000};if(symmetric){const n=model.nodes.find(n=>n.id===id)!;for(const p of model.nodes.filter(p=>p.member&&p.id!==id&&p.id.replace(p.group,'')===id.replace(n.group,'')))design.parts[p.id]={...design.parts[p.id],length:Number(value)/1000};}}
   else if(name.startsWith('gap:')){design.jointDistances={...design.jointDistances,[name.slice(4)]:Number(value)/1000};}
   else if(name.startsWith('prop:')){const key=name.slice(5),v=Number(value)*(key==='E'?1e9:key==='strength'?1e6:1);design.properties={...design.properties,[key]:v};redo=true;}
   else if(name==='c:rootSupport'){conditions.rootSupport=value as DesignConditions['rootSupport'];redo=true;}
   else if(name.startsWith('c:')){const key=name.slice(2) as Exclude<keyof DesignConditions,'rootSupport'>;conditions[key]=Number(value);}
   else if(name.startsWith('d:')){
    const key=name.slice(2);if(key==='material'){design.material=value as Material;design.properties={};for(const p of Object.values(design.parts)){delete p.material;delete p.properties;}redo=true;}
    else if(key==='section'){design.section=value as ConceptDesign['section'];for(const p of Object.values(design.parts))delete p.section;redo=true;}
    else if(key==='armModel'){design.armModel=value as ConceptDesign['armModel'];design.toolMass=0;design.parts={};design.joints={};delete design.armCircleCenter;redo=true;}else if(key==='legModel'){design.legModel=value as ConceptDesign['legModel'];delete design.gaitPeriod;delete design.strideLength;delete design.stepHeight;design.payload=0;design.parts={};design.joints={};design.sourceBeamEquivalent=false;redo=true;}else if(key==='sourceBeamEquivalent'){design.sourceBeamEquivalent=checked;redo=true;}else if(key==='armReference'){design.armReference=value as ConceptDesign['armReference'];delete design.armCircleCenter;redo=true;}else if(key==='armCirclePlane'){design.armCirclePlane=value as ConceptDesign['armCirclePlane'];redo=true;}else if(key==='quadHipPitch'||key==='quadKneeFlexion'){design[key]=(key==='quadKneeFlexion'?180-Number(value):Number(value))*Math.PI/180;}else if(key==='armBeamEquivalent'){design.armBeamEquivalent=checked;redo=true;}else if(key==='remote')design.remote=value==='true';
    else{const factor=['l1','l2','width','height','wall','bodyWidth','bodyLength','allowDeflection','motorRadius','motorLength','strideLength','stepHeight','stanceWidth','armCircleRadius'].includes(key)?.001:key==='rotorInertia'?1e-5:1;(design as unknown as Record<string,unknown>)[key]=Number(value)*factor;for(const [id,p] of Object.entries(design.parts)){if(['width','height','wall'].includes(key))delete p[key as 'width'|'height'|'wall'];if(key==='l1'&&id.endsWith('_pitch')||key==='l2'&&id.endsWith('_knee'))delete p.length;}}
   }
   if(JSON.stringify(design)===JSON.stringify(old)&&JSON.stringify(conditions)===JSON.stringify(oc))return;
   rebuild(false,redo,sourcePreview);
  }catch(error){design=old;conditions=oc;rebuild(false,!sourcePreview,sourcePreview);if(sourcePreview){const parameter=sourceParameterDefinitions(model).find(p=>p.id===name.slice(17));if(parameter){const value=String(parameter.value*1000);if(range)range.value=value;const input=root!.querySelector<HTMLInputElement>(`input[name="${name}"]`);if(input)input.value=String(Number(Number(value).toFixed(6)));}}$('[data-form-status]').textContent=name.startsWith('source-dimension:')?tr('Enter a joint spacing or offset within the shown range. The previous geometry has been restored.','请输入范围内的关节间距或偏置，已恢复修改前的构型。'):error instanceof Error&&/quadruped posture/i.test(error.message)?tr('The design stance exceeds the specified angle or joint limits. Adjust the stance or joint limits.','设计站姿超出角度范围或所设关节限位，请调整站姿或限位。'):error instanceof Error&&error.message.includes('circle')?tr('Check the circle plane, positive radius and three finite centre coordinates.','请检查画圆平面、半径和圆心的三个坐标值。'):error instanceof Error&&error.message.includes('stance width')?tr('The requested stance exceeds the hip or ankle roll range. Reduce the foot spacing or revise the leg geometry.','所设足间距超出髋／踝侧摆可达范围，请调整足间距或腿部尺寸。'):tr('Check the input range, material values and wall thickness.','请检查输入范围、材料数值与壁厚；壁厚需小于截面最小外尺寸的一半。');}
 }
 // Keep the native range element alive while dragging. Only geometry and the
 // current member calculation update during the gesture; the full motion
 // envelope, comparisons and persistence run once after release.
 let sourceRangeEdit:{element:HTMLInputElement;name:string;value:string;robot:RobotType}|undefined;
 let sourceRangePending:ReturnType<typeof setTimeout>|undefined;
 const isSourceRange=(el:EventTarget|null):el is HTMLInputElement&{type:'range'}=>el instanceof HTMLInputElement&&el.type==='range'&&(!!el.dataset.for?.startsWith('source-dimension:')||el.dataset.for==='d:armCircleRadius');
 function previewSourceRange(){
  sourceRangePending=undefined;const edit=sourceRangeEdit;
  if(!edit||!edit.element.isConnected||design.robot!==edit.robot)return;
  updateValue(edit.name,edit.value,false,true);edit.value=edit.element.value;
  if(edit.name.startsWith('source-dimension:'))for(const parameter of sourceParameterDefinitions(model)){
   const name='source-dimension:'+parameter.id,input=root!.querySelector<HTMLInputElement>(`input[name="${name}"]`),range=root!.querySelector<HTMLInputElement>(`[data-for="${name}"]`);
   if(input)input.value=String(Number((parameter.value*1000).toFixed(6)));if(range&&range!==edit.element)range.value=String(parameter.value*1000);
  }
 }
 function commitSourceRange(){
  const edit=sourceRangeEdit;if(!edit)return;
  sourceRangeEdit=undefined;if(sourceRangePending){clearTimeout(sourceRangePending);sourceRangePending=undefined;}
  if(!edit.element.isConnected||design.robot!==edit.robot)return;
  const focused=document.activeElement===edit.element;
  updateValue(edit.name,edit.value,false,true);
  const status=$('[data-form-status]').textContent;
  rebuild(false,true);
  if(status)$('[data-form-status]').textContent=status;
  if(focused)root!.querySelector<HTMLInputElement>(`[data-for="${edit.name}"]`)?.focus({preventScroll:true});
 }
 root.addEventListener('change',event=>{const el=event.target;if(isSourceRange(el)){commitSourceRange();return;}if(!(el instanceof HTMLInputElement||el instanceof HTMLSelectElement)||!el.name)return;updateValue(el.name,el.value,el instanceof HTMLInputElement&&el.checked);});
 root.addEventListener('input',event=>{
  const el=event.target;if(!(el instanceof HTMLInputElement)||!el.dataset.for)return;
  const name=el.dataset.for,target=root!.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  if(isSourceRange(el)){
   target.value=String(Number(Number(el.value).toFixed(6)));
   if(!sourceRangeEdit){if(renderPending){clearTimeout(renderPending);renderPending=undefined;}sourceRangeEdit={element:el,name,value:el.value,robot:design.robot};playing=false;mode='pose';time=0;requestLoads(true);scene?.loads();}
   sourceRangeEdit.value=el.value;
   if(!sourceRangePending)sourceRangePending=setTimeout(previewSourceRange,40);
   return;
  }
  target.value=el.value;if(renderPending)clearTimeout(renderPending);renderPending=setTimeout(()=>updateValue(name,el.value),50);
 });
 root.addEventListener('keydown',event=>{
  const el=event.target;if(!isSourceRange(el)||!['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key))return;
  event.preventDefault();const min=Number(el.min),max=Number(el.max),step=el.dataset.for==='d:armCircleRadius'?(event.shiftKey||event.key.startsWith('Page')?5:1):(event.shiftKey||event.key.startsWith('Page')?1:.1);
  const value=event.key==='Home'?min:event.key==='End'?max:Number((Number(el.value)+(['ArrowLeft','ArrowDown','PageDown'].includes(event.key)?-step:step)).toFixed(6));
  el.value=String(Math.max(min,Math.min(max,value)));el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 root.addEventListener('keyup',event=>{if(isSourceRange(event.target)&&['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key))commitSourceRange();});
 root.addEventListener('focusout',event=>{if(sourceRangeEdit?.element===event.target)commitSourceRange();});
 root.addEventListener('pointercancel',event=>{if(sourceRangeEdit?.element===event.target)commitSourceRange();});
 window.addEventListener('blur',commitSourceRange);
 root.addEventListener('click',async event=>{const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.hasAttribute('data-validate')){if(!loadsReady||referenceIssue||!envelope)return;clearValidation();$<HTMLButtonElement>('[data-validate]').disabled=true;$('[data-validation-status]').textContent=tr('Running torque-limited closed-loop simulation…','正在运行限转矩闭环仿真…');loadWorker.postMessage({type:'validate',token:workerToken});return;}
  if(button.hasAttribute('data-replay')&&validation?.passed){invalidateFrameRequest();mode='simulation';time=0;playing=true;$<HTMLSelectElement>('[data-motion-mode]').value=mode;scene?.envelope(validation.samples.map(s=>s.frame),true);updatePlayLabel();drawMotion();return;}
  if(button.hasAttribute('data-export-validation')&&validation?.passed){const snapshot={design:model.design,source:model.source,motion:motionSettings(model),nodes:model.nodes,home:model.home,mass:model.mass,elasticSectionDefined:hasElasticModel(model.design)&&model.nodes.some(n=>n.member)},hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshot))),modelSha256=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join(''),blob=new Blob([JSON.stringify({schema:'anncatto.simulation-evidence.v1',createdAt:new Date().toISOString(),implementationAsset:import.meta.url,design,model:snapshot,modelSha256,conditions,validation},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lightweight-motion-validation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(button.dataset.panelTab){switchTab('panel',button.dataset.panelTab);return;}
  if(button.dataset.studyTab){switchTab('study',button.dataset.studyTab);return;}
  if(button.hasAttribute('data-clamped-comparison')){conditions.rootSupport='clamped';rebuild(false,true);return;}
  if(button.hasAttribute('data-fix-stiffness')){switchTab('panel','drive');const input=$<HTMLInputElement>('[name="c:outputStiffness"]'),details=input.closest('details');if(details)details.open=true;input.focus({preventScroll:true});return;}
  if(button.hasAttribute('data-derive-material')){selectProfile('derived');switchTab('panel','material');switchTab('study','materials');return;}
  if(button.dataset.materialMode){materialMode=button.dataset.materialMode as MaterialComparisonMode;materialStudy();return;}
  if(button.dataset.openBasis){switchTab('study','basis');const detail=document.getElementById(button.dataset.openBasis) as HTMLDetailsElement;detail.open=true;return;}
  if(button.hasAttribute('data-reset-source-dimensions')){design.sourceDimensions={};if(design.robot==='arm')delete design.armCircleCenter;rebuild(true,true);return;}
  if(button.dataset.applyMaterial){const c=materialCandidates.find(c=>c.material===button.dataset.applyMaterial);if(c){design=copyDesign(c.design);rebuild(false,true);}return;}
  if(button.hasAttribute('data-material-all')){const m=materialNode()?.member;if(!m)return;for(const node of model.nodes.filter(n=>n.member))design.parts[node.id]={...design.parts[node.id],material:m.material,properties:{...m.prop}};rebuild(false,true);return;}
  if(button.dataset.architecture){const robot=button.dataset.architecture as RobotType;selectProfile(profiles.last[robot]??'source',robot);}
  else if(button.hasAttribute('data-reference')){hasReference=true;referenceCacheKey='';referenceDesign=copyDesign(design);referenceConditions={...conditions};calculate();persistWorkbench();}
  else if(button.hasAttribute('data-reset')){const profile=profileOf(design);hasReference=false;referenceCacheKey='';design=profileDefaults(design.robot,profile);liveGroup=design.robot==='biped'?'legs':'all';conditions={...initialConditions};time=0;rebuild(true,true);if(profile==='source')cadPanel.reset();}
  else if(button.hasAttribute('data-play')){invalidateFrameRequest();playing=!playing;if(playing){if(mode==='pose'||time>=duration())time=0;if(mode!=='simulation')mode='move';}$<HTMLSelectElement>('[data-motion-mode]').value=mode;updatePlayLabel();drawMotion();}
  else if(button.dataset.view){diagramView=button.dataset.view as DiagramView;scene?.view(diagramView);drawMotion();for(const b of root!.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));}

  else if(button.hasAttribute('data-import'))$<HTMLInputElement>('[data-file]').click();
 });
 $('[data-live-group]').addEventListener('change',()=>{liveGroup=$<HTMLSelectElement>('[data-live-group]').value;drawMotion();});
 $('[data-load-source]').addEventListener('change',()=>{loadSource=$<HTMLSelectElement>('[data-load-source]').value;results();});
 $('[data-motion-mode]').addEventListener('change',()=>{invalidateFrameRequest();mode=$<HTMLSelectElement>('[data-motion-mode]').value;playing=false;time=0;updatePlayLabel();drawMotion();});
 $('[data-support]').addEventListener('change',drawMotion);
 $('[data-motion-time]').addEventListener('input',()=>{invalidateFrameRequest();playing=false;if(mode!=='simulation')mode='move';$<HTMLSelectElement>('[data-motion-mode]').value=mode;time=Number($<HTMLInputElement>('[data-motion-time]').value)/1000*duration();updatePlayLabel();drawMotion();});
 $('[data-export]').addEventListener('change',async()=>{const select=$<HTMLSelectElement>('[data-export]'),format=select.value;select.value='';if(!format)return;try{let value:string|ArrayBuffer='',mime='text/plain',extension=format.toLowerCase();if(format==='JSON'){value=JSON.stringify({...JSON.parse(exportConceptJSON(model)),motion:motionSettings(model),analysis:loadSource==='cycle'?(envelope&&!referenceIssue?{source:'motion-envelope',...envelope}:null):analysis,manualAnalysis:!hasElasticModel(design)||!analysis.member.member?null:analysis,selectedMember:selected,loadSource,hardwareValidated:false,workbenchConditions:conditions,cadStructure:cadPanel.export(),reference:{design:referenceDesign,conditions:referenceConditions}},null,2);mime='application/json';}else if(format==='URDF')value=exportConceptURDF(model);else if(format==='MJCF'){value=exportMJCF(model);extension='xml';}else if(format==='GLB'){value=await exportScene().exportGLB();mime='model/gltf-binary';}else if(format==='PNG'){const a=document.createElement('a');a.href=scene?exportScene().capture():await diagram.capture();a.download='lightweight-design.png';a.click();return;}const url=URL.createObjectURL(new Blob([value],{type:mime})),a=document.createElement('a');a.href=url;a.download='lightweight-design.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){$('[data-form-status]').textContent=tr('Unable to read or export this model. Check the format and parameter values.','模型读取或导出失败，请检查文件格式与参数值。');}});
 $('[data-file]').addEventListener('change',async()=>{const el=$<HTMLInputElement>('[data-file]'),file=el.files?.[0];if(!file)return;try{const saved=JSON.parse(await file.text());if(saved.schema!=='anncatto.concept.v2')throw Error(tr('Unsupported model format','模型格式不匹配'));const candidate={...copyDesign(initialConcept),...saved.design};const importedConditions={...initialConditions,...saved.workbenchConditions};analyzeDesign(generateRobot(candidate),importedConditions);design=candidate;conditions=importedConditions;referenceDesign=copyDesign(design);referenceConditions={...conditions};hasReference=false;referenceCacheKey='';try{if(saved.reference?.design?.robot===design.robot){const rd=saved.reference.design,rc={...initialConditions,...saved.reference.conditions};analyzeDesign(generateRobot(rd),rc);referenceDesign=rd;referenceConditions=rc;hasReference=true;referenceCacheKey='';}}catch{}time=0;selected=defaultMember(generateRobot(design));rebuild(true,true);cadPanel.restore(saved.cadStructure);}catch(error){$('[data-form-status]').textContent=tr('Unable to read or export this model. Check the format and parameter values.','模型读取或导出失败，请检查文件格式与参数值。');}el.value='';});
 let viewVisible=true;const visibleRegions=new Map<Element,boolean>();const motionVisibility=new IntersectionObserver(entries=>{for(const entry of entries)visibleRegions.set(entry.target,entry.isIntersecting);viewVisible=[...visibleRegions.values()].some(Boolean);});for(const region of ['.design-model','.design-live-panel'])motionVisibility.observe($(region));
 function tick(now:number){const dt=last?Math.min(.25,(now-last)/1000):0;last=now;if(playing&&(mode==='move'||mode==='simulation')&&viewVisible&&!document.hidden){time=Math.min(duration(),time+dt);if(time>=duration()){playing=false;updatePlayLabel();}if(now-lastStatus>35||!playing){lastStatus=now;drawMotion();}}requestAnimationFrame(tick);}
 root.addEventListener('keydown',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('[role=tab]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...button.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]')],i=tabs.indexOf(button),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next]!.click();tabs[next]!.focus();});
 onLanguageChange(()=>{controls();results();explanations();materialStudy();geometryStatusText();drawMotion();});
 try{scene=createDesignViewer($('[data-design-view]'),selectMember);$('[data-design-diagram]').hidden=true;}catch{$('[data-design-view]').hidden=true;$('[data-design-diagram]').hidden=false;}
 rebuild(true,true);requestAnimationFrame(tick);
}
