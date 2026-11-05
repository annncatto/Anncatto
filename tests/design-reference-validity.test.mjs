import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,fk,inverseArm,rotate,jointTorqueLimit} from '../.build/concept-model.js';
import {motionFrame,armCircleSettings} from '../.build/design-motion.js';
import {createDynamics,dynamicsRuntime,dynamicsSamples} from '../.build/design-dynamics.js';
import {evaluateTracking} from '../.build/design-validation.js';
import {initialConditions} from '../.build/design-analysis.js';
import {motionMemberLoad} from '../.build/design-member-loads.js';

const make=(extra={})=>generateRobot({...copyDesign(initialConcept),robot:'arm',armModel:'aloha',toolMass:0,payload:0,armCirclePlane:'yz',armCircleRadius:.06,...extra});
const close=(a,b,t=1e-9,label='value')=>assert.ok(Math.abs(a-b)<=t,`${label}: ${a} != ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const quintic=u=>{const x=Math.max(0,Math.min(1,u));return 10*x**3-15*x**4+6*x**5;};

// Independent Cartesian target, including the preparation interval. A rejected
// reference must retain this requested circle, not silently project or shrink it.
function requestedTarget(model,time){
  const home=fk(model,model.home).tool.p,d=model.design,T=d.gaitPeriod??5;
  const r=d.armCircleRadius,c=d.armCircleCenter??[home[0],home[1],home[2]-r];
  const axis=d.armCirclePlane==='xz'?0:1,start=[...c];start[axis]-=r;
  if(time<1){const s=quintic(time);return home.map((x,i)=>x+s*(start[i]-x));}
  const phase=(time-1)/T-Math.floor((time-1)/T),angle=2*Math.PI*quintic(phase),p=[...c];
  p[axis]-=r*Math.cos(angle);p[2]+=r*Math.sin(angle);return p;
}

function userRadiusFixture(){
  const previous=make({armReference:'extended',armCircleRadius:.06,armCirclePlane:'yz'});
  return make({...previous.design,armCircleRadius:.088,armCircleCenter:[...armCircleSettings(previous).centre]});
}
const pollutedXZ=()=>make({armCirclePlane:'xz',armCircleRadius:.12,
  armCircleCenter:[.05337582158333929,-.32490447734938954,.42059164092451007]});
function rawStencil(model,time,h){
  const frames=[-2,-1,0,1,2].map(i=>motionFrame(model,time+i*h));
  const acceleration=Object.fromEntries(model.active.map(j=>[j.id,
    (-frames[4].q[j.id]+16*frames[3].q[j.id]-30*frames[2].q[j.id]+16*frames[1].q[j.id]-frames[0].q[j.id])/(12*h*h)]));
  return{frames,acceleration};
}
function assertInvalid(model,frame,kind){
  assert.equal(frame.referenceValid,false);
  assert.equal(frame.feasible,false);
  assert.ok(['ik','derivative','nonfinite'].includes(frame.referenceIssue?.kind));
  if(kind)assert.equal(frame.referenceIssue.kind,kind);
  for(const joint of model.active){
    assert.ok(Number.isFinite(frame.q[joint.id]),`${joint.id}: pose remains inspectable`);
    for(const field of ['torque','velocity','acceleration'])assert.ok(Number.isNaN(frame[field][joint.id]),`${joint.id}: invalid ${field} must not be a physical number`);
  }
}
function observedRuntime(mj,observers){
  return new Proxy(mj,{get(target,key,receiver){
    const value=Reflect.get(target,key,receiver);
    if(key in observers)return(...args)=>{observers[key](...args);return value(...args);};
    return value;
  }});
}

test('IK convergence and Cartesian residual describe the requested target, including the user radius edit',()=>{
  const model=make(),home=fk(model,model.home).tool;
  const exact=inverseArm(model,model.home,home.p,home.q);
  assert.equal(exact.converged,true);
  close(exact.error,0,1e-10);
  const impossible=inverseArm(model,model.home,[home.p[0]+2,home.p[1],home.p[2]],home.q);
  assert.equal(impossible.converged,false);
  assert.ok(impossible.error>1);
  assert.ok(Object.values(impossible.q).every(Number.isFinite));

  const edited=userRadiusFixture(),time=1.75,f=motionFrame(edited,time),requested=requestedTarget(edited,time);
  assert.equal(edited.design.armCircleRadius,.088);
  f.cartesianTarget.forEach((v,i)=>close(v,requested[i],1e-12,'requested Cartesian coordinate'));
  close(Math.hypot(requested[1]-edited.design.armCircleCenter[1],requested[2]-edited.design.armCircleCenter[2]),.088,1e-12,'requested radius');
  close(f.trackingError,distance(f.poses.tool.p,requested),1e-12,'actual Cartesian residual');
  assert.ok(f.trackingError>.001,'the reported user reference actually misses its target');
  assert.equal(f.ikConverged,false);
});

test('extended YZ 88 mm fixture is rejected before inverse dynamics instead of producing spike loads',async()=>{
  const model=userRadiusFixture(),mj=await dynamicsRuntime();let inverseCalls=0;
  const engine=createDynamics(observedRuntime(mj,{mj_inverse:()=>inverseCalls++}),model);
  try{
    const stencil=rawStencil(model,1.75,.002);
    const jump=Math.max(...stencil.frames.slice(1).flatMap((f,i)=>model.active.map(j=>Math.abs(f.q[j.id]-stencil.frames[i].q[j.id]))));
    assert.ok(jump>.1,'the regression retains the observed discontinuous raw IK samples');
    const result=engine.evaluate(1.75);
    assertInvalid(model,result,'ik');
    assert.equal(inverseCalls,0,'MuJoCo inverse dynamics is never invoked on the invalid reference');
  }finally{engine.dispose();}
});

test('an acceptable central pose cannot validate bad outer points of the five-point stencil',async()=>{
  const model=pollutedXZ(),time=2.634705078311265,{frames}=rawStencil(model,time,.002);
  assert.ok(frames[2].trackingError<.001&&frames[2].orientationError<.035);
  assert.ok(frames[3].trackingError>.001&&frames[4].trackingError>.001);
  const mj=await dynamicsRuntime();let inverseCalls=0;
  const engine=createDynamics(observedRuntime(mj,{mj_inverse:()=>inverseCalls++}),model);
  try{
    assertInvalid(model,engine.evaluate(time));
    assert.equal(inverseCalls,0);
  }finally{engine.dispose();}
});

test('small positional residuals do not qualify nonconvergent joint accelerations as physical loads',async()=>{
  const model=pollutedXZ(),time=2.6280000000000094,a=rawStencil(model,time,.002),b=rawStencil(model,time,.001);
  assert.ok([...a.frames,...b.frames].every(f=>f.trackingError<.001&&f.orientationError<.035));
  const discrepancy=Math.max(...model.active.map(j=>Math.abs(a.acceleration[j.id]-b.acceleration[j.id])));
  assert.ok(discrepancy>1e4,'independent raw differences expose the numerical acceleration instability');
  const mj=await dynamicsRuntime();let inverseCalls=0;
  const engine=createDynamics(observedRuntime(mj,{mj_inverse:()=>inverseCalls++}),model);
  try{
    assertInvalid(model,engine.evaluate(time,true,.002));
    assertInvalid(model,engine.evaluate(time,true,.001));
    assert.equal(inverseCalls,0);
  }finally{engine.dispose();}
});

test('nominal circles retain convergent loads at preparation and cycle seams and are independent of query order',async()=>{
  const mj=await dynamicsRuntime(),times=[0,.998,1,1.002,2.6,5.998,6,6.002];
  for(const armCirclePlane of ['xz','yz'])for(const armReference of ['bent','extended']){
    const model=make({armCirclePlane,armReference}),engine=createDynamics(mj,model);
    try{
      const first=new Map();
      for(const time of times){
        const frame=motionFrame(model,time),a=engine.evaluate(time,true,.002),b=engine.evaluate(time,true,.001);
        assert.equal(frame.ikConverged,true);
        close(distance(frame.poses.tool.p,requestedTarget(model,time)),0,1e-8,'requested path accuracy');
        assert.equal(a.referenceValid,true,`${armCirclePlane}/${armReference}/${time}`);
        assert.equal(b.referenceValid,true,`${armCirclePlane}/${armReference}/${time} half step`);
        assert.equal(a.feasible,true);assert.equal(b.feasible,true);
        for(const j of model.active){
          assert.ok(Number.isFinite(a.torque[j.id]));
          // Measured pre-fix nominal seam differences are at most 0.000346
          // N m; 0.001 N m is also the existing dynamics cross-check tolerance.
          close(a.torque[j.id],b.torque[j.id],.001,`${j.id} two-step convergence`);
        }
        first.set(time,{q:a.q,velocity:a.velocity,acceleration:a.acceleration,torque:a.torque});
      }
      for(const time of [...times].reverse()){
        const again=engine.evaluate(time,true,.002);
        assert.deepEqual({q:again.q,velocity:again.velocity,acceleration:again.acceleration,torque:again.torque},first.get(time),'random-access evaluation cannot change IK branch');
      }
      for(const seam of [1,6]){
        const left=motionFrame(model,seam-.001),right=motionFrame(model,seam+.001);
        for(const j of model.active)assert.ok(Math.abs(left.q[j.id]-right.q[j.id])<.01,`${j.id}: no branch jump across seam`);
      }
    }finally{engine.dispose();}
  }
});

test('a valid high-payload trajectory retains real effort exceedance and agrees with an independent static gravity sum',async()=>{
  const model=make({payload:2}),engine=createDynamics(await dynamicsRuntime(),model);
  try{
    const staticFrame=engine.evaluate(0,false),poses=fk(model,model.home);
    assert.equal(staticFrame.referenceValid,true);
    for(const joint of model.active){
      const pose=poses[joint.id],axis=rotate(pose.q,joint.axis);let torque=0;
      for(const body of model.nodes){
        let current=body;while(current&&current.id!==joint.id)current=model.nodes.find(n=>n.id===current.parent);
        if(!current)continue;
        const rotated=rotate(poses[body.id].q,body.com),r=rotated.map((x,k)=>x+poses[body.id].p[k]-pose.p[k]);
        torque+=body.mass*9.80665*(axis[0]*r[1]-axis[1]*r[0]);
      }
      close(staticFrame.torque[joint.id],torque,1e-8,`${joint.id} independent gravity moment`);
    }
    const a=engine.evaluate(2.6,true,.002),b=engine.evaluate(2.6,true,.001);
    assert.equal(a.referenceValid,true);assert.equal(a.feasible,true);
    assert.ok(a.engineError<.001);
    for(const j of model.active)close(a.torque[j.id],b.torque[j.id],.0001,`${j.id} loaded convergence`);
    for(const id of ['j2','j3','j4']){
      const j=model.active.find(j=>j.id===id);
      assert.ok(Math.abs(a.torque[id])>jointTorqueLimit(model,j),'physical overload must not be clipped or recategorized as invalid IK');
    }
  }finally{engine.dispose();}
});

test('contact infeasibility is distinct from an invalid kinematic reference',async()=>{
  const model=generateRobot({...copyDesign(initialConcept),robot:'quadruped',parts:{fl_pitch:{length:.45}}});
  const engine=createDynamics(await dynamicsRuntime(),model);
  try{
    const frame=engine.evaluate(0,false);
    assert.equal(frame.referenceValid,true);
    assert.equal(frame.feasible,false);
    assert.ok(frame.forceResidual>.1||frame.momentResidual>.1);
    assert.ok(Object.values(frame.torque).every(Number.isFinite));
  }finally{engine.dispose();}
});

test('a valid biped C2 seam refines the actual derivative stencil and shares it with member loads',async()=>{
  const model=generateRobot({...copyDesign(initialConcept),robot:'biped'}),time=1.8;
  const coarse=rawStencil(model,time,.002),fine=rawStencil(model,time,.001),finer=rawStencil(model,time,.0005);
  const difference=(a,b)=>Math.max(...model.active.map(j=>Math.abs(a.acceleration[j.id]-b.acceleration[j.id])));
  const coarseChange=difference(coarse,fine),fineChange=difference(fine,finer);
  // Independently sampled regression values are about 0.07816 and 0.03909
  // rad/s². The halving is consistent with the C² seam's finite-step error,
  // unlike the increasing errors in the bad arm references above.
  assert.ok(coarseChange>.07&&coarseChange<.09);
  assert.ok(fineChange>.035&&fineChange<.045);
  close(fineChange/coarseChange,.5,.03,'first-order convergence at the seam');
  assert.ok([...coarse.frames,...fine.frames,...finer.frames].every(f=>f.trackingError<.001&&f.orientationError<.035));
  const engine=createDynamics(await dynamicsRuntime(),model);
  try{
    const refined=engine.evaluate(time),explicit=engine.evaluate(time,true,.001);
    assert.equal(refined.referenceValid,true);
    assert.equal(explicit.referenceValid,true);
    assert.equal(dynamicsSamples(refined).step,.001);
    assert.equal(dynamicsSamples(explicit).step,.001);
    for(const j of model.active){
      close(refined.acceleration[j.id],fine.acceleration[j.id],1e-9,`${j.id} actual refined acceleration`);
      close(refined.acceleration[j.id],explicit.acceleration[j.id],1e-12,`${j.id} explicit-step acceleration`);
      close(refined.velocity[j.id],explicit.velocity[j.id],1e-12,`${j.id} explicit-step velocity`);
      close(refined.torque[j.id],explicit.torque[j.id],1e-10,`${j.id} explicit-step torque`);
    }
    const load=motionMemberLoad(model,refined,'left_pitch','left_pitch',1800,true);
    const direct=motionMemberLoad(model,explicit,'left_pitch','left_pitch',1800,true);
    assert.ok(Number.isFinite(load.stress)&&Number.isFinite(load.deflection));
    assert.deepEqual(load,direct,'both entry steps use the accepted 1 ms member-load samples');
    // The checked dynamics context is authoritative. If member postprocessing
    // mistakenly samples again, this flag would instead generate a static pose.
    assert.deepEqual(motionMemberLoad(model,refined,'left_pitch','left_pitch',1800,false),load,
      'member postprocessing consumes cached motion samples without independently re-solving the pose');
  }finally{engine.dispose();}
});

test('closed-loop evaluation rejects the user-invalid reference before any nonfinite motor command is integrated',async()=>{
  const mj=await dynamicsRuntime();let steps=0;
  const observed=observedRuntime(mj,{mj_step:(_model,data)=>{
    assert.ok(Array.from(data.ctrl).every(Number.isFinite),'NaN controls must never reach mj_step');steps++;
  }});
  const report=await evaluateTracking(observed,userRadiusFixture(),3);
  assert.equal(report.passed,false);
  assert.equal(report.completed,false);
  assert.ok(report.duration<3);
  assert.ok(report.reason.length>0);
  assert.ok(Number.isFinite(report.positionRms));
  for(const sample of report.samples)assert.ok(Object.values(sample.torque).every(Number.isFinite));
  close(report.duration,steps*.002,1e-10,'observed physical integration duration');
});

test('worker invalidates the whole user-fixture envelope without publishing a partial peak or validation report',async()=>{
  // Prime the shared runtime with its Node WASM resolver before importing the
  // worker module, whose URL resolver is intended for the browser build.
  await dynamicsRuntime();
  const savedPost=Object.getOwnPropertyDescriptor(globalThis,'postMessage');
  const savedHandler=Object.getOwnPropertyDescriptor(globalThis,'onmessage');
  const messages=[];
  Object.defineProperty(globalThis,'postMessage',{configurable:true,writable:true,value:message=>messages.push(message)});
  try{
    await import('../.build/design-load-worker.js');
    const valid=make({payload:2});
    await globalThis.onmessage({data:{type:'model',token:901,design:valid.design,conditions:initialConditions,member:'j2',driver:'j2'}});
    const ready=messages.find(m=>m.token===901&&m.type==='ready');
    assert.ok(ready,'the same worker can produce a complete valid reference envelope');
    assert.equal(ready.samples,97);
    assert.ok(Object.values(ready.peak).every(Number.isFinite));
    assert.ok(ready.overloaded.includes('j2'),'real actuator overload is retained');

    const invalid=userRadiusFixture();
    await globalThis.onmessage({data:{type:'model',token:902,design:invalid.design,conditions:initialConditions,member:'j2',driver:'j2'}});
    const rejected=messages.filter(m=>m.token===902);
    assert.equal(rejected.length,1);
    assert.equal(rejected[0].type,'reference-invalid');
    assert.ok(['ik','derivative'].includes(rejected[0].issue.kind));
    for(const field of ['peak','rms','worst','maxDeflection','maxBuckling','report'])assert.equal(field in rejected[0],false,`${field} is not a result of an incomplete cycle`);
    await globalThis.onmessage({data:{type:'validate',token:902}});
    assert.equal(messages.some(m=>m.token===902&&m.type==='validation'),false);
  }finally{
    if(savedPost)Object.defineProperty(globalThis,'postMessage',savedPost);else delete globalThis.postMessage;
    if(savedHandler)Object.defineProperty(globalThis,'onmessage',savedHandler);else delete globalThis.onmessage;
  }
});
