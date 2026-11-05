/** Concept geometry, mass properties, kinematics and manufacturing share this joint tree. SI units. */
import {materials,sectionProperties,type Material,type SectionType,type RobotType} from './lightweight-mechanics.js';
import {alohaPhysicsData} from './aloha-physics-data.js';
import {alohaDescription} from './aloha-description.js';
import {generateSourceRobot} from './source-robot.js';
import {applySourceParameters} from './design-source-parameters.js';
export type V3=[number,number,number];
export type Q4=[number,number,number,number]; // w, x, y, z
export const add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a:V3,s:number):V3=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=(a:V3)=>Math.hypot(...a);
export const unit=(a:V3):V3=>norm(a)>1e-10?mul(a,1/norm(a)):[0,0,1];
export const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export const qm=(a:Q4,b:Q4):Q4=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
export const qa=(axis:V3,q:number):Q4=>[Math.cos(q/2),...mul(unit(axis),Math.sin(q/2))];
export const rotate=(q:Q4,v:V3):V3=>{const u:V3=[q[1],q[2],q[3]],t=mul(cross(u,v),2);return add(v,add(mul(t,q[0]),cross(u,t)));};
export const inverseQ=(q:Q4):Q4=>[q[0],-q[1],-q[2],-q[3]];
export function alignZ(v:V3):Q4{const n=unit(v);if(n[2]<-.999999)return[0,1,0,0];const q:Q4=[1+n[2],-n[1],n[0],0],s=Math.hypot(...q);return q.map(x=>x/s) as Q4;}
export interface Transform{p:V3;q:Q4}
export const identity=():Transform=>({p:[0,0,0],q:[1,0,0,0]});
export interface Property{rho:number;E:number;G:number;strength:number;nu:number}
export const property=(m:Material):Property=>({...materials[m],nu:m==='abs'?.35:m==='steel'?.3:m==='titanium'?.34:.33});
export type Process='tube'|'cnc'|'cast'|'additive'|'laminate';
export interface PartOverride{section?:SectionType;properties?:Partial<Property>;length?:number;width?:number;height?:number;wall?:number;material?:Material}
export interface JointOverride{active?:boolean;axis?:V3;min?:number;max?:number}
export interface ConceptDesign{
 robot:RobotType;material:Material;section:SectionType;process:Process;
 l1:number;l2:number;armLengths:[number,number,number];width:number;height:number;wall:number;
 bodyLength:number;bodyWidth:number;bodyHeight:number;bodyMass:number;motorMass:number;motorTorque:number;ratio:number;rotorInertia:number;
 toolMass:number;payload:number;tool:'gripper'|'suction'|'hand'|'plate';remote:boolean;
 minWall:number;stockAllowance:number;processYield:number;maxToolReach:number;allowDeflection:number;safety:number;tipForce:number;speed:number;
 properties:Partial<Property>;parts:Record<string,PartOverride>;joints:Record<string,JointOverride>;
 jointDistances?:Record<string,number>;
 motorRadius?:number;motorLength?:number;
 footMass?:number;
 legModel?:'concept'|'go2'|'rp1';sourceBeamEquivalent?:boolean;
 sourceMode?:'original'|'derived';sourceDimensions?:Record<string,number>;
 gaitPeriod?:number;strideLength?:number;stepHeight?:number;groundFriction?:number;outputSpeedLimit?:number;stanceWidth?:number;
 quadHipPitch?:number;quadKneeFlexion?:number;
 armModel?:'concept'|'aloha';armInertia?:'cad-libero'|'urdf';armReference?:'bent'|'extended';armBeamEquivalent?:boolean;armCircleRadius?:number;armCircleCenter?:V3;armCirclePlane?:'xz'|'yz';
}
export const initialConcept:ConceptDesign={robot:'quadruped',material:'aluminium',section:'box',process:'tube',l1:.30,l2:.31,armLengths:[.30,.27,.11],width:.034,height:.045,wall:.002,bodyLength:.46,bodyWidth:.23,bodyHeight:.12,bodyMass:5,motorMass:.45,motorTorque:24,ratio:9,rotorInertia:2.5e-5,toolMass:.45,payload:0,tool:'gripper',remote:false,minWall:.0012,stockAllowance:.003,processYield:.85,maxToolReach:8,allowDeflection:.001,safety:1.5,tipForce:60,speed:.25,properties:{},parts:{},joints:{}};
export function copyDesign(d:ConceptDesign):ConceptDesign{return JSON.parse(JSON.stringify(d));}
export const isSourceDesign=(d:ConceptDesign)=>d.armModel==='aloha'||d.legModel==='go2'||d.legModel==='rp1';
export const hasElasticModel=(d:ConceptDesign)=>d.sourceMode==='derived'||!isSourceDesign(d)||(d.robot==='arm'&&d.armModel==='aloha'&&!!d.armBeamEquivalent);
export function validateConcept(d:ConceptDesign){
 if(d.sourceMode!==undefined&&!['original','derived'].includes(d.sourceMode))throw Error('Invalid source model mode');
 if(d.sourceMode==='derived'&&!isSourceDesign(d))throw Error('A derived model requires a source reference');
 if(d.sourceDimensions!==undefined&&(!d.sourceDimensions||Array.isArray(d.sourceDimensions)||typeof d.sourceDimensions!=='object'||Object.values(d.sourceDimensions).some(v=>!Number.isFinite(v))))throw Error('Invalid source dimensions');
 if(!['quadruped','biped','arm'].includes(d.robot)||!(d.material in materials))throw Error('Invalid architecture or material');
 for(const key of ['l1','l2','width','height','wall','bodyLength','bodyWidth','bodyHeight','bodyMass','motorMass','motorTorque','ratio','rotorInertia','minWall','allowDeflection','safety'] as const)if(!Number.isFinite(d[key])||d[key]<=0)throw Error(`Invalid ${key}`);
 if(!['tube','box','solid'].includes(d.section)||!['tube','cnc','cast','additive','laminate'].includes(d.process))throw Error('Invalid section or process');
 for(const key of ['toolMass','payload','tipForce','speed','stockAllowance','processYield','maxToolReach'] as const)if(!Number.isFinite(d[key])||d[key]<0)throw Error(`Invalid ${key}`);
 for(const L of d.armLengths)if(L<.045||L>2||!Number.isFinite(L))throw Error('Invalid arm length');
 if(d.l1<.08||d.l2<.08||d.l1>1.5||d.l2>1.5)throw Error('Invalid link length');
 for(const [value,min,max] of [[d.gaitPeriod,1.5,10],[d.strideLength,.01,.4],[d.stepHeight,.002,.15],[d.groundFriction,.05,2],[d.outputSpeedLimit,.05,50],[d.stanceWidth,.10,.60]])if(value!==undefined&&(!Number.isFinite(value)||value<min!||value>max!))throw Error('Invalid motion parameter');
 for(const [value,min,max] of [[d.quadHipPitch,0,80*Math.PI/180],[d.quadKneeFlexion,20*Math.PI/180,130*Math.PI/180]])if(value!==undefined&&(!Number.isFinite(value)||value<min!||value>max!))throw Error('Invalid quadruped posture');
 if(d.armInertia!==undefined&&!['cad-libero','urdf'].includes(d.armInertia))throw Error('Invalid arm inertia source');
 if(d.armCirclePlane!==undefined&&!['xz','yz'].includes(d.armCirclePlane))throw Error('Invalid circle plane');
 if(d.armCircleRadius!==undefined&&(!Number.isFinite(d.armCircleRadius)||d.armCircleRadius<.005||d.armCircleRadius>.15))throw Error('Invalid circle radius');
 if(d.armCircleCenter!==undefined&&(!Array.isArray(d.armCircleCenter)||d.armCircleCenter.length!==3||!d.armCircleCenter.every(Number.isFinite)))throw Error('Invalid circle centre');
 for(const value of [d.motorRadius,d.motorLength,d.footMass])if(value!==undefined&&(!Number.isFinite(value)||value<=0))throw Error('Invalid component specification');
 // Derived members have per-source reference sections. Their complete merged
 // dimensions are checked when the member is constructed, not against d.
 for(const p of d.sourceMode==='derived'?[d]:[d,...Object.values(d.parts).map(p=>({...d,...p}))])if(p.section!=='solid'&&2*p.wall>=(p.section==='tube'?p.height:Math.min(p.width,p.height)))throw Error('Invalid wall thickness');
 if(d.processYield<=0||d.processYield>1||d.maxToolReach<=0)throw Error('Invalid process parameters');
 for(const part of [{},...Object.values(d.parts)]){const mat=part.material??(d.sourceMode==='derived'&&d.armModel==='aloha'?'abs':d.material);if(!(mat in materials))throw Error('Invalid part material');const p=d.sourceMode==='derived'?{...property(mat),...part.properties}:{...property(mat),...d.properties,...part.properties};if(![p.rho,p.E,p.G,p.strength,p.nu].every(Number.isFinite)||p.rho<=0||p.E<=0||p.G<=0||p.strength<=0||p.nu<=-1||p.nu>=.5)throw Error('Invalid material properties');if(d.sourceMode==='derived'&&part.length!==undefined)throw Error('Derived member length must be set with sourceDimensions');for(const key of ['length','width','height','wall'] as const)if(part[key]!==undefined&&(!Number.isFinite(part[key])||part[key]!<=0))throw Error('Invalid part dimension');}
 for(const j of Object.values(d.joints)){if(j.axis&&(!j.axis.every(Number.isFinite)||norm(j.axis)<1e-8))throw Error('Invalid joint axis');if(j.min!==undefined&&!Number.isFinite(j.min)||j.max!==undefined&&!Number.isFinite(j.max)||j.min!==undefined&&j.max!==undefined&&j.min>=j.max)throw Error('Invalid joint limits');}
}
export interface Joint{id:string;label:[string,string];group:string;axis:V3;min:number;max:number;home:number;active:boolean;kind:'hinge'|'slide';motorScale:number;effortLimit?:number;velocityLimit?:number;sourceName?:string;damping?:number;rotorInertia?:number;armature?:number;frictionLoss?:number}
export interface Component{role:'body'|'member'|'motor'|'collar'|'foot'|'tool'|'payload'|'belt';shape:'box'|'cylinder'|'sphere'|'member'|'belt'|'mesh';p:V3;q:Q4;size:V3;mass:number;material:Material;collision:boolean;inertia?:[number,number,number,number,number,number];span?:V3;section?:{section:SectionType;width:number;height:number;wall:number};label?:string;mesh?:string;visible?:boolean;exportVisual?:boolean;meshFile?:string;sourceMesh?:string;meshScale?:V3}
export interface Node{id:string;parent:string|null;offset:V3;originQ?:Q4;sourceName?:string;sourceJointName?:string;joint?:Joint;components:Component[];label:[string,string];group:string;contactPoints?:V3[];member?:{vector:V3;length:number;cutLength:number;material:Material;section:SectionType;width:number;height:number;wall:number;prop:Property;sectionQ?:Q4;inertialComponents?:Component[]};tip?:'foot'|'tool';mass:number;com:V3;inertia:[number,number,number,number,number,number]}
export interface ModelSource{id:string;name:string;commit:string;meshAsset:string;urdfAsset:string;collisionAssets:{vfsPath:string;path:string}[];license:string;modelAssumptions:string[];parameterization?:{kind:'fixed-link-mass-affine-v1'|'source-members-v1';dimensions:Record<string,number>;collision:'joint-envelopes-native-feet';members?:{nodeId:string;childId:string;referenceMaterial:Material;referenceMass:number;currentMass:number;residualMass:number;referenceSection:{section:SectionType;width:number;height:number;wall:number};referenceLength:number}[]}}
export interface RobotModel{design:ConceptDesign;nodes:Node[];active:Joint[];home:Record<string,number>;height:number;tips:string[];mass:number;fingerprint:string;source?:ModelSource;physicalSource?:{id:string;sha256:string;classification:string;assumptions:string[]}}
const Z:V3=[0,0,1],Y:V3=[0,1,0],X:V3=[1,0,0];
function cylinder(p:V3,axis:V3,r:number,length:number,mass:number,role:Component['role']='motor'):Component{return{role,shape:'cylinder',p,q:alignZ(axis),size:[r,length,0],mass,material:'aluminium',collision:false};}
function box(p:V3,size:V3,mass:number,role:Component['role']='body'):Component{return{role,shape:'box',p,q:[1,0,0,0],size,mass,material:'aluminium',collision:true};}
function sphere(p:V3,r:number,mass:number):Component{return{role:'foot',shape:'sphere',p,q:[1,0,0,0],size:[r,r,r],mass,material:'steel',collision:true};}
function connector(p:V3,v:V3,r=.013):Component{const L=norm(v);return{role:'collar',shape:'cylinder',p:add(p,mul(v,.5)),q:alignZ(v),size:[r,L,0],mass:Math.PI*r*r*L*2700,material:'aluminium',collision:false};}
export function massProperties(components:Component[]){
 const mass=components.reduce((a,c)=>a+c.mass,0),com=mul(components.reduce((a,c)=>add(a,mul(c.p,c.mass)),[0,0,0] as V3),1/mass),I=[[0,0,0],[0,0,0],[0,0,0]];
 for(const c of components){let diag:V3;
  if(c.shape==='cylinder')diag=[c.mass*(3*c.size[0]**2+c.size[1]**2)/12,c.mass*(3*c.size[0]**2+c.size[1]**2)/12,c.mass*c.size[0]**2/2];
  else if(c.shape==='sphere')diag=[1,1,1].map(()=>.4*c.mass*c.size[0]**2) as V3;
  else if(c.shape==='member'&&c.section){const s=sectionProperties(c.section),L=c.size[2],b=c.section.section==='tube'?c.section.height:c.section.width,h=c.section.height,t=c.section.wall;
   const Iz=c.section.section==='tube'?s.I:(h*b**3-(c.section.section==='solid'?0:(h-2*t)*(b-2*t)**3))/12;
   diag=[c.mass*(L*L/12+s.I/s.area),c.mass*(L*L/12+Iz/s.area),c.mass*(s.I+Iz)/s.area];
  }else diag=[c.mass*(c.size[1]**2+c.size[2]**2)/12,c.mass*(c.size[0]**2+c.size[2]**2)/12,c.mass*(c.size[0]**2+c.size[1]**2)/12];
  // Explicit central tensors are expressed in the component frame at p.
  // They preserve arbitrary source remainder inertia without inventing a box.
  const local=c.inertia?[[c.inertia[0],c.inertia[3],c.inertia[4]],[c.inertia[3],c.inertia[1],c.inertia[5]],[c.inertia[4],c.inertia[5],c.inertia[2]]]:[[diag[0],0,0],[0,diag[1],0],[0,0,diag[2]]],basis=[rotate(c.q,X),rotate(c.q,Y),rotate(c.q,Z)],r=sub(c.p,com);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)I[i]![j]!+=local.reduce((s,row,k)=>s+row.reduce((v,x,l)=>v+x*basis[k]![i]!*basis[l]![j]!,0),0)+c.mass*((i===j?dot(r,r):0)-r[i]!*r[j]!);
 }
 return{mass,com,inertia:[I[0]![0]!,I[1]![1]!,I[2]![2]!,I[0]![1]!,I[0]![2]!,I[1]![2]!] as Node['inertia']};
}
export function generateRobot(d:ConceptDesign):RobotModel{
 validateConcept(d);if(d.robot==='arm'&&d.armModel==='aloha')return applySourceParameters(generateAloha(d));if(d.robot!=='arm'&&(d.legModel==='go2'||d.legModel==='rp1'))return applySourceParameters(generateSourceRobot(d));const nodes:Node[]=[],home:Record<string,number>={},tips:string[]=[];const material=d.material;
 const create=(id:string,parent:Node|null,offset:V3,label:[string,string],group:string,joint?:Omit<Joint,'id'|'group'|'active'>)=>{
  const distance=d.jointDistances?.[id];if(distance!==undefined){if(!Number.isFinite(distance)||distance<.045||distance>1)throw Error('Invalid joint spacing');offset=mul(unit(offset),distance);}
  let j:Joint|undefined;if(joint){const o=d.joints[id]||{};j={...joint,...o,id,group,active:o.active??true};j.axis=unit(j.axis);if(j.min>=j.max)throw Error('Invalid joint travel');j.home=clamp(j.home,j.min,j.max);home[id]=j.home;}
  if(parent&&norm(offset)>.008&&!parent.member)parent.components.push(connector([0,0,0],offset));
  const n:Node={id,parent:parent?.id||null,offset,joint:j,components:[],label,group,mass:0,com:[0,0,0],inertia:[1,1,1,0,0,0]};nodes.push(n);return n;
 };
 const root=create('base',null,[0,0,0],['Base','机身'],'base');
 root.components.push(box([0,0,d.robot==='arm'?.055:d.robot==='biped'?.03:0],d.robot==='arm'?[.22,.22,.11]:[d.bodyLength,d.bodyWidth,d.bodyHeight],d.robot==='biped'?d.bodyMass*.35:d.bodyMass));
 const hinge=(id:string,parent:Node,offset:V3,axis:V3,label:[string,string],group:string,q=0,min=-1.3,max=1.3,motorScale=1)=>{
  const n=create(id,parent,offset,label,group,{label,axis,min,max,home:q,kind:'hinge',motorScale});
  const on=n.joint!.active,ms=d.motorMass*motorScale,r=(d.motorRadius??.033)*Math.cbrt(motorScale),depth=(d.motorLength??.045)*Math.cbrt(motorScale),mirror=Math.abs(axis[1])>.9&&/^(fr|rr|right)/.test(group)?-1:1,side=mul(axis,depth*.52*mirror);
  parent.components.push(cylinder(add(n.offset,side),axis,r,depth,on?ms*.85:ms*.15));n.components.push(cylinder([0,0,0],axis,r*.76,.012,on?ms*.15:ms*.08,'collar'));
  return n;
 };
 const member=(n:Node,v:V3)=>{
  const o=d.parts[n.id]||{},L=o.length??norm(v),vec=mul(unit(v),L),mat=o.material??material,p={...property(mat),...(mat===material?d.properties:{}),...o.properties};
  const section={section:o.section??d.section,width:o.width??d.width,height:o.height??d.height,wall:o.wall??d.wall};const s=sectionProperties(section),end=Math.max(.041,(d.motorRadius??.033)*Math.cbrt(1.3)+.005),cutLength=Math.max(.01,L-2*end);
  n.member={vector:vec,length:L,cutLength,material:mat,...section,prop:p};
  n.components.push({role:'member',shape:'member',p:mul(vec,.5),q:alignZ(vec),size:[section.width,section.height,cutLength],mass:p.rho*s.area*cutLength,material:mat,section,span:vec,collision:true});
  n.components.push(connector([0,0,0],mul(unit(vec),end+.008),.019));n.components.push(connector(mul(unit(vec),L-end-.008),mul(unit(vec),end+.008),.019));
  return vec;
 };
 const remote=(n:Node,child:Node)=>{
  if(!d.remote||!n.member||child.joint?.kind!=='hinge'||!child.joint.active)return;
  const target=n.components.filter(c=>c.role==='motor').sort((a,b)=>norm(sub(a.p,child.offset))-norm(sub(b.p,child.offset)))[0];
  const side=/^(fr|rr|right)/.test(n.group)?-1:1,near=mul(unit(n.member.vector),Math.min(Math.max(.12,(d.motorRadius??.033)*2+.02),n.member.length*.45)),plane=(d.robot==='biped'?-side:side)*(n.member.width/2+(target?.size[1]??.045)/2+.0355),span=sub(n.member.vector,near),L=norm(span),r=.027;
  if(target)target.p=add(near,[0,plane,0]);
  n.components.push({role:'belt',shape:'belt',p:add(add(near,mul(span,.5)),[0,plane,0]),q:alignZ(mul(span,-1)),size:[r,.008,L],mass:(2*L+2*Math.PI*r)*.065,material:'steel',collision:false});
  for(const pos of [near,n.member.vector]){n.components.push(cylinder(add(pos,[0,plane,0]),Y,r,.012,.022,'collar'));n.components.push(cylinder(add(pos,[0,plane/2,0]),Y,.008,Math.abs(plane),.012,'collar'));}
 };
 if(d.robot!=='arm'){
  if(d.payload>0&&d.robot==='quadruped')root.components.push(box([0,0,d.bodyHeight/2+.045],[.12,.12,.09],d.payload,'payload'));
  const legs=d.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'];
  for(const [i,prefix] of legs.entries()){
   const side=i%2===0?1:-1,x=d.robot==='quadruped'?(i<2?d.bodyLength*.38:-d.bodyLength*.38):0,group=prefix,hipY=side*(d.bodyWidth*.5+(d.motorRadius??.033)+.01);
   let p=root;
   if(d.joints[`${prefix}_yaw`]?.active??d.robot==='biped')p=hinge(`${prefix}_yaw`,p,[x,hipY,0],Z,['Hip yaw','髋偏航'],group,0,-.8,.8);
   const roll=hinge(`${prefix}_roll`,p,p===root?[x,hipY,0]:[0,0,-.065],X,['Hip roll','髋侧摆'],group,0,-.7,.7);
   // With +X forward and +Y pitch axes, rear-folding quadruped knees use
   // positive hip pitch and negative knee pitch. Humanoid knees bend forward.
   const quadruped=d.robot==='quadruped',bend=quadruped?-1:1;
   const hipHome=quadruped?(d.quadHipPitch??.48):-.48,kneeHome=quadruped?-(d.quadKneeFlexion??.96):.96;
   const upper=hinge(`${prefix}_pitch`,roll,[0,side*.065,0],Y,['Hip pitch','髋俯仰'],group,hipHome,quadruped?-1.1:-1.6,quadruped?1.6:1.1);
   const v=member(upper,[0,0,-d.l1]);const knee=hinge(`${prefix}_knee`,upper,v,Y,['Knee','膝关节'],group,kneeHome,quadruped?-2.4:-.1,quadruped?.1:2.4);
   if(quadruped&&((d.quadHipPitch!==undefined&&upper.joint!.home!==hipHome)||(d.quadKneeFlexion!==undefined&&knee.joint!.home!==kneeHome)))throw Error(`Requested quadruped posture exceeds ${prefix} joint limits`);
   const lower=member(knee,[0,0,-d.l2]);remote(upper,knee);
   let ankle:Node;
   if(d.robot==='biped'||d.joints[`${prefix}_ankle`]?.active){ankle=hinge(`${prefix}_ankle`,knee,lower,Y,['Ankle pitch','踝俯仰'],group,quadruped?-upper.joint!.home-knee.joint!.home:-bend*.48,-1,1,.7);
    if(d.robot==='biped'){ankle=hinge(`${prefix}_ankle_roll`,ankle,[0,0,-.095],X,['Ankle roll','踝侧摆'],group,0,-.55,.55,.6);ankle.components.push(box([.025,0,-.025],[.18,.085,.05],d.footMass??.25,'foot'));}
    else ankle.components.push(sphere([0,0,-.07],.025,d.footMass??.08));
   }else{ankle=create(`${prefix}_foot`,knee,lower,['Foot','足端'],group);ankle.components.push(sphere([0,0,0],.027,d.footMass??.08));}
   ankle.tip='foot';tips.push(ankle.id);
  }
  if(d.robot==='biped'){
   const waist=hinge('waist',root,[0,0,d.bodyHeight/2+.04],Z,['Waist yaw','腰偏航'],'torso',0,-.8,.8);
   const torso=create('torso',waist,[0,0,.19],['Torso','躯干'],'torso');torso.components.push(box([0,0,0],[.19,d.bodyWidth*.94,.26],d.bodyMass*.65));if(d.payload>0)torso.components.push(box([-.17,0,0],[.12,.12,.09],d.payload,'payload'));
   const neck=hinge('neck_yaw',torso,[0,0,.19],Z,['Neck yaw','颈偏航'],'torso',0,-1,1,.25),head=hinge('neck_pitch',neck,[.055,0,.045],Y,['Neck pitch','颈俯仰'],'torso',0,-.6,.6,.25);head.components.push(box([0,0,.045],[.09,.10,.09],.3));
   for(const [side,prefix] of [[1,'left_arm'],[-1,'right_arm']] as const){
    const shoulder=hinge(`${prefix}_pitch`,torso,[0,side*(d.bodyWidth*.5+.09),.08],Y,['Shoulder pitch','肩俯仰'],prefix,.12,-2.4,2.4,.55);
    const roll=hinge(`${prefix}_roll`,shoulder,[0,side*.075,0],X,['Shoulder roll','肩侧摆'],prefix,side*.16,-1.5,1.5,.5);
    const yaw=hinge(`${prefix}_yaw`,roll,[0,0,-.085],Z,['Shoulder yaw','肩偏航'],prefix,0,-1.5,1.5,.4);
    const v=member(yaw,[0,0,-d.l1*.7]),elbow=hinge(`${prefix}_elbow`,yaw,v,Y,['Elbow','肘关节'],prefix,-.35,-2.3,.2,.35);const vv=member(elbow,[0,0,-d.l2*.65]);
    const hand=create(`${prefix}_hand`,elbow,vv,['Hand','手部'],prefix);hand.components.push(box([0,0,-.025],[.045,.035,.065],.16,'tool'));
   }
  }
 }else{
  const j1=hinge('j1',root,[0,0,.13],Z,['J1 · base','J1 · 基座'],'arm',0,-Math.PI,Math.PI,1.3);
  const j2=hinge('j2',j1,[0,0,.085],Y,['J2 · shoulder','J2 · 肩'],'arm',-.65,-1.8,1.8,1.2);
  const a=member(j2,[0,0,d.armLengths[0]]);const j3=hinge('j3',j2,a,Y,['J3 · elbow','J3 · 肘'],'arm',1.35,-2.4,2.4,1);
  const b=member(j3,[0,0,d.armLengths[1]]);remote(j2,j3);const j4=hinge('j4',j3,b,Z,['J4 · forearm roll','J4 · 前臂滚转'],'arm',0,-Math.PI,Math.PI,.6);
  const j5=hinge('j5',j4,[0,0,.065],Y,['J5 · wrist pitch','J5 · 腕俯仰'],'arm',.7,-1.8,1.8,.4);
  const w=member(j5,[0,0,d.armLengths[2]]);const j6=hinge('j6',j5,w,Z,['J6 · tool roll','J6 · 工具滚转'],'arm',0,-Math.PI,Math.PI,.35);
  const tool=create('tool',j6,[0,0,.04],['Tool flange','工具法兰'],'tool');tool.components.push(cylinder([0,0,.018],Z,.036,.036,d.toolMass*.30,'tool'));tool.components.push(box([0,0,.042],[.11,.04,.026],d.toolMass*.35,'tool'));
  const finger=create('gripper',tool,[0,0,.035],['Gripper opening','夹爪开合'],'tool',{label:['Gripper opening','夹爪开合'],axis:X,min:.005,max:.045,home:.025,kind:'slide',motorScale:.15});
  finger.components.push(box([0,0,.035],[.014,.025,.07],Math.max(.005,d.toolMass*.175),'tool'));
  const other=create('gripper_mirror',tool,[0,0,.035],['Opposed finger','对指'],'tool');other.components.push(box([0,0,.035],[.014,.025,.07],Math.max(.005,d.toolMass*.175),'tool'));
  const payload=create('payload',tool,[0,0,.115],['Payload','工件'],'tool');if(d.payload>0)payload.components.push(box([0,0,0],[.035,.035,.045],d.payload,'payload'));else payload.components.push(box([0,0,0],[.001,.001,.001],.000001,'payload'));
  tool.tip='tool';tips.push(tool.id);
 }
 if(d.robot==='biped'){
  // Stance is a foot-centre distance, independent of hip spacing. Solve the
  // actual chain so changes to link length or joint offsets retain that width.
  const skeleton={nodes,height:0},width=d.stanceWidth??.26;
  for(const [prefix,side] of [['left',1],['right',-1]] as const){
   const roll=nodes.find(n=>n.id===`${prefix}_roll`)!.joint!,ankle=nodes.find(n=>n.id===`${prefix}_ankle_roll`)!.joint!,tip=nodes.find(n=>n.group===prefix&&n.tip==='foot')!,foot=tip.components.find(c=>c.role==='foot')!;
   const position=(angle:number)=>{roll.home=home[roll.id]=angle;ankle.home=home[ankle.id]=-angle;const pose=fk(skeleton,home)[tip.id]!;return add(pose.p,rotate(pose.q,foot.p))[1];};
   let lo=Math.max(roll.min,-ankle.max),hi=Math.min(roll.max,-ankle.min);const target=side*width/2,a=position(lo),b=position(hi);
   if(lo>hi||target<Math.min(a,b)-1e-9||target>Math.max(a,b)+1e-9)throw Error('Requested stance width exceeds hip/ankle roll limits');
   for(let i=0;i<48;i++){const mid=(lo+hi)/2,value=position(mid);if((value<target)===(a<b))lo=mid;else hi=mid;}
   position((lo+hi)/2);
  }
 }
 for(const n of nodes){if(!n.components.length)n.components.push(cylinder([0,0,0],Z,.009,.012,.006,'collar'));Object.assign(n,massProperties(n.components));}
 const active=nodes.flatMap(n=>n.joint?.active?[n.joint]:[]),m={design:copyDesign(d),nodes,active,home,height:0,tips,mass:nodes.reduce((a,n)=>a+n.mass,0),fingerprint:''};
 if(d.robot!=='arm'){const f=fk(m,home);const low=Math.min(...nodes.flatMap(n=>n.components.filter(c=>c.role==='foot').map(c=>{const pose=f[n.id]!,q=qm(pose.q,c.q),centre=pose.p[2]+rotate(pose.q,c.p)[2],extent=c.shape==='sphere'?c.size[0]:Math.abs(rotate(q,X)[2])*c.size[0]/2+Math.abs(rotate(q,Y)[2])*c.size[1]/2+Math.abs(rotate(q,Z)[2])*c.size[2]/2;return centre-extent;})));m.height=-low+.001;}
 const key=JSON.stringify([d,nodes]);let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);m.fingerprint=(hash>>>0).toString(16);return m;
}
export function fk(model:Pick<RobotModel,'nodes'|'height'>,q:Record<string,number>,base?:Transform){
 const result:Record<string,Transform>={};for(const n of model.nodes){const p=n.parent?result[n.parent]!:base??{p:[0,0,model.height],q:[1,0,0,0] as Q4};let position=add(p.p,rotate(p.q,n.offset)),rotation=qm(p.q,n.originQ??[1,0,0,0]);
  const joint=n.joint,value=joint?.active?q[n.id]??joint.home:joint?.home??0;if(joint){if(joint.kind==='slide')position=add(position,rotate(rotation,mul(joint.axis,value)));else rotation=qm(rotation,qa(joint.axis,value));}
  if(n.id==='gripper_mirror'){const gripper=model.nodes.find(n=>n.id==='gripper')!.joint!;position=add(position,rotate(p.q,[-(gripper.active?q.gripper??gripper.home:gripper.home),0,0]));}result[n.id]={p:position,q:rotation};
 }return result;
}
export function inverseArm(model:RobotModel,q0:Record<string,number>,target:V3,targetQ?:Q4){
 const q={...q0},tip=model.tips[0]!,ancestors=new Set<string>();let node=model.nodes.find(n=>n.id===tip);while(node){ancestors.add(node.id);node=model.nodes.find(n=>n.id===node!.parent);}const joints=model.nodes.filter(n=>ancestors.has(n.id)&&n.joint?.active&&n.joint.kind==='hinge');let residual=Infinity;
 for(let it=0;it<240;it++){const poses=fk(model,q),end=poses[tip]!,e=sub(target,end.p),qr=targetQ?qm(targetQ,inverseQ(end.q)):[1,0,0,0] as Q4,orient:V3=targetQ?mul([qr[1],qr[2],qr[3]],2*(qr[0]<0?-1:1)):[0,0,0];residual=norm(e);if(residual<1e-9&&norm(orient)<1e-8)break;
  const cols=joints.map(n=>{const pose=poses[n.id]!,axis=rotate(pose.q,n.joint!.axis),v=cross(axis,sub(end.p,pose.p));return [...v,...mul(axis,targetQ?.18:0)];});
  const err=[...e,...mul(orient,.18)],A=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>cols.reduce((s,c)=>s+c[i]!*c[j]!,i===j?1e-6:0)));
  const solve=linearSolve(A,err);joints.forEach((n,j)=>{const v=cols[j]!.reduce((s,c,k)=>s+c*solve[k]!,0);q[n.id]=clamp((q[n.id]??0)+clamp(v,-.16,.16),n.joint!.min,n.joint!.max);});
 }
 const end=fk(model,q)[tip]!,error=norm(sub(target,end.p)),orientation=targetQ?qm(targetQ,inverseQ(end.q)):[1,0,0,0] as Q4;
 return{q,error,converged:error<1e-9&&2*Math.hypot(orientation[1],orientation[2],orientation[3])<1e-8};
}
const rpyQuaternion=(r:readonly number[]):Q4=>qm(qm(qa([0,0,1],r[2]!),qa([0,1,0],r[1]!)),qa([1,0,0],r[0]!));
function generateAloha(d:ConceptDesign):RobotModel{
 const names:Record<string,string>={left_Base:'base',left_Rotation_Pitch:'j1',left_Upper_Arm:'j2',left_Lower_Arm:'j3',left_Wrist_Pitch_Roll:'j4',left_wrist_yaw:'j5',left_Fixed_Jaw:'j6',left_Moving_Jaw:'gripper',left_camera:'camera',left_tcp:'tool'},nodes:Node[]=[],home:Record<string,number>={};
 const reference=d.armReference==='extended'?[0,-1.571,1.571,0,0,0]:[-.35,-1.2,1.8,-.25,.4,-.6];
 for(const source of alohaDescription){
  const s=source as unknown as {name:string;parent:string|null;offset:V3;rpy:V3;kind:string;joint?:string;axis?:V3;limits?:{lower:number;upper:number;effort:number;velocity:number};mass:number;com:V3;inertia:Node['inertia'];visual?:{origin:V3;rpy:V3;min:V3;max:V3;mesh:string}},id=names[s.name]!,group=id==='gripper'?'tool':id==='base'?'base':'arm',index=Number(id.slice(1))-1,label:[string,string]=id==='gripper'?['Gripper','夹爪']:id[0]==='j'?[`J${index+1}`,['J1 · 肩偏航','J2 · 肩俯仰','J3 · 肘','J4 · 腕俯仰','J5 · 腕偏航','J6 · 腕滚转'][index]!]:[s.name,s.name];
  const n:Node={id,sourceName:s.name,parent:s.parent?names[s.parent]!:null,offset:[...s.offset],originQ:rpyQuaternion(s.rpy),components:[],label,group,mass:s.mass,com:[...s.com],inertia:[...s.inertia]};
  if(d.armInertia!=='urdf'){const physical=alohaPhysicsData.links.find(link=>link.name===s.name)!;n.mass=physical.mass;n.com=[...physical.com] as V3;n.inertia=[...physical.inertia] as Node['inertia'];}
  if(s.kind==='revolute'){const limits=s.limits!;n.joint={id,label,group,sourceName:s.joint,axis:[...s.axis!],min:limits.lower,max:limits.upper,home:id==='gripper'?0:reference[index]!,active:d.joints[id]?.active??true,kind:'hinge',motorScale:1,effortLimit:limits.effort,velocityLimit:limits.velocity};home[id]=n.joint.home;if(d.armInertia!=='urdf'){const armature=alohaPhysicsData.jointArmature.find(j=>j.name===s.joint);if(armature)n.joint.armature=armature.value;}}
  if(s.visual)n.components.push({role:['j2','j3','j5'].includes(id)?'member':id==='gripper'||id==='j6'?'tool':'body',shape:'mesh',mesh:s.visual.mesh,p:[...s.visual.origin],q:rpyQuaternion(s.visual.rpy),size:sub(s.visual.max,s.visual.min),mass:n.mass,material:'aluminium',collision:false});
  if(id==='tool')n.tip='tool';nodes.push(n);
 }
 for(const id of ['j2','j3','j5']){const n=nodes.find(n=>n.id===id)!,child=nodes.find(c=>c.parent===id&&c.joint)!,part=d.parts[id]??{},vector=child.offset,length=norm(vector),mat=part.material??d.material;n.member={vector:[...vector],length,cutLength:length*.8,section:part.section??d.section,width:part.width??d.width,height:part.height??d.height,wall:part.wall??d.wall,material:mat,prop:{...property(mat),...part.properties}};}
 for(const [id,mass,role] of [['payload',d.payload,'payload'],['extra_tool',d.toolMass,'tool']] as const)if(mass>0){const c=box([0,0,0],[.025,.025,.035],mass,role);nodes.push({id,parent:'tool',offset:[0,0,.02],label:[id,id],group:'tool',components:[c],...massProperties([c])});}
 const key=JSON.stringify([d,nodes]);let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
 return{design:copyDesign(d),nodes,home,active:nodes.flatMap(n=>n.joint?.active?[n.joint]:[]),height:0,tips:['tool'],mass:nodes.reduce((s,n)=>s+n.mass,0),fingerprint:(hash>>>0).toString(16),...(d.armInertia!=='urdf'?{physicalSource:{id:'alohamini-libero-cad',sha256:alohaPhysicsData.bundleSha256,classification:alohaPhysicsData.classification,assumptions:['CAD nominal mass, COM and full tensors from the LIBERO inertia bundle; camera mass is included once in the fixed jaw.', 'Shoulder-yaw armature uses the source bearing-inertia upper bound; motor rotor and transmission inertia are not identified.', 'The LIBERO contact assets and task controller are separate from this workbench controller.']}}:{})};
}
export function linearSolve(A:number[][],b:number[]){const m=A.map((r,i)=>[...r,b[i]!]),n=b.length;for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j]![i]!)>Math.abs(m[p]![i]!))p=j;[m[i],m[p]]=[m[p]!,m[i]!];const s=m[i]![i]!;if(Math.abs(s)<1e-14)throw Error('Singular system');for(let k=i;k<=n;k++)m[i]![k]!/=s;for(let j=0;j<n;j++)if(j!==i){const f=m[j]![i]!;for(let k=i;k<=n;k++)m[j]![k]!-=f*m[i]![k]!;}}return m.map(r=>r[n]!);}
export function subtree(model:RobotModel,id:string){const ids=new Set([id]);for(const n of model.nodes)if(n.parent&&ids.has(n.parent))ids.add(n.id);return model.nodes.filter(n=>ids.has(n.id));}
/** Rigid-body inertia about a world axis, including each body's COM tensor. */
export function inertiaAbout(nodes:Node[],poses:Record<string,Transform>,origin:V3,axis:V3){
 const a=unit(axis);return nodes.reduce((sum,n)=>{const pose=poses[n.id]!,local=rotate(inverseQ(pose.q),a),r=sub(add(pose.p,rotate(pose.q,n.com)),origin),I=n.inertia;
  const central=I[0]*local[0]**2+I[1]*local[1]**2+I[2]*local[2]**2+2*(I[3]*local[0]*local[1]+I[4]*local[0]*local[2]+I[5]*local[1]*local[2]);
  return sum+central+n.mass*(dot(r,r)-dot(r,a)**2);
 },0);
}
export function jointInertia(model:RobotModel,id:string,q=model.home){const node=model.nodes.find(n=>n.id===id);if(!node?.joint)throw Error('Unknown joint');const poses=fk(model,q),pose=poses[id]!;return inertiaAbout(subtree(model,id),poses,pose.p,rotate(pose.q,node.joint.axis));}
export function evaluateConcept(model:RobotModel,q=model.home,partId?:string){
 const d=model.design,poses=fk(model,q),com=mul(model.nodes.reduce((s,n)=>add(s,mul(add(poses[n.id]!.p,rotate(poses[n.id]!.q,n.com)),n.mass)),[0,0,0] as V3),1/model.mass);
 const node=model.nodes.find(n=>n.id===partId&&n.member)??model.nodes.find(n=>n.member)!;const mem=node.member!,s=sectionProperties(mem),p=mem.prop,L=mem.cutLength,F=d.tipForce+(d.robot==='arm'?d.toolMass+d.payload:0)*9.80665;
 const Iweak=mem.section==='tube'?s.I:(mem.height*mem.width**3-(mem.section==='solid'?0:(mem.height-2*mem.wall)*(mem.width-2*mem.wall)**3))/12;
 const stress=F*L*s.c/s.I,deflection=F*L**3/(3*p.E*s.I),buckling=Math.PI**2*p.E*Math.min(s.I,Iweak)/(2*L)**2;
 const motors=model.nodes.flatMap(n=>n.components).filter(c=>c.role==='motor').reduce((s,c)=>s+c.mass,0),structural=model.nodes.flatMap(n=>n.components).filter(c=>c.role==='member').reduce((s,c)=>s+c.mass,0);
 const stock=model.nodes.reduce((sum,n)=>{if(!n.member)return sum;const m=n.member,area=sectionProperties(m).area,blankArea=d.process==='tube'?area:d.process==='cast'||d.process==='additive'||d.process==='laminate'?area/d.processYield:(m.width+2*d.stockAllowance)*(m.height+2*d.stockAllowance);return sum+blankArea*(m.cutLength+2*d.stockAllowance)*m.prop.rho;},0);
 const torques=model.nodes.filter(n=>n.joint?.active&&n.joint.kind==='hinge').map(n=>{const parent=poses[n.parent!]!,origin=add(parent.p,rotate(parent.q,n.offset)),axis=rotate(parent.q,n.joint!.axis);let torque=0;
  const descendants=new Set([n.id]);for(const c of model.nodes)if(c.parent&&descendants.has(c.parent))descendants.add(c.id);
  for(const c of model.nodes)if(descendants.has(c.id)){const world=add(poses[c.id]!.p,rotate(poses[c.id]!.q,c.com));torque+=dot(axis,cross(sub(world,origin),[0,0,-c.mass*9.80665]));}return{id:n.id,torque,utilization:Math.abs(torque)/(d.motorTorque*n.joint!.motorScale)};});
 const rootInertia=inertiaAbout(model.nodes,poses,poses.base!.p,[0,1,0]);
 return{mass:model.mass,com,rootInertia,part:node,section:s,material:p,structural,motors,stock,buyToFly:stock/structural,phi:12*s.I/s.area**2,specificE:p.E/p.rho,specificStrength:p.strength/p.rho,beamIndex:Math.sqrt(p.E)/p.rho,shapeIndex:Math.sqrt(12*s.I/s.area**2*p.E)/p.rho,stress,deflection,buckling,utilization:stress*d.safety/p.strength,deflectionUse:deflection/d.allowDeflection,minWallOK:mem.section==='solid'||mem.wall>=d.minWall,torques,maxTorque:Math.max(...torques.map(t=>t.utilization)),payloadRatio:(d.payload+(d.robot==='arm'?d.toolMass:0))/model.mass,reflected:d.ratio**2*d.rotorInertia,partMass:node.components.reduce((a,c)=>a+(c.role==='member'?c.mass:0),0),cutLength:L};
}
export function sizeCandidates(model:RobotModel,partId:string){
 const member=model.nodes.find(n=>n.id===partId&&n.member)?.member;if(!member)return[];
 const results=[];for(const mat of Object.keys(materials) as Material[]){
  const check=(t:number)=>{const d=copyDesign(model.design);d.parts[partId]={...(d.parts[partId]||{}),properties:{rho:materials[mat].rho,E:materials[mat].E,G:materials[mat].G,strength:materials[mat].strength,nu:property(mat).nu},material:mat,wall:t};const m=generateRobot(d),a=evaluateConcept(m,m.home,partId);return{design:d,analysis:a};};
  let lo=Math.max(.0005,model.design.minWall),hi=Math.min(member.width,member.height)/2-.0001,result:ReturnType<typeof check>|undefined;
  if(member.section==='solid'){const c=check(member.wall);if(c.analysis.utilization<=1&&c.analysis.deflectionUse<=1)result=c;}
  else if(lo<=hi){const c=check(hi);if(c.analysis.utilization<=1&&c.analysis.deflectionUse<=1){for(let i=0;i<18;i++){const t=(lo+hi)/2,a=check(t).analysis;if(a.utilization<=1&&a.deflectionUse<=1)hi=t;else lo=t;}result=check(Math.ceil(hi*1e5)/1e5);}}
  results.push({material:mat,analysis:result?.analysis,design:result?.design});
 }return results.sort((a,b)=>(a.analysis?.partMass??Infinity)-(b.analysis?.partMass??Infinity));
}

