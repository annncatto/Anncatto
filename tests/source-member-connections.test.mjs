import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {initialConcept,copyDesign,generateRobot,fk,exportConceptURDF,exportMJCF} from '../.build/concept-model.js';
import {sourceParameterDefinitions} from '../.build/design-source-parameters.js';

const cases=[
 {robot:'quadruped',source:{legModel:'go2'},pairs:['fl','fr','rl','rr'].flatMap(p=>[[p+'_pitch',p+'_knee'],[p+'_knee',p+'_foot']])},
 {robot:'biped',source:{legModel:'rp1'},pairs:['left','right'].flatMap(p=>[[p+'_yaw',p+'_knee'],[p+'_knee',p+'_ankle']])},
 {robot:'arm',source:{armModel:'aloha'},pairs:[['j2','j3'],['j3','j4']]},
];
const vector=v=>new Vector3(...v),quaternion=q=>new Quaternion(q[1],q[2],q[3],q[0]);
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const samePoint=(a,b,label)=>assert.ok(a.distanceTo(b)<1e-9,`${label}: endpoint gap ${a.distanceTo(b)} m`);
const area=s=>s.section==='tube'?Math.PI*(s.height*s.height-(s.height-2*s.wall)**2)/4:s.width*s.height-(s.section==='solid'?0:(s.width-2*s.wall)*(s.height-2*s.wall));
const endpoints=c=>{
 const length=c.shape==='cylinder'?c.size[1]:c.size[2];
 return[-1,1].map(sign=>new Vector3(0,0,sign*length/2).applyQuaternion(quaternion(c.q)).add(vector(c.p)));
};
const world=(point,pose)=>point.clone().applyQuaternion(quaternion(pose.q)).add(vector(pose.p));
const attributes=element=>Object.fromEntries([...element.matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const numbers=value=>value.trim().split(/\s+/).map(Number);
const sameNumbers=(actual,expected)=>actual.forEach((v,i)=>close(v,expected[i],1e-8));

for(const entry of cases)test(`${entry.source.legModel??'aloha'} explicit rigid ends join all elastic members to their actual joints without double-counting mass`,()=>{
 const sourceDesign={...copyDesign(initialConcept),robot:entry.robot,...entry.source,payload:0,toolMass:0,sourceMode:'original',parts:{}};
 const source=generateRobot(sourceDesign),baseDesign={...copyDesign(sourceDesign),sourceMode:'derived',sourceDimensions:{}},baseline=generateRobot(baseDesign);
 assert.deepEqual(baseline.nodes.map(n=>[n.mass,n.com,n.inertia]),source.nodes.map(n=>[n.mass,n.com,n.inertia]));
 const definitions=sourceParameterDefinitions(baseline);
 const variants=[
  {name:'baseline',dimensions:{},parts:{}},
  {name:'long and offset',dimensions:Object.fromEntries(definitions.filter(p=>p.axis===undefined).map(p=>[p.id,Math.max(p.min,Math.min(p.max,p.min<0?p.baseline+.025:p.baseline*1.8))])),parts:Object.fromEntries(entry.pairs.map(([id])=>[id,{material:'steel',section:'tube',height:.028,width:.024,wall:.0012}]))},
  {name:'short solid',dimensions:Object.fromEntries(definitions.filter(p=>p.axis===undefined).map(p=>[p.id,Math.max(p.min,Math.min(p.max,p.min<0?p.baseline-.015:p.baseline*.6))])),parts:Object.fromEntries(entry.pairs.map(([id])=>[id,{material:'titanium',section:'solid',height:.022,width:.016}]))},
 ];
 for(const variant of variants){
  const model=generateRobot({...copyDesign(baseDesign),sourceDimensions:variant.dimensions,parts:variant.parts}),home=fk(model,model.home);
  const altered={...model.home};for(const joint of model.active)if(joint.kind==='hinge')altered[joint.id]=Math.max(joint.min,Math.min(joint.max,altered[joint.id]+.17));
  const moved=fk(model,altered),urdf=exportConceptURDF(model),mjcf=exportMJCF(model);
  let expectedMass=source.mass;
  for(const [id,childId] of entry.pairs){
   const node=model.nodes.find(n=>n.id===id),child=model.nodes.find(n=>n.id===childId),member=node.member;
   const ends=node.components.filter(c=>c.label==='Concept proximal rigid connection'||c.label==='Concept distal rigid connection');
   assert.equal(ends.length,2,`${variant.name} ${id}: both rigid end regions must be present`);
   const beam=node.components.find(c=>c.role==='member'),L=Math.hypot(...child.offset),beamEnds=endpoints(beam),near=endpoints(ends[0]),far=endpoints(ends[1]);
   close(member.length,L);close(member.cutLength,.8*L);close(beam.size[2],.8*L);
   samePoint(near[0],new Vector3(),`${id} proximal joint`);samePoint(near[1],beamEnds[0],`${id} proximal member face`);
   samePoint(beamEnds[1],far[0],`${id} distal member face`);samePoint(far[1],vector(child.offset),`${id} child joint`);
   for(const poses of [home,moved]){
    samePoint(world(near[0],poses[id]),vector(poses[id].p),`${id} transformed proximal joint`);
    samePoint(world(far[1],poses[id]),vector(poses[childId].p),`${id} transformed child joint`);
   }
   const name=node.sourceName??node.id,link=urdf.slice(urdf.indexOf(`<link name="${name}">`)).split('</link>')[0];
   const collisionElements=[...link.matchAll(/<collision>(.*?)<\/collision>/g)].map(m=>m[1]),visualElements=[...link.matchAll(/<visual>(.*?)<\/visual>/g)].map(m=>m[1]);
   for(const end of ends){
    assert.equal(end.mass,0);assert.equal(end.collision,true);assert.notEqual(end.visible,false);assert.notEqual(end.exportVisual,false);
    assert.ok(!member.inertialComponents.includes(end),'end geometry must not add a second inertial allocation');
    const axial=end.shape==='cylinder'?end.size[1]:end.size[2];close(axial,.1*L);
    if(member.section==='tube'){assert.equal(end.shape,'cylinder');close(end.size[0],member.height/2);}
    else{assert.equal(end.shape,'box');close(end.size[0],member.width);close(end.size[1],member.height);}
    const collision=collisionElements[node.components.filter(c=>c.collision).indexOf(end)],visual=visualElements[node.components.filter(c=>c.shape!=='belt'&&(c.exportVisual??c.visible!==false)).indexOf(end)];
    assert.ok(collision&&visual);assert.equal(collision,visual,'URDF visual and collision must use the same end geometry');
    sameNumbers(numbers(attributes(collision.match(/<origin[^>]*>/)[0]).xyz),end.p);
    const index=node.components.indexOf(end),geom=mjcf.match(new RegExp(`<geom name="${id}_g${index}"[^>]*>`));assert.ok(geom,'MJCF collision includes the connector');
    const attrs=attributes(geom[0]);assert.equal(attrs.type,end.shape);sameNumbers(numbers(attrs.pos),end.p);sameNumbers(numbers(attrs.quat),end.q);
    sameNumbers(numbers(attrs.size),end.shape==='cylinder'?[end.size[0],end.size[1]/2]:end.size.map(v=>v/2));
   }
   const referenceL=Math.hypot(...source.nodes.find(n=>n.id===childId).offset),referenceRho=entry.robot==='arm'?1058:2700;
   const referenceArea=.012*.018-(.012-.0016)*(.018-.0016),referenceBeamMass=referenceRho*referenceArea*.8*referenceL,currentBeamMass=member.prop.rho*area(member)*.8*L;
   const rawMass=source.nodes.find(n=>n.id===id).mass;close(node.mass,rawMass-referenceBeamMass+currentBeamMass);
   close(member.inertialComponents.reduce((sum,c)=>sum+c.mass,0),node.mass);expectedMass+=currentBeamMass-referenceBeamMass;
  }
  close(model.mass,expectedMass);close(model.nodes.reduce((sum,n)=>sum+n.mass,0),model.mass);
 }
});
