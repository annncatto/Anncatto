import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Matrix4,Quaternion} from 'three';
import {initialConcept,copyDesign,generateRobot,exportMJCF,exportConceptJSON,jointRotorInertia} from '../.build/concept-model.js';
import {alohaPhysicsData as data} from '../.build/aloha-physics-data.js';
import {initialConditions,analyzeDesign} from '../.build/design-analysis.js';
import {dynamicsRuntime,createDynamics} from '../.build/design-dynamics.js';
const bytes=await fs.readFile('public/models/alohamini-left/physics-source.json'),bundle=JSON.parse(bytes);
const near=(a,b,t=2e-12)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const vec=(a,b,t)=>a.forEach((x,i)=>near(x,b[i],t));
const make=(extra={})=>generateRobot({...copyDesign(initialConcept),robot:'arm',armModel:'aloha',toolMass:0,...extra});
const multiply=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,x,k)=>s+x*B[k][j],0)));
const transpose=A=>A[0].map((_,j)=>A.map(row=>row[j]));
const pack=A=>[A[0][0],A[1][1],A[2][2],A[0][1],A[0][2],A[1][2]];
const matrix=v=>[[v[0],v[3],v[4]],[v[3],v[1],v[5]],[v[4],v[5],v[2]]];
const shift=r=>r.map((_,i)=>r.map((_,j)=>(i===j?r.reduce((s,v)=>s+v*v,0):0)-r[i]*r[j]));
function independentGroup(group){
 const pieces=group.sources.map(s=>{const p=s.properties,T=s.T_link_source,R=T.slice(0,3).map(r=>r.slice(0,3));return{mass:p.mass_kg,com:R.map((row,i)=>row.reduce((a,x,k)=>a+x*p.com_m[k],T[i][3])),I:multiply(multiply(R,p.central_inertia_kg_m2),transpose(R))};});
 const mass=pieces.reduce((s,p)=>s+p.mass,0),com=[0,1,2].map(k=>pieces.reduce((s,p)=>s+p.mass*p.com[k],0)/mass),I=[[0,0,0],[0,0,0],[0,0,0]];
 for(const p of pieces){const P=shift(p.com.map((x,i)=>x-com[i]));for(let i=0;i<3;i++)for(let j=0;j<3;j++)I[i][j]+=p.I[i][j]+p.mass*P[i][j];}
 return{mass,com,inertia:pack(I)};
}
test('CAD inertia import is bound to the original bundle and unique left-arm CAD ownership',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),data.bundleSha256);
 assert.equal(data.urdfSha256,bundle.source_description_sha256['urdf/alohamini2pro.urdf']);
 const ids=new Set();
 for(const group of bundle.link_groups.filter(g=>g.link.startsWith('left_'))){
  for(const s of group.sources)for(const id of s.component_ids){assert.ok(!ids.has(id),'CAD part counted twice: '+id);ids.add(id);}
  const expected=independentGroup(group),actual=data.links.find(n=>n.name===group.link);near(actual.mass,expected.mass);vec(actual.com,expected.com);vec(actual.inertia,expected.inertia);
 }
 near(data.links.reduce((s,n)=>s+n.mass,0),1.84962);assert.equal(data.links.find(n=>n.name==='left_camera').mass,0);
 assert.ok(data.links.find(n=>n.name==='left_Fixed_Jaw').replaces.includes('left_camera'));
});
test('default Aloha uses the CAD physics while retaining the original geometry and explicit legacy URDF option',()=>{
 const model=make(),old=make({armInertia:'urdf'});near(model.mass,1.84962);near(old.mass,2);
 const geometry=n=>({id:n.id,parent:n.parent,offset:n.offset,originQ:n.originQ,axis:n.joint?.axis,limits:n.joint&&[n.joint.min,n.joint.max,n.joint.effortLimit]});
 assert.deepEqual(model.nodes.map(geometry),old.nodes.map(geometry));assert.deepEqual(model.home,old.home);
 for(const n of model.nodes){const p=data.links.find(l=>l.name===n.sourceName);near(n.mass,p.mass);vec(n.com,p.com);vec(n.inertia,p.inertia);}
 assert.equal(model.physicalSource.sha256,data.bundleSha256);assert.equal(JSON.parse(exportConceptJSON(model)).physicalSource.sha256,data.bundleSha256);
 const derived=make({sourceMode:'derived'});assert.deepEqual(derived.nodes.map(n=>[n.mass,n.com,n.inertia]),model.nodes.map(n=>[n.mass,n.com,n.inertia]));
});
test('bearing armature is included as the LIBERO upper-bound assumption and is not presented as identified rotor inertia',()=>{
 const model=make(),j=model.active.find(j=>j.id==='j1'),expected=bundle.joint_armature_kg_m2.left_shoulder_pan;
 near(j.armature,expected);near(jointRotorInertia(model,j),expected);assert.equal(j.rotorInertia,undefined);
 assert.ok(Number.isNaN(analyzeDesign(model,initialConditions,'j1').rotorReflection));
 assert.equal(model.active.filter(j=>j.armature!==undefined).length,1);
 assert.ok(model.physicalSource.assumptions.some(s=>s.includes('upper bound')));
});
test('compiled MuJoCo receives all link-frame full tensors, the camera-free mass budget and the bearing term',async()=>{
 const robot=make(),mj=await dynamicsRuntime(),m=mj.MjModel.from_xml_string(exportMJCF(robot));
 try{
  let mass=0;for(const n of robot.nodes){const id=mj.mj_name2id(m,1,n.id);near(m.body_mass[id],n.mass,1e-8);mass+=m.body_mass[id];if(!n.mass)continue;vec(Array.from(m.body_ipos.slice(3*id,3*id+3)),n.com,1e-8);
   const q=Array.from(m.body_iquat.slice(4*id,4*id+4)),rotation=new Matrix4().makeRotationFromQuaternion(new Quaternion(q[1],q[2],q[3],q[0])).elements,R=[0,1,2].map(i=>[0,1,2].map(j=>rotation[4*j+i])),D=[0,1,2].map(i=>[0,1,2].map(j=>i===j?m.body_inertia[3*id+i]:0));vec(pack(multiply(multiply(R,D),transpose(R))),n.inertia,2e-10);}
  near(mass,1.84962,1e-8);const j=mj.mj_name2id(m,3,'j1');near(m.dof_armature[m.jnt_dofadr[j]],bundle.joint_armature_kg_m2.left_shoulder_pan,1e-12);
 }finally{m.delete();}
 const old=createDynamics(mj,make({armInertia:'urdf'})),next=createDynamics(mj,robot);
 try{const a=old.evaluate(0,false),b=next.evaluate(0,false);assert.ok(robot.active.some(j=>Math.abs(a.torque[j.id]-b.torque[j.id])>.01));assert.ok(b.engineError<.001);}finally{old.dispose();next.dispose();}
});
