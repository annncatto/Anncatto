import {type MainModule,type MjModel,type MjData} from '@mujoco/mujoco';
import {jointTorqueLimit,jointRotorInertia,type RobotModel,type V3,type Q4,rotate,sub,norm,qm,inverseQ,clamp} from './concept-model.js';
import {groundFrame,motionFrame,soleCorners} from './design-motion.js';
import {quadraticProgram} from './design-qp.js';
import {type DynamicsFrame} from './design-dynamics.js';
/** Torque-limited weighted whole-body inverse dynamics. Six unactuated
 * equations and an inscribed friction pyramid are hard constraints; stance
 * acceleration, floating-base tracking and posture are weighted tasks. */
export function createWholeBodyController(mj:MainModule,m:MjModel,d:MjData,robot:RobotModel){
 const nv=m.nv,weight=robot.mass*9.80665,jointIds=robot.active.map(j=>mj.mj_name2id(m,3,j.id)),bodyIds=Object.fromEntries(robot.nodes.map(n=>[n.id,mj.mj_name2id(m,1,n.id)]));
 const massBuffer=new mj.DoubleBuffer(nv*nv),jacBuffer=new mj.DoubleBuffer(3*nv),dotBuffer=new mj.DoubleBuffer(3*nv),rotBuffer=new mj.DoubleBuffer(3*nv);
 function solve(time:number,reference:DynamicsFrame){
  mj.mj_forward(m,d);mj.mj_fullM(m,d,massBuffer);const M=massBuffer.GetView() as Float64Array,ref=groundFrame(motionFrame(robot,time)),poses=Object.fromEntries(robot.nodes.map(n=>{const i=bodyIds[n.id];return[n.id,{p:Array.from(d.xpos.slice(3*i,3*i+3)) as V3,q:Array.from(d.xquat.slice(4*i,4*i+4)) as Q4}];}));
  const contacts=robot.nodes.filter(n=>n.tip==='foot').flatMap(n=>{
   const planned=soleCorners(n,ref.poses[n.id]!),centre=planned.reduce((s,p)=>s.map((v,k)=>v+p[k]/planned.length) as V3,[0,0,0] as V3);if(!ref.contacts.some(p=>norm(sub(p,centre))<.003))return[];
   return soleCorners(n,poses[n.id]!).map((point,k)=>({id:n.id,point,target:[planned[k]![0],planned[k]![1],0] as V3}));
  });
  const nf=3*contacts.length,n=nv+nf,H=Array.from({length:n},()=>Array(n).fill(0)),g=Array(n).fill(0),rows:number[][]=[],bounds:number[]=[],J:number[][]=[],JD:number[][]=[];
  contacts.forEach(c=>{mj.mj_jac(m,d,jacBuffer,rotBuffer,c.point,bodyIds[c.id]);mj.mj_jacDot(m,d,dotBuffer,rotBuffer,c.point,bodyIds[c.id]);const jac=jacBuffer.GetView() as Float64Array,jd=dotBuffer.GetView() as Float64Array;for(let axis=0;axis<3;axis++){J.push(Array.from(jac.slice(axis*nv,(axis+1)*nv)));JD.push(Array.from(jd.slice(axis*nv,(axis+1)*nv)));}});
  const square=(row:number[],target:number,w:number)=>{const indices=row.flatMap((x,i)=>x?[i]:[]);for(const i of indices){g[i]-=2*w*row[i]*target;for(const j of indices)H[i][j]+=2*w*row[i]*row[j];}};
  for(let i=0;i<n;i++)H[i][i]=i<nv?1e-5:.02;
  const bias=Array.from({length:nv},(_,i)=>d.qfrc_bias[i]-d.qfrc_passive[i]),required=(i:number)=>[...Array.from(M.slice(i*nv,(i+1)*nv)),...J.map(row=>-row[i]*weight)];
  for(let i=0;i<6;i++){rows.push(required(i));bounds.push(-bias[i]);}
  for(let i=0;i<nf;i+=3)for(const [x,y] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const row=Array(n).fill(0);row[nv+i]=x;row[nv+i+1]=y;row[nv+i+2]=robot.design.groundFriction??.7;rows.push(row);bounds.push(0);}
  robot.active.forEach((joint,k)=>{const i=m.jnt_dofadr[jointIds[k]!],row=required(i),limit=jointTorqueLimit(robot,joint);rows.push(row,row.map(x=>-x));bounds.push(-limit-bias[i],-limit+bias[i]);const target=reference.acceleration[joint.id]!+60*(reference.q[joint.id]!-d.qpos[m.jnt_qposadr[jointIds[k]!]])+12*(reference.velocity[joint.id]!-d.qvel[i]);const task=Array(n).fill(0);task[i]=1;square(task,target,1);
   const position=d.qpos[m.jnt_qposadr[jointIds[k]!]],speed=d.qvel[i],dt=.01,maxSpeed=joint.velocityLimit??robot.design.outputSpeedLimit??8;
   const positive=Array(n).fill(0),negative=Array(n).fill(0);positive[i]=1;negative[i]=-1;
   rows.push(positive,negative,positive,negative);bounds.push((-maxSpeed-speed)/dt,(-maxSpeed+speed)/dt,2*(joint.min-position-speed*dt)/(dt*dt),-2*(joint.max-position-speed*dt)/(dt*dt));});
  const root=ref.poses.base!,actual=poses.base!,difference=qm(root.q,inverseQ(actual.q)),rotError=[difference[1],difference[2],difference[3]].map(x=>2*x*(difference[0]<0?-1:1));
  const eps=.002,minus=groundFrame(motionFrame(robot,time-eps)),plus=groundFrame(motionFrame(robot,time+eps));
  for(let i=0;i<6;i++){
   let target:number;if(i<3){const velocity=(plus.poses.base!.p[i]-minus.poses.base!.p[i])/(2*eps),acceleration=(plus.poses.base!.p[i]-2*root.p[i]+minus.poses.base!.p[i])/(eps*eps);target=acceleration+60*(root.p[i]-actual.p[i])+15*(velocity-d.qvel[i]);}else target=100*rotError[i-3]-20*d.qvel[i];
   const row=Array(n).fill(0);row[i]=1;square(row,target,i<3?100:150);
  }
  for(let k=0;k<nf;k++){
   const c=contacts[Math.floor(k/3)]!,axis=k%3,speed=J[k].reduce((s,x,i)=>s+x*d.qvel[i],0),drift=JD[k].reduce((s,x,i)=>s+x*d.qvel[i],0),target=-400*(c.point[axis]-c.target[axis])-40*speed-drift;
   square([...J[k],...Array(nf).fill(0)],target,1000);
  }
  // Swing feet are explicit Cartesian tasks, rather than incidental results
  // of low-priority joint posture tracking. Finish horizontal deceleration
  // before descent to avoid loading a foot that still has tangential speed.
  for(const foot of robot.nodes.filter(n=>n.tip==='foot'&&!contacts.some(c=>c.id===n.id))){
   const centre=(poses:typeof ref.poses)=>{const points=soleCorners(foot,poses[foot.id]!),c=points.reduce((s,p)=>s.map((v,k)=>v+p[k]/points.length) as V3,[0,0,0] as V3);const geometry=foot.components.find(c=>c.role==='foot')!;if(geometry.shape==='sphere')c[2]+=geometry.size[0];return c;},point=centre(poses),desired=centre(ref.poses),before=centre(minus.poses),after=centre(plus.poses);
   mj.mj_jac(m,d,jacBuffer,rotBuffer,point,bodyIds[foot.id]);mj.mj_jacDot(m,d,dotBuffer,rotBuffer,point,bodyIds[foot.id]);const jac=jacBuffer.GetView() as Float64Array,jdot=dotBuffer.GetView() as Float64Array;
   for(let k=0;k<3;k++){const row=Array.from(jac.slice(k*nv,(k+1)*nv)),speed=row.reduce((s,x,i)=>s+x*d.qvel[i],0),drift=Array.from(jdot.slice(k*nv,(k+1)*nv)).reduce((s,x,i)=>s+x*d.qvel[i],0),v=(after[k]-before[k])/(2*eps),a=(after[k]-2*desired[k]+before[k])/(eps*eps),target=a+200*(desired[k]-point[k])+28*(v-speed)-drift;square([...row,...Array(nf).fill(0)],target,100);}
  }
  const result=quadraticProgram(H,g,rows,bounds,6),torques=robot.active.map((j,k)=>{const i=m.jnt_dofadr[jointIds[k]!],tau=required(i).reduce((s,x,k)=>s+x*result.x[k],bias[i]),limit=jointTorqueLimit(robot,j);return clamp(tau,-limit,limit);});
  return{torques,residual:result.residual};
 }
 return{solve,dispose:()=>{massBuffer.delete();jacBuffer.delete();dotBuffer.delete();rotBuffer.delete();}};
}
