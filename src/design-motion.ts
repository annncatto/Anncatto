import {type RobotModel,type Transform,type V3,type Node,fk,inverseArm,rotate,add,sub,mul,unit,norm,clamp,qm,inverseQ} from './concept-model.js';
import {planCentroidal} from './design-gait.js';
import {inverse2R} from './lightweight-kinematics.js';
import {sourceLegGeometry,sourceLegIK,sourceSolePoint} from './source-leg-kinematics.js';
export interface MotionFrame{q:Record<string,number>;poses:Record<string,Transform>;travel:number;contacts:V3[];supportPolygon:V3[];com:V3;supportMargin:number;trackingError:number;orientationError:number;phase:number;zmp?:V3;plannerValid?:boolean;plannerReason?:string;stage:'pose'|'settle'|'motion';ikConverged?:boolean;cartesianTarget?:V3}
const smooth=(x:number)=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
const ease=(x:number)=>{const u=clamp(x,0,1);return u*u*u*(10+u*(-15+6*u));};
export const motionPeriod=(model:RobotModel)=>model.design.gaitPeriod??(model.design.robot==='arm'?5:model.design.robot==='biped'?(model.design.legModel==='rp1'?2.4:1.6):3.2);
export const preparationTime=(_model:RobotModel)=>1;
export const motionDuration=(model:RobotModel)=>preparationTime(model)+motionPeriod(model);
/** The target curve is shared by IK, the viewer and exported motion inputs. */
export function armCircleSettings(model:RobotModel){
 const d=model.design,plane=d.armCirclePlane??'yz',radius=d.armCircleRadius??.025,p=fk(model,model.home).tool!.p;
 // Preserve legacy designs without a plane. New circles sit below the home
 // TCP to retain reach margin while keeping its orientation fixed.
 const centre=d.armCircleCenter??(d.armCirclePlane?[p[0],p[1],p[2]-radius] as V3:add(p,[0,radius,0]));
 return{plane,radius,centre};
}
export function armCirclePoint(model:RobotModel,phase:number):V3{
 const {plane,radius,centre}=armCircleSettings(model),point=[...centre] as V3,angle=2*Math.PI*phase;
 point[plane==='xz'?0:1]-=radius*Math.cos(angle);point[2]+=radius*Math.sin(angle);return point;
}
const legPrefixes=(model:RobotModel)=>model.design.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'];
function shortestLeg(model:RobotModel){
 const source=!!model.design.legModel&&model.design.legModel!=='concept';
 return Math.min(...legPrefixes(model).map(p=>source?sourceLegGeometry(model,p).length:model.nodes.find(n=>n.id===`${p}_pitch`)!.member!.length+model.nodes.find(n=>n.id===`${p}_knee`)!.member!.length));
}
/** Defaults and effective inputs shared by planning and the interface. */
export function motionSettings(model:RobotModel){
 const period=motionPeriod(model);if(model.design.robot==='arm')return{period,stride:0,lift:0,...armCircleSettings(model)};
 const shortest=shortestLeg(model);
 // RP1 uses the measured nominal reference from the source-model parameter
 // sweep. This point passed; neighbouring periods did not all pass.
 return{period,stride:model.design.strideLength??(model.design.legModel==='rp1'?.06:shortest*(model.design.robot==='quadruped'?.24:.18)),lift:model.design.stepHeight??(model.design.legModel==='rp1'?.025:Math.min(.045,shortest*.065))};
}
export function centreOfMass(model:RobotModel,poses:Record<string,Transform>):V3{return mul(model.nodes.reduce((sum,n)=>add(sum,mul(add(poses[n.id]!.p,rotate(poses[n.id]!.q,n.com)),n.mass)),[0,0,0] as V3),1/model.mass);}
const cross2=(a:V3,b:V3,c:V3)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function convexHull(points:V3[]){const pts=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(pts.length<3)return pts;const lower:V3[]=[],upper:V3[]=[];for(const p of pts){while(lower.length>=2&&cross2(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}for(const p of pts.reverse()){while(upper.length>=2&&cross2(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
export function polygonMargin(p:V3,polygon:V3[]){if(polygon.length<3)return-1;return Math.min(...polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length]!;return cross2(a,b,p)/Math.max(1e-9,Math.hypot(b[0]-a[0],b[1]-a[1]));}));}
export function footSole(n:Node,pose:Transform):V3{return sourceSolePoint(n,pose);}
export function soleCorners(n:Node,pose:Transform):V3[]{if(n.contactPoints)return n.contactPoints.map(p=>add(pose.p,rotate(pose.q,p)));const c=n.components.find(c=>c.role==='foot')!;if(c.shape==='sphere')return[footSole(n,pose)];return[-1,1].flatMap(x=>[-1,1].map(y=>add(pose.p,rotate(pose.q,add(c.p,rotate(c.q,[x*c.size[0]/2,y*c.size[1]/2,-c.size[2]/2]))))));}
function contactPatch(n:Node,pose:Transform){return soleCorners(n,pose).filter(p=>Math.abs(p[2])<=.002);}
const contactCentre=(patch:V3[]):V3=>mul(patch.reduce((sum,p)=>add(sum,p),[0,0,0] as V3),1/patch.length);
/** Display in the ground frame. Camera following must not change this transform. */
export function groundFrame(frame:MotionFrame):MotionFrame{const shift=(p:V3):V3=>[p[0]+frame.travel,p[1],p[2]];return{...frame,poses:Object.fromEntries(Object.entries(frame.poses).map(([id,p])=>[id,{p:shift(p.p),q:p.q}])),contacts:frame.contacts.map(shift),supportPolygon:frame.supportPolygon.map(shift),com:shift(frame.com),zmp:frame.zmp?shift(frame.zmp):undefined};}
function legIK(model:RobotModel,q:Record<string,number>,prefix:string,target:V3,base:Transform){
 if(model.design.legModel&&model.design.legModel!=='concept'){sourceLegIK(model,q,prefix,target,base);return;}
 const roll=model.nodes.find(n=>n.id===`${prefix}_roll`)!,upper=model.nodes.find(n=>n.id===`${prefix}_pitch`)!,knee=model.nodes.find(n=>n.id===`${prefix}_knee`)!,tip=model.nodes.find(n=>n.group===prefix&&n.tip==='foot')!,side=prefix==='fl'||prefix==='rl'||prefix==='left'?1:-1;
 const poses=fk(model,{...q,[roll.id]:0},base),origin=poses[roll.id]!.p,foot=tip.components.find(c=>c.role==='foot')!,biped=model.design.robot==='biped',ankle=model.nodes.find(n=>n.id===`${prefix}_ankle`),extra=biped?-tip.offset[2]:ankle?-foot.p[2]:0,r=foot.shape==='sphere'?foot.size[0]:foot.size[2]/2;
 // With a flat humanoid sole, the final foot offset is fixed in world axes.
 // The small ankle riser rotates with hip roll and is included below.
 const fixed:V3=biped?[foot.p[0],0,foot.p[2]-r]:[0,0,-r];
 const v=sub(sub(target,origin),fixed),radius=Math.hypot(v[1],v[2]);let phi=roll.joint!.active?Math.atan2(v[2],v[1])+Math.acos(clamp(side*Math.abs(upper.offset[1])/radius,-1,1)):roll.joint!.home;
 phi=clamp(phi,roll.joint!.min,roll.joint!.max);
 const z=-Math.sin(phi)*v[1]+Math.cos(phi)*v[2]+extra,l1=upper.member!.length,l2=knee.member!.length;
 const ik=inverse2R(l1,l2,-z,-v[0],model.design.robot==='quadruped'?-1:1);q[roll.id]=phi;if(upper.joint!.active)q[upper.id]=clamp(ik.q1,upper.joint!.min,upper.joint!.max);if(knee.joint!.active)q[knee.id]=clamp(ik.q2,knee.joint!.min,knee.joint!.max);
 if(ankle?.joint?.active)q[ankle.id]=clamp(-q[upper.id]!-q[knee.id]!,ankle.joint.min,ankle.joint.max);
 const ar=model.nodes.find(n=>n.id===`${prefix}_ankle_roll`);if(ar?.joint?.active)q[ar.id]=clamp(-phi,ar.joint.min,ar.joint.max);
}
const gaitCache=new WeakMap<RobotModel,ReturnType<typeof createGaitData>>();
function footTargets(model:RobotModel,phase:number,cycle:number,stride:number,lift:number){
 const prefixes=model.design.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'],home=fk(model,model.home),duty=model.design.robot==='quadruped'?.79:.66;
 return prefixes.map((p,i)=>{const node=model.nodes.find(n=>n.group===p&&n.tip==='foot')!,old=footSole(node,home[node.id]!),offset=model.design.robot==='quadruped'?[0,.5,.75,.25][i]!:i*.5,start=duty-offset,end=1-offset,u=clamp((phase-start)/(end-start),0,1),stance=phase<start||phase>=end;
 return{p,point:[old[0]+stride*(cycle+ease(u/.82)),old[1],stance?0:lift*(u<.5?ease(2*u):1-ease(2*u-1))] as V3,stance};});
}
function realizeLegPose(model:RobotModel,q:Record<string,number>,prefixes:string[],targets:{p:string;point:V3}[],height:number,aim:V3,armWave:number){
 const base:Transform={p:[0,0,height],q:[1,0,0,0]};let poses=fk(model,q,base),com:V3=[0,0,0];
 for(let k=0;k<7;k++){
  for(const t of targets)legIK(model,q,t.p,t.point,base);
  if(model.design.robot==='biped'&&(!model.design.legModel||model.design.legModel==='concept'))for(const [side,p] of [[1,'left_arm'],[-1,'right_arm']] as const){q[`${p}_pitch`]=model.home[`${p}_pitch`]!+side*.10*armWave;q[`${p}_elbow`]=model.home[`${p}_elbow`]!-side*.05*armWave;}
  poses=fk(model,q,base);com=centreOfMass(model,poses);
  if(k<6){base.p[0]+=aim[0]-com[0];if(prefixes.every(p=>model.nodes.find(n=>n.id===`${p}_roll`)!.joint!.active))base.p[1]+=aim[1]-com[1];}
 }
 return{base,poses,com};
}
function createGaitData(model:RobotModel){
 const prefixes=model.design.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'],home=fk(model,model.home),footNodes=prefixes.map(p=>model.nodes.find(n=>n.group===p&&n.tip==='foot')!),q={...model.home};
 const shortest=shortestLeg(model),{stride,lift}=motionSettings(model);
 // A moderate flexion leaves reach margin; the sole offsets are already
 // represented by the model and its neutral stance.
 const height=model.height-shortest*.055,base:Transform={p:[0,0,height],q:[1,0,0,0]};
 for(const t of footTargets(model,0,0,stride,lift))legIK(model,q,t.p,t.point,base);
 const origin=centreOfMass(model,fk(model,q,base));
 const polygon=(phase:number)=>convexHull(footTargets(model,phase,0,stride,lift).flatMap((t,i)=>{
  if(!t.stance)return[];const c=footNodes[i]!.components.find(c=>c.role==='foot')!;
  if(c.shape==='sphere')return[t.point];const node=footNodes[i]!,centre=footSole(node,home[node.id]!);
  return soleCorners(node,home[node.id]!).map(p=>add(t.point,sub(p,centre)));
 }));
 const events=model.design.robot==='quadruped'?[.04,.25,.29,.5,.54,.75,.79,1]:[.16,.5,.66,1];
 let plan=planCentroidal(motionPeriod(model),stride,origin[2],origin,polygon,events);
 if((model.design.robot==='quadruped'||model.design.legModel==='rp1')&&plan.valid){
  // Account for the motion of link COMs relative to the trunk when imposing
  // forward progress. Constraining only total COM velocity can still move the
  // trunk backwards during rapid swing-leg retraction.
  const previous=plan,N=192,offsets=Array.from({length:N},(_,i)=>{const phase=i/N,travel=stride*phase,desired=previous.sample(phase),targets=footTargets(model,phase,0,stride,lift).map(t=>({...t,point:sub(t.point,[travel,0,0])})),f=realizeLegPose(model,{...model.home},prefixes,targets,height,sub(desired.p,[travel,0,0]),0);return f.com[0]-f.base.p[0];});
  const velocities=offsets.map((_,i)=>(offsets[(i+1)%N]!-offsets[(i+N-1)%N]!)*N/(2*motionPeriod(model))),bias=(phase:number)=>{const x=phase*N,i=Math.floor(x)%N,u=x-Math.floor(x);return velocities[i]!*(1-u)+velocities[(i+1)%N]!*u;};
  plan=planCentroidal(motionPeriod(model),stride,origin[2],origin,polygon,events,bias);
 }
 return{prefixes,footNodes,home,height,stride,lift,plan};
}
function gaitData(model:RobotModel){let data=gaitCache.get(model);if(!data){data=createGaitData(model);gaitCache.set(model,data);}return data;}
export function motionFrame(model:RobotModel,time:number,moving=true):MotionFrame{
 const q={...model.home},d=model.design;
 if(d.robot==='arm'){
  const home=fk(model,q),p=home.tool!.p,T=motionPeriod(model),elapsed=Math.max(0,time-preparationTime(model)),phase=elapsed/T-Math.floor(elapsed/T),start=armCirclePoint(model,0),circle=armCirclePoint(model,ease(phase)),target=moving?(time<preparationTime(model)?add(p,mul(sub(start,p),ease(time/preparationTime(model)))):circle):p;
  const result=moving?inverseArm(model,q,target,d.armModel==='aloha'||model.active.filter(j=>j.kind==='hinge').length>=6?home.tool!.q:undefined):{q,error:0,converged:true},poses=fk(model,result.q),qr=qm(home.tool!.q,inverseQ(poses.tool!.q));
  return{q:result.q,poses,ikConverged:result.converged,cartesianTarget:target,travel:0,contacts:[],supportPolygon:[],com:centreOfMass(model,poses),supportMargin:0,trackingError:result.error,orientationError:d.armModel==='aloha'||model.active.filter(j=>j.kind==='hinge').length>=6?2*Math.acos(clamp(Math.abs(qr[0]),-1,1)):0,phase,stage:moving?(time<preparationTime(model)?'settle':'motion'):'pose'};
 }
 if(!moving){const poses=fk(model,q),nodes=model.nodes.filter(n=>n.tip==='foot'),patches=nodes.map(n=>contactPatch(n,poses[n.id]!)).filter(p=>p.length),contacts=patches.map(contactCentre),points=patches.flat(),com=centreOfMass(model,poses),supportPolygon=convexHull(points);return{q,poses,contacts,supportPolygon,com,supportMargin:polygonMargin(com,supportPolygon),trackingError:0,orientationError:0,travel:0,phase:0,stage:'pose'};}
 const data=gaitData(model),{prefixes,footNodes,height:readyHeight,stride,lift,home,plan}=data,period=motionPeriod(model);
 const settle=ease(time/preparationTime(model)),elapsed=Math.max(0,time-preparationTime(model)),cycle=Math.floor(elapsed/period),phase=elapsed/period-cycle,travel=stride*(cycle+phase);
 const height=model.height+(readyHeight-model.height)*settle;
 const targets=footTargets(model,phase,cycle,stride,lift).map(t=>({...t,point:[t.point[0]-travel,t.point[1],t.point[2]+(footSole(footNodes[prefixes.indexOf(t.p)]!,home[footNodes[prefixes.indexOf(t.p)]!.id]!)[2])*(1-settle)] as V3}));
 const desired=plan.sample(cycle+phase),startCOM=centreOfMass(model,home),aim:V3=[desired.p[0]-travel,desired.p[1],desired.p[2]];
 if(time<preparationTime(model)){
  const end=plan.sample(0),T=preparationTime(model),u=clamp(time/T,0,1);
  for(let k=0;k<2;k++){const delta=end.p[k]-startCOM[k],v=end.v[k]*T,a=end.a[k]*T*T;aim[k]=startCOM[k]+(10*delta-4*v+a/2)*u**3+(-15*delta+7*v-a)*u**4+(6*delta-3*v+a/2)*u**5;}
 }
 const armWave=time<preparationTime(model)?(()=>{const u=time/preparationTime(model),v=2*Math.PI/motionPeriod(model)*preparationTime(model);return -4*v*u**3+7*v*u**4-3*v*u**5;})():Math.sin(phase*Math.PI*2);
 const {poses,com}=realizeLegPose(model,q,prefixes,targets,height,aim,armWave);
 const contacts:V3[]=[],footprint:V3[]=[];let trackingError=0,orientationError=0;
 for(const [i,t] of targets.entries()){
  const n=footNodes[i]!,actual=footSole(n,poses[n.id]!);trackingError=Math.max(trackingError,norm(sub(actual,t.point)));
  if(d.robot==='biped'){
   if(d.legModel&&d.legModel!=='concept'){const difference=qm(home[n.id]!.q,inverseQ(poses[n.id]!.q));orientationError=Math.max(orientationError,2*Math.atan2(Math.hypot(difference[1],difference[2],difference[3]),Math.abs(difference[0])));}
   else{const up=rotate(poses[n.id]!.q,[0,0,1]);orientationError=Math.max(orientationError,Math.acos(clamp(up[2],-1,1)));}
  }
  const patch=contactPatch(n,poses[n.id]!);if(t.stance&&patch.length){contacts.push(contactCentre(patch));footprint.push(...patch);}
 }
 const supportPolygon=convexHull(footprint);
 return{q,poses,travel,contacts,supportPolygon,com,zmp:sub(desired.zmp,[travel,0,0]),plannerValid:plan.valid,plannerReason:plan.reason,supportMargin:polygonMargin(com,supportPolygon),trackingError,orientationError,phase:clamp(time/motionDuration(model),0,1),stage:time<preparationTime(model)?'settle':'motion'};
}
