import {type RobotModel,type V3,type Component,add,sub,mul,dot,cross,norm,unit,rotate,inverseQ,qm,alignZ,massProperties} from './concept-model.js';
import {groundFrame,motionFrame} from './design-motion.js';
import {type DynamicsFrame,gravity,dynamicsSamples} from './design-dynamics.js';
import {memberSection,memberInertialComponents,memberBuckling} from './design-analysis.js';
export interface MemberLoad{member:string;time:number;normal:number;shear:number;bending:number;torsion:number;stress:number;deflection:number;beamDeflection:number;connectionDeflection:number;twist:number;bucklingUse:number;strengthUse:number;deflectionUse:number;torque:number;elasticTorque:number;structuralDataComplete:boolean;feasible:boolean}
/** Section resultants from the distal Newton–Euler wrench plus all component
 * inertia/gravity downstream of the cut. A member is a distributed beam;
 * rigid fixtures are assigned by their COM. This is a beam screen, not FEA. */
export function motionMemberLoad(robot:RobotModel,dynamics:DynamicsFrame,id:string,driver:string,outputStiffness:number,moving=true):MemberLoad{
 const n=robot.nodes.find(n=>n.id===id)!,member=n.member!,L=member.length,l=member.cutLength,e=(L-l)/2,axis=unit(member.vector),context=dynamicsSamples(dynamics),step=context?.step??.002,t=dynamics.time,components=memberInertialComponents(robot,n);
 if(!components||dynamics.referenceValid===false)return{member:id,time:t,normal:NaN,shear:NaN,bending:NaN,torsion:NaN,stress:NaN,deflection:NaN,beamDeflection:NaN,connectionDeflection:NaN,twist:NaN,bucklingUse:NaN,strengthUse:NaN,deflectionUse:NaN,torque:dynamics.torque[driver]??NaN,elasticTorque:NaN,structuralDataComplete:false,feasible:dynamics.feasible};
 const samples=context?.samples??[-step,0,step].map(dt=>groundFrame(motionFrame(robot,t+dt,moving))),pose=samples[1]!.poses[n.id]!,end=add(pose.p,rotate(pose.q,member.vector)),children=robot.nodes.filter(c=>c.parent===id);
 const {q:sectionQ,section,Ix,Iy}=memberSection(n),basis=qm(pose.q,sectionQ);
 const rv=(q:ReturnType<typeof qm>):V3=>{const sign=q[0]<0?-1:1,r=Math.hypot(q[1],q[2],q[3]);return r<1e-12?[0,0,0]:mul([q[1],q[2],q[3]],2*sign*Math.atan2(r,Math.abs(q[0]))/r);},w=mul(rv(qm(samples[2]!.poses[id]!.q,inverseQ(samples[0]!.poses[id]!.q))),1/(2*step)),wp=mul(rv(qm(samples[2]!.poses[id]!.q,inverseQ(pose.q))),1/step),wn=mul(rv(qm(pose.q,inverseQ(samples[0]!.poses[id]!.q))),1/step),alpha=mul(sub(wp,wn),1/step);
 const componentWrench=(c:Component,cut:V3)=>{
  const points=samples.map(f=>add(f.poses[id]!.p,rotate(f.poses[id]!.q,c.p))),a=mul(add(sub(points[2]!,mul(points[1]!,2)),points[0]!),1/(step*step)),force=mul(add(a,[0,0,gravity]),c.mass),I=massProperties([c]).inertia;
  const tensor=(v:V3):V3=>[I[0]*v[0]+I[3]*v[1]+I[4]*v[2],I[3]*v[0]+I[1]*v[1]+I[5]*v[2],I[4]*v[0]+I[5]*v[1]+I[2]*v[2]],worldI=(v:V3)=>rotate(pose.q,tensor(rotate(inverseQ(pose.q),v)));
  return{force,moment:add(add(worldI(alpha),cross(w,worldI(w))),cross(sub(points[1]!,cut),force))};
 };
 let normal=0,shear=0,bending=0,torsion=0,stress=0,compression=0,defX=0,defY=0,twist=0;
 const steps=24,ds=l/steps;
 for(let i=0;i<=steps;i++){
  const x=e+i*ds,cut=add(pose.p,rotate(pose.q,mul(axis,x)));let force:V3=[0,0,0],moment:V3=[0,0,0];
  // Every distal attachment contributes at its own actual joint origin.
  for(const child of children){if(dot(child.offset,axis)<x-1e-10)continue;const load=dynamics.wrenches[child.id];if(!load)throw Error('Missing child wrench for '+child.id);force=add(force,load.force);moment=add(moment,add(load.moment,cross(sub(samples[1]!.poses[child.id]!.p,cut),load.force)));}
  for(const original of components){let c=original;
   if(c.role==='member'){
    const length=c.shape==='cylinder'?c.size[1]:c.size[2],centre=dot(c.p,axis),a=Math.max(centre-length/2,x),b=centre+length/2;if(b<=a)continue;const size=[...c.size] as V3;size[c.shape==='cylinder'?1:2]=b-a;c={...c,p:add(c.p,mul(axis,(a+b)/2-centre)),size,mass:c.mass*(b-a)/length};
   }else if(dot(c.p,axis)<x)continue;
   if(c.mass<=0)continue;const load=componentWrench(c,cut);force=add(force,load.force);moment=add(moment,load.moment);
  }
  const f=rotate(inverseQ(basis),force),m=rotate(inverseQ(basis),moment),sigma=Math.abs(f[2])/section.area+(member.section==='tube'?Math.hypot(m[0],m[1])*member.height/2/Ix:Math.abs(m[0])*member.height/2/Ix+Math.abs(m[1])*member.width/2/Iy),weight=i===0||i===steps?1:i%2?4:2;
  normal=Math.max(normal,Math.abs(f[2]));compression=Math.max(compression,f[2]);shear=Math.max(shear,Math.hypot(f[0],f[1]));bending=Math.max(bending,Math.hypot(m[0],m[1]));torsion=Math.max(torsion,Math.abs(m[2]));stress=Math.max(stress,sigma);
  defX+=weight*m[1]*(L-x)/(member.prop.E*Iy)*ds/3;defY-=weight*m[0]*(L-x)/(member.prop.E*Ix)*ds/3;twist+=weight*m[2]/(member.prop.G*section.J)*ds/3;
 }
 const driving=robot.nodes.find(n=>n.id===driver)!,jointPose=samples[1]!.poses[driver]!,direction=rotate(jointPose.q,driving.joint!.axis),elasticTorque=dot(direction,dynamics.wrenches[driver]!.moment),rotation=elasticTorque/outputStiffness,spring=cross(direction,sub(end,jointPose.p)),springLocal=rotate(inverseQ(basis),mul(spring,rotation)),deflection=Math.hypot(defX+springLocal[0],defY+springLocal[1]),critical=memberBuckling(robot,n,driving,samples[1]!.poses,outputStiffness);
 twist+=dot(rotate(inverseQ(basis),direction),[0,0,1])*rotation;
 return{member:id,time:t,normal,shear,bending,torsion,stress,deflection,beamDeflection:Math.hypot(defX,defY),connectionDeflection:Math.hypot(springLocal[0],springLocal[1]),twist,bucklingUse:compression*robot.design.safety/critical,strengthUse:stress*robot.design.safety/member.prop.strength,deflectionUse:deflection/robot.design.allowDeflection,torque:dynamics.torque[driver]??0,elasticTorque,structuralDataComplete:true,feasible:dynamics.feasible};
}
