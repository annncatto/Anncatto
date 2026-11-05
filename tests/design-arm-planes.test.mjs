import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRobot,initialConcept,copyDesign,fk,exportConceptJSON} from '../.build/concept-model.js';
import {motionFrame,motionDuration,armCircleSettings,armCirclePoint,motionSettings} from '../.build/design-motion.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';
import {evaluateTracking} from '../.build/design-validation.js';
const make=(extra={})=>generateRobot({...copyDesign(initialConcept),robot:'arm',armModel:'aloha',toolMass:0,armCircleRadius:.06,armCirclePlane:'yz',...extra});
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('60 mm XZ and YZ circles retain TCP orientation through preparation and a full cycle',()=>{
 for(const plane of ['xz','yz'])for(const armReference of ['bent','extended']){
  const m=make({armCirclePlane:plane,armReference}),centre=armCircleSettings(m).centre,axis=plane==='xz'?0:1,fixed=plane==='xz'?1:0,home=fk(m,m.home).tool;
  const start=motionFrame(m,0);start.poses.tool.p.forEach((v,k)=>close(v,home.p[k]));
  let maxStep=0,previous;
  for(let i=0;i<=240;i++){
   const t=i/240*motionDuration(m),f=motionFrame(m,t),p=f.poses.tool.p;
   assert.ok(f.trackingError<1e-8);assert.ok(f.orientationError<1e-6);
   for(const j of m.active)assert.ok(f.q[j.id]>=j.min-1e-10&&f.q[j.id]<=j.max+1e-10);
   if(t>=1){close(p[fixed],centre[fixed]);close(Math.hypot(p[axis]-centre[axis],p[2]-centre[2]),.06);}
   if(previous)maxStep=Math.max(maxStep,...m.active.map(j=>Math.abs(f.q[j.id]-previous[j.id])));
   previous=f.q;
  }
  assert.ok(maxStep<.08,'IK remains on one continuous branch');
  const path=Array.from({length:128},(_,i)=>armCirclePoint(m,i/128));
  for(const p of path){close(p[fixed],centre[fixed]);close(Math.hypot(p[axis]-centre[axis],p[2]-centre[2]),.06);}
  close(Math.max(...path.map(p=>p[axis]))-Math.min(...path.map(p=>p[axis])),.12);
  assert.equal(JSON.parse(exportConceptJSON(m)).design.armCirclePlane,plane);
  assert.deepEqual(motionSettings(m).centre,centre);
 }
});

test('explicit circle centres survive plane changes and malformed circle inputs are rejected',()=>{
 const centre=[.035,-.32,.42];
 for(const armCirclePlane of ['xz','yz'])assert.deepEqual(armCircleSettings(make({armCirclePlane,armCircleCenter:centre})).centre,centre);
 for(const extra of [{armCirclePlane:'xy'},{armCircleRadius:0},{armCircleRadius:NaN},{armCircleRadius:.2},{armCircleCenter:[0,0,Infinity]},{armCircleCenter:[0,0]}])assert.throws(()=>make(extra),/circle/);
 const legacy=generateRobot({...copyDesign(initialConcept),robot:'arm',armModel:'aloha',toolMass:0}),p=fk(legacy,legacy.home).tool.p;
 assert.deepEqual(armCircleSettings(legacy),{plane:'yz',radius:.025,centre:[p[0],p[1]+.025,p[2]]});
});

test('both 60 mm circle planes pass source-effort closed-loop tracking for 10 seconds',async()=>{
 const mj=await dynamicsRuntime();
 for(const armCirclePlane of ['xz','yz']){
  const r=await evaluateTracking(mj,make({armCirclePlane}),10);
  assert.equal(r.passed,true,JSON.stringify({...r,samples:undefined}));
  assert.ok(r.completed);assert.ok(r.positionRms<.001);assert.ok(r.maxJointLimitError<.005);
  assert.ok(r.maxSpeedUse<1.02);assert.ok(r.saturatedFraction<.01);
 }
});


test('edited radii retain their requested size in both planes and both source profiles',()=>{
 for(const sourceMode of ['original','derived'])for(const armCirclePlane of ['xz','yz'])for(const radius of [.03,.045]){
  const model=make({sourceMode,armCirclePlane,armCircleRadius:radius}),centre=armCircleSettings(model).centre,axis=armCirclePlane==='xz'?0:1,fixed=1-axis;
  for(let i=0;i<=48;i++){
   const f=motionFrame(model,1+5*i/48),p=f.poses.tool.p;assert.ok(f.trackingError<1e-8);assert.ok(f.orientationError<1e-6);close(p[fixed],centre[fixed]);close(Math.hypot(p[axis]-centre[axis],p[2]-centre[2]),radius);
  }
 }
});
