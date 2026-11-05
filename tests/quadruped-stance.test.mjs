import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,fk,sub,dot,norm,rotate,exportMJCF} from '../.build/concept-model.js';
import {motionFrame,motionDuration,groundFrame,footSole} from '../.build/design-motion.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';

const make=extra=>generateRobot({...copyDesign(initialConcept),...extra});
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const prefixes=['fl','fr','rl','rr'];

test('unspecified quadruped stance retains the original defaults and source Go2 ignores concept stance inputs',()=>{
 const original=make(),explicit=make({quadHipPitch:.48,quadKneeFlexion:.96});
 assert.deepEqual(original.nodes,explicit.nodes);assert.deepEqual(original.home,explicit.home);close(original.height,explicit.height);close(original.mass,explicit.mass);
 close(original.height,.30*Math.cos(.48)+.31*Math.cos(.48)+.027+.001);
 for(const prefix of prefixes){close(original.home[prefix+'_pitch'],.48);close(original.home[prefix+'_knee'],-.96);}
 for(const time of [0,.4,1,2.2,4.2])assert.deepEqual(motionFrame(original,time),motionFrame(explicit,time));
 const source=make({legModel:'go2'}),ignored=make({legModel:'go2',quadHipPitch:.7,quadKneeFlexion:1.4});
 assert.deepEqual(source.nodes,ignored.nodes);assert.deepEqual(source.home,ignored.home);close(source.mass,ignored.mass);close(source.height,ignored.height);
});

test('quadruped stance changes joint coordinates and ground height while retaining installation geometry and mass',()=>{
 const original=make();
 for(const [hip,flex] of [[.3,.6],[.65,1.05],[.45,1.25],[.9,1.8]]){
  const model=make({quadHipPitch:hip,quadKneeFlexion:flex}),poses=fk(model,model.home),start=motionFrame(model,0);
  close(model.mass,original.mass);close(model.height,.30*Math.cos(hip)+.31*Math.cos(hip-flex)+.027+.001);
  for(const node of model.nodes){
   const unchanged=original.nodes.find(n=>n.id===node.id);
   for(const key of ['offset','originQ','member','components','mass','com','inertia'])assert.deepEqual(node[key],unchanged[key]);
   if(node.joint){assert.deepEqual(node.joint.axis,unchanged.joint.axis);close(node.joint.min,unchanged.joint.min);close(node.joint.max,unchanged.joint.max);}
  }
  for(const prefix of prefixes){
   close(model.home[prefix+'_pitch'],hip);close(model.home[prefix+'_knee'],-flex);
   const h=poses[prefix+'_pitch'].p,k=poses[prefix+'_knee'].p,f=poses[prefix+'_foot'].p;
   close(k[0]-h[0],-.30*Math.sin(hip));assert.ok(k[0]<h[0],'positive +Y hip angle tilts the thigh rearward');
   close(f[0]-h[0],-.30*Math.sin(hip)-.31*Math.sin(hip-flex));
   const kh=sub(h,k),kf=sub(f,k);close(Math.acos(dot(kh,kf)/norm(kh)/norm(kf)),Math.PI-flex);
   const foot=model.nodes.find(n=>n.id===prefix+'_foot');close(footSole(foot,poses[foot.id])[2],.001);
   for(const id of [prefix+'_pitch',prefix+'_knee'])close(start.q[id],model.home[id],1e-7);
  }
  assert.equal(start.contacts.length,4);assert.ok(start.trackingError<1e-8);
 }
});

test('adjusted quadruped stance drives continuous grounded IK and exported MuJoCo transforms',async()=>{
 const mj=await dynamicsRuntime();
 for(const [hip,flex] of [[.65,1.05],[.9,1.8]]){
  const model=make({quadHipPitch:hip,quadKneeFlexion:flex}),m=mj.MjModel.from_xml_string(exportMJCF(model)),d=new mj.MjData(m);
  try{
   for(let i=0;i<=64;i++){
    const time=motionDuration(model)*i/64,frame=groundFrame(motionFrame(model,time));
    assert.ok(frame.trackingError<1e-8);assert.ok(frame.plannerValid);
    for(const joint of model.active)assert.ok(frame.q[joint.id]>=joint.min-1e-10&&frame.q[joint.id]<=joint.max+1e-10);
    const next=groundFrame(motionFrame(model,time+.0001));
    for(const foot of model.nodes.filter(n=>n.tip==='foot')){
     const p=footSole(foot,frame.poses[foot.id]),q=footSole(foot,next.poses[foot.id]);assert.ok(p[2]>=-1e-8);
     if(time>=1&&frame.contacts.some(c=>norm(sub(c,p))<1e-7)&&next.contacts.some(c=>norm(sub(c,q))<1e-7))p.forEach((v,k)=>close(v,q[k],1e-7));
    }
    if(i%8)continue;
    mj.mj_resetData(m,d);d.qpos.set(frame.poses.base.p,0);d.qpos.set(frame.poses.base.q,3);
    for(const joint of model.active){const id=mj.mj_name2id(m,3,joint.id);d.qpos[m.jnt_qposadr[id]]=frame.q[joint.id];}
    mj.mj_forward(m,d);
    for(const node of model.nodes){const id=mj.mj_name2id(m,1,node.id);frame.poses[node.id].p.forEach((v,k)=>close(v,d.xpos[3*id+k],1e-8));}
   }
  }finally{d.delete();m.delete();}
 }
});

test('a mechanically allowed extreme stance retains measurable motion reach error',()=>{
 const model=make({quadHipPitch:0,quadKneeFlexion:130*Math.PI/180}),frames=Array.from({length:33},(_,i)=>motionFrame(model,motionDuration(model)*i/32));
 assert.ok(frames[0].trackingError<1e-8,'the chosen design pose is represented exactly');
 assert.ok(frames.some(frame=>frame.trackingError>.001),'the original walking reference is not relabelled reachable');
 for(const frame of frames)for(const joint of model.active)assert.ok(frame.q[joint.id]>=joint.min-1e-10&&frame.q[joint.id]<=joint.max+1e-10);
});

test('optional quadruped ankle compensates the actual hip and knee home angles',()=>{
 const model=make({quadHipPitch:.65,quadKneeFlexion:1.05,joints:Object.fromEntries(prefixes.map(p=>[p+'_ankle',{active:true}]))}),poses=fk(model,model.home);
 for(const prefix of prefixes){close(model.home[prefix+'_ankle'],.4);close(rotate(poses[prefix+'_ankle'].q,[0,0,1])[2],1);}
 assert.ok(motionFrame(model,0).trackingError<1e-8);
 assert.throws(()=>make({quadHipPitch:NaN}),/Invalid quadruped posture/);
 assert.throws(()=>make({quadKneeFlexion:Math.PI}),/Invalid quadruped posture/);
 assert.throws(()=>make({quadHipPitch:.65,joints:{fl_pitch:{max:.4}}}),/posture exceeds fl joint limits/);
 assert.throws(()=>make({quadKneeFlexion:1.05,joints:{fr_knee:{min:-.8}}}),/posture exceeds fr joint limits/);
});
