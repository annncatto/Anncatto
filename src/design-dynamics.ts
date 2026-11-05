import loadMujoco,{type MainModule} from '@mujoco/mujoco';
import {jointTorqueLimit,jointRotorInertia,jointDamping,type RobotModel,type V3,type Node,exportMJCF,add,sub,mul,dot,cross,norm,rotate,inverseQ,qm,unit} from './concept-model.js';
import {motionFrame,groundFrame,soleCorners,type MotionFrame} from './design-motion.js';
import {quadraticProgram} from './design-qp.js';
export const gravity=9.80665;
export interface BodyWrench{force:V3;moment:V3}
export interface ReferenceIssue{kind:'ik'|'derivative'|'nonfinite';time:number;trackingError:number;orientationError:number;derivativeError?:number}
export interface DynamicsFrame{referenceValid:boolean;referenceIssue?:ReferenceIssue;time:number;q:Record<string,number>;velocity:Record<string,number>;acceleration:Record<string,number>;torque:Record<string,number>;wrenches:Record<string,BodyWrench>;forces:{node:string;point:V3;force:V3}[];feasible:boolean;forceResidual:number;momentResidual:number;frictionUse:number;zmp:V3|null;engineError:number}
// Keep the exact checked stencil local to the dynamics/member calculation.
// This avoids recomputing IK on a different time step or another branch.
const checkedSamples=new WeakMap<DynamicsFrame,{samples:MotionFrame[];step:number}>();
export const dynamicsSamples=(frame:DynamicsFrame)=>checkedSamples.get(frame);
let runtime:Promise<MainModule>|undefined;
export function dynamicsRuntime(locateFile?:(path:string)=>string){return runtime??=loadMujoco(locateFile?{locateFile}:undefined);}
const rotationVector=(q:ReturnType<typeof qm>):V3=>{const sign=q[0]<0?-1:1,v:V3=[q[1]*sign,q[2]*sign,q[3]*sign],r=norm(v);return r<1e-12?mul(v,2):mul(v,2*Math.atan2(r,q[0]*sign)/r);};
const tensor=(n:Node,v:V3):V3=>{const I=n.inertia;return[I[0]*v[0]+I[3]*v[1]+I[4]*v[2],I[3]*v[0]+I[1]*v[1]+I[5]*v[2],I[4]*v[0]+I[5]*v[1]+I[2]*v[2]];};
/** Required rigid-body loads on a prescribed trajectory. Engine inverse
 * dynamics is evaluated without contact/limit constraints. A separate QP
 * supplies unilateral, friction-constrained contacts and leaves a measured
 * floating-base residual if those contacts cannot produce the motion. */
