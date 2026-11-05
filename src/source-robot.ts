import {go2Description,rp1Description} from './source-robot-data.js';
import {type ConceptDesign,type RobotModel,type Node,type V3,type Q4,type Component,type ModelSource,copyDesign,fk,qa,qm,rotate,add,sub,mul,dot,unit,norm,property,massProperties} from './concept-model.js';

interface Geometry{type:string;filename?:string;scale?:V3;size?:V3;radius?:number;length?:number;asset?:string;vfsPath?:string}
interface Shape{xyz:V3;rpy:V3;geometry:Geometry;material?:{name?:string;rgba?:number[]}}
interface SourceLink{name:string;inertial?:{mass:number;xyz:V3;rpy:V3;tensor:Node['inertia']}|null;visuals:Shape[];collisions:Shape[];visualBounds?:{min:V3;max:V3}}
interface SourceJoint{name:string;parent:string;child:string;type:string;xyz:V3;rpy:V3;axis:V3;limit?:{lower:number;upper:number;effort:number;velocity:number};dynamics?:{damping?:number;friction?:number;armature?:number}}
interface Description{id:string;name:string;root:string;source:{commit:string;meshAsset:string;urdfAsset:string;collisionAssets:{vfsPath:string;path:string}[]};links:SourceLink[];joints:SourceJoint[]}
const rpy=(v:V3):Q4=>qm(qm(qa([0,0,1],v[2]),qa([0,1,0],v[1])),qa([1,0,0],v[0]));
const safe=(name:string)=>name.replace(/[^a-zA-Z0-9_]/g,'_');
function canonical(link:SourceLink,incoming:SourceJoint|undefined,root:string,id:string){
 if(link.name===root)return'base';
 if(id==='go2'){
  const match=(incoming?.name??'').match(/^(FL|FR|RL|RR)_(hip|thigh|calf)_joint$/);
  if(match)return match[1]!.toLowerCase()+'_'+({hip:'roll',thigh:'pitch',calf:'knee'} as Record<string,string>)[match[2]!]!;
  const foot=link.name.match(/^(FL|FR|RL|RR)_foot$/);if(foot)return foot[1]!.toLowerCase()+'_foot';
 }else{
  const match=(incoming?.name??'').match(/^(left|right)_(hip_pitch|hip_roll|hip_yaw|knee|ankle_pitch|ankle_roll)_joint$/);
  if(match)return match[1]+'_'+({hip_pitch:'pitch',hip_roll:'roll',hip_yaw:'yaw',knee:'knee',ankle_pitch:'ankle',ankle_roll:'ankle_roll'} as Record<string,string>)[match[2]!]!;
  const arm=(incoming?.name??'').match(/^(left|right)_(shoulder_pitch|shoulder_roll|shoulder_yaw|elbow|wrist)_joint$/);
  if(arm)return arm[1]+'_arm_'+arm[2]!.replace('shoulder_','');
  if(incoming?.name.startsWith('waist_'))return incoming.name.replace(/_joint$/,'');
 }
 return'source_'+safe(link.name);
}
function group(id:string):string{
 for(const prefix of ['left_arm','right_arm','fl','fr','rl','rr','left','right'])if(id.startsWith(prefix+'_'))return prefix;
 return id==='base'?'base':'torso';
}
function label(id:string,name:string):[string,string]{
 const suffix=id.replace(/^(fl|fr|rl|rr|left|right)(_arm)?_/,''),labels:Record<string,[string,string]>={roll:['Hip roll','髋侧摆'],pitch:['Hip pitch','髋俯仰'],yaw:['Hip yaw','髋偏航'],knee:['Knee','膝关节'],ankle:['Ankle pitch','踝俯仰'],ankle_roll:['Ankle roll','踝侧摆'],foot:['Foot','足端'],waist_roll:['Waist roll','腰侧摆'],waist_yaw:['Waist yaw','腰偏航']};
 if(id.includes('_arm_'))return({pitch:['Shoulder pitch','肩俯仰'],roll:['Shoulder roll','肩侧摆'],yaw:['Shoulder yaw','肩偏航'],elbow:['Elbow','肘关节'],wrist:['Wrist','腕关节']} as Record<string,[string,string]>)[suffix]??[name,name];
 return labels[suffix]??[name,name];
}
function initialJoint(id:string,source:string){
 if(source==='go2')return id.endsWith('_pitch')?.9:id.endsWith('_knee')?-1.8:id.endsWith('_roll')?(id.startsWith('fl_')||id.startsWith('rl_')?-.1:.1):0;
 return({left_pitch:-.1,left_knee:-.3,left_ankle:-.2,right_pitch:.1,right_knee:.3,right_ankle:-.2,left_arm_pitch:.2,left_arm_roll:.2,left_arm_elbow:-1.2,right_arm_pitch:-.2,right_arm_roll:-.2,right_arm_elbow:1.2} as Record<string,number>)[id]??0;
}
function inertiaInLink(tensor:Node['inertia'],orientation:Q4):Node['inertia']{
 const [a,b,c,d,e,f]=tensor,I=[[a,d,e],[d,b,f],[e,f,c]],R=([ [1,0,0],[0,1,0],[0,0,1] ] as V3[]).map(v=>rotate(orientation,v));
 const at=(i:number,j:number)=>I.reduce((s,row,k)=>s+row.reduce((t,v,l)=>t+R[k]![i]!*v*R[l]![j]!,0),0);
 return[at(0,0),at(1,1),at(2,2),at(0,1),at(0,2),at(1,2)];
}
function collision(shape:Shape,foot=false):Component{
 const g=shape.geometry,size:V3=g.type==='box'?[...g.size!]:g.type==='sphere'?[g.radius!,g.radius!,g.radius!]:g.type==='cylinder'?[g.radius!,g.length!,0]:[0,0,0];
 return{role:foot?'foot':'body',shape:g.type as Component['shape'],p:[...shape.xyz],q:rpy(shape.rpy),size,mass:0,material:'aluminium',collision:true,visible:false,meshFile:g.vfsPath,sourceMesh:g.filename,meshScale:g.scale};
}
/** Convex support of the actual horizontal cylinder contact lines, not the
 * bounding rectangle of the visual foot. Meshes are retained separately. */
