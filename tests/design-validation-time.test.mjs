import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,fk} from '../.build/concept-model.js';
import {motionFrame,groundFrame} from '../.build/design-motion.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';
import {evaluateTracking} from '../.build/design-validation.js';

test('tracking statistics and replay poses use the reference at the integrated state time',async()=>{
 const mj=await dynamicsRuntime();
 for(const robot of ['quadruped','arm']){
  const model=generateRobot({...copyDesign(initialConcept),robot,...(robot==='arm'?{armModel:'aloha',toolMass:0,gaitPeriod:2}:{})}),states=[];
  let steps=0;
  const observed=new Proxy(mj,{get(runtime,key){
   if(key!=='mj_step')return Reflect.get(runtime,key);
   return(m,d)=>{
    runtime.mj_step(m,d);
    if(++steps%5)return;
    const q=Object.fromEntries(model.active.map(j=>[j.id,d.qpos[m.jnt_qposadr[runtime.mj_name2id(m,3,j.id)]]])),base=robot==='arm'?undefined:{p:Array.from(d.qpos.slice(0,3)),q:Array.from(d.qpos.slice(3,7))};
    states.push({time:d.time,q,poses:fk(model,q,base)});
   };
  }});
  const report=await evaluateTracking(observed,model,1.4);
  assert.ok(report.completed,report.reason);
  let position=0,joints=0,oldPosition=0;
  const tip=robot==='arm'?'tool':'base';
  for(const state of states){
   const reference=groundFrame(motionFrame(model,state.time)),oldReference=groundFrame(motionFrame(model,state.time-.01));
   for(let k=0;k<3;k++){
    position+=(state.poses[tip].p[k]-reference.poses[tip].p[k])**2;
    oldPosition+=(state.poses[tip].p[k]-oldReference.poses[tip].p[k])**2;
   }
   for(const joint of model.active)joints+=(state.q[joint.id]-reference.q[joint.id])**2;
  }
  assert.ok(Math.abs(report.positionRms-Math.sqrt(position/states.length))<1e-10,`${robot}: RMS must compare simultaneous positions`);
  assert.ok(Math.abs(report.jointRms-Math.sqrt(joints/(states.length*model.active.length)))<1e-10,`${robot}: RMS must compare simultaneous joint angles`);
  assert.ok(Math.abs(Math.sqrt(oldPosition/states.length)-report.positionRms)>1e-6,`${robot}: moving reference exposes the old 10 ms offset`);
  for(const sample of report.samples){
   const state=states.find(s=>Math.abs(s.time-sample.time)<1e-10);assert.ok(state);
   for(const node of model.nodes)for(let k=0;k<3;k++)assert.ok(Math.abs(sample.frame.poses[node.id].p[k]-state.poses[node.id].p[k])<1e-9,`${robot}/${node.id}: replay pose timestamp`);
  }
 }
});
