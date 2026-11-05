import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import{initialConcept,copyDesign,generateRobot,fk,rotate,exportMJCF,jointTorqueLimit}from'../.build/concept-model.js';
import{motionFrame,motionDuration,groundFrame}from'../.build/design-motion.js';
import{dynamicsRuntime,createDynamics}from'../.build/design-dynamics.js';
import{motionMemberLoad}from'../.build/design-member-loads.js';
import{evaluateTracking}from'../.build/design-validation.js';
const make=(robot,extra={})=>generateRobot({...copyDesign(initialConcept),robot,...extra});
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('planned walking advances in the fixed ground frame with bounded lateral trunk motion',()=>{
 for(const robot of['quadruped','biped']){const model=make(robot),ys=[];for(let i=0;i<256;i++){const t=1+i/256*(motionDuration(model)-1),a=groundFrame(motionFrame(model,t)),b=groundFrame(motionFrame(model,t+.0001));assert.ok(b.poses.base.p[0]>=a.poses.base.p[0]-1e-8,`${robot} reverses at ${t}`);ys.push(a.poses.base.p[1]);}assert.ok(Math.max(...ys)-Math.min(...ys)<(robot==='biped'?.135:.180));}
});
test('inverse dynamics includes floating-base payload, exact rigid-body tensors and unilateral contacts',async()=>{
 const mj=await dynamicsRuntime();for(const robot of['quadruped','biped']){const model=make(robot),engine=createDynamics(mj,model);for(let i=0;i<64;i++){const f=engine.evaluate(1+i/64*(motionDuration(model)-1));assert.ok(f.feasible,`${robot} contact wrench at ${f.time}`);assert.ok(f.engineError<.001,`independent Newton-Euler vs MuJoCo ${f.engineError}`);assert.ok(f.forces.every(c=>c.force[2]>=-1e-7&&Math.hypot(c.force[0],c.force[1])<=.7*c.force[2]+1e-7));}engine.dispose();}
 const a=make('quadruped'),b=make('quadruped',{payload:10}),ea=createDynamics(mj,a),eb=createDynamics(mj,b),fa=ea.evaluate(2.1),fb=eb.evaluate(2.1),la=motionMemberLoad(a,fa,'fl_pitch','fl_pitch',1800),lb=motionMemberLoad(b,fb,'fl_pitch','fl_pitch',1800);assert.ok(lb.bending>la.bending*1.4);assert.ok(lb.deflection>la.deflection*1.3);assert.ok(fb.forces.reduce((s,c)=>s+c.force[2],0)>fa.forces.reduce((s,c)=>s+c.force[2],0)+80);ea.dispose();eb.dispose();
});
test('an infeasible one-foot floating-base reference is reported with a residual',async()=>{
 const mj=await dynamicsRuntime(),model=make('quadruped',{parts:{fl_pitch:{length:.45}}}),e=createDynamics(mj,model),f=e.evaluate(0,false);assert.equal(f.feasible,false);assert.ok(f.forceResidual>.1||f.momentResidual>.1);e.dispose();
});
test('Alohamini source poses, complete rotation frames and effort limits match the local URDF',async()=>{
 const fixtures=JSON.parse(await fs.readFile('tests/fixtures/alohamini-fk.json','utf8')),model=make('arm',{armModel:'aloha',toolMass:0}),mj=await dynamicsRuntime(),m=mj.MjModel.from_xml_string(exportMJCF(model)),data=new mj.MjData(m);close(model.mass,1.84962,1e-12);assert.equal(model.active.length,7);assert.equal(model.active.find(j=>j.id==='gripper').kind,'hinge');close(jointTorqueLimit(model,model.active.find(j=>j.id==='j2')),2.21);
 for(const sample of Object.values(fixtures.samples)){const q={...model.home};sample.q_rad.forEach((v,i)=>q['j'+(i+1)]=v);const f=fk(model,q).tool;for(let k=0;k<3;k++){close(f.p[k],sample.transform[k][3],1e-9);for(let j=0;j<3;j++){const axis=[0,0,0];axis[j]=1;close(rotate(f.q,axis)[k],sample.transform[k][j],1e-9);}}
  mj.mj_resetData(m,data);for(const joint of model.active){const id=mj.mj_name2id(m,3,joint.id);data.qpos[m.jnt_qposadr[id]]=q[joint.id];}mj.mj_forward(m,data);for(const node of model.nodes){const id=mj.mj_name2id(m,1,node.id),pose=fk(model,q)[node.id];pose.p.forEach((v,k)=>close(v,data.xpos[3*id+k],2e-9));}}
 data.delete();m.delete();
});
test('Alohamini TCP traces a Cartesian circle with fixed orientation and smooth derivatives',async()=>{
 const model=make('arm',{armModel:'aloha',toolMass:0}),p=fk(model,model.home).tool.p,R=.025,centre=[p[0],p[1]+R,p[2]],mj=await dynamicsRuntime(),e=createDynamics(mj,model);for(let i=0;i<=64;i++){const t=1+i/64*5,f=motionFrame(model,t);assert.ok(f.trackingError<1e-8);assert.ok(f.orientationError<1e-6);close(Math.hypot(f.poses.tool.p[1]-centre[1],f.poses.tool.p[2]-centre[2]),R,1e-8);close(f.poses.tool.p[0],centre[0],1e-8);}
 const a=e.evaluate(2.6,true,.002),b=e.evaluate(2.6,true,.001);for(const j of model.active)close(a.torque[j.id],b.torque[j.id],.0001);e.dispose();
});
test('closed-loop tests retain failures under insufficient actuation and pass the sized nominal cases',async()=>{
 const mj=await dynamicsRuntime();for(const [robot,motorTorque,expected]of[['quadruped',24,true],['biped',24,false],['biped',40,true],['arm',24,true]]){const model=make(robot,{motorTorque,...(robot==='arm'?{armModel:'aloha',toolMass:0}:{})}),r=await evaluateTracking(mj,model,10);assert.equal(r.passed,expected,JSON.stringify({...r,samples:undefined}));assert.equal(r.hardwareValidated,false);assert.ok(r.samples.length>10);if(expected){assert.ok(r.completed);if(robot!=='arm')assert.ok(r.distance>.2);assert.ok(r.maxSpeedUse<1.02);assert.ok(r.maxJointLimitError<.005);assert.ok(r.maxContactSlipSpeed<.05);assert.ok(r.positionRms<.025);assert.ok(r.maxTilt<.15);}else assert.ok(r.reason);}
});
