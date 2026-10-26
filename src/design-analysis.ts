import {type RobotModel,type Node,type V3,fk,subtree,jointInertia,rotate,inverseQ,alignZ,qm,sub,add,dot,cross,unit,norm} from './concept-model.js';
import {sectionProperties} from './lightweight-mechanics.js';

export interface DesignConditions{
 acceleration:number;angularSpeed:number;bandwidth:number;separation:number;
 motorShaftTorque:number;efficiency:number;reverseEfficiency:number;
 motorFriction:number;gearFriction:number;outputStiffness:number;
}
export const initialConditions:DesignConditions={acceleration:8,angularSpeed:2,bandwidth:8,separation:3,motorShaftTorque:3,efficiency:.9,reverseEfficiency:.8,motorFriction:.015,gearFriction:.12,outputStiffness:1800};
export function defaultMember(model:RobotModel){return model.design.robot==='arm'?'j2':model.design.robot==='biped'?'left_pitch':'fl_pitch';}
function tensorProjection(n:Node,a:V3){const I=n.inertia;return I[0]*a[0]**2+I[1]*a[1]**2+I[2]*a[2]**2+2*(I[3]*a[0]*a[1]+I[4]*a[0]*a[2]+I[5]*a[1]*a[2]);}
export function analyzeDesign(model:RobotModel,conditions:DesignConditions,memberId=defaultMember(model)){
 for(const [key,value] of Object.entries(conditions))if(!Number.isFinite(value)||value<0)throw Error(`Invalid ${key}`);
 for(const key of ['bandwidth','separation','motorShaftTorque','outputStiffness','efficiency','reverseEfficiency'] as const)if(conditions[key]<=0)throw Error(`Invalid ${key}`);
 if(conditions.efficiency>1||conditions.reverseEfficiency>1)throw Error('Efficiency must be at most one');
 const n=model.nodes.find(n=>n.id===memberId&&n.member&&n.joint?.active)??model.nodes.find(n=>n.member&&n.joint?.active)!;
 const m=n.member!,d=model.design,p=m.prop,s=sectionProperties(m),l=m.cutLength,poses=fk(model,model.home),pose=poses[n.id]!;
 let driver=n;while(driver.parent&&Math.abs(dot(rotate(poses[driver.id]!.q,driver.joint?.axis??[0,0,1]),rotate(pose.q,unit(m.vector))))>.95)driver=model.nodes.find(b=>b.id===driver.parent)!;
 if(!driver.joint)driver=n;
 const axis=rotate(poses[driver.id]!.q,driver.joint!.axis),origin=poses[driver.id]!.p,direction=unit(m.vector),worldDirection=rotate(pose.q,direction),rigidOffset=Math.max(0,dot(sub(pose.p,origin),worldDirection)),L=m.length+rigidOffset,e=(m.length-l)/2,start=rigidOffset+e,end=L-e,members=subtree(model,driver.id);
 const localAxis=rotate(inverseQ(qm(pose.q,alignZ(m.vector))),axis),planar=Math.hypot(localAxis[0],localAxis[1]),ax=Math.abs(localAxis[0])/Math.max(planar,1e-12),ay=Math.abs(localAxis[1])/Math.max(planar,1e-12);
 const Iy=m.section==='tube'?s.I:(m.height*m.width**3-(m.section==='solid'?0:(m.height-2*m.wall)*(m.width-2*m.wall)**3))/12,bendingI=1/(ax*ax/s.I+ay*ay/Iy);
 const loadInertia=jointInertia(model,driver.id),rotorReflection=d.ratio**2*d.rotorInertia,totalInertia=loadInertia+rotorReflection;
 const gravity=members.reduce((sum,b)=>{const r=sub(add(poses[b.id]!.p,rotate(poses[b.id]!.q,b.com)),origin);return sum+dot(axis,cross(r,[0,0,-b.mass*9.80665]));},0);
 const staticTorque=Math.abs(gravity)+d.tipForce*L,friction=conditions.gearFriction+d.ratio*conditions.motorFriction/conditions.reverseEfficiency;
 const requestedTorque=staticTorque+totalInertia*conditions.acceleration+friction,availableTorque=conditions.motorShaftTorque*d.ratio*conditions.efficiency*driver.joint!.motorScale;
 // Unit transverse load at the distal axis. End fixtures are rigid; only the
 // actual cut member contributes beam flexibility. A root torsional spring
 // represents output-side transmission stiffness.
 const EI=p.E*bendingI,beamCompliance=((L-start)**3-(L-end)**3)/(3*EI),driveCompliance=L*L/conditions.outputStiffness,compliance=beamCompliance+driveCompliance;
 const unitDisplacement=(x:number)=>{const b=Math.min(x,end),a=Math.min(start,b),primitive=(u:number)=>x*L*u-(x+L)*u*u/2+u**3/3;return L*x/conditions.outputStiffness+(primitive(b)-primitive(a))/EI;};
 const mode=(x:number)=>unitDisplacement(Math.min(L,Math.max(0,x)))/compliance;
 let modalMass=0;const steps=80,ds=l/steps;
 for(let i=0;i<=steps;i++){const x=start+i*ds;modalMass+=(i===0||i===steps?1:i%2?4:2)*p.rho*s.area*mode(x)**2*ds/3;}
 const memberNodes=subtree(model,n.id),memberIds=new Set(memberNodes.map(b=>b.id)),distalMass=memberNodes.filter(b=>b.id!==n.id).reduce((a,b)=>a+b.mass,0);
 for(const c of n.components)if(c.role!=='member')modalMass+=c.mass*mode(rigidOffset+dot(c.p,direction))**2;
 for(const b of members.filter(b=>!memberIds.has(b.id))){const centre=add(poses[b.id]!.p,rotate(poses[b.id]!.q,b.com));modalMass+=b.mass*mode(dot(sub(centre,origin),worldDirection))**2;}
 modalMass+=distalMass;
 const rootRotation=L/(conditions.outputStiffness*compliance);modalMass+=rotorReflection*rootRotation**2;
 const frequency=1/(2*Math.PI)*Math.sqrt(1/(compliance*modalMass)),resonanceRatio=frequency/conditions.bandwidth;
 const moment=d.tipForce*(L-start),stress=moment*(m.section==='tube'?s.c/bendingI:ax*m.height/(2*s.I)+ay*m.width/(2*Iy)),beamDeflection=d.tipForce*beamCompliance,deflection=d.tipForce*compliance;
 const structures=model.nodes.flatMap(n=>n.components).filter(c=>c.role==='member').reduce((a,c)=>a+c.mass,0);
 const actuatorMass=model.design.motorMass*model.active.filter(j=>j.kind==='hinge').reduce((a,j)=>a+j.motorScale,0);
 const Iweak=Math.min(s.I,Iy);
 const slenderness=m.section==='tube'?m.height/(2*m.wall):Math.max(m.width,m.height)/m.wall;
 return{member:n,driver,L,cutLength:l,section:s,bendingI,bendingAxis:[ax,ay] as [number,number],loadInertia,rotorReflection,totalInertia,reflectionRatio:rotorReflection/loadInertia,gravity,staticTorque,requestedTorque,availableTorque,torqueUse:requestedTorque/availableTorque,
  beamCompliance,driveCompliance,compliance,stiffness:1/compliance,modalMass,frequency,resonanceRatio,bandwidthSatisfied:resonanceRatio>=conditions.separation,beamDeflection,deflection,stress,strengthUse:stress*d.safety/p.strength,deflectionUse:deflection/d.allowDeflection,
  breakawayTorque:friction,breakawayForce:friction/L,kineticEnergy:.5*totalInertia*conditions.angularSpeed**2,structures,actuatorMass,mass:model.mass,
  specificE:p.E/p.rho,beamIndex:Math.sqrt(p.E)/p.rho,shapeFactor:12*bendingI/s.area**2,slenderness,buckling:Math.PI**2*p.E*Iweak/(4*l*l),distalMass,tipForce:d.tipForce};
}
export type DesignAnalysis=ReturnType<typeof analyzeDesign>;

/** Oblique rigid-body inertia is useful when inspecting a selected body's tensor. */
export const centralAxisInertia=(n:Node,a:V3)=>tensorProjection(n,unit(a));
