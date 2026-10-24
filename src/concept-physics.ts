import loadMujoco,{type MainModule,type MjModel,type MjData} from '@mujoco/mujoco';
import {type RobotModel,type V3,type Q4,type Transform,exportMJCF,fk,clamp,rotate,inverseQ} from './concept-model.js';
import {PPO,RNG,type Sample,type PolicyFile} from './concept-rl.js';
export type Task='stand'|'walk';
export interface PhysicsSnapshot{fingerprint:string;poses:Record<string,Transform>;q:Record<string,number>;time:number;tilt:number;speed:number;contacts:number;height:number;energy:number;distance:number;cot:number|null;torque:number;reward:number;fallen:boolean}
export async function loadPhysics(locateFile?:(path:string)=>string){return await loadMujoco(locateFile?{locateFile}:undefined);}
export class Physics{
 model:MjModel;data:MjData;policy:PPO;task:Task='stand';rng=new RNG(123);qadr:number[]=[];vadr:number[]=[];bids:Record<string,number>={};floating:boolean;episodeSteps=0;lastReward=0;sumReward=0;episodeReturn=0;episodes:number[]=[];work=0;startX=0;lastAction:number[];target:Record<string,number>;torque=0;
 constructor(public mj:MainModule,public robot:RobotModel,task:Task='stand'){
  this.task=task;this.model=mj.MjModel.from_xml_string(exportMJCF(robot));this.data=new mj.MjData(this.model);this.floating=robot.design.robot!=='arm';this.target={...robot.home};this.lastAction=robot.active.map(()=>0);
  for(const j of robot.active){const id=mj.mj_name2id(this.model,3,j.id);this.qadr.push(this.model.jnt_qposadr[id]);this.vadr.push(this.model.jnt_dofadr[id]);}
  for(const n of robot.nodes)this.bids[n.id]=mj.mj_name2id(this.model,1,n.id);
  this.reset();this.policy=new PPO(this.observe().length,robot.active.length,robot.fingerprint,task);
 }
 dispose(){this.data.delete();this.model.delete();}
 reset(random=false,q?:Record<string,number>){const m=this.model,d=this.data;this.mj.mj_resetData(m,d);if(this.floating){d.qpos[2]=this.robot.height;d.qpos[3]=1;if(random){d.qpos[3]=Math.cos(.015);d.qpos[4]=.03*(this.rng.uniform()-.5);d.qpos[5]=.03*(this.rng.uniform()-.5);}}
  this.robot.active.forEach((j,i)=>d.qpos[this.qadr[i]!]=(q?.[j.id]??this.robot.home[j.id]!)+(random&&j.kind==='hinge'?(this.rng.uniform()-.5)*.025:0));
  if(this.robot.design.robot==='arm'){const id=this.mj.mj_name2id(m,3,'finger_mirror');if(id>=0)d.qpos[m.jnt_qposadr[id]]=q?.gripper??this.robot.home.gripper??.025;}
  this.mj.mj_forward(m,d);this.episodeSteps=0;this.episodeReturn=0;this.work=0;this.startX=d.xpos[3*this.bids.base!];this.lastAction.fill(0);
 }
 reference(){const q={...this.target};if(this.robot.design.robot==='biped'){const id=this.bids.base!,up=rotate([...this.data.xquat.slice(id*4,id*4+4)] as Q4,[0,0,1]),pitch=Math.atan2(up[0],up[2]),roll=-Math.atan2(up[1],up[2]);for(const n of ['left','right']){q[`${n}_ankle`]=this.target[`${n}_ankle`]!+2*pitch+.4*this.data.qvel[4];q[`${n}_ankle_roll`]=this.target[`${n}_ankle_roll`]!+1.6*roll+.3*this.data.qvel[3];q[`${n}_pitch`]=this.target[`${n}_pitch`]!-.2*pitch;}}if(this.task==='stand'||this.robot.design.robot==='arm')return q;
  const period=1.2,speed=this.robot.design.speed,stride=speed*period,phase=(this.data.time/period)%1,legs=this.robot.design.robot==='quadruped'?['fl','fr','rl','rr']:['left','right'];
  legs.forEach((name,i)=>{const p=(phase+(this.robot.design.robot==='quadruped'?[0,.5,.75,.25][i]!:i*.5))%1,duty=this.robot.design.robot==='quadruped'?.75:.7,stance=p<duty,u=stance?p/duty:(p-duty)/(1-duty),smooth=u*u*(3-2*u),plannedX=stance?stride*(.5-u):stride*(smooth-.5),baseId=this.bids.base!,baseQuat=[...this.data.xquat.slice(baseId*4,baseId*4+4)] as Q4,baseUp=rotate(baseQuat,[0,0,1]),pitch=Math.atan2(baseUp[0],baseUp[2]),roll=-Math.atan2(baseUp[1],baseUp[2]),x=plannedX+.16*((this.floating?this.data.qvel[0]:0)-speed)+.1*pitch+.025*(this.floating?this.data.qvel[4]:0),lift=stance?0:.035*Math.sin(Math.PI*u)**2;
   const L1=this.robot.nodes.find(n=>n.id===`${name}_pitch`)!.member!.length,L2=this.robot.nodes.find(n=>n.id===`${name}_knee`)!.member!.length,h=(L1+L2)*Math.cos(.48)-lift,c=clamp((x*x+h*h-L1*L1-L2*L2)/(2*L1*L2),-.995,.995),k=Math.acos(c),hip=-Math.atan2(x,h)-Math.atan2(L2*Math.sin(k),L1+L2*Math.cos(k));
   const ramp=Math.min(1,this.data.time/1.2),mix=ramp*ramp*(3-2*ramp);q[`${name}_pitch`]=this.target[`${name}_pitch`]!+(hip-this.target[`${name}_pitch`]!)*mix;q[`${name}_knee`]=this.target[`${name}_knee`]!+(k-this.target[`${name}_knee`]!)*mix;q[`${name}_roll`]=-.5*roll-.08*(this.floating?this.data.qvel[3]:0);if(`${name}_ankle` in q)q[`${name}_ankle`]=-hip-k;
   if(this.robot.design.robot==='biped'){q[`${name}_roll`]=.06*Math.sin(2*Math.PI*phase);q[`${name}_ankle_roll`]=-.06*Math.sin(2*Math.PI*phase);}
  });return q;
 }
 observe(){const d=this.data,base=this.bids.base!,quat=[...d.xquat.slice(base*4,base*4+4)] as Q4,g=rotate(inverseQ(quat),[0,0,-1]),ref=this.reference(),v=this.floating?[d.qvel[0],d.qvel[1],d.qvel[2],d.qvel[3]*.3,d.qvel[4]*.3,d.qvel[5]*.3]:[0,0,0,0,0,0];const obs=[...g,...v,Math.sin(this.data.time*Math.PI*2/1.2),Math.cos(this.data.time*Math.PI*2/1.2),this.task==='walk'?this.robot.design.speed:0];
  this.robot.active.forEach((j,i)=>obs.push((d.qpos[this.qadr[i]!]-ref[j.id]!)*(j.kind==='slide'?20:1),d.qvel[this.vadr[i]!]*(j.kind==='slide'?2:.15),this.lastAction[i]!*.25));return obs.map(v=>clamp(v,-5,5));
 }
 step(action:number[]){const d=this.data,m=this.model,ref=this.reference();let maxTorque=0;
  for(let substep=0;substep<10;substep++){
   for(let i=0;i<this.robot.active.length;i++){const j=this.robot.active[i]!,range=j.kind==='slide'?.008:.20,target=clamp(ref[j.id]!+clamp(action[i]??0,-1,1)*range,j.min,j.max),kp=j.kind==='slide'?220:90*j.motorScale,kd=j.kind==='slide'?8:3.8*Math.sqrt(j.motorScale),limit=j.kind==='slide'?40:this.robot.design.motorTorque*j.motorScale;
    const torque=clamp(kp*(target-d.qpos[this.qadr[i]!])-kd*d.qvel[this.vadr[i]!]+d.qfrc_bias[this.vadr[i]!],-limit,limit);d.ctrl[i]=torque;maxTorque=Math.max(maxTorque,Math.abs(torque)/limit);this.work+=Math.abs(torque*d.qvel[this.vadr[i]!])*.002;
   }this.mj.mj_step(m,d);
  }
  this.episodeSteps++;this.lastAction=[...action];this.torque=maxTorque;const base=this.bids.base!,quat=[...d.xquat.slice(base*4,base*4+4)] as Q4,up=rotate(quat,[0,0,1]),tilt=Math.acos(clamp(up[2],-1,1)),h=d.xpos[base*3+2],v=this.floating?d.qvel[0]:0;
  const tracking=this.robot.active.reduce((a,j,i)=>a+(d.qpos[this.qadr[i]!]-ref[j.id]!)**2,0)/this.robot.active.length,energy=this.robot.active.reduce((s,_,i)=>s+(d.ctrl[i]/(this.robot.design.motorTorque*this.robot.active[i]!.motorScale))**2,0)/this.robot.active.length;
  const fallen=this.floating&&(h<this.robot.height*.50||tilt>1.1),reward=2*Math.exp(-5*tilt*tilt)+Math.exp(-4*tracking)+ (this.task==='walk'?2*Math.exp(-8*(v-this.robot.design.speed)**2):Math.exp(-4*v*v))-.05*energy-.01*action.reduce((s,a)=>s+a*a,0)/action.length-(fallen?4:0);
  this.lastReward=reward;this.episodeReturn+=reward;const done=fallen||this.episodeSteps>=400||!Number.isFinite(reward);if(done){this.episodes.push(this.episodeReturn);if(this.episodes.length>30)this.episodes.shift();}return{reward,done,fallen};
 }
 snapshot():PhysicsSnapshot{const d=this.data,poses:Record<string,Transform>={};for(const [name,id] of Object.entries(this.bids))poses[name]={p:[...d.xpos.slice(id*3,id*3+3)] as V3,q:[...d.xquat.slice(id*4,id*4+4)] as Q4};const base=poses.base!,up=rotate(base.q,[0,0,1]),distance=base.p[0]-this.startX;return{fingerprint:this.robot.fingerprint,poses,q:Object.fromEntries(this.robot.active.map((j,i)=>[j.id,d.qpos[this.qadr[i]!]])),time:d.time,tilt:Math.acos(clamp(up[2],-1,1)),speed:this.floating?d.qvel[0]:0,contacts:d.ncon,height:base.p[2],energy:this.work,distance,cot:distance>.1?this.work/(this.robot.mass*9.80665*distance):null,torque:this.torque,reward:this.lastReward,fallen:this.floating&&(base.p[2]<this.robot.height*.5||Math.acos(clamp(up[2],-1,1))>1.1)};}
 trainBatch(steps=512){const samples:Sample[]=[];for(let i=0;i<steps;i++){const obs=this.observe(),a=this.policy.act(obs),s=this.step(a.action);samples.push({obs,...a,reward:s.reward,done:s.done});if(s.done)this.reset(true);}
  const loss=this.policy.update(samples,this.policy.value(this.observe())),reward=samples.reduce((s,a)=>s+a.reward,0)/samples.length,episode=this.episodes.length?this.episodes.reduce((a,b)=>a+b,0)/this.episodes.length:this.episodeReturn;this.policy.history.push({steps:this.policy.steps,reward,episode,loss});return{steps:this.policy.steps,updates:this.policy.updates,reward,episode,loss};
 }
 loadPolicy(p:PolicyFile){this.policy.load(p);this.task=p.task as Task;}
}
