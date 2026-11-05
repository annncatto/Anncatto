import {type RobotModel,type Node,type Component,type Property,type V3,generateRobot,copyDesign,property,massProperties,norm,mul,add,alignZ} from './concept-model.js';
import {materials,sectionProperties,type Material,type SectionType} from './lightweight-mechanics.js';

export interface SourceMemberDefinition{
 nodeId:string;childId:string;label:[string,string];
 reference:{section:SectionType;width:number;height:number;wall:number;material:Material;prop:Property;mass:number;length:number;cutLength:number};
 residualMass:number;currentMass:number;
}
export interface SourceAffine{A:number[][];b:V3}
const eye=()=>[[1,0,0],[0,1,0],[0,0,1]];
const product=(A:number[][],B:number[][])=>A.map(row=>B[0].map((_,j)=>row.reduce((s,x,k)=>s+x*B[k][j],0)));
const transpose=(A:number[][])=>A[0].map((_,i)=>A.map(row=>row[i]));
const action=(A:number[][],p:V3)=>A.map(row=>row.reduce((s,x,i)=>s+x*p[i],0)) as V3;
const tensor=(v:Node['inertia'])=>[[v[0],v[3],v[4]],[v[3],v[1],v[5]],[v[4],v[5],v[2]]];
const pack=(A:number[][]):Node['inertia']=>[A[0][0],A[1][1],A[2][2],A[0][1],A[0][2],A[1][2]];
const second=(I:number[][])=>{const h=(I[0][0]+I[1][1]+I[2][2])/2;return I.map((row,i)=>row.map((x,j)=>(i===j?h:0)-x));};
const inertia=(S:number[][])=>{const t=S[0][0]+S[1][1]+S[2][2];return S.map((row,i)=>row.map((x,j)=>(i===j?t:0)-x));};
function minimumEigenvalue(A:number[][]){
 const M=A.map(row=>[...row]),N=M.length;
 for(let iteration=0;iteration<80;iteration++){
  let p=0,q=1;for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)if(Math.abs(M[i][j])>Math.abs(M[p][q])){p=i;q=j;}
  if(Math.abs(M[p][q])<1e-15*Math.max(1,...M.map((row,i)=>Math.abs(row[i]))))break;
  const theta=.5*Math.atan2(2*M[p][q],M[q][q]-M[p][p]),c=Math.cos(theta),s=Math.sin(theta),a=M[p][p],b=M[q][q],v=M[p][q];
  for(let k=0;k<N;k++)if(k!==p&&k!==q){const x=M[k][p],y=M[k][q];M[k][p]=M[p][k]=c*x-s*y;M[k][q]=M[q][k]=s*x+c*y;}
  M[p][p]=c*c*a-2*c*s*v+s*s*b;M[q][q]=s*s*a+2*c*s*v+c*c*b;M[p][q]=M[q][p]=0;
 }
 return Math.min(...M.map((row,i)=>row[i]));
}

/** Subtract full zeroth/first/second mass moments. A positive residual mass
 * alone is insufficient: its central second moment must also be PSD. */
export function subtractSourceMember(node:Pick<Node,'id'|'mass'|'com'|'inertia'>,beam:Component):Component{
 if(!(Number.isFinite(node.mass)&&node.mass>0&&Number.isFinite(beam.mass)&&beam.mass>0))throw Error(`Invalid source/reference member mass: ${node.id}`);
 const B=massProperties([beam]),mass=node.mass-B.mass;if(!(mass>1e-9))throw Error(`Concept member exceeds the link mass budget: ${node.id}`);
 const com=node.com.map((x,i)=>(node.mass*x-B.mass*B.com[i])/mass) as V3,S=second(tensor(node.inertia)),SB=second(tensor(B.inertia));
 const residual=S.map((row,i)=>row.map((x,j)=>x+node.mass*node.com[i]*node.com[j]-SB[i][j]-B.mass*B.com[i]*B.com[j]-mass*com[i]*com[j]));
 const scale=Math.max(norm(node.com),norm(B.com),beam.size[2],.01),normalized=residual.map(row=>row.map(x=>x/(mass*scale*scale)));
 if(!normalized.flat().every(Number.isFinite)||minimumEigenvalue(normalized)<-1e-10)throw Error(`Concept member leaves a nonphysical residual inertia: ${node.id}`);
 return{role:'body',shape:'box',p:com,q:[1,0,0,0],size:[0,0,0],mass,material:beam.material,collision:false,visible:false,inertia:pack(inertia(residual)),label:'Remaining source mass budget'};
}

