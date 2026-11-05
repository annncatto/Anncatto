import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,jointInertia,jointTorqueLimit,hasElasticModel} from '../.build/concept-model.js';
import {analyzeDesign,initialConditions} from '../.build/design-analysis.js';

const sourceArm=(extra={})=>generateRobot({...copyDesign(initialConcept),robot:'arm',armModel:'aloha',toolMass:0,...extra});
const unknown=['deflection','stress','frequency','rotorReflection','totalInertia','breakawayTorque','kineticEnergy','structures','actuatorMass'];

test('source URDF analysis preserves known joint data without inventing elastic or motor parameters',()=>{
 const model=sourceArm(),a=analyzeDesign(model,initialConditions,'j2');
 assert.equal(a.mass,model.mass);
 assert.equal(a.loadInertia,jointInertia(model,'j2'));
 assert.equal(a.availableTorque,jointTorqueLimit(model,model.active.find(j=>j.id==='j2')));
 assert.ok(Number.isFinite(a.gravity));
 for(const field of unknown)assert.ok(Number.isNaN(a[field]),`${field} must remain unknown`);
 const exported=JSON.parse(JSON.stringify(a));for(const field of unknown)assert.equal(exported[field],null);
});

test('a source model without any beam members still supports every active joint',()=>{
 const model=sourceArm();for(const node of model.nodes)delete node.member;
 for(const joint of model.active){const a=analyzeDesign(model,initialConditions,joint.id);assert.equal(a.member.id,joint.id);assert.equal(a.driver.id,joint.id);assert.ok(Number.isFinite(a.loadInertia));assert.ok(a.availableTorque>0);assert.ok(Number.isNaN(a.stress));}
 assert.ok(analyzeDesign(model,initialConditions,'unavailable-joint').driver.joint.active);
});

test('explicit equivalent-beam assumptions do not replace source mass or identify motor dynamics',()=>{
 const model=sourceArm({armBeamEquivalent:true}),a=analyzeDesign(model,initialConditions,'j2');
 assert.ok(Number.isFinite(a.stress)&&Number.isFinite(a.deflection));
 assert.ok(Number.isNaN(a.breakawayTorque)&&Number.isNaN(a.rotorReflection));
 assert.ok(Number.isNaN(a.structures)&&Number.isNaN(a.actuatorMass));
 const changed=sourceArm({armBeamEquivalent:true,parts:{j2:{material:'steel',properties:{rho:7850,E:210e9}}}});
 assert.equal(changed.mass,model.mass);
 assert.equal(jointInertia(changed,'j2'),jointInertia(model,'j2'));
});

test('native Go2 and RP1 remain rigid-body analyses even if an imported design requests an undefined beam',()=>{
 for(const [robot,legModel,count]of[['quadruped','go2',12],['biped','rp1',24]]){
  const model=generateRobot({...copyDesign(initialConcept),robot,legModel,sourceBeamEquivalent:true});
  assert.equal(model.active.length,count);assert.equal(hasElasticModel(model.design),false);
  assert.equal(model.nodes.filter(n=>n.member).length,0);
  for(const joint of model.active){const a=analyzeDesign(model,initialConditions,joint.id);assert.equal(a.driver.id,joint.id);assert.ok(Number.isFinite(a.loadInertia));assert.ok(a.availableTorque>0);assert.ok(Number.isNaN(a.deflection));}
  assert.equal(analyzeDesign(model,initialConditions).mass,model.mass);
 }
});
