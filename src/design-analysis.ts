import {jointTorqueLimit,jointRotorInertia,isSourceDesign,hasElasticModel,type RobotModel,type Node,type Component,type V3,fk,subtree,jointInertia,rotate,inverseQ,alignZ,qm,sub,add,mul,dot,cross,unit,norm,massProperties} from './concept-model.js';
import {sectionProperties} from './lightweight-mechanics.js';

export interface DesignConditions{
 acceleration:number;angularSpeed:number;bandwidth:number;separation:number;
 motorShaftTorque:number;efficiency:number;reverseEfficiency:number;
 motorFriction:number;gearFriction:number;outputStiffness:number;rootSupport?:'clamped'|'spring';
}
export const initialConditions:DesignConditions={acceleration:8,angularSpeed:2,bandwidth:8,separation:3,motorShaftTorque:3,efficiency:.9,reverseEfficiency:.8,motorFriction:.015,gearFriction:.12,outputStiffness:1800};
/** A clamp is a local structural boundary, not an identified actuator stiffness.
 * Keep legacy designs on their entered elastic-root condition. */
export function effectiveOutputStiffness(conditions:DesignConditions){
 if(conditions.rootSupport!==undefined&&!['clamped','spring'].includes(conditions.rootSupport))throw Error('Invalid root support');
 return conditions.rootSupport==='clamped'?Infinity:conditions.outputStiffness;
}
export function defaultMember(model:RobotModel){const preferred=model.design.robot==='arm'?'j2':model.design.robot==='biped'?'left_pitch':'fl_pitch';return model.nodes.find(n=>n.id===preferred&&n.joint?.active)?.id??model.nodes.find(n=>n.member&&n.joint?.active)?.id??model.active[0]?.id??'';}
function tensorProjection(n:Node,a:V3){const I=n.inertia;return I[0]*a[0]**2+I[1]*a[1]**2+I[2]*a[2]**2+2*(I[3]*a[0]*a[1]+I[4]*a[0]*a[2]+I[5]*a[1]*a[2]);}
/** Cross-section X/Y axes are physical data, independent of the beam centreline. */
export function memberSection(n:Node){
 const m=n.member;if(!m)throw Error('No elastic member section');
 const q=m.sectionQ??alignZ(m.vector);
 if(Math.abs(Math.hypot(...q)-1)>1e-8||norm(sub(rotate(q,[0,0,1]),unit(m.vector)))>1e-8)throw Error('Section frame Z must follow the member axis');
 const section=sectionProperties(m),Iy=m.section==='tube'?section.I:(m.height*m.width**3-(m.section==='solid'?0:(m.height-2*m.wall)*(m.width-2*m.wall)**3))/12;
 return{q,section,Ix:section.I,Iy};
}
/** A source link mesh is not a mass partition of its elastic member.
 * An explicit partition must account for mass, COM and the full inertia. Mesh-only
 * components still lack an inertia/density distribution for sectional loads. */
export function memberInertialComponents(model:RobotModel,n:Node):Component[]|undefined{
 const explicit=n.member?.inertialComponents,components=explicit??(isSourceDesign(model.design)?undefined:n.components);
 if(!components||components.some(c=>c.shape==='mesh'&&c.mass>0))return undefined;
 if(components.some(c=>c.role==='member'&&c.mass>0&&(Math.abs(dot(rotate(c.q,[0,0,1]),unit(n.member!.vector)))<1-1e-8||!['member','box','cylinder'].includes(c.shape))))return undefined;
 if(explicit){
  const mass=components.reduce((s,c)=>s+c.mass,0),moment=components.reduce((s,c)=>add(s,mul(c.p,c.mass)),[0,0,0] as V3);
  if(components.some(c=>!Number.isFinite(c.mass)||c.mass<0)||Math.abs(mass-n.mass)>1e-8*Math.max(1,n.mass)||norm(sub(moment,mul(n.com,n.mass)))>1e-8*Math.max(1,n.mass))throw Error('Elastic mass partition must preserve link mass and COM');
  const total=massProperties(components),scale=Math.max(1e-8,...n.inertia.map(Math.abs));
  if(total.inertia.some((v,i)=>!Number.isFinite(v)||Math.abs(v-n.inertia[i]!)>1e-8*scale))throw Error('Elastic mass partition must preserve the complete link inertia');
 }
 return components;
}
/** Euler bifurcation of a straight uniform beam with rigid end lengths and
 * the actual root-axis rotational spring. The other root rotations are fixed.
 * A skew attachment is not the straight, concentrically loaded column model. */
