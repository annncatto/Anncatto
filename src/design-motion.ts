import {type RobotModel,type Transform,type V3,type Node,fk,inverseArm,rotate,add,sub,mul,unit,norm,clamp} from './concept-model.js';
import {inverse2R,footCycle} from './lightweight-kinematics.js';
export interface MotionFrame{q:Record<string,number>;poses:Record<string,Transform>;travel:number;contacts:V3[];com:V3;supportMargin:number;trackingError:number;phase:number}
const smooth=(x:number)=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
export function centreOfMass(model:RobotModel,poses:Record<string,Transform>):V3{return mul(model.nodes.reduce((sum,n)=>add(sum,mul(add(poses[n.id]!.p,rotate(poses[n.id]!.q,n.com)),n.mass)),[0,0,0] as V3),1/model.mass);}
const cross2=(a:V3,b:V3,c:V3)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function convexHull(points:V3[]){const pts=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(pts.length<3)return pts;const lower:V3[]=[],upper:V3[]=[];for(const p of pts){while(lower.length>=2&&cross2(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}for(const p of pts.reverse()){while(upper.length>=2&&cross2(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
export function polygonMargin(p:V3,polygon:V3[]){if(polygon.length<3)return-1;return Math.min(...polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length]!;return cross2(a,b,p)/Math.max(1e-9,Math.hypot(b[0]-a[0],b[1]-a[1]));}));}
export function footSole(n:Node,pose:Transform):V3{const c=n.components.find(c=>c.role==='foot')!;return add(pose.p,add(rotate(pose.q,c.p),[0,0,-(c.shape==='sphere'?c.size[0]:c.size[2]/2)]));}
function legIK(model:RobotModel,q:Record<string,number>,prefix:string,target:V3,base:Transform){
 const roll=model.nodes.find(n=>n.id===`${prefix}_roll`)!,upper=model.nodes.find(n=>n.id===`${prefix}_pitch`)!,knee=model.nodes.find(n=>n.id===`${prefix}_knee`)!,tip=model.nodes.find(n=>n.group===prefix&&n.tip==='foot')!,side=prefix==='fl'||prefix==='rl'||prefix==='left'?1:-1;
 const poses=fk(model,{...q,[roll.id]:0},base),origin=poses[roll.id]!.p,foot=tip.components.find(c=>c.role==='foot')!,biped=model.design.robot==='biped',ankle=model.nodes.find(n=>n.id===`${prefix}_ankle`),extra=biped?-tip.offset[2]:ankle?-foot.p[2]:0,r=foot.shape==='sphere'?foot.size[0]:foot.size[2]/2;
 // With a flat humanoid sole, the final foot offset is fixed in world axes.
 // The small ankle riser rotates with hip roll and is included below.
 const fixed:V3=biped?[foot.p[0],0,foot.p[2]-r]:[0,0,-r];
 const v=sub(sub(target,origin),fixed),radius=Math.hypot(v[1],v[2]);let phi=roll.joint!.active?Math.atan2(v[2],v[1])+Math.acos(clamp(side*Math.abs(upper.offset[1])/radius,-1,1)):roll.joint!.home;
 phi=clamp(phi,roll.joint!.min,roll.joint!.max);
 const z=-Math.sin(phi)*v[1]+Math.cos(phi)*v[2]+extra,l1=upper.member!.length,l2=knee.member!.length;
 const ik=inverse2R(l1,l2,-z,-v[0],1);q[roll.id]=phi;q[upper.id]=clamp(ik.q1,upper.joint!.min,upper.joint!.max);q[knee.id]=clamp(ik.q2,knee.joint!.min,knee.joint!.max);
 if(ankle?.joint)q[ankle.id]=clamp(-q[upper.id]!-q[knee.id]!,ankle.joint.min,ankle.joint.max);
 const ar=model.nodes.find(n=>n.id===`${prefix}_ankle_roll`);if(ar?.joint)q[ar.id]=clamp(-phi,ar.joint.min,ar.joint.max);
}
export function motionFrame(model:RobotModel,time:number,moving=true):MotionFrame{
 const q={...model.home},d=model.design;
 if(d.robot==='arm'){
  const home=fk(model,q),p=home.tool!.p,phase=time/5%1;
  const target:V3=moving?add(p,[.055*(Math.cos(phase*Math.PI*2)-1),.085*Math.sin(phase*Math.PI*2),.045*Math.sin(phase*Math.PI*4)]):p;
  const result=moving?inverseArm(model,q,target):{q,error:0},poses=fk(model,result.q);
  return{q:result.q,poses,travel:0,contacts:[],com:centreOfMass(model,poses),supportMargin:0,trackingError:result.error,phase};
 }
 if(!moving){const poses=fk(model,q),nodes=model.nodes.filter(n=>n.tip==='foot'),contacts=nodes.map(n=>footSole(n,poses[n.id]!)),points:V3[]=[];for(const [i,n] of nodes.entries()){const c=n.components.find(c=>c.role==='foot')!,hx=c.shape==='sphere'?.009:c.size[0]/2,hy=c.shape==='sphere'?.009:c.size[1]/2;for(const x of [-hx,hx])for(const y of [-hy,hy])points.push(add(contacts[i]!,[x,y,0]));}const com=centreOfMass(model,poses);return{q,poses,contacts,com,supportMargin:polygonMargin(com,convexHull(points)),trackingError:0,travel:0,phase:0};}
 const prefixes=d.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'],period=d.robot==='quadruped'?3.2:5.4,duty=d.robot==='quadruped'?.79:.66,phase=moving?(time/period%1+1)%1:0;
 const home=fk(model,q),footNodes=prefixes.map(p=>model.nodes.find(n=>n.group===p&&n.tip==='foot')!);
 const sole=footNodes[0]!.components.find(c=>c.role==='foot')!,footStack=-sole.p[2]+(sole.shape==='sphere'?sole.size[0]:sole.size[2]/2)+(d.robot==='biped'?-footNodes[0]!.offset[2]:0);
 const sums=prefixes.map(p=>model.nodes.find(n=>n.id===`${p}_pitch`)!.member!.length+model.nodes.find(n=>n.id===`${p}_knee`)!.member!.length),shortest=Math.min(...sums),stride=shortest*(d.robot==='quadruped'?.24:.15),lift=Math.min(.06,shortest*.09),drop=home[`${prefixes[0]}_roll`]!.p[2]-model.height,height=shortest*.81-drop+footStack;
 const targets=prefixes.map((p,i)=>{const old=footSole(footNodes[i]!,home[footNodes[i]!.id]!),offset=d.robot==='quadruped'?[0,.5,.75,.25][i]!:i*.5,lp=(phase+offset)%1,cycle=moving?footCycle(lp,stride,lift,duty):{x:0,y:0,stance:true};return{p,lp,point:[old[0]+cycle.x,old[1],cycle.y] as V3,stance:cycle.stance,weight:moving?(cycle.stance?smooth(lp/.1)*smooth((duty-lp)/.12):0):1};});
 const weight=targets.reduce((a,t)=>a+t.weight,0),aim=mul(targets.reduce((a,t)=>add(a,mul(t.point,t.weight)),[0,0,0] as V3),1/Math.max(weight,1e-9));
 const base:Transform={p:[0,0,height],q:[1,0,0,0]};let poses:Record<string,Transform>=home,com:V3=[0,0,0];
 // A slow reference transfers COM before lifting a foot. The support margin
 // is calculated from the resulting geometry, rather than asserted stable.
 for(let k=0;k<10;k++){
  for(const t of targets)legIK(model,q,t.p,t.point,base);
  if(d.robot==='biped'&&moving){for(const [side,p] of [[1,'left_arm'],[-1,'right_arm']] as const){q[`${p}_pitch`]=.12+side*.16*Math.sin(phase*Math.PI*2);q[`${p}_elbow`]=-.35-side*.08*Math.sin(phase*Math.PI*2);}}
  poses=fk(model,q,base);com=centreOfMass(model,poses);
  const rollsFree=prefixes.every(p=>model.nodes.find(n=>n.id===`${p}_roll`)!.joint!.active);
  if(k<9){base.p[0]=clamp(base.p[0]+(aim[0]-com[0])*.8,-shortest*.28,shortest*.28);if(rollsFree)base.p[1]=clamp(base.p[1]+(aim[1]-com[1])*.8,-shortest*.48,shortest*.48);}
 }
 const contacts:V3[]=[],footprint:V3[]=[];let trackingError=0;
 for(const [i,t] of targets.entries()){
  const n=footNodes[i]!,actual=footSole(n,poses[n.id]!);trackingError=Math.max(trackingError,norm(sub(actual,t.point)));
  if(t.stance){contacts.push(actual);const c=n.components.find(c=>c.role==='foot')!,hx=c.shape==='sphere'?.009:c.size[0]/2,hy=c.shape==='sphere'?.009:c.size[1]/2;for(const x of [-hx,hx])for(const y of [-hy,hy])footprint.push(add(actual,[x,y,0]));}
 }
 return{q,poses,travel:moving?time*stride/(duty*period):0,contacts,com,supportMargin:polygonMargin(com,convexHull(footprint)),trackingError,phase};
}