function memberPairs(design:RobotModel['design']):{nodeId:string;childId:string;label:[string,string]}[]{
 if(design.legModel==='go2')return(['fl','fr','rl','rr'] as const).flatMap((p,i)=>{const en=['Front left','Front right','Rear left','Rear right'][i],zh=['左前','右前','左后','右后'][i];return[{nodeId:p+'_pitch',childId:p+'_knee',label:[en+' thigh',zh+'大腿'] as [string,string]},{nodeId:p+'_knee',childId:p+'_foot',label:[en+' shank',zh+'小腿'] as [string,string]}];});
 if(design.legModel==='rp1')return(['left','right'] as const).flatMap((p,i)=>{const en=i?'Right':'Left',zh=i?'右':'左';return[{nodeId:p+'_yaw',childId:p+'_knee',label:[en+' hip-yaw–knee member',zh+'髋偏航—膝关节杆'] as [string,string]},{nodeId:p+'_knee',childId:p+'_ankle',label:[en+' knee–ankle member',zh+'膝—踝关节杆'] as [string,string]}];});
 return design.armModel==='aloha'?[{nodeId:'j2',childId:'j3',label:['Upper arm','上臂']},{nodeId:'j3',childId:'j4',label:['Forearm','前臂']}]:[];
}
function baselineMember(model:Pick<RobotModel,'design'|'nodes'>,pair:ReturnType<typeof memberPairs>[number]){
 const node=model.nodes.find(n=>n.id===pair.nodeId)!,child=model.nodes.find(n=>n.id===pair.childId)!,length=norm(child.offset),cutLength=.8*length,material:Material=model.design.armModel==='aloha'?'abs':'aluminium',prop=property(material),section={section:'box' as SectionType,width:.012,height:.018,wall:.0008},mass=prop.rho*sectionProperties(section).area*cutLength;
 const beam:Component={role:'member',shape:'member',p:mul(child.offset,.5),q:alignZ(child.offset),size:[section.width,section.height,cutLength],mass,material,section,span:[...child.offset],collision:true};
 return{node,beam,reference:{...section,material,prop,mass,length,cutLength},residual:subtractSourceMember(node,beam)};
}

export function sourceMemberDefinitions(model:RobotModel):SourceMemberDefinition[]{
 if(model.design.sourceMode!=='derived')return[];
 const design=copyDesign(model.design);design.sourceMode='original';delete design.sourceDimensions;
 const raw=generateRobot(design);
 return memberPairs(design).map(pair=>{const b=baselineMember(raw,pair),n=model.nodes.find(n=>n.id===pair.nodeId);return{...pair,reference:b.reference,residualMass:b.residual.mass,currentMass:n?.member?.inertialComponents?.filter(c=>c.role==='member').reduce((s,c)=>s+c.mass,0)??b.reference.mass};});
}

/** The reference partition is always rebuilt from the unedited source and the
 * versioned concept section. Current overrides never redefine that baseline. */
