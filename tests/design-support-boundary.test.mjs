import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot} from '../.build/concept-model.js';
import {initialConditions,analyzeDesign,effectiveOutputStiffness} from '../.build/design-analysis.js';
import {compareMemberMaterials} from '../.build/design-materials.js';
import {createDynamics,dynamicsRuntime} from '../.build/design-dynamics.js';
import {motionMemberLoad} from '../.build/design-member-loads.js';

// Independent reference: URDF Go2 thigh joint spacing 213 mm; the concept
// member uses a centred 80%-length, 12 x 18 x 0.8 mm box. The reference is a
// declared design assumption, not a reconstruction of Unitree's actual tube.
const L=.213,b=.012,h=.018,t=.0008,F=60,E=69e9,k=1800,allow=.001;
const start=.1*L,end=.9*L;
const Iy=(h*b**3-(h-2*t)*(b-2*t)**3)/12;
const beam=F*((L-start)**3-(L-end)**3)/(3*E*Iy);
const connection=F*L**2/k;
const stress=F*(L-start)*(b/2)/Iy;
const close=(actual,expected,label,relative=2e-9)=>assert.ok(
  Math.abs(actual-expected)<=relative*Math.max(Math.abs(expected),1e-12),
  `${label}: ${actual} != ${expected}`,
);
const design=()=>({...copyDesign(initialConcept),robot:'quadruped',legModel:'go2',sourceMode:'derived',payload:0,toolMass:0});
const analyze=(rootSupport,outputStiffness=k)=>analyzeDesign(generateRobot(design()),{...initialConditions,rootSupport,outputStiffness},'fl_pitch');

test('legacy conditions retain the finite connection; an explicit clamp has zero connection compliance',()=>{
  assert.equal(effectiveOutputStiffness(initialConditions),k);
  assert.equal(effectiveOutputStiffness({...initialConditions,rootSupport:'spring'}),k);
  assert.equal(effectiveOutputStiffness({...initialConditions,rootSupport:'clamped'}),Infinity);
  const model=generateRobot(design());
  const legacy=analyzeDesign(model,initialConditions,'fl_pitch'),spring=analyze('spring');
  close(legacy.deflection,spring.deflection,'legacy spring boundary');
  const clamped=analyze('clamped');
  assert.equal(clamped.driveCompliance,0);
  close(clamped.deflection,clamped.beamDeflection,'clamped total equals beam');
  close(clamped.deflection,analyze('clamped',250).deflection,'inactive spring input does not change clamp');
});

test('Go2 thigh deflection and stress agree with the independent centred-beam integral',()=>{
  const spring=analyze('spring'),clamped=analyze('clamped');
  close(spring.member.member.length,L,'source thigh length');
  close(spring.loadLever,L,'force lever about pitch axis');
  close(spring.bendingI,Iy,'weak-axis section inertia');
  close(spring.beamDeflection,beam,'member displacement');
  close(F*spring.driveCompliance,connection,'connection displacement');
  close(spring.deflection,beam+connection,'total displacement');
  close(spring.stress,stress,'root elastic-section stress');
  close(clamped.stress,stress,'support choice does not change force-controlled bending stress');
  assert.ok(connection>allow,'the connection alone exceeds the unchanged 1 mm requirement');
  assert.ok(beam>allow,'the original aluminium member also fails independently of the connection');
});

test('fixed-section comparison exposes the connection floor without blaming material strength',()=>{
  const model=generateRobot(design()),rows=compareMemberMaterials(model,{...initialConditions,rootSupport:'spring'},'fl_pitch','fixed');
  assert.equal(rows.length,6);
  assert.ok(rows.every(row=>!row.feasible));
  for(const row of rows){
    assert.equal(row.failure,'connection','connection floor is the first actionable obstruction');
    close(F*row.analysis.driveCompliance,connection,`${row.material} connection`);
    close(row.analysis.stress,stress,`${row.material} force-controlled stress`);
    close(row.analysis.deflection,row.analysis.beamDeflection+connection,`${row.material} total`);
    assert.ok(row.analysis.deflection>connection);
    if(row.material!=='abs')assert.ok(row.analysis.strengthUse<1,`${row.material} strength already passes`);
  }
  assert.ok(rows.find(row=>row.material==='abs').analysis.strengthUse>1);
});

test('a clamped comparison changes displacement feasibility while preserving geometry and stress',()=>{
  const model=generateRobot(design());
  const rows=compareMemberMaterials(model,{...initialConditions,rootSupport:'clamped'},'fl_pitch','fixed');
  assert.deepEqual(rows.filter(row=>row.feasible).map(row=>row.material),['steel']);
  for(const row of rows){
    assert.equal(row.failure,row.material==='steel'?null:row.material==='abs'?'both':'deflection');
    assert.equal(row.analysis.driveCompliance,0);
    close(row.analysis.deflection,row.analysis.beamDeflection,`${row.material} clamped total`);
    close(row.analysis.stress,stress,`${row.material} stress`);
    close(row.analysis.member.member.width,b,`${row.material} width`);
    close(row.analysis.member.member.height,h,`${row.material} height`);
    close(row.analysis.member.member.wall,t,`${row.material} wall`);
  }
});

