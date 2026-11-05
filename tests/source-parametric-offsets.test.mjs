import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,fk,exportMJCF,exportConceptJSON} from '../.build/concept-model.js';
import {sourceParameterDefinitions,editSourceDimension} from '../.build/design-source-parameters.js';
import {motionFrame,motionPeriod,armCircleSettings,armCirclePoint} from '../.build/design-motion.js';
import {dynamicsRuntime,createDynamics} from '../.build/design-dynamics.js';
import {prepareSourcePhysics,compileRobotPhysics} from '../.build/source-physics.js';
const make=(id,extra={})=>generateRobot({...copyDesign(initialConcept),robot:id==='aloha'?'arm':id==='go2'?'quadruped':'biped',...(id==='aloha'?{armModel:'aloha',toolMass:0,armCircleRadius:.06}:{legModel:id}),sourceMode:'derived',...extra});
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const node=(m,id)=>m.nodes.find(n=>n.id===id);
const edit=(m,id,value)=>generateRobot({...copyDesign(m.design),sourceDimensions:editSourceDimension(m,id,value)});

test('Aloha displayed arm distances match the original URDF joint-origin vectors',()=>{
 const model=make('aloha'),parameters=sourceParameterDefinitions(model),upper=[-.041170749065642,.128514358904429,0],fore=[.00320470342874501,-.198428485161884,0];
 for(const [id,child,v] of [['upperArm','j3',upper],['forearm','j4',fore]]){
  near(parameters.find(p=>p.id===id).value,Math.hypot(...v));
  node(model,child).offset.forEach((x,i)=>near(x,v[i]));
  ['X','Y','Z'].forEach((a,i)=>near(parameters.find(p=>p.id===id+a).value,v[i]));
 }
 near(parameters.find(p=>p.id==='upperArm').value*1000,134.948030823878,1e-9);
 near(parameters.find(p=>p.id==='forearm').value*1000,198.454362128189,1e-9);
});

test('every exposed coordinate moves its referenced origin and keeps the distance field consistent',()=>{
 for(const id of ['go2','rp1','aloha']){
  const base=make(id);
  for(const p of sourceParameterDefinitions(base).filter(p=>p.axis!==undefined)){
   const target=p.value+.002,next=edit(base,p.id,target),v=node(next,p.reference[1]).offset,definitions=sourceParameterDefinitions(next);
   near(v[p.axis],target);near(definitions.find(d=>d.id===p.edge).value,Math.hypot(...v));
   for(const axis of [0,1,2])if(axis!==p.axis)near(v[axis],node(base,p.reference[1]).offset[axis]);
   const restored=edit(next,p.id,p.baseline);node(restored,p.reference[1]).offset.forEach((x,i)=>near(x,node(base,p.reference[1]).offset[i]));
  }
 }
});

test('length edits scale the edited vector, cross-zero offsets persist, and inconsistent JSON is rejected',()=>{
 let m=make('aloha');m=edit(m,'upperArmZ',.018);m=edit(m,'upperArmX',.012);const v=[...node(m,'j3').offset],L=Math.hypot(...v);m=edit(m,'upperArm',L*1.5);
 node(m,'j3').offset.forEach((x,i)=>near(x,1.5*v[i]));
 const loaded=generateRobot(JSON.parse(exportConceptJSON(m)).design);assert.deepEqual(loaded.nodes,m.nodes);
 const again=edit(m,'upperArmX',-.012);near(node(again,'j3').offset[0],-.012);
 assert.throws(()=>make('aloha',{sourceDimensions:{upperArm:.2,upperArmX:.1,upperArmY:.1,upperArmZ:0}}),/Inconsistent/);
 for(const Lbad of [0,-.2,3])assert.throws(()=>make('aloha',{sourceDimensions:{upperArm:Lbad}}),/outside range/);
});

test('paired offsets preserve native asymmetry and root mounts leave unrelated attachments unchanged',()=>{
 const base=make('rp1'),left=node(base,'left_knee').offset,right=node(base,'right_knee').offset,next=edit(base,'thighY',left[1]+.008),target=node(next,'left_knee').offset;
 const s=Math.hypot(...target)/Math.hypot(...left);
 near(node(next,'right_knee').offset[1]+target[1],s*(right[1]+left[1]));
 const root=edit(base,'hipMountZ',node(base,'left_pitch').offset[2]+.025);
 for(const n of base.nodes.filter(n=>n.parent==='base')){
  const expected=[...n.offset];if(['left_pitch','right_pitch'].includes(n.id))expected[2]+=.025;
  node(root,n.id).offset.forEach((x,i)=>near(x,expected[i]));
 }
 assert.deepEqual(node(root,'base').com,node(base,'base').com);assert.deepEqual(node(root,'base').inertia,node(base,'base').inertia);
});

test('combined offset and length edits agree with compiled MuJoCo FK and update actual motion loads',async()=>{
 const mj=await dynamicsRuntime();
 for(const [id,offset,length] of [['go2','thighX','thigh'],['rp1','shankY','shank'],['aloha','upperArmZ','upperArm']]){
  const base=make(id),p=sourceParameterDefinitions(base).find(p=>p.id===offset),shifted=edit(base,offset,p.value+.002),model=edit(shifted,length,sourceParameterDefinitions(shifted).find(p=>p.id===length).value*1.04);
  await prepareSourcePhysics(mj,model);const m=compileRobotPhysics(mj,model,exportMJCF(model)),data=new mj.MjData(m);
  try{
   for(let k=0;k<=16;k++){
    const frame=motionFrame(model,1+k*motionPeriod(model)/16);assert.ok(frame.trackingError<.001,`${id}: IK ${frame.trackingError}`);assert.ok(frame.orientationError<.035);
    if(model.design.robot!=='arm'){data.qpos.set(frame.poses.base.p,0);data.qpos.set(frame.poses.base.q,3);}
    for(const j of model.active){const ji=mj.mj_name2id(m,3,j.id);data.qpos[m.jnt_qposadr[ji]]=frame.q[j.id];}
    mj.mj_forward(m,data);
    for(const n of model.nodes){const bid=mj.mj_name2id(m,1,n.id),expected=frame.poses[n.id].p;expected.forEach((v,i)=>near(data.xpos[3*bid+i],v,2e-8));}
   }
  }finally{data.delete();m.delete();}
  const a=createDynamics(mj,base),b=createDynamics(mj,model);
  try{const x=a.evaluate(1.6),y=b.evaluate(1.6);assert.ok(y.engineError<.001);assert.ok(model.active.some(j=>Math.abs(x.torque[j.id]-y.torque[j.id])>1e-4));}finally{a.dispose();b.dispose();}
 }
});
