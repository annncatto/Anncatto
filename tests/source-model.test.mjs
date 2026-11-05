import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initialConcept,copyDesign,generateRobot,fk,rotate,jointTorqueLimit,jointRotorInertia,exportConceptURDF,exportMJCF} from '../.build/concept-model.js';
import {dynamicsRuntime,createDynamics,gravity} from '../.build/design-dynamics.js';
import {prepareSourcePhysics,compileRobotPhysics} from '../.build/source-physics.js';
const fixtures=JSON.parse(await fs.readFile('tests/fixtures/source-robots-fk.json','utf8'));
const files={go2:'public/models/go2/source.urdf',rp1:'public/models/rp1-24/source.urdf'};
const raw=Object.fromEntries(await Promise.all(Object.entries(files).map(async([id,file])=>[id,await fs.readFile(file,'utf8')])));
const make=(legModel,extra={})=>generateRobot({...copyDesign(initialConcept),robot:legModel==='go2'?'quadruped':'biped',legModel,...extra});
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const blocks=(text,tag)=>[...text.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'g'))].map(m=>({attributes:attrs(m[1]),text:m[2]}));
const tag=(text,name)=>attrs(text.match(new RegExp(`<${name}\\b([^>]*)>`))?.[1]??'');
const count=(text,name)=>(text.match(new RegExp(`<${name}\\b`,'g'))??[]).length;
const meshes=text=>[...text.matchAll(/<mesh\b[^>]*filename="([^"]+)"/g)].map(m=>m[1]).sort();

test('source assemblies retain original masses, all link frames and native drive declarations',()=>{
 for(const [id,links,joints,mass] of [['go2',42,12,16.087],['rp1',25,24,39.10931784]]){
  const model=make(id),sourceJoints=new Map(blocks(raw[id],'joint').filter(j=>j.attributes.type).map(j=>[j.attributes.name,j.text]));
  assert.equal(model.nodes.length,links);assert.equal(model.active.length,joints);close(model.mass,mass,1e-10);assert.ok(model.nodes.every(n=>!n.member));
  assert.deepEqual(model.nodes.map(n=>n.sourceName).sort(),Object.keys(fixtures[id].samples[0].poses).sort());
  const nativeMass=blocks(raw[id],'inertial').reduce((s,x)=>s+Number(tag(x.text,'mass').value),0);close(model.mass,nativeMass,1e-10);
  for(const joint of model.active){
   const original=sourceJoints.get(joint.sourceName);assert.ok(original,`source joint ${joint.sourceName}`);const limits=tag(original,'limit'),dynamics=tag(original,'dynamics');
   close(joint.min,Number(limits.lower));close(joint.max,Number(limits.upper));close(jointTorqueLimit(model,joint),Number(limits.effort));close(joint.velocityLimit,Number(limits.velocity));
   close(jointRotorInertia(model,joint),Number(dynamics.armature??0));close(joint.damping??0,Number(dynamics.damping??0));close(joint.frictionLoss??0,Number(dynamics.friction??0));
  }
  if(id==='go2')assert.ok(model.nodes.some(n=>n.originQ&&Math.hypot(...n.originQ.slice(1))>.1),'nonzero source rest rotations are retained');
  else{close(model.active.find(j=>j.id==='left_knee').axis[1],-1);close(model.active.find(j=>j.id==='right_knee').axis[1],1);close(jointRotorInertia(model,model.active.find(j=>j.id==='left_knee')),.0290856);close(jointRotorInertia(model,model.active.find(j=>j.id==='left_ankle_roll')),.006266268);}
 }
});