test('a mathematically impossible spring boundary does not produce a fictitious oversized solution',()=>{
  const rows=compareMemberMaterials(generateRobot(design()),{...initialConditions,rootSupport:'spring'},'fl_pitch','sized');
  for(const row of rows){
    assert.equal(row.feasible,false);
    assert.equal(row.limit,'drive-compliance');
    assert.equal(row.failure,'connection');
    assert.equal(row.scale,1,'an impossible connection has no section-sizing solution');
    close(row.analysis.member.member.width,b,`${row.material} retained width`);
    close(row.analysis.member.member.height,h,`${row.material} retained height`);
    close(row.analysis.member.member.wall,t,`${row.material} retained wall`);
  }
});

test('clamped sizing meets the unchanged strength and displacement requirements for all six materials',()=>{
  const d=design(),rows=compareMemberMaterials(generateRobot(d),{...initialConditions,rootSupport:'clamped'},'fl_pitch','sized');
  for(const row of rows){
    assert.equal(row.feasible,true,`${row.material}: sized clamp`);
    assert.equal(row.limit,null);
    assert.equal(row.failure,null);
    assert.equal(row.analysis.driveCompliance,0);
    assert.ok(row.analysis.deflection<=allow*(1+1e-8));
    assert.ok(row.analysis.strengthUse<=1+1e-8);
    assert.ok(row.analysis.member.member.wall>=d.minWall*(1-1e-8));
    const scale=row.analysis.member.member.width/b;
    close(row.analysis.member.member.height/h,scale,`${row.material} similar height`);
    close(row.analysis.member.member.wall/t,scale,`${row.material} similar wall`);
    close(row.analysis.stress,stress/scale**3,`${row.material} stress scales with section modulus`);
  }
});

test('section and connection changes have independent, explicit effects without relaxing the load or limit',()=>{
  const d=design();
  d.parts.fl_pitch={section:'box',width:.018,height:.027,wall:.0012,material:'aluminium'};
  const conditions={...initialConditions,rootSupport:'spring',outputStiffness:5000};
  const a=analyzeDesign(generateRobot(d),conditions,'fl_pitch');
  const expectedBeam=beam/1.5**4,expectedConnection=F*L**2/5000;
  close(a.beamDeflection,expectedBeam,'enlarged section');
  close(F*a.driveCompliance,expectedConnection,'specified connection');
  close(a.deflection,expectedBeam+expectedConnection,'independent displacement budget');
  close(a.stress,stress/1.5**3,'enlarged section stress');
  assert.equal(d.tipForce,F);
  assert.equal(d.allowDeflection,allow);
  assert.ok(a.deflection<allow);
  assert.ok(a.strengthUse<1);
  // 5000 Nm/rad is a design requirement in this counterfactual, not an
  // identified Go2 joint property. Restoring 1800 must still fail.
  assert.ok(analyzeDesign(generateRobot(d),{...conditions,outputStiffness:k},'fl_pitch').deflection>allow);
});

test('strength-only failure remains distinct when the selected displacement requirement is satisfied',()=>{
  // A separate test condition exercises the diagnostic; it does not replace
  // the product's default 1 mm displacement requirement.
  const d=design();d.allowDeflection=.2;
  const abs=compareMemberMaterials(generateRobot(d),{...initialConditions,rootSupport:'clamped'},'fl_pitch','fixed').find(row=>row.material==='abs');
  assert.ok(abs.analysis.deflectionUse<1);
  assert.ok(abs.analysis.strengthUse>1);
  assert.equal(abs.failure,'strength');
});

test('motion-load support selection preserves rigid-body loads and combines displacement vectors',async()=>{
  const model=generateRobot(design()),engine=createDynamics(await dynamicsRuntime(),model);
  try{
    for(const time of [1.1375,2.275]){
      const frame=engine.evaluate(time),before=JSON.stringify(frame);
      const spring=motionMemberLoad(model,frame,'fl_pitch','fl_pitch',k,true);
      const clamped=motionMemberLoad(model,frame,'fl_pitch','fl_pitch',Infinity,true);
      assert.equal(clamped.connectionDeflection,0);
      close(clamped.deflection,clamped.beamDeflection,'motion clamp equals member displacement');
      for(const field of ['normal','shear','bending','torsion','stress','strengthUse','torque','elasticTorque','beamDeflection']){
        assert.equal(clamped[field],spring[field],`${field} does not depend on the postprocessed support compliance`);
      }
      // Go2 thigh and pitch axis are perpendicular, so the independent
      // small-angle connection displacement magnitude is |torque| L / k.
      close(spring.connectionDeflection,Math.abs(spring.elasticTorque)*L/k,'motion connection displacement');
      assert.ok(spring.deflection<=spring.beamDeflection+spring.connectionDeflection+1e-12);
      assert.ok(spring.deflection>=Math.abs(spring.beamDeflection-spring.connectionDeflection)-1e-12);
      assert.equal(JSON.stringify(frame),before,'postprocessing does not change the physical load frame');
    }
  }finally{engine.dispose();}
});
