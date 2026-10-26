import {type RobotModel,type Transform,type V3,type Component,add,sub,dot,cross,norm,unit,rotate,qm} from './concept-model.js';
interface Envelope{node:string;parent:string|null;role:Component['role'];centre:V3;axes:V3[];half:V3}
/** Conservative solid envelopes; adjoining joint interfaces are intentionally excluded. */
export function packingConflicts(model:RobotModel,poses:Record<string,Transform>){
 const parts:Envelope[]=model.nodes.flatMap(n=>n.components.filter(c=>!['collar','belt'].includes(c.role)).map(c=>{
  const p=poses[n.id]!,q=qm(p.q,c.q),half:V3=c.shape==='cylinder'?[c.size[0],c.size[0],c.size[1]/2]:c.shape==='sphere'?[c.size[0],c.size[0],c.size[0]]:c.shape==='member'?[c.section!.section==='tube'?c.section!.height/2:c.section!.width/2,c.section!.height/2,c.size[2]/2]:[c.size[0]/2,c.size[1]/2,c.size[2]/2];
  return{node:n.id,parent:n.parent,role:c.role,centre:add(p.p,rotate(p.q,c.p)),axes:([[1,0,0],[0,1,0],[0,0,1]] as V3[]).map(a=>rotate(q,a)),half};
 }));
 const conflicts:{a:string;b:string;roles:string;depth:number}[]=[];
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=parts[i]!,b=parts[j]!;
  if((a.node===b.parent||b.node===a.parent)&&!(a.role==='motor'&&b.role==='motor'))continue;
  if(a.node===b.node&&a.role!=='motor'&&b.role!=='motor')continue;
  const offset=sub(b.centre,a.centre);if(norm(offset)>norm(a.half)+norm(b.half))continue;
  const axes=[...a.axes,...b.axes,...a.axes.flatMap(x=>b.axes.map(y=>cross(x,y)))].filter(v=>norm(v)>1e-7).map(unit);
  let depth=Infinity;
  for(const axis of axes){const extent=(p:Envelope)=>p.axes.reduce((s,v,k)=>s+Math.abs(dot(v,axis))*p.half[k]!,0);depth=Math.min(depth,extent(a)+extent(b)-Math.abs(dot(offset,axis)));if(depth<.001)break;}
  if(depth>.001)conflicts.push({a:a.node,b:b.node,roles:a.role+' / '+b.role,depth});
 }
 return conflicts;
}