export function createDynamics(mj:MainModule,robot:RobotModel,friction=robot.design.groundFriction??.7){
 const xml=exportMJCF(robot).replace(/<option([^>]*)\/>/,'<option$1><flag constraint="disable"/></option>').replace(/<asset>[\s\S]*?<\/asset>/,'').replace(/<geom\b[^>]*\/>/g,'');
 const m=mj.MjModel.from_xml_string(xml),d=new mj.MjData(m),floating=robot.design.robot!=='arm',jointIds=robot.active.map(j=>mj.mj_name2id(m,3,j.id));
 const ancestors=new Map(robot.nodes.map(n=>{const set=new Set<string>();let p:Node|undefined=n;while(p){set.add(p.id);p=robot.nodes.find(n=>n.id===p!.parent);}return[n.id,set];}));
 const qpos=(frame:MotionFrame)=>{const q=Array.from(m.qpos0 as Float64Array);if(floating){q.splice(0,3,...frame.poses.base!.p);q.splice(3,4,...frame.poses.base!.q);}robot.active.forEach((j,i)=>q[m.jnt_qposadr[jointIds[i]!]]=frame.q[j.id]!);const mirror=mj.mj_name2id(m,3,'finger_mirror');if(mirror>=0)q[m.jnt_qposadr[mirror]]=frame.q.gripper!;return q;};
 const velocityBuffer=new mj.DoubleBuffer(m.nv);
 function evaluateSample(time:number,moving:boolean,step:number,refinements=0,previousError=Infinity):DynamicsFrame{
  if(!Number.isFinite(time)||!Number.isFinite(step)||step<=0)throw Error('Invalid dynamics sample time or step');
  const sample=(t:number)=>groundFrame(motionFrame(robot,t,moving)),f=sample(time),minus=sample(time-step),plus=sample(time+step),minus2=sample(time-2*step),plus2=sample(time+2*step),samples=[minus2,minus,f,plus,plus2];
  const invalid=(issue:ReferenceIssue):DynamicsFrame=>{
   const empty=()=>Object.fromEntries(robot.active.map(j=>[j.id,NaN]));
   return{time,q:f.q,velocity:empty(),acceleration:empty(),torque:empty(),wrenches:{},forces:[],feasible:false,referenceValid:false,referenceIssue:issue,forceResidual:NaN,momentResidual:NaN,frictionUse:NaN,zmp:null,engineError:NaN};
  };
  const issueAt=(frame:MotionFrame,t:number):ReferenceIssue|undefined=>{
   if(![...Object.values(frame.q),frame.trackingError,frame.orientationError,...Object.values(frame.poses).flatMap(p=>[...p.p,...p.q])].every(Number.isFinite))return{kind:'nonfinite',time:t,trackingError:frame.trackingError,orientationError:frame.orientationError};
   // A millimetre task tolerance is not an IK convergence criterion suitable
   // for a second derivative. Use the solver's own termination precision.
   if(frame.ikConverged===false||frame.trackingError>.001||frame.orientationError>.035)return{kind:'ik',time:t,trackingError:frame.trackingError,orientationError:frame.orientationError};
  };
  for(let i=0;i<samples.length;i++){const issue=issueAt(samples[i],time+(i-2)*step);if(issue)return invalid(issue);}
  const halfMinus=sample(time-step/2),halfPlus=sample(time+step/2);
  for(const [frame,t] of [[halfMinus,time-step/2],[halfPlus,time+step/2]] as const){const issue=issueAt(frame,t);if(issue)return invalid(issue);}
  let derivativeError=0;
  for(const joint of robot.active){
   const id=joint.id,q0=f.q[id],qm=minus.q[id],qp=plus.q[id],qmm=minus2.q[id],qpp=plus2.q[id],qmh=halfMinus.q[id],qph=halfPlus.q[id];
   const velocity=(qp-qm)/(2*step),fineVelocity=(qph-qmh)/step;
   const acceleration=(-qpp+16*qp-30*q0+16*qm-qmm)/(12*step*step),fineAcceleration=(-qp+16*qph-30*q0+16*qmh-qm)/(3*step*step);
   // Mixed absolute/relative discretization tolerance, independent of motor
   // torque/speed limits. Genuine high loads remain available for sizing.
   const vAbs=joint.kind==='slide'?1e-5:1e-3,aAbs=joint.kind==='slide'?1e-4:.05;
   derivativeError=Math.max(derivativeError,Math.abs(velocity-fineVelocity)/(vAbs+.005*Math.max(Math.abs(velocity),Math.abs(fineVelocity))),Math.abs(acceleration-fineAcceleration)/(aAbs+.02*Math.max(Math.abs(acceleration),Math.abs(fineAcceleration))));
  }
  if(!Number.isFinite(derivativeError)||derivativeError>1){
   // C² gait segments have continuous acceleration but can change jerk at a
   // seam. Refine the actual stencil, with a fixed budget and decreasing
   // error; never turn a failed IK result into a smaller-step load estimate.
   if(Number.isFinite(derivativeError)&&refinements<2&&derivativeError<previousError)return evaluateSample(time,moving,step/2,refinements+1,derivativeError);
   return invalid({kind:'derivative',time,trackingError:f.trackingError,orientationError:f.orientationError,derivativeError});
  }
  const q0=qpos(f),qp=qpos(plus),qn=qpos(minus),qpp=qpos(plus2),qnn=qpos(minus2);
  mj.mj_resetData(m,d);d.qpos.set(q0);mj.mj_differentiatePos(m,velocityBuffer,2*step,qn,qp);d.qvel.set(velocityBuffer.GetView());
  const am=Array.from({length:m.nv},()=>0);if(floating)for(let k=0;k<3;k++)am[k]=(-qpp[k]+16*qp[k]-30*q0[k]+16*qn[k]-qnn[k])/(12*step*step);
  robot.active.forEach((j,i)=>{const a=m.jnt_qposadr[jointIds[i]!],v=m.jnt_dofadr[jointIds[i]!];am[v]=(-qpp[a]+16*qp[a]-30*q0[a]+16*qn[a]-qnn[a])/(12*step*step);});
  const mirror=mj.mj_name2id(m,3,'finger_mirror');if(mirror>=0)am[m.jnt_dofadr[mirror]]=am[m.jnt_dofadr[jointIds[robot.active.findIndex(j=>j.id==='gripper')]!]];
  d.qacc.set(am);mj.mj_inverse(m,d);
  const b=Array.from(d.qfrc_inverse as Float64Array),contacts=robot.nodes.filter(n=>n.tip==='foot').flatMap(n=>{
   // Only scheduled stance feet contribute; a barely airborne swing foot must
   // not silently gain a reaction force through a geometric tolerance.
   const centre=soleCorners(n,f.poses[n.id]!).reduce((s,p)=>add(s,mul(p,1/soleCorners(n,f.poses[n.id]!).length)),[0,0,0] as V3);
   if(!f.contacts.some(p=>norm(sub(p,centre))<.003))return[];
   return soleCorners(n,f.poses[n.id]!).filter(p=>Math.abs(p[2])<.002).map(point=>({node:n.id,point}));
  });
  const base=f.poses.base!,weight=robot.mass*gravity,scale=.4;
  const W=Array.from({length:6},()=>Array(3*contacts.length).fill(0));
  contacts.forEach((c,i)=>{for(let k=0;k<3;k++){const e=[0,0,0] as V3;e[k]=1;W[k][3*i+k]=weight;const moment=rotate(inverseQ(base.q),cross(sub(c.point,base.p),e));for(let a=0;a<3;a++)W[3+a][3*i+k]=weight*moment[a];}});
  let forcesVector=Array(contacts.length*3).fill(0);
  if(floating&&contacts.length){
   const rows=W.map((row,i)=>row.map(x=>x/weight/(i<3?1:scale))),bounds=b.slice(0,6).map((v,i)=>v/weight/(i<3?1:scale));
   for(let i=0;i<contacts.length;i++)for(const [x,y] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const row=Array(forcesVector.length).fill(0);row[3*i]=x;row[3*i+1]=y;row[3*i+2]=friction;rows.push(row);bounds.push(0);}
   const H=forcesVector.map((_,i)=>forcesVector.map((_,j)=>i===j?1:0)),g=forcesVector.map(()=>0);
   try{forcesVector=quadraticProgram(H,g,rows,bounds,6).x;}catch{
    // Best admissible approximation remains visibly infeasible. No invented
    // supporting wrench is applied to the floating base.
    for(let i=0;i<H.length;i++)for(let j=0;j<H.length;j++)for(let k=0;k<6;k++)H[i][j]+=1e4*rows[k][i]*rows[k][j];
    for(let i=0;i<g.length;i++)for(let k=0;k<6;k++)g[i]-=1e4*rows[k][i]*bounds[k];
    try{forcesVector=quadraticProgram(H,g,rows.slice(6),bounds.slice(6)).x;}catch{}
   }
  }
  const forces=contacts.map((c,i)=>({...c,force:mul(forcesVector.slice(3*i,3*i+3) as V3,weight)})),residual=b.slice(0,6).map((x,k)=>x-W[k].reduce((s,a,i)=>s+a*forcesVector[i],0));
  const forceResidual=floating?norm(residual.slice(0,3) as V3):0,momentResidual=floating?norm(residual.slice(3,6) as V3):0;
  const torque:Record<string,number>={},velocity:Record<string,number>={},acceleration:Record<string,number>={};
  robot.active.forEach((j,i)=>{const v=m.jnt_dofadr[jointIds[i]!],pose=f.poses[j.id]!,axis=rotate(pose.q,j.axis);let t=b[v];for(const c of forces)if(ancestors.get(c.node)!.has(j.id))t-=dot(j.kind==='slide'?axis:cross(axis,sub(c.point,pose.p)),c.force);torque[j.id]=t;velocity[j.id]=d.qvel[v];acceleration[j.id]=d.qacc[v];});
  // Independent spatial Newton–Euler balance at every joint origin supplies
  // section resultants and a cross-check on engine generalized forces.
  const wrenches:Record<string,BodyWrench>={},inertial:Record<string,BodyWrench>={};
  for(const n of robot.nodes){
   const pose=f.poses[n.id]!,point=(frame:MotionFrame)=>add(frame.poses[n.id]!.p,rotate(frame.poses[n.id]!.q,n.com)),centre=point(f),points=[point(minus2),point(minus),centre,point(plus),point(plus2)],a=[0,1,2].map(k=>(-points[4][k]+16*points[3][k]-30*points[2][k]+16*points[1][k]-points[0][k])/(12*step*step)) as V3;
   const w=mul(rotationVector(qm(plus.poses[n.id]!.q,inverseQ(minus.poses[n.id]!.q))),1/(2*step)),wp=mul(rotationVector(qm(plus.poses[n.id]!.q,inverseQ(pose.q))),1/step),wn=mul(rotationVector(qm(pose.q,inverseQ(minus.poses[n.id]!.q))),1/step),alpha=mul(sub(wp,wn),1/step),Iw=rotate(pose.q,tensor(n,rotate(inverseQ(pose.q),w))),Ia=rotate(pose.q,tensor(n,rotate(inverseQ(pose.q),alpha))),force=mul(add(a,[0,0,gravity]),n.mass),moment=add(add(Ia,cross(w,Iw)),cross(sub(centre,pose.p),force));
   inertial[n.id]={force,moment};
  }
  for(const n of [...robot.nodes].reverse()){
   const w={force:[...inertial[n.id].force] as V3,moment:[...inertial[n.id].moment] as V3},origin=f.poses[n.id]!.p;
   for(const c of forces.filter(c=>c.node===n.id)){w.force=sub(w.force,c.force);w.moment=sub(w.moment,cross(sub(c.point,origin),c.force));}
   for(const child of robot.nodes.filter(c=>c.parent===n.id)){const cw=wrenches[child.id];w.force=add(w.force,cw.force);w.moment=add(w.moment,add(cw.moment,cross(sub(f.poses[child.id]!.p,origin),cw.force)));}
   wrenches[n.id]=w;
  }
  let engineError=0;for(const j of robot.active){const pose=f.poses[j.id]!,axis=rotate(pose.q,j.axis),w=wrenches[j.id],t=dot(axis,j.kind==='slide'?w.force:w.moment),rotor=j.kind==='hinge'?jointRotorInertia(robot,j)*acceleration[j.id]:.001*acceleration[j.id],damping=jointDamping(robot,j)*velocity[j.id];engineError=Math.max(engineError,Math.abs(t+rotor+damping-torque[j.id]));}
  const sum=forces.reduce((s,c)=>add(s,c.force),[0,0,0] as V3),moment=forces.reduce((s,c)=>add(s,cross(c.point,c.force)),[0,0,0] as V3),zmp=sum[2]>1e-6?[-moment[1]/sum[2],moment[0]/sum[2],0] as V3:null;
  const result:DynamicsFrame={referenceValid:true,time,q:f.q,velocity,acceleration,torque,wrenches,forces,feasible:forceResidual<.001*weight&&momentResidual<.001*weight*scale&&f.trackingError<.001&&f.orientationError<.035,forceResidual,momentResidual,frictionUse:Math.max(0,...forces.map(c=>Math.hypot(c.force[0],c.force[1])/Math.max(1e-9,friction*c.force[2]))),zmp,engineError};
  if(![...Object.values(torque),...Object.values(velocity),...Object.values(acceleration),engineError].every(Number.isFinite))return invalid({kind:'nonfinite',time,trackingError:f.trackingError,orientationError:f.orientationError});
  checkedSamples.set(result,{samples:[minus,f,plus],step});return result;
 }
 return{evaluate:(time:number,moving=true,step=.002)=>evaluateSample(time,moving,step),dispose:()=>{velocityBuffer.delete();d.delete();m.delete();}};
}
