import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,fk,add,mul,rotate} from '../.build/concept-model.js';
import {initialConditions,analyzeDesign} from '../.build/design-analysis.js';
import {compareMemberMaterials} from '../.build/design-materials.js';
import {assemblyDiagramGeometry} from '../.build/design-diagram.js';

const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('fixed-section material comparisons charge only the selected member and preserve the input design',()=>{
  const model=generateRobot(copyDesign(initialConcept)),before=JSON.stringify(model.design);
  const rows=compareMemberMaterials(model,initialConditions,'fl_pitch','fixed');
  const base=analyzeDesign(model,initialConditions,'fl_pitch');
  const baseMass=base.member.components.find(c=>c.role==='member').mass;
  for(const row of rows){
    close(row.memberMass/baseMass,row.analysis.member.member.prop.rho/2700);
    close(row.analysis.mass-base.mass,row.memberMass-baseMass);
    close(row.analysis.driveCompliance,base.driveCompliance);
    assert.deepEqual(row.design.parts.fl_knee,model.design.parts.fl_knee);
    close(row.analysis.member.member.width,base.member.member.width);
  }
  assert.equal(JSON.stringify(model.design),before);
});

test('similar-section sizing satisfies both constraints and exposes the active sizing bound',()=>{
  const design=copyDesign(initialConcept);design.minWall=.0002;design.allowDeflection=.003;
  const model=generateRobot(design),conditions={...initialConditions,outputStiffness:1e6};
  const rows=compareMemberMaterials(model,conditions,'fl_pitch','sized');
  assert.ok(rows.every(row=>row.feasible));
  for(const row of rows){
    assert.ok(row.analysis.deflectionUse<=1+1e-8);
    assert.ok(row.analysis.strengthUse<=1+1e-8);
    const reduced=copyDesign(row.design),part=reduced.parts.fl_pitch;
    part.width*=.999;part.height*=.999;part.wall*=.999;
    const smaller=analyzeDesign(generateRobot(reduced),conditions,'fl_pitch');
    assert.ok(smaller.deflectionUse>1||smaller.strengthUse>1,'a smaller similar section violates the controlling constraint');
    close(part.width/part.height,design.width/design.height);
  }
});

test('material stiffness cannot overcome the fixed transmission compliance floor',()=>{
  const model=generateRobot(copyDesign(initialConcept));
  const rows=compareMemberMaterials(model,{...initialConditions,outputStiffness:100},'fl_pitch','sized');
  assert.ok(rows.every(row=>!row.feasible&&row.limit==='drive-compliance'));
  assert.ok(rows.every(row=>Number.isFinite(row.memberMass)&&Number.isFinite(row.analysis.deflection)));
});

test('sizing enforces manufacturing wall and stated external envelope limits',()=>{
  const design=copyDesign(initialConcept);design.minWall=.003;design.tipForce=1;design.allowDeflection=.02;
  for(const row of compareMemberMaterials(generateRobot(design),initialConditions,'fl_pitch','sized')){
    assert.ok(row.analysis.member.member.wall>=design.minWall-1e-10);
  }
  const rows=compareMemberMaterials(generateRobot(design),initialConditions,'fl_pitch','sized',.02);
  assert.ok(rows.every(row=>!row.feasible&&row.limit==='envelope'));
});

test('mechanism diagram endpoints preserve FK attachment coordinates in all architectures',()=>{
  for(const robot of ['quadruped','biped','arm']){
    const design={...copyDesign(initialConcept),robot},model=generateRobot(design),poses=fk(model,model.home);
    const geometry=assemblyDiagramGeometry(model,poses);
    for(const item of geometry){
      assert.deepEqual(item.start,poses[item.node.id].p);
      if(item.node.parent){
        const parent=poses[item.node.parent];let expected=add(parent.p,rotate(parent.q,item.node.offset));
        if(item.node.joint?.kind==='slide')expected=add(expected,rotate(parent.q,mul(item.node.joint.axis,model.home[item.node.id])));
        if(item.node.id==='gripper_mirror')expected=add(expected,rotate(parent.q,[-model.home.gripper,0,0]));
        expected.forEach((v,i)=>close(item.start[i],v));
      }
      if(item.end){
        const child=model.nodes.find(n=>n.parent===item.node.id&&n.offset.every((v,i)=>Math.abs(v-item.node.member.vector[i])<1e-9));
        assert.ok(child,`${item.node.id} has a distal attachment`);
        item.end.forEach((v,i)=>close(v,poses[child.id].p[i]));
      }
    }
  }
});