const fmt=(x:number)=>Number(x.toPrecision(10));const xyz=(a:number[])=>a.map(fmt).join(' ');const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export function exportMJCF(model:RobotModel){
 const meshAssets=model.nodes.flatMap(n=>n.components.flatMap((c,k)=>c.collision&&c.shape==='mesh'?[`<mesh name="${n.id}_mesh${k}" file="${esc(c.meshFile!)}" scale="${xyz(c.meshScale??[1,1,1])}"/>`]:[])).join('');
 const d=model.design,gripperActive=model.active.some(j=>j.id==='gripper'),body=(n:Node):string=>{const j=n.joint,i=n.inertia;const joint=j?.active?`<joint name="${n.id}" type="${j.kind}" axis="${xyz(j.axis)}" ref="${fmt(j.home)}" range="${xyz([j.min,j.max])}" damping="${jointDamping(model,j)}" frictionloss="${j.frictionLoss??0}" armature="${j.kind==='slide'?.001:jointRotorInertia(model,j)}"/>`:'';
  const inertial=n.mass>0?`<inertial pos="${xyz(n.com)}" mass="${fmt(n.mass)}" fullinertia="${xyz(i)}"/>`:'';
  const geoms=n.components.flatMap((c,k)=>{if(!c.collision)return[];let size=c.size,shape=c.shape;if(shape==='member'){if(c.section!.section==='tube'){size=[c.section!.height/2,c.size[2],0];shape='cylinder';}else{size=[c.section!.width/2,c.section!.height/2,c.size[2]/2];shape='box';}}else if(shape==='box')size=mul(size,.5);return `<geom name="${n.id}_g${k}" type="${shape}" pos="${xyz(c.p)}" quat="${xyz(c.q)}" ${shape==='mesh'?`mesh="${n.id}_mesh${k}"`:`size="${xyz(shape==='sphere'?[size[0]]:shape==='cylinder'?[size[0],size[1]/2]:size)}"`} friction="${d.groundFriction??.7} .01 .001" rgba=".4 .6 .7 1"/>`;}).join('');
  const mirror=n.id==='gripper_mirror'&&gripperActive?`<joint name="finger_mirror" type="slide" axis="-1 0 0" ref="${fmt(model.home.gripper!)}" range=".005 .045" damping="2"/>`:'';
  const root=n.parent?'':d.robot==='arm'?'':'<freejoint name="floating_base"/>';
  const fixedQ=qm(n.originQ??[1,0,0,0],j&&j.kind==='hinge'?qa(j.axis,j.home):[1,0,0,0]),fixedPos=j&&j.kind==='slide'?add(n.offset,rotate(n.originQ??[1,0,0,0],mul(j.axis,j.home))):n.id==='gripper_mirror'?add(n.offset,[-model.home.gripper!,0,0]):n.offset;
  return `<body name="${n.id}" pos="${xyz(n.parent?fixedPos:[0,0,model.height])}" quat="${xyz(fixedQ)}">${root}${joint}${mirror}${inertial}${geoms}${model.nodes.filter(c=>c.parent===n.id).map(body).join('')}</body>`;
 };
 const actuators=model.active.map(j=>`<motor name="act_${j.id}" joint="${j.id}" gear="1" ctrllimited="true" ctrlrange="${j.kind==='slide'?'-40 40':xyz([-jointTorqueLimit(model,j),jointTorqueLimit(model,j)])}"/>`).join('');
 const finger=d.robot==='arm'&&gripperActive&&model.nodes.some(n=>n.id==='gripper_mirror')?'<equality><joint joint1="finger_mirror" joint2="gripper" polycoef="0 1 0 0 0"/></equality>':'';
 const exclude=model.source?'':model.nodes.flatMap(n=>{const parent=model.nodes.find(a=>a.id===n.parent);return[parent?.parent?`<exclude body1="${n.id}" body2="${parent.parent}"/>`:''];}).join('');
 return `<mujoco model="lightweight_concept"><compiler angle="radian" inertiafromgeom="false"/><option timestep=".002" integrator="implicitfast" cone="elliptic" iterations="50" gravity="0 0 -9.80665"/><asset>${meshAssets}</asset><default><geom condim="3" solref=".012 1"/><joint limited="true"/></default><worldbody><geom name="ground" type="plane" size="4 4 .1" friction="${d.groundFriction??.7} .01 .001"/>${body(model.nodes[0]!)}</worldbody><contact>${exclude}</contact>${finger}<actuator>${actuators}</actuator></mujoco>`;
}
export function exportConceptURDF(model:RobotModel){
 const gripperActive=model.active.some(j=>j.id==='gripper'),names=new Map(model.nodes.map(n=>[n.id,model.source?n.sourceName??n.id:n.id]));
 const angles=(q:Q4)=>[Math.atan2(2*(q[0]*q[1]+q[2]*q[3]),1-2*(q[1]**2+q[2]**2)),Math.asin(clamp(2*(q[0]*q[2]-q[3]*q[1]),-1,1)),Math.atan2(2*(q[0]*q[3]+q[1]*q[2]),1-2*(q[2]**2+q[3]**2))];
 const geometry=(c:Component)=>c.shape==='mesh'?`<mesh filename="${esc(c.sourceMesh??`package://alohamini_description/meshes/visual/${c.mesh}.STL`)}" scale="${xyz(c.meshScale??[1,1,1])}"/>`:c.shape==='sphere'?`<sphere radius="${c.size[0]}"/>`:c.shape==='cylinder'?`<cylinder radius="${c.size[0]}" length="${c.size[1]}"/>`:c.shape==='member'&&c.section!.section==='tube'?`<cylinder radius="${c.section!.height/2}" length="${c.size[2]}"/>`:`<box size="${xyz(c.shape==='member'?[c.section!.width,c.section!.height,c.size[2]]:c.size)}"/>`;
 const component=(c:Component,tag:'visual'|'collision')=>`<${tag}><origin xyz="${xyz(c.p)}" rpy="${xyz(angles(c.q))}"/><geometry>${geometry(c)}</geometry></${tag}>`;
 const links=model.nodes.map(n=>{const i=n.inertia,visual=n.components.filter(c=>c.shape!=='belt'&&(c.exportVisual??c.visible!==false)).map(c=>component(c,'visual')).join(''),collisions=n.components.filter(c=>c.collision).map(c=>component(c,'collision')).join('');return`<link name="${esc(names.get(n.id)!)}">${n.mass>0?`<inertial><origin xyz="${xyz(n.com)}"/><mass value="${fmt(n.mass)}"/><inertia ixx="${fmt(i[0])}" iyy="${fmt(i[1])}" izz="${fmt(i[2])}" ixy="${fmt(i[3])}" ixz="${fmt(i[4])}" iyz="${fmt(i[5])}"/></inertial>`:''}${visual}${collisions}</link>`;}).join('');
 const joints=model.nodes.filter(n=>n.parent).map(n=>{
  const j=n.joint,fixedPos=j&&!j.active&&j.kind==='slide'?add(n.offset,rotate(n.originQ??[1,0,0,0],mul(j.axis,j.home))):n.id==='gripper_mirror'&&!gripperActive?add(n.offset,[-model.home.gripper!,0,0]):n.offset,fixedQ=qm(n.originQ??[1,0,0,0],j&&!j.active&&j.kind==='hinge'?qa(j.axis,j.home):[1,0,0,0]);
  const drive=j?.active?`<axis xyz="${xyz(j.axis)}"/><limit lower="${j.min}" upper="${j.max}" effort="${jointTorqueLimit(model,j)}" velocity="${j.velocityLimit??(j.kind==='slide'?.1:8)}"/><dynamics damping="${jointDamping(model,j)}" friction="${j.frictionLoss??0}"${(j.armature??j.rotorInertia)!==undefined?` armature="${j.armature??j.rotorInertia}"`:''}/>`:n.id==='gripper_mirror'&&gripperActive?'<axis xyz="-1 0 0"/><limit lower=".005" upper=".045" effort="40" velocity=".1"/><mimic joint="joint_gripper" multiplier="1"/>':'';
  return`<joint name="${esc(model.source&&n.sourceJointName?n.sourceJointName:'joint_'+n.id)}" type="${j?.active?j.kind==='slide'?'prismatic':'revolute':n.id==='gripper_mirror'&&gripperActive?'prismatic':'fixed'}"><parent link="${esc(names.get(n.parent!)!)}"/><child link="${esc(names.get(n.id)!)}"/><origin xyz="${xyz(fixedPos)}" rpy="${xyz(angles(fixedQ))}"/>${drive}</joint>`;
 }).join('');
 return`<?xml version="1.0"?><robot name="${model.source?.id??'lightweight_concept'}${model.design.sourceMode==='derived'?'_concept':''}">${links}${joints}</robot>`;
}
export function exportConceptJSON(model:RobotModel){return JSON.stringify({schema:'anncatto.concept.v2',units:'SI',design:model.design,home:model.home,assembly:model.nodes,elasticSectionDefined:hasElasticModel(model.design),source:model.source,physicalSource:model.physicalSource,hardwareValidated:false,analysis:isSourceDesign(model.design)?null:evaluateConcept(model)},null,2);}

export const jointTorqueLimit=(model:RobotModel,joint:Joint)=>joint.effortLimit??(joint.kind==='slide'?40:model.design.motorTorque*joint.motorScale);
export const jointRotorInertia=(model:RobotModel,joint?:Joint)=>isSourceDesign(model.design)?joint?.armature??joint?.rotorInertia??0:model.design.ratio**2*model.design.rotorInertia;
export const jointDamping=(model:RobotModel,joint:Joint)=>isSourceDesign(model.design)?joint.damping??0:joint.kind==='slide'?2:.08;
