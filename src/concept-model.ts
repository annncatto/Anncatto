/** Concept geometry, mass properties, kinematics and manufacturing share this joint tree. SI units. */
import {materials,sectionProperties,type Material,type SectionType,type RobotType} from './lightweight-mechanics.js';
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
export const property=(m:Material):Property=>({...materials[m],nu:m==='steel'?.3:m==='titanium'?.34:.33});
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
}
export const initialConcept:ConceptDesign={robot:'quadruped',material:'aluminium',section:'box',process:'tube',l1:.30,l2:.31,armLengths:[.30,.27,.11],width:.034,height:.045,wall:.002,bodyLength:.46,bodyWidth:.23,bodyHeight:.12,bodyMass:5,motorMass:.45,motorTorque:24,ratio:9,rotorInertia:2.5e-5,toolMass:.45,payload:0,tool:'gripper',remote:false,minWall:.0012,stockAllowance:.003,processYield:.85,maxToolReach:8,allowDeflection:.001,safety:1.5,tipForce:60,speed:.25,properties:{},parts:{},joints:{}};
export function copyDesign(d:ConceptDesign):ConceptDesign{return JSON.parse(JSON.stringify(d));}
export function validateConcept(d:ConceptDesign){
 if(!['quadruped','biped','arm'].includes(d.robot)||!(d.material in materials))throw Error('Invalid architecture or material');
 for(const key of ['l1','l2','width','height','wall','bodyLength','bodyWidth','bodyHeight','bodyMass','motorMass','motorTorque','ratio','rotorInertia','minWall','allowDeflection','safety'] as const)if(!Number.isFinite(d[key])||d[key]<=0)throw Error(`Invalid ${key}`);
 if(!['tube','box','solid'].includes(d.section)||!['tube','cnc','cast','additive','laminate'].includes(d.process))throw Error('Invalid section or process');
 for(const key of ['toolMass','payload','tipForce','speed','stockAllowance','processYield','maxToolReach'] as const)if(!Number.isFinite(d[key])||d[key]<0)throw Error(`Invalid ${key}`);
 for(const L of d.armLengths)if(L<.045||L>2||!Number.isFinite(L))throw Error('Invalid arm length');
 if(d.l1<.08||d.l2<.08||d.l1>1.5||d.l2>1.5)throw Error('Invalid link length');
 for(const p of [d,...Object.values(d.parts).map(p=>({...d,...p}))])if(p.section!=='solid'&&2*p.wall>=Math.min(p.width,p.height))throw Error('Invalid wall thickness');
 if(d.processYield<=0||d.processYield>1||d.maxToolReach<=0)throw Error('Invalid process parameters');
 for(const part of [{},...Object.values(d.parts)]){const mat=part.material??d.material;if(!(mat in materials))throw Error('Invalid part material');const p={...property(mat),...d.properties,...part.properties};if(![p.rho,p.E,p.G,p.strength,p.nu].every(Number.isFinite)||p.rho<=0||p.E<=0||p.G<=0||p.strength<=0||p.nu<=-1||p.nu>=.5)throw Error('Invalid material properties');for(const key of ['length','width','height','wall'] as const)if(part[key]!==undefined&&(!Number.isFinite(part[key])||part[key]!<=0))throw Error('Invalid part dimension');}
 for(const j of Object.values(d.joints)){if(j.axis&&(!j.axis.every(Number.isFinite)||norm(j.axis)<1e-8))throw Error('Invalid joint axis');if(j.min!==undefined&&!Number.isFinite(j.min)||j.max!==undefined&&!Number.isFinite(j.max)||j.min!==undefined&&j.max!==undefined&&j.min>=j.max)throw Error('Invalid joint limits');}
}
export interface Joint{id:string;label:[string,string];group:string;axis:V3;min:number;max:number;home:number;active:boolean;kind:'hinge'|'slide';motorScale:number}
export interface Component{role:'body'|'member'|'motor'|'collar'|'foot'|'tool'|'payload'|'belt';shape:'box'|'cylinder'|'sphere'|'member'|'belt';p:V3;q:Q4;size:V3;mass:number;material:Material;collision:boolean;span?:V3;section?:{section:SectionType;width:number;height:number;wall:number};label?:string}
export interface Node{id:string;parent:string|null;offset:V3;joint?:Joint;components:Component[];label:[string,string];group:string;member?:{vector:V3;length:number;cutLength:number;material:Material;section:SectionType;width:number;height:number;wall:number;prop:Property};tip?:'foot'|'tool';mass:number;com:V3;inertia:[number,number,number,number,number,number]}
export interface RobotModel{design:ConceptDesign;nodes:Node[];active:Joint[];home:Record<string,number>;height:number;tips:string[];mass:number;fingerprint:string}
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
  const basis=[rotate(c.q,X),rotate(c.q,Y),rotate(c.q,Z)],r=sub(c.p,com);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)I[i]![j]!+=basis.reduce((s,a,k)=>s+diag[k]!*a[i]!*a[j]!,0)+c.mass*((i===j?dot(r,r):0)-r[i]!*r[j]!);
 }
 return{mass,com,inertia:[I[0]![0]!,I[1]![1]!,I[2]![2]!,I[0]![1]!,I[0]![2]!,I[1]![2]!] as Node['inertia']};
}
export function generateRobot(d:ConceptDesign):RobotModel{
 validateConcept(d);const nodes:Node[]=[],home:Record<string,number>={},tips:string[]=[];const material=d.material;
 const create=(id:string,parent:Node|null,offset:V3,label:[string,string],group:string,joint?:Omit<Joint,'id'|'group'|'active'>)=>{
  let j:Joint|undefined;if(joint){const o=d.joints[id]||{};j={...joint,...o,id,group,active:o.active??true};j.axis=unit(j.axis);if(j.min>=j.max)throw Error('Invalid joint travel');j.home=clamp(j.home,j.min,j.max);home[id]=j.home;}
  if(parent&&norm(offset)>.008&&!parent.member)parent.components.push(connector([0,0,0],offset));
  const n:Node={id,parent:parent?.id||null,offset,joint:j,components:[],label,group,mass:0,com:[0,0,0],inertia:[1,1,1,0,0,0]};nodes.push(n);return n;
 };
 const root=create('base',null,[0,0,0],['Base','机身'],'base');
 root.components.push(box([0,0,d.robot==='arm'?.055:d.robot==='biped'?.03:0],d.robot==='arm'?[.22,.22,.11]:[d.bodyLength,d.bodyWidth,d.bodyHeight],d.robot==='biped'?d.bodyMass*.35:d.bodyMass));
 const hinge=(id:string,parent:Node,offset:V3,axis:V3,label:[string,string],group:string,q=0,min=-1.3,max=1.3,motorScale=1)=>{
  const n=create(id,parent,offset,label,group,{label,axis,min,max,home:q,kind:'hinge',motorScale});
  const on=n.joint!.active,ms=d.motorMass*motorScale,r=.033*Math.cbrt(motorScale),depth=.045*Math.cbrt(motorScale),side=mul(axis,depth*.52);
  parent.components.push(cylinder(add(offset,side),axis,r,depth,on?ms*.85:ms*.15));n.components.push(cylinder([0,0,0],axis,r*.76,.012,on?ms*.15:ms*.08,'collar'));
  return n;
 };
 const member=(n:Node,v:V3)=>{
  const o=d.parts[n.id]||{},L=o.length??norm(v),vec=mul(unit(v),L),mat=o.material??material,p={...property(mat),...(mat===material?d.properties:{}),...o.properties};
  const section={section:o.section??d.section,width:o.width??d.width,height:o.height??d.height,wall:o.wall??d.wall};const s=sectionProperties(section),end=.026,cutLength=Math.max(.01,L-2*end);
  n.member={vector:vec,length:L,cutLength,material:mat,...section,prop:p};
  n.components.push({role:'member',shape:'member',p:mul(vec,.5),q:alignZ(vec),size:[section.width,section.height,cutLength],mass:p.rho*s.area*cutLength,material:mat,section,span:vec,collision:true});
  n.components.push(connector([0,0,0],mul(unit(vec),end+.008),.019));n.components.push(connector(mul(unit(vec),L-end-.008),mul(unit(vec),end+.008),.019));
  return vec;
 };
 const remote=(n:Node,child:Node)=>{
  if(!d.remote||!n.member||child.joint?.kind!=='hinge'||!child.joint.active)return;
  const target=n.components.find(c=>c.role==='motor'&&norm(sub(c.p,add(child.offset,mul(Y,.045*.52))))<.03);
  if(target)target.p=sub(target.p,child.offset);
  const L=n.member.length,r=.027,plane=d.width/2+.033;
  n.components.push({role:'belt',shape:'belt',p:add(mul(n.member.vector,.5),[0,plane,0]),q:alignZ(mul(n.member.vector,-1)),size:[r,.008,L],mass:(2*L+2*Math.PI*r)*.065,material:'steel',collision:false});
  for(const pos of [[0,0,0],n.member.vector] as V3[]){n.components.push(cylinder(add(pos,[0,plane,0]),Y,r,.012,.022,'collar'));n.components.push(cylinder(add(pos,[0,plane/2,0]),Y,.008,plane,.012,'collar'));}
 };
 if(d.robot!=='arm'){
  if(d.payload>0)root.components.push(box([0,0,d.bodyHeight/2+.045],[.12,.12,.09],d.payload,'payload'));
  const legs=d.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'];
  for(const [i,prefix] of legs.entries()){
   const side=i%2===0?1:-1,x=d.robot==='quadruped'?(i<2?d.bodyLength*.38:-d.bodyLength*.38):0,group=prefix;
   let p=root;
   if(d.joints[`${prefix}_yaw`]?.active??d.robot==='biped')p=hinge(`${prefix}_yaw`,p,[x,side*d.bodyWidth*.5,0],Z,['Hip yaw','髋偏航'],group,0,-.8,.8);
   const roll=hinge(`${prefix}_roll`,p,p===root?[x,side*d.bodyWidth*.5,0]:[0,0,-.065],X,['Hip roll','髋侧摆'],group,0,-.7,.7);
   const upper=hinge(`${prefix}_pitch`,roll,[0,side*.065,0],Y,['Hip pitch','髋俯仰'],group,-.48,-1.6,1.1);
   const v=member(upper,[0,0,-d.l1]);const knee=hinge(`${prefix}_knee`,upper,v,Y,['Knee','膝关节'],group,.96,-.1,2.4);
   const lower=member(knee,[0,0,-d.l2]);remote(upper,knee);
   let ankle:Node;
   if(d.robot==='biped'||d.joints[`${prefix}_ankle`]?.active){ankle=hinge(`${prefix}_ankle`,knee,lower,Y,['Ankle pitch','踝俯仰'],group,-.48,-1,1,.7);
    if(d.robot==='biped'){ankle=hinge(`${prefix}_ankle_roll`,ankle,[0,0,-.04],X,['Ankle roll','踝侧摆'],group,0,-.55,.55,.6);ankle.components.push(box([.025,0,-.025],[.18,.085,.05],.25,'foot'));}
    else ankle.components.push(sphere([0,0,-.025],.025,.08));
   }else{ankle=create(`${prefix}_foot`,knee,lower,['Foot','足端'],group);ankle.components.push(sphere([0,0,0],.027,.08));}
   ankle.tip='foot';tips.push(ankle.id);
  }
  if(d.robot==='biped'){
   const waist=hinge('waist',root,[0,0,d.bodyHeight/2+.04],Z,['Waist yaw','腰偏航'],'torso',0,-.8,.8);
   const torso=create('torso',waist,[0,0,.15],['Torso','躯干'],'torso');torso.components.push(box([0,0,0],[.19,d.bodyWidth*.94,.26],d.bodyMass*.65));
   const neck=hinge('neck_yaw',torso,[0,0,.19],Z,['Neck yaw','颈偏航'],'torso',0,-1,1,.25),head=hinge('neck_pitch',neck,[.035,0,.045],Y,['Neck pitch','颈俯仰'],'torso',0,-.6,.6,.25);head.components.push(box([0,0,.045],[.09,.10,.09],.3));
   for(const [side,prefix] of [[1,'left_arm'],[-1,'right_arm']] as const){
    const shoulder=hinge(`${prefix}_pitch`,torso,[0,side*(d.bodyWidth*.5+.04),.08],Y,['Shoulder pitch','肩俯仰'],prefix,.12,-2.4,2.4,.55);
    const roll=hinge(`${prefix}_roll`,shoulder,[0,side*.055,0],X,['Shoulder roll','肩侧摆'],prefix,-side*.12,-1.5,1.5,.5);
    const yaw=hinge(`${prefix}_yaw`,roll,[0,0,-.055],Z,['Shoulder yaw','肩偏航'],prefix,0,-1.5,1.5,.4);
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
  const payload=create('payload',tool,[0,0,.115],['Payload','工件'],'tool');if(d.payload>0)payload.components.push(box([0,0,0],[.065,.065,.065],d.payload,'payload'));else payload.components.push(box([0,0,0],[.001,.001,.001],.000001,'payload'));
  tool.tip='tool';tips.push(tool.id);
 }
 for(const n of nodes){if(!n.components.length)n.components.push(cylinder([0,0,0],Z,.009,.012,.006,'collar'));Object.assign(n,massProperties(n.components));}
 const active=nodes.flatMap(n=>n.joint?.active?[n.joint]:[]),m={design:copyDesign(d),nodes,active,home,height:0,tips,mass:nodes.reduce((a,n)=>a+n.mass,0),fingerprint:''};
 if(d.robot!=='arm'){const f=fk(m,home);const low=Math.min(...nodes.flatMap(n=>n.components.filter(c=>c.role==='foot').map(c=>f[n.id]!.p[2]+rotate(f[n.id]!.q,c.p)[2]-(c.shape==='sphere'?c.size[0]:c.size[2]/2))));m.height=-low+.001;}
 const key=JSON.stringify(d);let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);m.fingerprint=(hash>>>0).toString(16);return m;
}
export function fk(model:Pick<RobotModel,'nodes'|'height'>,q:Record<string,number>,base?:Transform){
 const result:Record<string,Transform>={};for(const n of model.nodes){const p=n.parent?result[n.parent]!:base??{p:[0,0,model.height],q:[1,0,0,0] as Q4};let position=add(p.p,rotate(p.q,n.offset)),rotation=p.q;
  const joint=n.joint,value=q[n.id]??joint?.home??0;if(joint){if(joint.kind==='slide')position=add(position,rotate(p.q,mul(joint.axis,value)));else rotation=qm(rotation,qa(joint.axis,value));}
  if(n.id==='gripper_mirror')position=add(position,rotate(p.q,[-(q.gripper??.025),0,0]));result[n.id]={p:position,q:rotation};
 }return result;
}
export function inverseArm(model:RobotModel,q0:Record<string,number>,target:V3,targetQ?:Q4){
 const q={...q0},joints=model.nodes.filter(n=>n.joint?.active&&n.joint.kind==='hinge'),tip=model.tips[0]!;let residual=Infinity;
 for(let it=0;it<140;it++){const poses=fk(model,q),end=poses[tip]!,e=sub(target,end.p),qr=targetQ?qm(targetQ,inverseQ(end.q)):[1,0,0,0] as Q4,orient:V3=targetQ?mul([qr[1],qr[2],qr[3]],2*(qr[0]<0?-1:1)):[0,0,0];residual=norm(e);if(residual<.0002&&norm(orient)<.005)break;
  const cols=joints.map(n=>{const p=poses[n.parent!]!,axis=rotate(p.q,n.joint!.axis),o=add(p.p,rotate(p.q,n.offset)),v=cross(axis,sub(end.p,o));return [...v,...mul(axis,targetQ?.18:0)];});
  const err=[...e,...mul(orient,.18)],A=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>cols.reduce((s,c)=>s+c[i]!*c[j]!,i===j?.0015:0)));
  const solve=linearSolve(A,err);joints.forEach((n,j)=>{const v=cols[j]!.reduce((s,c,k)=>s+c*solve[k]!,0);q[n.id]=clamp((q[n.id]??0)+clamp(v,-.16,.16),n.joint!.min,n.joint!.max);});
 }return{q,error:norm(sub(target,fk(model,q)[tip]!.p))};
}
export function linearSolve(A:number[][],b:number[]){const m=A.map((r,i)=>[...r,b[i]!]),n=b.length;for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j]![i]!)>Math.abs(m[p]![i]!))p=j;[m[i],m[p]]=[m[p]!,m[i]!];const s=m[i]![i]!;if(Math.abs(s)<1e-14)throw Error('Singular system');for(let k=i;k<=n;k++)m[i]![k]!/=s;for(let j=0;j<n;j++)if(j!==i){const f=m[j]![i]!;for(let k=i;k<=n;k++)m[j]![k]!-=f*m[i]![k]!;}}return m.map(r=>r[n]!);}
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
 const rootInertia=model.nodes.reduce((s,n)=>{const r=sub(add(poses[n.id]!.p,rotate(poses[n.id]!.q,n.com)),poses.base!.p);return s+n.mass*(r[0]**2+r[2]**2);},0);
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
 const d=model.design,gripperActive=model.active.some(j=>j.id==='gripper'),body=(n:Node):string=>{const j=n.joint,i=n.inertia;const joint=j?.active?`<joint name="${n.id}" type="${j.kind}" axis="${xyz(j.axis)}" range="${xyz([j.min,j.max])}" damping="${j.kind==='slide'?2:.08}" armature="${j.kind==='slide'?.001:d.ratio**2*d.rotorInertia}"/>`:'';
  const inertial=`<inertial pos="${xyz(n.com)}" mass="${fmt(n.mass)}" fullinertia="${xyz(i)}"/>`;
  const geoms=n.components.filter(c=>c.collision).map((c,k)=>{let size=c.size,shape=c.shape;if(shape==='member'){size=[c.section!.section==='tube'?c.section!.height/2:c.section!.width/2,c.section!.height/2,c.size[2]/2];shape='box';}else if(shape==='box')size=mul(size,.5);return `<geom name="${n.id}_g${k}" type="${shape}" pos="${xyz(c.p)}" quat="${xyz(c.q)}" size="${xyz(shape==='sphere'?[size[0]]:shape==='cylinder'?[size[0],size[1]/2]:size)}" friction=".9 .01 .001" rgba=".4 .6 .7 1"/>`;}).join('');
  const mirror=n.id==='gripper_mirror'&&gripperActive?'<joint name="finger_mirror" type="slide" axis="-1 0 0" range=".005 .045" damping="2"/>':'';
  const root=n.parent?'':d.robot==='arm'?'':'<freejoint name="floating_base"/>';
  const fixedQ=j&&!j.active&&j.kind==='hinge'?qa(j.axis,j.home):[1,0,0,0],fixedPos=j&&!j.active&&j.kind==='slide'?add(n.offset,mul(j.axis,j.home)):n.id==='gripper_mirror'&&!gripperActive?add(n.offset,[-model.home.gripper!,0,0]):n.offset;
  return `<body name="${n.id}" pos="${xyz(n.parent?fixedPos:[0,0,model.height])}" quat="${xyz(fixedQ)}">${root}${joint}${mirror}${inertial}${geoms}${model.nodes.filter(c=>c.parent===n.id).map(body).join('')}</body>`;
 };
 const actuators=model.active.map(j=>`<motor name="act_${j.id}" joint="${j.id}" gear="1" ctrllimited="true" ctrlrange="${j.kind==='slide'?'-40 40':xyz([-d.motorTorque*j.motorScale,d.motorTorque*j.motorScale])}"/>`).join('');
 const finger=d.robot==='arm'&&gripperActive?'<equality><joint joint1="finger_mirror" joint2="gripper" polycoef="0 1 0 0 0"/></equality>':'';
 const exclude=model.nodes.flatMap(n=>{const parent=model.nodes.find(a=>a.id===n.parent);return[parent?.parent?`<exclude body1="${n.id}" body2="${parent.parent}"/>`:''];}).join('');
 return `<mujoco model="lightweight_concept"><compiler angle="radian" inertiafromgeom="false"/><option timestep=".002" integrator="implicitfast" cone="elliptic" iterations="50" gravity="0 0 -9.80665"/><default><geom condim="3" solref=".012 1"/><joint limited="true"/></default><worldbody><geom name="ground" type="plane" size="4 4 .1" friction=".9 .01 .001"/>${body(model.nodes[0]!)}</worldbody><contact>${exclude}</contact>${finger}<actuator>${actuators}</actuator></mujoco>`;
}
export function exportConceptURDF(model:RobotModel){
 const gripperActive=model.active.some(j=>j.id==='gripper');
 const links=model.nodes.map(n=>{const i=n.inertia;return `<link name="${n.id}"><inertial><origin xyz="${xyz(n.com)}"/><mass value="${fmt(n.mass)}"/><inertia ixx="${fmt(i[0])}" iyy="${fmt(i[1])}" izz="${fmt(i[2])}" ixy="${fmt(i[3])}" ixz="${fmt(i[4])}" iyz="${fmt(i[5])}"/></inertial>${n.components.filter(c=>c.shape!=='belt').map(c=>{const q=c.q,sinp=2*(q[0]*q[2]-q[3]*q[1]),rpy=[Math.atan2(2*(q[0]*q[1]+q[2]*q[3]),1-2*(q[1]**2+q[2]**2)),Math.asin(clamp(sinp,-1,1)),Math.atan2(2*(q[0]*q[3]+q[1]*q[2]),1-2*(q[2]**2+q[3]**2))];const shape=c.shape==='sphere'?`<sphere radius="${c.size[0]}"/>`:c.shape==='cylinder'?`<cylinder radius="${c.size[0]}" length="${c.size[1]}"/>`:`<box size="${xyz(c.shape==='member'?[c.section!.width,c.section!.height,c.size[2]]:c.size)}"/>`;return `<visual><origin xyz="${xyz(c.p)}" rpy="${xyz(rpy)}"/><geometry>${shape}</geometry></visual>`;}).join('')}</link>`;}).join('');
 const joints=model.nodes.filter(n=>n.parent).map(n=>{const j=n.joint,fixedPos=j&&!j.active&&j.kind==='slide'?add(n.offset,mul(j.axis,j.home)):n.id==='gripper_mirror'&&!gripperActive?add(n.offset,[-model.home.gripper!,0,0]):n.offset,fixedQ=j&&!j.active&&j.kind==='hinge'?qa(j.axis,j.home):[1,0,0,0] as Q4,rpy=[Math.atan2(2*(fixedQ[0]!*fixedQ[1]!+fixedQ[2]!*fixedQ[3]!),1-2*(fixedQ[1]!**2+fixedQ[2]!**2)),Math.asin(clamp(2*(fixedQ[0]!*fixedQ[2]!-fixedQ[3]!*fixedQ[1]!),-1,1)),Math.atan2(2*(fixedQ[0]!*fixedQ[3]!+fixedQ[1]!*fixedQ[2]!),1-2*(fixedQ[2]!**2+fixedQ[3]!**2))];return `<joint name="joint_${n.id}" type="${j?.active?j.kind==='slide'?'prismatic':'revolute':n.id==='gripper_mirror'&&gripperActive?'prismatic':'fixed'}"><parent link="${n.parent}"/><child link="${n.id}"/><origin xyz="${xyz(fixedPos)}" rpy="${xyz(rpy)}"/>${j?.active?`<axis xyz="${xyz(j.axis)}"/><limit lower="${j.min}" upper="${j.max}" effort="${j.kind==='slide'?40:model.design.motorTorque*j.motorScale}" velocity="${j.kind==='slide'?.1:8}"/><dynamics damping=".08" friction="0"/>`:n.id==='gripper_mirror'&&gripperActive?'<axis xyz="-1 0 0"/><limit lower=".005" upper=".045" effort="40" velocity=".1"/><mimic joint="joint_gripper" multiplier="1"/>':''}</joint>`;}).join('');
 return `<?xml version="1.0"?><robot name="lightweight_concept">${links}${joints}</robot>`;
}
export function exportConceptJSON(model:RobotModel){return JSON.stringify({schema:'anncatto.concept.v2',units:'SI',design:model.design,home:model.home,assembly:model.nodes,analysis:evaluateConcept(model)},null,2);}