test('all source links match independent URDF fixtures and MuJoCo FK in three asymmetric poses',async()=>{
 const mj=await dynamicsRuntime();
 for(const id of ['go2','rp1']){
  const robot=make(id);await prepareSourcePhysics(mj,robot);const m=compileRobotPhysics(mj,robot),d=new mj.MjData(m),jointIds=robot.active.map(j=>mj.mj_name2id(m,3,j.id));
  try{
   close(Array.from(m.body_mass).reduce((s,v)=>s+v,0),robot.mass,1e-8);
   for(const [k,j] of robot.active.entries()){
    const actuator=mj.mj_name2id(m,19,'act_'+j.id),dof=m.jnt_dofadr[jointIds[k]];
    close(m.actuator_ctrlrange[2*actuator+1],jointTorqueLimit(robot,j));close(m.dof_armature[dof],jointRotorInertia(robot,j),1e-10);close(m.dof_frictionloss[dof],j.frictionLoss??0,1e-10);
   }
   for(const sample of fixtures[id].samples){
    const q=Object.fromEntries(robot.active.map(j=>[j.id,sample.q[j.sourceName]])),poses=fk(robot,q,{p:[0,0,0],q:[1,0,0,0]});
    mj.mj_resetData(m,d);d.qpos.set([0,0,0,1,0,0,0]);robot.active.forEach((j,k)=>d.qpos[m.jnt_qposadr[jointIds[k]]]=q[j.id]);mj.mj_forward(m,d);
    for(const node of robot.nodes){const expected=sample.poses[node.sourceName],pose=poses[node.id],body=mj.mj_name2id(m,1,node.id);assert.ok(body>0);
     for(let k=0;k<3;k++){close(pose.p[k],expected[k][3],1e-10);close(d.xpos[3*body+k],expected[k][3],2e-8);const basis=[0,0,0];basis[k]=1;const column=rotate(pose.q,basis);for(let row=0;row<3;row++){close(column[row],expected[row][k],1e-10);close(d.xmat[9*body+3*row+k],expected[row][k],2e-8);}}
     close(m.body_mass[body],node.mass,1e-9);if(node.mass===0)continue;node.com.forEach((v,k)=>close(m.body_ipos[3*body+k],v,1e-9));
     const principal=Array.from(m.body_inertia.slice(3*body,3*body+3)),iq=Array.from(m.body_iquat.slice(4*body,4*body+4)),basis=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rotate(iq,v));
     const entry=(r,c)=>basis.reduce((s,v,k)=>s+principal[k]*v[r]*v[c],0),tensor=[entry(0,0),entry(1,1),entry(2,2),entry(0,1),entry(0,2),entry(1,2)];tensor.forEach((v,k)=>close(v,node.inertia[k],2e-9));
    }
   }
   if(id==='rp1'){assert.equal(m.nmesh,22);assert.equal(m.ngeom,37);}else{assert.equal(m.nmesh,0);assert.equal(m.ngeom,28);}
  }finally{d.delete();m.delete();}
 }
});

test('source URDF and MJCF exports preserve original geometry counts and mesh references',()=>{
 for(const id of ['go2','rp1']){
  const model=make(id),urdf=exportConceptURDF(model),mjcf=exportMJCF(model);
  for(const element of ['link','visual','collision'])assert.equal(count(urdf,element),count(raw[id],element),`${id} ${element}`);
  assert.deepEqual(meshes(urdf),meshes(raw[id]),`${id} original visual/collision mesh paths`);
  assert.deepEqual(blocks(urdf,'joint').map(j=>j.attributes.name).sort(),blocks(raw[id],'joint').filter(j=>j.attributes.type).map(j=>j.attributes.name).sort());
  assert.equal((mjcf.match(/<geom\b[^>]*name="/g)??[]).length,count(raw[id],'collision')+1,'source collision geometries plus ground');
  assert.doesNotMatch(mjcf,/<exclude\b/,'source model does not inherit concept collision exclusions');
  if(id==='rp1'){assert.equal(count(mjcf,'mesh'),22);assert.equal((mjcf.match(/type="cylinder"/g)??[]).length,14);assert.match(mjcf,/armature="0\.0290856"/);}
 }
});

test('source static inverse dynamics retains full tensors and additional body payload support',async()=>{
 const mj=await dynamicsRuntime();
 for(const id of ['go2','rp1']){
  const base=make(id),loaded=make(id,{payload:2}),a=createDynamics(mj,base),b=createDynamics(mj,loaded);
  try{const first=a.evaluate(0,false),second=b.evaluate(0,false);assert.ok(first.feasible);assert.ok(second.feasible);assert.ok(first.engineError<1e-7);assert.ok(second.engineError<1e-7);
   const vertical=f=>f.forces.reduce((s,c)=>s+c.force[2],0);close(vertical(first),base.mass*gravity,1e-7);close(vertical(second)-vertical(first),2*gravity,1e-7);close(loaded.mass-base.mass,2,1e-10);
  }finally{a.dispose();b.dispose();}
 }
});
