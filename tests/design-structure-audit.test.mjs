import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,qa,unit} from '../.build/concept-model.js';
import {analyzeDesign,initialConditions,memberSection} from '../.build/design-analysis.js';
import {motionMemberLoad} from '../.build/design-member-loads.js';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function beamModel({L=.3,b=.02,h=.04,rho=2700,E=69e9,tipMass=0,tipOffset=0,tipInertia=0,axis=[0,1,0],source=false}={}){
 const mass=rho*b*h*L,design={...copyDesign(initialConcept),robot:'arm',rotorInertia:1e-20,...(source?{armModel:'aloha',armBeamEquivalent:true}:{})},base={id:'base',parent:null,offset:[0,0,0],components:[],label:['Base','基座'],group:'base',mass:1,com:[0,0,0],inertia:[0,0,0,0,0,0]},joint={id:'beam',label:['Beam','梁'],group:'arm',axis:unit(axis),min:-3,max:3,home:0,active:true,kind:'hinge',motorScale:1},component={role:'member',shape:'member',p:[0,0,L/2],q:[1,0,0,0],size:[b,h,L],mass,material:'aluminium',collision:true,section:{section:'solid',width:b,height:h,wall:.002}},beam={id:'beam',parent:'base',offset:[0,0,0],joint,components:[component],label:['Beam','梁'],group:'arm',member:{vector:[0,0,L],length:L,cutLength:L,material:'aluminium',section:'solid',width:b,height:h,wall:.002,prop:{rho,E,G:26e9,strength:240e6,nu:.33}},mass,com:[0,0,L/2],inertia:[mass*(L*L+h*h)/12,mass*(L*L+b*b)/12,mass*(b*b+h*h)/12,0,0,0]},tool={id:'tool',parent:'beam',offset:[0,0,L],components:[],label:['Tool','末端'],group:'tool',mass:tipMass,com:[0,0,tipOffset],inertia:[0,tipInertia,0,0,0,0],tip:'tool'};
 return{design,nodes:[base,beam,tool],active:[joint],home:{beam:0},height:0,tips:['tool'],mass:1+mass+tipMass,fingerprint:'analytical-beam'};
}
const stiff={...initialConditions,outputStiffness:1e18};

test('Rayleigh mass includes rigid distal COM offsets and central rotational inertia',()=>{
 const L=.3,offset=.2,tipMass=2,tipInertia=.02,model=beamModel({L,tipOffset:offset,tipMass,tipInertia}),a=analyzeDesign(model,stiff,'beam'),beam=model.nodes[1];
 const slope=1.5/L,expected=beam.mass*33/140+tipMass*(1+slope*offset)**2+tipInertia*slope**2;
 close(a.modalMass,expected,1e-8);
 close(a.frequency,1/(2*Math.PI)*Math.sqrt(1/(a.beamCompliance*expected)),1e-8);
 const concentrated=analyzeDesign(beamModel({tipMass}),stiff,'beam');assert.ok(a.frequency<concentrated.frequency*.55);
});

test('manual force and root spring use the actual joint-axis lever arm',()=>{
 const L=.3,F=60,k=1800,model=beamModel({L,axis:[0,1,1]}),a=analyzeDesign(model,{...initialConditions,outputStiffness:k,acceleration:0,motorFriction:0,gearFriction:0},'beam');
 close(a.loadLever,L/Math.sqrt(2));close(a.driveCompliance,L*L/(2*k));close(a.staticTorque,F*L/Math.sqrt(2));
 const axial=analyzeDesign(beamModel({axis:[0,0,1]}),initialConditions,'beam');assert.ok(Number.isFinite(axial.beamCompliance)&&axial.beamCompliance>0);close(axial.driveCompliance,0);close(axial.loadLever,0);
});

test('an explicit section frame preserves the physical strong and weak bending axes',()=>{
 const model=beamModel(),original=analyzeDesign(model,stiff,'beam'),node=model.nodes[1],section=memberSection(node);close(original.bendingI,section.Iy);
 node.member.sectionQ=qa([0,0,1],Math.PI/2);const rotated=analyzeDesign(model,stiff,'beam');close(rotated.bendingI,section.Ix);close(rotated.beamCompliance/original.beamCompliance,section.Iy/section.Ix);
 node.member.sectionQ=qa([1,0,0],.2);assert.throws(()=>analyzeDesign(model,stiff,'beam'),/Section frame/);
});