export function memberBuckling(model:RobotModel,n:Node,driver:Node,poses:ReturnType<typeof fk>,outputStiffness:number){
 const m=n.member!,{q, Ix,Iy}=memberSection(n),basis=qm(poses[n.id]!.q,q),offset=rotate(inverseQ(basis),sub(poses[n.id]!.p,poses[driver.id]!.p)),e=(m.length-m.cutLength)/2,l=m.cutLength,a=offset[2]+e,b=e;
 if(Math.hypot(offset[0],offset[1])>1e-8||a<0||b<0||!(outputStiffness>0))return NaN;
 const axis=rotate(inverseQ(basis),rotate(poses[driver.id]!.q,driver.joint!.axis)),EI=[m.prop.E*Ix,m.prop.E*Iy];
 const fixedCritical=(rigidity:number)=>{let lo=0,hi=Math.PI/2;for(let i=0;i<60;i++){const x=(lo+hi)/2;if(Math.cos(x)-x*b/l*Math.sin(x)>0)lo=x;else hi=x;}return rigidity*((lo+hi)/(2*l))**2;};
 const upper=Math.min(...EI.map(fixedCritical));
 const determinant=(P:number)=>outputStiffness-P*a*(axis[0]**2+axis[1]**2)-EI.reduce((sum,rigidity,i)=>{
  if(Math.abs(axis[i]!)<1e-12)return sum;const beta=Math.sqrt(P/rigidity),x=beta*l;
  return sum+axis[i]!**2*rigidity*beta*(Math.sin(x)+beta*b*Math.cos(x))/(Math.cos(x)-beta*b*Math.sin(x));
 },0);
 // An uncoupled, weaker bending plane can buckle before the spring mode.
 if(determinant(upper*(1-1e-12))>=0)return upper;
 let lo=0,hi=upper*(1-1e-12);for(let i=0;i<64;i++){const P=(lo+hi)/2;if(determinant(P)>0)lo=P;else hi=P;}return(lo+hi)/2;
}
export function analyzeDesign(model:RobotModel,conditions:DesignConditions,memberId=defaultMember(model)){
 for(const [key,value] of Object.entries(conditions))if(key!=='rootSupport'&&(!Number.isFinite(value)||value<0))throw Error(`Invalid ${key}`);
 for(const key of ['bandwidth','separation','motorShaftTorque','outputStiffness','efficiency','reverseEfficiency'] as const)if(conditions[key]<=0)throw Error(`Invalid ${key}`);
 if(conditions.efficiency>1||conditions.reverseEfficiency>1)throw Error('Efficiency must be at most one');
 const outputStiffness=effectiveOutputStiffness(conditions);
 const d=model.design,source=isSourceDesign(d),eligible=(n:Node)=>!!n.joint?.active&&(source||!!n.member);
 const n=model.nodes.find(n=>n.id===memberId&&eligible(n))??model.nodes.find(eligible)??(source?model.nodes.find(n=>n.joint?.active):undefined);if(!n)throw Error('No active analysis joint');
 const poses=fk(model,model.home),pose=poses[n.id]!;
 if(!n.member||!hasElasticModel(d)){
  const axis=rotate(pose.q,n.joint!.axis),members=subtree(model,n.id),loadInertia=jointInertia(model,n.id),rotorReflection=n.joint!.rotorInertia??NaN,totalInertia=loadInertia+rotorReflection,gravity=members.reduce((sum,b)=>sum+dot(axis,cross(sub(add(poses[b.id]!.p,rotate(poses[b.id]!.q,b.com)),pose.p),[0,0,-b.mass*9.80665])),0);
  // A rigid-body URDF supplies joint inertia and effort, but no elastic section,
  // component mass partition or calibrated motor/friction parameters.
  return{member:n,driver:n,L:NaN,loadLever:NaN,loadDirection:[NaN,NaN,NaN] as V3,cutLength:NaN,section:{area:NaN,I:NaN,J:NaN,c:NaN},bendingI:NaN,bendingAxis:[NaN,NaN] as [number,number],loadInertia,rotorReflection,totalInertia,reflectionRatio:rotorReflection/loadInertia,gravity,staticTorque:NaN,requestedTorque:NaN,availableTorque:jointTorqueLimit(model,n.joint!),torqueUse:NaN,
   beamCompliance:NaN,driveCompliance:NaN,compliance:NaN,stiffness:NaN,modalMass:NaN,frequency:NaN,resonanceRatio:NaN,bandwidthSatisfied:false,beamDeflection:NaN,deflection:NaN,stress:NaN,strengthUse:NaN,deflectionUse:NaN,
   breakawayTorque:NaN,breakawayForce:NaN,kineticEnergy:NaN,structures:NaN,actuatorMass:NaN,mass:model.mass,specificE:NaN,beamIndex:NaN,shapeFactor:NaN,slenderness:NaN,buckling:NaN,distalMass:members.filter(b=>b.id!==n.id).reduce((sum,b)=>sum+b.mass,0),tipForce:d.tipForce};
 }
 const m=n.member,p=m.prop,{q:sectionQ,section:s,Ix,Iy}=memberSection(n),l=m.cutLength;
 let driver=n;while(driver.parent&&Math.abs(dot(rotate(poses[driver.id]!.q,driver.joint?.axis??[0,0,1]),rotate(pose.q,unit(m.vector))))>.95)driver=model.nodes.find(b=>b.id===driver.parent)!;
 if(!driver.joint)driver=n;
 const axis=rotate(poses[driver.id]!.q,driver.joint!.axis),origin=poses[driver.id]!.p,direction=unit(m.vector),worldDirection=rotate(pose.q,direction),basis=qm(pose.q,sectionQ),tip=add(pose.p,rotate(pose.q,m.vector));
 const rigidOffset=Math.max(0,dot(sub(pose.p,origin),worldDirection)),L=m.length+rigidOffset,start=(m.length-l)/2,end=start+l,members=subtree(model,driver.id);
 const transverse=cross(axis,worldDirection),loadDirection=norm(transverse)>1e-10?unit(transverse):rotate(basis,[1,0,0]),localForce=rotate(inverseQ(basis),loadDirection),ax=Math.abs(localForce[1]),ay=Math.abs(localForce[0]),bendingI=1/(ax*ax/Ix+ay*ay/Iy);
 const loadLever=dot(axis,cross(sub(tip,origin),loadDirection)),loadInertia=jointInertia(model,driver.id),rotorReflection=source?(driver.joint!.rotorInertia??NaN):jointRotorInertia(model,driver.joint),totalInertia=loadInertia+rotorReflection;
 const gravity=members.reduce((sum,b)=>{const r=sub(add(poses[b.id]!.p,rotate(poses[b.id]!.q,b.com)),origin);return sum+dot(axis,cross(r,[0,0,-b.mass*9.80665]));},0);
 const staticTorque=Math.abs(gravity)+d.tipForce*Math.abs(loadLever),friction=conditions.gearFriction+d.ratio*conditions.motorFriction/conditions.reverseEfficiency;
 const requestedTorque=source?NaN:staticTorque+totalInertia*conditions.acceleration+friction,availableTorque=driver.joint!.effortLimit??conditions.motorShaftTorque*d.ratio*conditions.efficiency*driver.joint!.motorScale;
 // Unit load is transverse to the member. Transfer its moment to the actual
 // driving axis: a skew axis or an offset joint does not have lever arm L.
 const beamCompliance=((m.length-start)**3-(m.length-end)**3)/(3*p.E*bendingI),driveCompliance=loadLever**2/outputStiffness,compliance=beamCompliance+driveCompliance;
 const rootRotation=mul(axis,loadLever/outputStiffness);
 const sectionMotion=(point:V3)=>{
  const local=rotate(inverseQ(basis),sub(point,pose.p)),x=local[2],b=Math.max(start,Math.min(x,end)),primitive=(u:number)=>x*m.length*u-(x+m.length)*u*u/2+u**3/3;
  const integral=primitive(b)-primitive(start),slope=m.length*(b-start)-(b*b-start*start)/2;
  const rotation:V3=[-localForce[1]*slope/(p.E*Ix),localForce[0]*slope/(p.E*Iy),0],displacement:V3=[localForce[0]*integral/(p.E*Iy),localForce[1]*integral/(p.E*Ix),0];
  return{rotation:add(rootRotation,rotate(basis,rotation)),displacement:add(cross(rootRotation,sub(point,origin)),rotate(basis,add(displacement,cross(rotation,[local[0],local[1],0]))))};
 };
 const rootMotion=(point:V3)=>({rotation:rootRotation,displacement:cross(rootRotation,sub(point,origin))});
 const components=memberInertialComponents(model,n),memberNodes=subtree(model,n.id),memberIds=new Set(memberNodes.map(b=>b.id)),distalMass=memberNodes.filter(b=>b.id!==n.id).reduce((sum,b)=>sum+b.mass,0);
 let modalMass=components&&Number.isFinite(rotorReflection)?0:NaN;
 const rigidMass=(mass:number,centre:V3,inertia:Node['inertia'],orientation:typeof pose.q,motion:ReturnType<typeof sectionMotion>)=>{
  const a=rotate(inverseQ(orientation),motion.rotation),tensor=inertia[0]*a[0]**2+inertia[1]*a[1]**2+inertia[2]*a[2]**2+2*(inertia[3]*a[0]*a[1]+inertia[4]*a[0]*a[2]+inertia[5]*a[1]*a[2]);
  return(mass*dot(motion.displacement,motion.displacement)+tensor)/compliance**2;
 };
 if(components&&Number.isFinite(modalMass)){
  for(const c of components){if(c.mass<=0)continue;
   if(c.role==='member'){
    // Euler–Bernoulli distributed translational inertia uses the actual
    // component mass, not a second mass invented from an equivalent section.
    const steps=80,axis=rotate(c.q,[0,0,1]),length=c.shape==='cylinder'?c.size[1]:c.size[2];for(let i=0;i<=steps;i++){const point=add(pose.p,rotate(pose.q,add(c.p,mul(axis,(i/steps-.5)*length)))),u=sectionMotion(point).displacement;modalMass+=(i===0||i===steps?1:i%2?4:2)*c.mass*dot(u,u)/(3*steps*compliance**2);}
   }else{const props=massProperties([c]),centre=add(pose.p,rotate(pose.q,props.com));modalMass+=rigidMass(c.mass,centre,props.inertia,pose.q,sectionMotion(centre));}
  }
  for(const body of members.filter(b=>b.id!==n.id)){
   const bodyPose=poses[body.id]!,centre=add(bodyPose.p,rotate(bodyPose.q,body.com));let motion=rootMotion(centre);
   if(memberIds.has(body.id)){
    let attachment=body;while(attachment.parent!==n.id)attachment=model.nodes.find(b=>b.id===attachment.parent)!;
    const point=poses[attachment.id]!.p,at=sectionMotion(point);motion={rotation:at.rotation,displacement:add(at.displacement,cross(at.rotation,sub(centre,point)))};
   }
   modalMass+=rigidMass(body.mass,centre,body.inertia,bodyPose.q,motion);
  }
  modalMass+=rotorReflection*(loadLever/(outputStiffness*compliance))**2;
 }
 const frequency=1/(2*Math.PI)*Math.sqrt(1/(compliance*modalMass)),resonanceRatio=frequency/conditions.bandwidth;
 const moment=d.tipForce*(m.length-start),stress=moment*(m.section==='tube'?s.c/bendingI:ax*m.height/(2*Ix)+ay*m.width/(2*Iy)),beamDeflection=d.tipForce*beamCompliance,deflection=d.tipForce*compliance;
 const structures=source?NaN:model.nodes.flatMap(n=>n.components).filter(c=>c.role==='member').reduce((a,c)=>a+c.mass,0),actuatorMass=source?NaN:model.design.motorMass*model.active.filter(j=>j.kind==='hinge').reduce((a,j)=>a+j.motorScale,0);
 const slenderness=m.section==='tube'?m.height/(2*m.wall):Math.max(m.width,m.height)/m.wall;
 return{member:n,driver,L,loadLever,loadDirection,cutLength:l,section:s,bendingI,bendingAxis:[ax,ay] as [number,number],loadInertia,rotorReflection,totalInertia,reflectionRatio:rotorReflection/loadInertia,gravity,staticTorque,requestedTorque,availableTorque,torqueUse:requestedTorque/availableTorque,
  beamCompliance,driveCompliance,compliance,stiffness:1/compliance,modalMass,frequency,resonanceRatio,bandwidthSatisfied:resonanceRatio>=conditions.separation,beamDeflection,deflection,stress,strengthUse:stress*d.safety/p.strength,deflectionUse:deflection/d.allowDeflection,
  breakawayTorque:source?NaN:friction,breakawayForce:source?NaN:friction/Math.abs(loadLever),kineticEnergy:source?NaN:.5*totalInertia*conditions.angularSpeed**2,structures,actuatorMass,mass:model.mass,
  specificE:p.E/p.rho,beamIndex:Math.sqrt(p.E)/p.rho,shapeFactor:12*bendingI/s.area**2,slenderness,buckling:memberBuckling(model,n,driver,poses,outputStiffness),distalMass,tipForce:d.tipForce};
}
export type DesignAnalysis=ReturnType<typeof analyzeDesign>;

/** Oblique rigid-body inertia is useful when inspecting a selected body's tensor. */
export const centralAxisInertia=(n:Node,a:V3)=>tensorProjection(n,unit(a));
