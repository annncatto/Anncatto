import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,inertiaAbout,qa,fk,jointInertia} from '../.build/concept-model.js';
import {initialConditions,analyzeDesign} from '../.build/design-analysis.js';
import {motionFrame,footSole} from '../.build/design-motion.js';
import {packingConflicts} from '../.build/design-packing.js';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const design=(robot='quadruped',extra={})=>({...copyDesign(initialConcept),robot,bodyLength:robot==='quadruped'?.46:.22,bodyWidth:robot==='biped'?.22:.23,...extra});
const period=robot=>robot==='quadruped'?3.2:robot==='biped'?5.4:5;
test('joint-axis inertia includes rotated COM tensors and parallel-axis terms',()=>{
 const n={id:'body',mass:2,com:[0,0,0],inertia:[1,3,5,0,0,0]};
 close(inertiaAbout([n],{body:{p:[4,0,0],q:[1,0,0,0]}},[0,0,0],[0,1,0]),35);
 close(inertiaAbout([n],{body:{p:[0,0,0],q:qa([0,0,1],Math.PI/2)}},[0,0,0],[1,0,0]),3);
});
test('gear, force and rotor changes obey their stated scaling and keep geometry mass independent',()=>{
 const base=generateRobot(design()),a=analyzeDesign(base,initialConditions),gear=analyzeDesign(generateRobot(design('quadruped',{ratio:18})),initialConditions),force=analyzeDesign(generateRobot(design('quadruped',{tipForce:120})),initialConditions);
 close(gear.rotorReflection,4*a.rotorReflection);close(gear.loadInertia,a.loadInertia);close(gear.availableTorque,2*a.availableTorque);close(gear.mass,a.mass);
 close(force.deflection,2*a.deflection);close(force.stress,2*a.stress);close(force.frequency,a.frequency);
 const friction=analyzeDesign(base,{...initialConditions,motorFriction:initialConditions.motorFriction*2});assert.ok(friction.breakawayTorque>a.breakawayTorque);
 const stiff=analyzeDesign(base,{...initialConditions,outputStiffness:initialConditions.outputStiffness*2});assert.ok(stiff.deflection<a.deflection);assert.ok(stiff.frequency>a.frequency);
 assert.throws(()=>analyzeDesign(base,{...initialConditions,reverseEfficiency:0}));
});
test('section bending uses the physical joint axis, not always the strong section axis',()=>{
 const m=generateRobot(design()),a=analyzeDesign(m,initialConditions),s=m.nodes.find(n=>n.id==='fl_pitch').member;
 const Iy=(s.height*s.width**3-(s.height-2*s.wall)*(s.width-2*s.wall)**3)/12;
 close(a.bendingI,Iy);assert.ok(a.bendingI<a.section.I);
 const h=generateRobot(design('biped')),arm=analyzeDesign(h,initialConditions,'left_arm_yaw');assert.equal(arm.driver.id,'left_arm_roll');assert.ok(Number.isFinite(arm.frequency));
});
test('distal mass and proximal transmission are charged to both the assembly and its inertia',()=>{
 for(const robot of ['quadruped','biped','arm']){
  const a=analyzeDesign(generateRobot(design(robot)),initialConditions),remote=analyzeDesign(generateRobot(design(robot,{remote:true})),initialConditions);
  assert.ok(remote.mass>a.mass);assert.ok(remote.loadInertia<a.loadInertia);close(remote.rotorReflection,a.rotorReflection);
 }
 const a=analyzeDesign(generateRobot(design()),initialConditions),heavy=analyzeDesign(generateRobot(design('quadruped',{footMass:.18})),initialConditions);close(heavy.mass-a.mass,.4);assert.ok(heavy.loadInertia>a.loadInertia);assert.ok(heavy.frequency<a.frequency);
});
test('custom lengths propagate to child joints, COM, geometry and derived metrics',()=>{
 const d=design('arm'),a=generateRobot(d);d.parts.j2={length:.43};d.jointDistances={j1:.18,j5:.08};const b=generateRobot(d),upper=b.nodes.find(n=>n.id==='j2');close(b.nodes.find(n=>n.id==='j3').offset[2],.43);close(b.nodes.find(n=>n.id==='j1').offset[2],.18);close(b.nodes.find(n=>n.id==='j5').offset[2],.08);
 assert.ok(jointInertia(b,'j2')>jointInertia(a,'j2'));assert.ok(b.mass>a.mass);close(upper.member.length,.43);
});
test('reference motion preserves planted feet, flat soles, reachable paths and support margins',()=>{
 for(const robot of ['quadruped','biped','arm']){
  const model=generateRobot(design(robot)),T=period(robot);
  for(let i=0;i<128;i++){
   const t=i*T/128,f=motionFrame(model,t);assert.ok(f.trackingError<(robot==='arm'?.00021:1e-8));assert.ok(Object.values(f.q).every(Number.isFinite));
   if(robot==='arm')continue;
   assert.ok(f.supportMargin>.02,`${robot} support ${i}: ${f.supportMargin}`);
   const next=motionFrame(model,t+.0001);
   for(const n of model.nodes.filter(n=>n.tip==='foot')){
    const sole=footSole(n,f.poses[n.id]),later=footSole(n,next.poses[n.id]);assert.ok(sole[2]>-1e-8);
    if(f.contacts.some(p=>Math.hypot(...p.map((x,k)=>x-sole[k]))<1e-7)&&next.contacts.some(p=>Math.hypot(...p.map((x,k)=>x-later[k]))<1e-7)){
     close(sole[0]+f.travel,later[0]+next.travel,1e-7);close(sole[1],later[1],1e-7);
    }
    if(robot==='biped'){const q=f.poses[n.id].q;assert.ok(Math.abs(q[1])+Math.abs(q[2])<1e-8,'sole remains flat');}
   }
  }
  const reference=motionFrame(model,0,false),canonical=fk(model,model.home);for(const id of model.tips)for(let k=0;k<3;k++)close(reference.poses[id].p[k],canonical[id].p[k]);
 }
});
test('default motion sweeps clear motor and non-adjoining solid envelopes in both placements',()=>{
 for(const robot of ['quadruped','biped','arm'])for(const remote of [false,true]){
  const model=generateRobot(design(robot,{remote}));
  for(let i=0;i<96;i++){const f=motionFrame(model,i*period(robot)/96),conflicts=packingConflicts(model,f.poses);assert.deepEqual(conflicts,[],`${robot} remote=${remote} frame=${i}: ${JSON.stringify(conflicts)}`);}
 }
 const compact=generateRobot(design('arm',{jointDistances:{j2:.045},motorRadius:.06}));assert.ok(packingConflicts(compact,fk(compact,compact.home)).length>0,'packing gate detects oversized adjacent motors');
});
test('the rigid-drive uniform-beam limit recovers the independent Rayleigh result',()=>{
 const d=design('arm',{rotorInertia:1e-20,material:'aluminium',section:'solid',width:.02,height:.02});
 const L=.3,rho=2700,E=69e9,A=.02**2,I=.02**4/12,m=rho*A*L;
 const base={id:'base',parent:null,offset:[0,0,0],components:[],label:['Base','基座'],group:'base',mass:1,com:[0,0,0],inertia:[.01,.01,.01,0,0,0]};
 const beam={id:'beam',parent:'base',offset:[0,0,0],joint:{id:'beam',label:['Beam','梁'],group:'arm',axis:[0,1,0],min:-2,max:2,home:0,active:true,kind:'hinge',motorScale:1},components:[{role:'member',shape:'member',p:[0,0,L/2],q:[1,0,0,0],size:[.02,.02,L],mass:m,material:'aluminium',collision:true,section:{section:'solid',width:.02,height:.02,wall:.002}}],label:['Beam','梁'],group:'arm',member:{vector:[0,0,L],length:L,cutLength:L,material:'aluminium',section:'solid',width:.02,height:.02,wall:.002,prop:{rho,E,G:26e9,strength:240e6,nu:.33}},mass:m,com:[0,0,L/2],inertia:[m*(L*L+.02*.02)/12,m*(L*L+.02*.02)/12,m*.02*.02/6,0,0,0]};
 const model={design:d,nodes:[base,beam],active:[beam.joint],home:{beam:0},height:0,tips:[],mass:1+m,fingerprint:'beam'},a=analyzeDesign(model,{...initialConditions,outputStiffness:1e18},'beam');
 close(a.beamCompliance,L**3/(3*E*I));close(a.modalMass,m*33/140,1e-6);close(a.frequency,Math.sqrt(3*E*I/(L**3*m*33/140))/(2*Math.PI),1e-6);
});
test('exported MJCF defaults reproduce the reference pose without manual joint initialization',async()=>{
 const {loadPhysics}=await import('../.build/concept-physics.js'),{exportMJCF}=await import('../.build/concept-model.js');const mj=await loadPhysics();
 for(const robot of ['quadruped','biped','arm']){
  const canonical=generateRobot(design(robot)),expected=fk(canonical,canonical.home),m=mj.MjModel.from_xml_string(exportMJCF(canonical)),data=new mj.MjData(m);mj.mj_forward(m,data);
  for(const n of canonical.nodes){const id=mj.mj_name2id(m,1,n.id);for(let k=0;k<3;k++)close(data.xpos[3*id+k],expected[n.id].p[k],1e-7);}
  data.delete();m.delete();
 }
});
test('additional supported DOF presets and explicit payloads fit their motion envelopes',()=>{
 const four=design();for(const p of ['fl','fr','rl','rr'])four.joints[p+'_ankle']={active:true};
 const ten=design('biped');for(const p of ['left','right'])ten.joints[p+'_yaw']={active:false};
 const arm=design('arm');for(const id of ['j4','j6'])arm.joints[id]={active:false};
 for(const d of [four,ten,arm,...['quadruped','biped','arm'].map(robot=>design(robot,{payload:2}))]){
  const model=generateRobot(d);for(let i=0;i<64;i++){const frame=motionFrame(model,i*period(d.robot)/64);assert.ok(frame.trackingError<.00021);assert.deepEqual(packingConflicts(model,frame.poses),[]);}
 }
});
