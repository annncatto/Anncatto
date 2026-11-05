import {type RobotModel,type Node,type Transform,type V3,type Q4,fk,add,sub,mul,cross,norm,rotate,qm,inverseQ,linearSolve,clamp} from './concept-model.js';

/** Source descriptions retain their own joint order, frames and axis signs.
 * This solver therefore follows the actual foot ancestor chain; it does not
 * assume the concept model's roll/pitch/knee ordering or a two-link plane. */
const cache=new WeakMap<RobotModel,Map<string,ReturnType<typeof buildLeg>>>();
const rotationError=(target:Q4,actual:Q4):V3=>{
 const q=qm(target,inverseQ(actual)),sign=q[0]<0?-1:1,v:V3=[q[1]*sign,q[2]*sign,q[3]*sign],s=norm(v);
 return s<1e-12?mul(v,2):mul(v,2*Math.atan2(s,q[0]*sign)/s);
};
export function sourceSolePoint(node:Node,pose:Transform):V3{
 const foot=node.components.find(c=>c.role==='foot');if(!foot)throw Error(`Missing contact geometry for ${node.id}`);
 const centre=add(pose.p,rotate(pose.q,foot.p));
 return add(centre,foot.shape==='sphere'?[0,0,-foot.size[0]]:rotate(pose.q,rotate(foot.q,[0,0,-foot.size[2]/2])));
}
function buildLeg(model:RobotModel,prefix:string){
 const tip=model.nodes.find(n=>n.group===prefix&&n.tip==='foot');if(!tip)throw Error(`Missing source foot for ${prefix}`);
 const chain:Node[]=[];let node:Node|undefined=tip;
 while(node){chain.unshift(node);node=model.nodes.find(n=>n.id===node!.parent);}
 const joints=chain.filter(n=>n.joint?.active&&n.group===prefix),home=fk(model,model.home),pitch=model.nodes.find(n=>n.id===`${prefix}_pitch`)!,knee=model.nodes.find(n=>n.id===`${prefix}_knee`)!;
 const length=norm(sub(home[knee.id]!.p,home[pitch.id]!.p))+norm(sub(home[tip.id]!.p,home[knee.id]!.p));
 return{tip,chain,joints,length,homePose:home[tip.id]!,homePoint:sourceSolePoint(tip,home[tip.id]!),orientation:tip.components.find(c=>c.role==='foot')!.shape==='sphere'?undefined:home[tip.id]!.q};
}
export function sourceLegGeometry(model:RobotModel,prefix:string){
 let legs=cache.get(model);if(!legs){legs=new Map();cache.set(model,legs);}let leg=legs.get(prefix);if(!leg){leg=buildLeg(model,prefix);legs.set(prefix,leg);}return leg;
}
export function sourceLegIK(model:RobotModel,q:Record<string,number>,prefix:string,target:V3,base:Transform){
 const leg=sourceLegGeometry(model,prefix),skeleton={nodes:leg.chain,height:model.height},n=leg.joints.length,orientationScale=Math.min(.3,leg.length*.4),targetQ=leg.orientation;
 const evaluate=()=>{const poses=fk(skeleton,q,base),pose=poses[leg.tip.id]!,point=sourceSolePoint(leg.tip,pose),position=sub(target,point),rotation=targetQ?rotationError(targetQ,pose.q):[0,0,0] as V3,error=targetQ?[...position,...mul(rotation,orientationScale)]:[...position];return{poses,pose,point,position,rotation,error,cost:error.reduce((s,v)=>s+v*v,0)};};
 let state=evaluate(),iterations=0;
 for(;iterations<72&&n>0;iterations++){
  if(norm(state.position)<2e-10&&(!targetQ||norm(state.rotation)<2e-9))break;
  // World-space spatial Jacobian from the source transforms. The hinge axis
  // is unchanged by its own rotation; originQ has already been applied by FK.
  const columns=leg.joints.map(node=>{
   const joint=node.joint!,pose=state.poses[node.id]!,axis=rotate(pose.q,joint.axis),geometry=leg.tip.components.find(c=>c.role==='foot')!;
   const centre=geometry.shape==='sphere'?add(state.point,[0,0,geometry.size[0]]):state.point;
   const linear=joint.kind==='slide'?axis:cross(axis,sub(centre,pose.p));
   return targetQ?[...linear,...mul(joint.kind==='slide'?[0,0,0]:axis,orientationScale)]:[...linear];
  });
  const H=columns.map((a,i)=>columns.map((b,j)=>a.reduce((s,v,k)=>s+v*b[k]!,0)+(i===j?1e-10:0))),rhs=columns.map(a=>a.reduce((s,v,k)=>s+v*state.error[k]!,0));
  const step=linearSolve(H,rhs),stepScale=Math.min(1,.2/Math.max(...step.map(Math.abs))),before=leg.joints.map(node=>q[node.id]??node.joint!.home);let accepted=false;
  for(const scale of [1,.5,.25,.125,.0625]){
   leg.joints.forEach((node,i)=>{const joint=node.joint!;q[node.id]=clamp(before[i]!+scale*stepScale*step[i]!,joint.min,joint.max);});
   const next=evaluate();if(next.cost<state.cost){state=next;accepted=true;break;}
  }
  if(!accepted){leg.joints.forEach((node,i)=>q[node.id]=before[i]!);break;}
 }
 return{positionError:norm(state.position),orientationError:targetQ?norm(state.rotation):0,iterations};
}