test('source modal results require both a mass partition and declared output inertia',()=>{
 const model=beamModel({source:true}),node=model.nodes[1];let a=analyzeDesign(model,stiff,'beam');
 assert.ok(Number.isFinite(a.stress)&&Number.isFinite(a.beamCompliance));assert.ok(Number.isNaN(a.frequency)&&Number.isNaN(a.modalMass));
 node.member.inertialComponents=structuredClone(node.components);a=analyzeDesign(model,stiff,'beam');assert.ok(Number.isNaN(a.frequency),'unknown rotor inertia is not silently zero');
 node.joint.rotorInertia=.003;a=analyzeDesign(model,stiff,'beam');assert.ok(Number.isFinite(a.frequency));const before=a.modalMass;
 node.member.prop.rho*=10;close(analyzeDesign(model,stiff,'beam').modalMass,before);
 const element=node.member.inertialComponents[0];element.inertia=[...node.inertia];element.inertia[0]*=2;
 assert.throws(()=>analyzeDesign(model,stiff,'beam'),/complete link inertia/);delete element.inertia;
 node.member.inertialComponents[0].mass*=.5;assert.throws(()=>analyzeDesign(model,stiff,'beam'),/preserve link mass and COM/);
});

test('section loads transfer every distal branch from its actual attachment point',()=>{
 const model=beamModel({rho:0}),node=model.nodes[1],L=node.member.length,Fx=10,Fy=20,offset=.1,k=1800;
 model.nodes.push({id:'branch',parent:'beam',offset:[offset,0,L],components:[],label:['Branch','支路'],group:'tool',mass:0,com:[0,0,0],inertia:[0,0,0,0,0,0]});
 const dynamics={time:0,torque:{beam:999},wrenches:{tool:{force:[Fx,0,0],moment:[0,0,0]},branch:{force:[0,Fy,0],moment:[0,0,0]},beam:{force:[Fx,Fy,0],moment:[-Fy*L,Fx*L,offset*Fy]}},feasible:true};
 const a=motionMemberLoad(model,dynamics,'beam','beam',k,false),{Ix,Iy,section}=memberSection(node),E=node.member.prop.E;
 close(a.bending,L*Math.hypot(Fx,Fy));close(a.torsion,offset*Fy);close(a.stress,Fy*L*node.member.height/(2*Ix)+Fx*L*node.member.width/(2*Iy));
 close(a.deflection,Math.hypot(Fx*L**3/(3*E*Iy)+Fx*L*L/k,Fy*L**3/(3*E*Ix)));
 close(a.twist,offset*Fy*L/(node.member.prop.G*section.J));close(a.elasticTorque,Fx*L);assert.equal(a.torque,999,'actuator torque remains separately available');assert.equal(a.structuralDataComplete,true);
});

test('a source visual mesh is not converted into invented distributed member inertia',()=>{
 const model=beamModel({source:true}),dynamics={time:0,torque:{beam:3},wrenches:{},feasible:true};
 const a=motionMemberLoad(model,dynamics,'beam','beam',1800,false);assert.equal(a.structuralDataComplete,false);assert.equal(a.feasible,true);assert.equal(a.torque,3);for(const field of ['stress','deflection','normal','twist'])assert.ok(Number.isNaN(a[field]));
});

test('distributed self-weight recovers the cantilever load and elastic-root solution',()=>{
 const model=beamModel(),node=model.nodes[1],L=node.member.length,k=1800,g=9.80665;
 model.home.beam=node.joint.home=Math.PI/2;
 const torque=-node.mass*g*L/2,dynamics={time:0,torque:{beam:torque},wrenches:{beam:{force:[0,0,node.mass*g],moment:[0,torque,0]},tool:{force:[0,0,0],moment:[0,0,0]}},feasible:true},a=motionMemberLoad(model,dynamics,'beam','beam',k,false),{Iy}=memberSection(node);
 close(a.bending,node.mass*g*L/2);close(a.deflection,node.mass*g*L**3/(8*node.member.prop.E*Iy)+node.mass*g*L*L/(2*k));
 close(a.elasticTorque,torque);
});

test('Euler critical load uses the root spring and recovers the rigid-clamp limit',()=>{
 const model=beamModel(),node=model.nodes[1],L=node.member.length,{Iy}=memberSection(node),EI=node.member.prop.E*Iy,x=.7,k=EI/L*x*Math.tan(x);
 const elastic=analyzeDesign(model,{...initialConditions,outputStiffness:k},'beam'),rigid=analyzeDesign(model,stiff,'beam');
 close(elastic.buckling,EI*(x/L)**2);close(rigid.buckling,Math.PI**2*EI/(4*L*L));assert.ok(elastic.buckling<rigid.buckling);
});