function solePatch(node:Node){
 const points:V3[]=[];
 for(const c of node.components.filter(c=>c.collision&&c.shape==='cylinder')){
  const axis=rotate(c.q,[0,0,1]),down:V3=[0,0,-1],radial=mul(unit(sub(down,mul(axis,dot(axis,down)))),c.size[0]);
  for(const side of [-1,1])points.push(add(add(c.p,mul(axis,side*c.size[1]/2)),radial));
 }
 if(!points.length)throw Error('Source foot contact geometry missing');
 const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a:V3,b:V3,c:V3)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower:V3[]=[],upper:V3[]=[];
 for(const p of sorted){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=1e-12)lower.pop();lower.push(p);}
 for(const p of sorted.reverse()){while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=1e-12)upper.pop();upper.push(p);}
 node.contactPoints=lower.slice(0,-1).concat(upper.slice(0,-1));
 const centre=mul(node.contactPoints.reduce((s,p)=>add(s,p),[0,0,0] as V3),1/node.contactPoints.length),width=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])),length=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
 node.components.push({role:'foot',shape:'box',p:add(centre,[0,0,.01]),q:[1,0,0,0],size:[length,width,.02],mass:0,material:'aluminium',collision:false,visible:false});
}
export function generateSourceRobot(design:ConceptDesign):RobotModel{
 const id=design.legModel!;if(id==='go2'&&design.robot!=='quadruped'||id==='rp1'&&design.robot!=='biped')throw Error('Source model does not match robot architecture');
 const raw=(id==='go2'?go2Description:rp1Description) as unknown as Description,incoming=new Map(raw.joints.map(j=>[j.child,j])),mapping=new Map(raw.links.map(l=>[l.name,canonical(l,incoming.get(l.name),raw.root,id)])),nodes:Node[]=[],home:Record<string,number>={};
 const pending=[...raw.links];while(pending.length){const index=pending.findIndex(l=>!incoming.has(l.name)||nodes.some(n=>n.sourceName===incoming.get(l.name)!.parent));if(index<0)throw Error('Source joint tree is disconnected');const link=pending.splice(index,1)[0]!,joint=incoming.get(link.name),nodeId=mapping.get(link.name)!,g=group(nodeId),name=label(nodeId,joint?.name??link.name),inertial=link.inertial;
  const node:Node={id:nodeId,sourceName:link.name,sourceJointName:joint?.name,parent:joint?mapping.get(joint.parent)!:null,offset:joint?[...joint.xyz]:[0,0,0],originQ:joint?rpy(joint.rpy):[1,0,0,0],label:name,group:g,mass:inertial?.mass??0,com:inertial?[...inertial.xyz]:[0,0,0],inertia:inertial?inertiaInLink(inertial.tensor,rpy(inertial.rpy)):[0,0,0,0,0,0],components:[]};
  if(joint&&joint.type!=='fixed'){if(joint.type!=='revolute'&&joint.type!=='continuous')throw Error('Unsupported source joint');const limit=joint.limit!,angle=initialJoint(nodeId,id);node.joint={id:nodeId,sourceName:joint.name,label:name,group:g,axis:unit([...joint.axis]),min:limit?.lower??-Math.PI,max:limit?.upper??Math.PI,home:angle,active:true,kind:'hinge',motorScale:1,effortLimit:limit?.effort,velocityLimit:limit?.velocity,damping:joint.dynamics?.damping??0,frictionLoss:joint.dynamics?.friction,rotorInertia:joint.dynamics?.armature};home[nodeId]=angle;}
  if(link.visuals.length){const bounds=link.visualBounds;node.components.push({role:'body',shape:'mesh',mesh:id+'/'+link.name,p:[0,0,0],q:[1,0,0,0],size:bounds?sub(bounds.max,bounds.min):[0,0,0],mass:0,material:'aluminium',collision:false,exportVisual:false});}
  for(const shape of link.visuals){const c=collision(shape);c.collision=false;c.exportVisual=true;node.components.push(c);}
  const foot=id==='go2'?nodeId.endsWith('_foot'):nodeId.endsWith('_ankle_roll');
  for(const shape of link.collisions)node.components.push(collision(shape,foot&&id==='go2'&&shape.geometry.type==='sphere'));
  if(foot){node.tip='foot';if(id==='rp1')solePatch(node);}
  nodes.push(node);
 }
 if(design.payload>0){const component:Component={role:'payload',shape:'box',p:[0,0,0],q:[1,0,0,0],size:[.12,.12,.09],mass:design.payload,material:'aluminium',collision:true},parent=id==='go2'?nodes.find(n=>n.sourceName==='trunk')??nodes[0]!:nodes.find(n=>n.id==='waist_yaw')??nodes[0]!;
  nodes.push({id:'payload',parent:parent.id,offset:id==='go2'?[0,0,.10]:[-.16,0,.18],label:['Added payload','附加载荷'],group:'payload',components:[component],...massProperties([component])});
 }
 const source:ModelSource={id,name:id==='go2'?'Unitree Go2':'RoboParty RP1 · 24 DOF',commit:raw.source.commit,meshAsset:raw.source.meshAsset,urdfAsset:raw.source.urdfAsset,collisionAssets:raw.source.collisionAssets??[],license:id==='go2'?'BSD-3-Clause':'Model sub-repository license unspecified; local evaluation only',modelAssumptions:['Source URDF inertias and effort/velocity limits; not hardware-identified.','Native collision primitives and convex hulls of source collision meshes.','URDF damping, friction and any declared armature retained; undeclared rotor coupling, torque-speed and thermal behavior unknown.','Workbench reference planner and torque control; no official trained policy is running.']};
 const model:RobotModel={design:copyDesign(design),nodes,home,active:nodes.flatMap(n=>n.joint?[n.joint]:[]),height:0,tips:nodes.filter(n=>n.tip==='foot').map(n=>n.id),mass:nodes.reduce((s,n)=>s+n.mass,0),fingerprint:'',source};
 if(model.tips.length!==(id==='go2'?4:2))throw Error('Incomplete source feet');
 const poses=fk(model,home),low=Math.min(...nodes.filter(n=>n.tip==='foot').flatMap(n=>{const p=poses[n.id]!;if(n.contactPoints)return n.contactPoints.map(v=>add(p.p,rotate(p.q,v))[2]);const c=n.components.find(c=>c.role==='foot')!;return[add(p.p,rotate(p.q,c.p))[2]-c.size[0]];}));model.height=-low+.001;
 let hash=2166136261;const key=JSON.stringify([model.design,nodes,source]);for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);model.fingerprint=(hash>>>0).toString(16);return model;
}