export function applySourceMembers(model:RobotModel,originalNodes:Node[],transforms:ReadonlyMap<string,SourceAffine>):SourceMemberDefinition[]{
 const original={design:model.design,nodes:originalNodes},definitions:SourceMemberDefinition[]=[];
 const allowed=new Set(memberPairs(model.design).map(p=>p.nodeId));
 for(const [id,part] of Object.entries(model.design.parts))if(!allowed.has(id)&&Object.keys(part).length)throw Error('Unsupported concept member: '+id);
 for(const pair of memberPairs(model.design)){
  const {reference,residual}=baselineMember(original,pair),node=model.nodes.find(n=>n.id===pair.nodeId)!,child=model.nodes.find(n=>n.id===pair.childId)!,v=[...child.offset] as V3,length=norm(v),cutLength=.8*length,override=model.design.parts[pair.nodeId]??{},material=override.material??reference.material;
  if(!(material in materials))throw Error(`Invalid concept member material: ${pair.nodeId}`);
  const prop={...property(material),...override.properties};
  const section={section:override.section??reference.section,width:override.width??reference.width,height:override.height??reference.height,wall:override.wall??reference.wall};
  if(override.length!==undefined)throw Error('Derived member length must be set with sourceDimensions');
  if(!['box','tube','solid'].includes(section.section)||![section.width,section.height,section.wall].every(x=>Number.isFinite(x)&&x>0))throw Error(`Invalid concept member section: ${pair.nodeId}`);
  if(section.section!=='solid'&&2*section.wall>=(section.section==='tube'?section.height:Math.min(section.width,section.height)))throw Error(`Invalid concept member wall thickness: ${pair.nodeId}`);
  if(!(Number.isFinite(length)&&length>0)||![prop.rho,prop.E,prop.G,prop.strength].every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(prop.nu)||prop.nu<=-1||prop.nu>=.5)throw Error(`Invalid concept member properties: ${pair.nodeId}`);
  const mass=prop.rho*sectionProperties(section).area*cutLength,beam:Component={role:'member',shape:'member',p:mul(v,.5),q:alignZ(v),size:[section.width,section.height,cutLength],mass,material,section,span:v,collision:true};
  const T=transforms.get(pair.nodeId);if(T){residual.p=add(action(T.A,residual.p),T.b);residual.inertia=pack(inertia(product(product(T.A,second(tensor(residual.inertia!))),transpose(T.A))));}
  const elements=[residual,beam],physical=massProperties(elements),raw=originalNodes.find(n=>n.id===pair.nodeId)!;
  // Exact unchanged identity matters for source comparisons. Material E and
  // strength alone do not change a rigid body's mass distribution either.
  const unchanged=!T&&v.every((x,i)=>x===originalNodes.find(n=>n.id===pair.childId)!.offset[i])&&section.section===reference.section&&section.width===reference.width&&section.height===reference.height&&section.wall===reference.wall&&prop.rho===reference.prop.rho;
  if(unchanged){node.mass=raw.mass;node.com=[...raw.com];node.inertia=[...raw.inertia];}else Object.assign(node,physical);
  node.member={vector:v,length,cutLength,...section,material,prop,sectionQ:[...beam.q],inertialComponents:elements};
  // The central elastic member replaces the full joint-to-joint connector.
  // Its two rigid end regions belong to the existing assembly remainder, so
  // their visible/collision geometry adds no second mass or inertia budget.
  // Match the member's outer section: a smaller rod inside a hollow member
  // would not actually meet its walls at the shared end face.
  const endLength=(length-cutLength)/2;
  const connections:Component[]=[endLength/2,length-endLength/2].map((station,index)=>({
   role:'collar',shape:section.section==='tube'?'cylinder':'box',
   p:mul(v,station/length),q:[...beam.q],
   size:section.section==='tube'?[section.height/2,endLength,0]:[section.width,section.height,endLength],
   mass:0,material:reference.material,collision:true,
   label:index===0?'Concept proximal rigid connection':'Concept distal rigid connection',
  }));
  node.components=node.components.filter(c=>!(c.shape==='cylinder'&&c.role==='collar'&&norm(c.p.map((x,i)=>x-v[i]/2) as V3)<1e-10));
  node.components.push(residual,beam,...connections);
  definitions.push({...pair,reference,residualMass:residual.mass,currentMass:beam.mass});
 }
 model.mass=model.nodes.reduce((s,n)=>s+n.mass,0);
 return definitions;
}
