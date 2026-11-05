import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRobot,initialConcept,copyDesign,exportConceptJSON,exportConceptURDF,exportMJCF,jointInertia} from '../.build/concept-model.js';
import {initialConditions,analyzeDesign} from '../.build/design-analysis.js';
import {memberMaterialDesign} from '../.build/design-materials.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';

const make=(id='go2',extra={})=>generateRobot({...copyDesign(initialConcept),robot:id==='go2'?'quadruped':id==='rp1'?'biped':'arm',...(id==='aloha'?{armModel:'aloha',toolMass:0}:{legModel:id}),sourceMode:'derived',...extra});
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const physical=n=>({id:n.id,offset:n.offset,originQ:n.originQ,joint:n.joint,mass:n.mass,com:n.com,inertia:n.inertia});

test('derived sections validate against their reference dimensions, including circular diameter',()=>{
 assert.throws(()=>make('go2',{parts:{fl_pitch:{wall:.007}}}),/wall thickness/i);
 const thin=make('go2',{parts:{fl_pitch:{height:.003}}}).nodes.find(n=>n.id==='fl_pitch').member;
 assert.equal(thin.height,.003);assert.equal(thin.wall,.0008);
 const circular={section:'tube',height:.024,wall:.002},a=make('go2',{parts:{fl_pitch:{...circular,width:.001}}}),b=make('go2',{parts:{fl_pitch:{...circular,width:.080}}});
 assert.deepEqual(a.nodes.map(physical),b.nodes.map(physical),'unused circular-section width cannot alter the tube mass or inertia');
 assert.throws(()=>make('go2',{parts:{fl_pitch:{...circular,wall:.012}}}),/wall thickness/i);
 assert.throws(()=>make('go2',{parts:{fl_pitch:{...circular,wall:.013}}}),/wall thickness/i);
});

test('invalid member inputs and unsupported length overrides are rejected before generation',()=>{
 for(const part of [{width:NaN},{height:Infinity},{wall:0},{width:-.01},{properties:{rho:NaN}},{properties:{E:0}},{properties:{G:-1}},{properties:{nu:.5}},{section:'triangle'},{material:'unknown'}]){
  assert.throws(()=>make('aloha',{parts:{j2:part}}),/Invalid|invalid/);
 }
 assert.throws(()=>make('aloha',{parts:{j2:{length:.2}}}),/sourceDimensions/);
});

test('unknown and nonmember overrides cannot be silently recorded as material changes',()=>{
 for(const parts of [{missing_link:{material:'steel'}},{fl_roll:{material:'steel'}},{fl_foot:{width:.02}}]){
  assert.throws(()=>make('go2',{parts}),/Unsupported concept member/);
 }
 // Original-source mode keeps its physical data even if a saved design also
 // carries a later concept material choice.
 const raw=make('go2',{sourceMode:'original'}),retained=make('go2',{sourceMode:'original',parts:{fl_roll:{material:'steel'}}});
 assert.deepEqual(raw.nodes.map(physical),retained.nodes.map(physical));
});

test('global generic properties do not change source-derived reference materials',()=>{
 for(const id of ['go2','rp1','aloha']){
  const base=make(id),other=make(id,{material:'steel',properties:{rho:8000,E:220e9,G:83e9,strength:700e6,nu:.29}});
  assert.deepEqual(other.nodes.map(physical),base.nodes.map(physical));
  assert.deepEqual(other.nodes.filter(n=>n.member).map(n=>n.member.prop),base.nodes.filter(n=>n.member).map(n=>n.member.prop));
 }
});

test('material changes round-trip without rebasing the reference or accumulating mass',()=>{
 const base=make('aloha'),steel=generateRobot(memberMaterialDesign(base.design,'j2','steel')),back=generateRobot(memberMaterialDesign(steel.design,'j2','abs'));
 assert.ok(steel.mass>base.mass);assert.deepEqual(back.nodes.map(physical),base.nodes.map(physical));
 const originalReference=base.source.parameterization.members.find(m=>m.nodeId==='j2');
 for(const m of [steel,back]){const reference=m.source.parameterization.members.find(m=>m.nodeId==='j2');assert.equal(reference.referenceMaterial,originalReference.referenceMaterial);assert.equal(reference.referenceMass,originalReference.referenceMass);assert.equal(reference.residualMass,originalReference.residualMass);}
});

test('selecting nonmember source joints preserves their own inertia and drive limits',()=>{
 for(const [id,joint]of[['go2','fl_roll'],['rp1','left_pitch'],['aloha','j1']]){
  const robot=make(id),a=analyzeDesign(robot,initialConditions,joint),node=robot.nodes.find(n=>n.id===joint);
  assert.equal(a.member.id,joint);assert.equal(a.driver.id,joint);assert.equal(node.member,undefined);
  close(a.loadInertia,jointInertia(robot,joint));assert.equal(a.availableTorque,node.joint.effortLimit);assert.ok(Number.isNaN(a.stress));assert.ok(Number.isNaN(a.frequency));
 }
});

test('source JSON exports the actual model without legacy generic-analysis results',()=>{
 for(const id of ['go2','rp1','aloha'])for(const mode of ['original','derived']){
  const robot=make(id,{sourceMode:mode}),data=JSON.parse(exportConceptJSON(robot));
  assert.equal(data.analysis,null);assert.deepEqual(data.assembly,JSON.parse(JSON.stringify(robot.nodes)));assert.deepEqual(data.design,robot.design);assert.equal(data.elasticSectionDefined,mode==='derived');
 }
});

test('a hollow circular member has a cylinder collision envelope in URDF and compiled MuJoCo',async()=>{
 const D=.024,t=.002,robot=make('go2',{parts:{fl_pitch:{section:'tube',height:D,width:.071,wall:t}}}),node=robot.nodes.find(n=>n.id==='fl_pitch'),beam=node.components.find(c=>c.role==='member'),L=beam.size[2],area=Math.PI*(D*D-(D-2*t)**2)/4;
 close(beam.mass,node.member.prop.rho*area*L);
 const link=exportConceptURDF(robot).match(new RegExp(`<link name="${node.sourceName}">([\\s\\S]*?)<\\/link>`))[1];
 assert.match(link,new RegExp(`<cylinder radius="${D/2}" length="${L}"`));
 const mj=await dynamicsRuntime(),m=mj.MjModel.from_xml_string(exportMJCF(robot));
 try{
  const gid=mj.mj_name2id(m,5,`${node.id}_g${node.components.indexOf(beam)}`),bid=mj.mj_name2id(m,1,node.id);assert.ok(gid>=0);
  assert.equal(m.geom_type[gid],mj.mjtGeom.mjGEOM_CYLINDER.value);close(m.geom_size[3*gid],D/2);close(m.geom_size[3*gid+1],L/2);
  beam.p.forEach((x,i)=>close(m.geom_pos[3*gid+i],x));close(m.body_mass[bid],node.mass,2e-9);
 }finally{m.delete();}
});
