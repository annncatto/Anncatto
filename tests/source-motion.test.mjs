import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,fk,qa,add,sub,mul,dot,unit,norm,rotate} from '../.build/concept-model.js';
import {motionFrame,motionDuration,motionSettings,groundFrame,footSole,soleCorners} from '../.build/design-motion.js';
import {sourceLegIK,sourceLegGeometry} from '../.build/source-leg-kinematics.js';
const make=legModel=>generateRobot({...copyDesign(initialConcept),robot:legModel==='go2'?'quadruped':'biped',legModel});
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('source gait starts at the imported joint pose and uses its model-specific reference',()=>{
 for(const name of ['go2','rp1']){
  const model=make(name),pose=motionFrame(model,0,false),start=motionFrame(model,0),settings=motionSettings(model),feet=model.nodes.filter(n=>n.tip==='foot');
  assert.ok(model.nodes.every(n=>!n.member),'source kinematics does not require fabricated elastic members');
  for(const joint of model.active)close(start.q[joint.id],model.home[joint.id],1e-10);
  for(const n of model.nodes)pose.poses[n.id].p.forEach((v,k)=>close(v,start.poses[n.id].p[k],1e-10));
  const length=Math.min(...feet.map(n=>sourceLegGeometry(model,n.group).length));
  close(settings.stride,name==='rp1'?.06:length*.24);close(settings.lift,name==='rp1'?.025:Math.min(.045,length*.065));close(settings.period,name==='rp1'?2.4:3.2);
  const other=generateRobot({...copyDesign(model.design),l1:.9,l2:1.1,stanceWidth:.60});
  close(motionSettings(other).stride,settings.stride);close(motionSettings(other).lift,settings.lift);
  const a=fk(model,model.home),b=fk(other,other.home);for(const n of feet)footSole(n,a[n.id]).forEach((v,k)=>close(v,footSole(other.nodes.find(c=>c.id===n.id),b[n.id])[k]));
 }
});

test('source leg IK respects arbitrary rest rotations, source axis signs and fixed joints',()=>{
 for(const name of ['go2','rp1']){
  const model=make(name),prefix=name==='go2'?'fl':'left',hip=model.nodes.find(n=>n.id===prefix+'_pitch');
  hip.originQ=qa([1,.3,-.2],.04);
  const q={...model.home},geometry=sourceLegGeometry(model,prefix),target=add(geometry.homePoint,[.01,-.006,.012]),base={p:[0,0,model.height],q:[1,0,0,0]};
  const result=sourceLegIK(model,q,prefix,target,base);assert.ok(result.positionError<1e-8);assert.ok(result.orientationError<1e-8);
  for(const joint of model.active){assert.ok(q[joint.id]>=joint.min&&q[joint.id]<=joint.max);if(joint.group!==prefix)close(q[joint.id],model.home[joint.id]);}
  const locked=make(name),joint=locked.nodes.find(n=>n.id===prefix+'_knee').joint;joint.active=false;
  const lockedQ={...locked.home},foot=sourceLegGeometry(locked,prefix);sourceLegIK(locked,lockedQ,prefix,add(foot.homePoint,[.015,0,.02]),base);close(lockedQ[joint.id],locked.home[joint.id]);
 }
});

test('RP1 support uses the source cylinder contact-line hull instead of a visual bounding rectangle',()=>{
 const model=make('rp1'),poses=fk(model,model.home);
 for(const n of model.nodes.filter(n=>n.tip==='foot')){
  const points=n.contactPoints;assert.ok(points&&points.length>4);
  const cylinders=n.components.filter(c=>c.collision&&c.shape==='cylinder');assert.equal(cylinders.length,7);
  const sourcePoints=cylinders.flatMap(c=>{const axis=rotate(c.q,[0,0,1]),down=[0,0,-1],radial=mul(unit(sub(down,mul(axis,dot(axis,down)))),c.size[0]);return[-1,1].map(side=>add(add(c.p,mul(axis,side*c.size[1]/2)),radial));});
  for(const point of points)assert.ok(sourcePoints.some(p=>norm(sub(p,point))<1e-10));
  close(Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1])),.06);
  const area=Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-p[1]*q[0];},0))/2;
  const rectangle=(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])))*.06;
  assert.ok(area<rectangle*.95,'support hull retains tapered heel and toe');
  const actual=soleCorners(n,poses[n.id]);assert.equal(actual.length,points.length);
  points.forEach((p,i)=>add(poses[n.id].p,rotate(poses[n.id].q,p)).forEach((v,k)=>close(v,actual[i][k],1e-12)));
 }
});

test('source walking keeps stance feet planted, tracks foot orientation and advances the trunk',()=>{
 for(const name of ['go2','rp1']){
  const model=make(name),feet=model.nodes.filter(n=>n.tip==='foot'),period=motionSettings(model).period;
  for(let i=0;i<128;i++){
   const t=1+i*period/128,a=groundFrame(motionFrame(model,t)),b=groundFrame(motionFrame(model,t+.0001));
   assert.ok(a.plannerValid);assert.ok(a.trackingError<1e-8);assert.ok(a.orientationError<1e-8);assert.ok(b.poses.base.p[0]>=a.poses.base.p[0]-1e-8,`${name} trunk reverses`);
   for(const foot of feet){
    const centre=frame=>{const points=soleCorners(foot,frame.poses[foot.id]);return mul(points.reduce((s,p)=>add(s,p),[0,0,0]),1/points.length);};
    const p=centre(a),q=centre(b),onGround=(frame,point)=>frame.contacts.some(c=>norm(sub(c,point))<1e-7);
    if(onGround(a,p)&&onGround(b,q)){close(p[0],q[0],1e-8);close(p[1],q[1],1e-8);}
    assert.ok(soleCorners(foot,a.poses[foot.id]).every(p=>p[2]>-1e-6),'source URDF cylinder-axis rounding remains below a micrometre');
   }
  }
 }
});
