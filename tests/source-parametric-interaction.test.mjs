import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRobot,initialConcept,copyDesign,fk,norm,sub,jointInertia,hasElasticModel,exportConceptJSON} from '../.build/concept-model.js';
import {sourceParameterDefinitions} from '../.build/design-source-parameters.js';
import {motionFrame,motionPeriod,footSole} from '../.build/design-motion.js';
import {dynamicsRuntime,createDynamics} from '../.build/design-dynamics.js';

const make=(id,extra={})=>generateRobot({...copyDesign(initialConcept),robot:id==='go2'?'quadruped':id==='rp1'?'biped':'arm',...(id==='aloha'?{armModel:'aloha',toolMass:0,armCircleRadius:.01,armCirclePlane:'yz'}:{legModel:id}),sourceMode:'derived',...extra});
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const byId=(m,id)=>m.nodes.find(n=>n.id===id);

test('source parameter catalogs use original SI dimensions and never accumulate edits',()=>{
 for(const [id,count,parameter]of[['go2',15,'thigh'],['rp1',23,'shank'],['aloha',26,'upperArm']]){
  const original=make(id),list=sourceParameterDefinitions(original),p=list.find(p=>p.id===parameter);assert.equal(list.length,count);
  for(const item of list){assert.ok(item.min<=item.baseline&&item.baseline<=item.max);assert.equal(item.value,item.baseline);assert.ok(['mount','limb','terminal'].includes(item.group));}
  const changed=make(id,{sourceDimensions:{[parameter]:p.baseline*1.2}}),again=generateRobot(copyDesign(changed.design));
  assert.deepEqual(changed.nodes,again.nodes);assert.equal(changed.fingerprint,again.fingerprint);
  const actual=sourceParameterDefinitions(changed).find(p=>p.id===parameter);assert.equal(actual.baseline,p.baseline);near(actual.value,1.2*p.baseline);
  const fixed=generateRobot({...copyDesign(changed.design),sourceMode:'original'});assert.equal(sourceParameterDefinitions(fixed).find(p=>p.id===parameter).value,p.baseline);
  assert.equal(hasElasticModel(changed.design),true);assert.ok(changed.nodes.some(n=>n.member));
  assert.equal(JSON.parse(exportConceptJSON(changed)).design.sourceMode,'derived');
 }
 near(sourceParameterDefinitions(make('go2')).find(p=>p.id==='thigh').baseline,.213);
 near(sourceParameterDefinitions(make('aloha')).find(p=>p.id==='shoulderY').baseline,-.029035);
});

test('dimensions on a shared owner compose and update every branch once',()=>{
 const base=make('go2'),defs=Object.fromEntries(sourceParameterDefinitions(base).map(p=>[p.id,p.baseline])),changed=make('go2',{sourceDimensions:{hipLength:defs.hipLength*1.2,hipWidth:defs.hipWidth*.8}});
 for(const node of base.nodes.filter(n=>n.parent==='base')){const actual=byId(changed,node.id);near(actual.offset[0],node.offset[0]*1.2);near(actual.offset[1],node.offset[1]*.8);near(actual.offset[2],node.offset[2]);}
 const arm=make('aloha'),next=make('aloha',{sourceDimensions:{shoulderY:-.01,shoulderZ:.075,tcpX:.012,tcpY:-.009,tcpZ:.12}}),tcp=byId(arm,'tool').offset,delta=[.012-tcp[0],-.009-tcp[1],.12-tcp[2]];
 byId(next,'j2').offset.forEach((v,k)=>near(v,[0,-.01,.075][k]));
 for(const node of arm.nodes.filter(n=>n.parent==='j6'))node.offset.forEach((v,k)=>near(byId(next,node.id).offset[k],v+delta[k]));
 byId(arm,'j6').com.forEach((v,k)=>near(byId(next,'j6').com[k],v+delta[k]));
 byId(arm,'j6').inertia.forEach((v,k)=>near(byId(next,'j6').inertia[k],v));
});

test('bad dimensions are rejected without silently changing fixed source models',()=>{
 assert.throws(()=>make('go2',{sourceDimensions:{unknown:.3}}),/Unknown source dimension/);
 for(const value of [0,-.2,100])assert.throws(()=>make('rp1',{sourceDimensions:{ankleOffset:value}}),/outside range/);
 assert.throws(()=>make('aloha',{sourceDimensions:{upperArm:NaN}}),/Invalid source dimensions/);
 assert.throws(()=>generateRobot({...copyDesign(initialConcept),sourceMode:'derived'}),/requires a source/);
 const a=make('go2',{sourceMode:'original'}),b=make('go2',{sourceMode:'original',sourceDimensions:{thigh:.3}});assert.deepEqual(a.nodes,b.nodes);
 const derived=make('aloha',{armBeamEquivalent:true});assert.equal(hasElasticModel(derived.design),true);assert.deepEqual(derived.nodes.filter(n=>n.member).map(n=>n.id),['j2','j3']);
});

test('leg edits keep native foot shapes and regenerate the ground reference',()=>{
 for(const id of ['go2','rp1']){
  const base=make(id),p=sourceParameterDefinitions(base).find(p=>p.id==='shank'),changed=make(id,{sourceDimensions:{shank:p.baseline*1.12}});
  assert.ok(changed.height>base.height);const poses=fk(changed,changed.home);
  for(const n of base.nodes.filter(n=>n.tip==='foot')){
   const actual=byId(changed,n.id);assert.deepEqual(actual.contactPoints,n.contactPoints);
   const shape=c=>({shape:c.shape,p:c.p,q:c.q,size:c.size,meshFile:c.meshFile,meshScale:c.meshScale});
   assert.deepEqual(actual.components.filter(c=>c.collision).map(shape),n.components.filter(c=>c.collision).map(shape));
   assert.ok(footSole(actual,poses[n.id])[2]>=-.00001);
  }
  assert.notEqual(changed.fingerprint,base.fingerprint);
 }
});

test('edited layouts update space IK, whole-body inertia and inverse-dynamics torques',async()=>{
 const mj=await dynamicsRuntime();
 for(const [id,parameter,root]of[['go2','thigh','fl_pitch'],['rp1','shank','left_pitch'],['aloha','upperArm','j2']]){
  const base=make(id),p=sourceParameterDefinitions(base).find(p=>p.id===parameter),changed=make(id,{sourceDimensions:{[parameter]:p.baseline*1.06}});
  assert.ok(Math.abs(jointInertia(changed,root)-jointInertia(base,root))>1e-5);
  assert.ok(norm(sub(fk(base,base.home)[base.tips[0]].p,fk(changed,changed.home)[changed.tips[0]].p))>1e-4);
  for(let i=0;i<12;i++){const f=motionFrame(changed,1+i*motionPeriod(changed)/12);assert.ok(f.trackingError<.001,`${id}: ${f.trackingError}`);assert.ok(f.orientationError<.035,`${id}: ${f.orientationError}`);}
  const a=createDynamics(mj,base),b=createDynamics(mj,changed);
  try{const x=a.evaluate(1.7),y=b.evaluate(1.7);assert.ok(x.engineError<.001,`${id} nominal finite-difference NE error ${x.engineError}`);assert.ok(y.engineError<.001,`${id} edited finite-difference NE error ${y.engineError}`);assert.ok(Math.max(...changed.active.map(j=>Math.abs(y.torque[j.id]-x.torque[j.id])))>.001,`${id}: loads must follow geometry`);}
  finally{a.dispose();b.dispose();}
 }
});
