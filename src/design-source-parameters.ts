import {type RobotModel,type Node,type V3,type Component,type ModelSource,generateRobot,copyDesign,isSourceDesign,add,sub,mul,dot,cross,norm,unit,alignZ,rotate,fk} from './concept-model.js';
import {go2Description,rp1Description} from './source-robot-data.js';
import {alohaDescription} from './aloha-description.js';
import {applySourceMembers} from './design-source-members.js';

export interface SourceParameterDefinition{id:string;label:[string,string];value:number;baseline:number;min:number;max:number;group:'mount'|'limb'|'terminal';edge?:string;axis?:number;reference?:[string,string]}
type Matrix=number[][];
interface Affine{A:Matrix;b:V3}
interface Parameter extends SourceParameterDefinition{apply:(value:number,transforms:Map<string,Affine>)=>void}
const identity=():Matrix=>[[1,0,0],[0,1,0],[0,0,1]];
const product=(A:Matrix,B:Matrix):Matrix=>A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
const action=(A:Matrix,v:V3):V3=>A.map(row=>dot(row as V3,v)) as V3;
function compose(map:Map<string,Affine>,id:string,A:Matrix,b:V3=[0,0,0]){const old=map.get(id)??{A:identity(),b:[0,0,0] as V3};map.set(id,{A:product(A,old.A),b:add(action(A,old.b),b)});}

/** Fixed total link mass, with its existing mass distribution transformed by A.
 * The central second moment S transforms as A S Aᵀ. Translation moves the COM
 * but does not change central inertia. No source motor/member split is invented. */
export function transformSourceInertia(inertia:Node['inertia'],A:Matrix):Node['inertia']{
 const [xx,yy,zz,xy,xz,yz]=inertia,halfTrace=(xx+yy+zz)/2,S=[[halfTrace-xx,-xy,-xz],[-xy,halfTrace-yy,-yz],[-xz,-yz,halfTrace-zz]],AS=product(A,S),T=product(AS,A[0].map((_,i)=>A.map(row=>row[i]))),trace=T[0][0]+T[1][1]+T[2][2];
 return[trace-T[0][0],trace-T[1][1],trace-T[2][2],-T[0][1],-T[0][2],-T[1][2]];
}

function parameterCatalog(model:RobotModel,dimensions:Record<string,number>={}):Parameter[]{
 const node=(id:string)=>{const n=model.nodes.find(n=>n.id===id);if(!n)throw Error('Source parameter node missing: '+id);return n;},specs:Parameter[]=[];
 const append=(id:string,label:[string,string],baseline:number,group:SourceParameterDefinition['group'],apply:Parameter['apply'],min=Math.max(.001,baseline*.35),max=Math.max(.08,baseline*2.5))=>specs.push({id,label,value:dimensions[id]??baseline,baseline,min,max,group,apply});
 // Length and XYZ are two views of one joint-origin vector. Old length-only
 // designs retain directional scaling. XYZ edits are explicit parent-frame
 // coordinates; paired limbs retain their source asymmetry and mirrored Y.
 const length=(id:string,label:[string,string],children:string[],group:SourceParameterDefinition['group'])=>{
  const reference=node(children[0]),v=reference.offset,baseline=norm(v),scale=(dimensions[id]??baseline)/baseline;
  if(baseline<1e-8)throw Error('A zero-length source edge cannot define a spacing');
  const keys=['X','Y','Z'].map(a=>id+a),hasCoordinates=keys.some(k=>dimensions[k]!==undefined);
  const target=v.map((x,i)=>dimensions[keys[i]]??x*scale) as V3,currentLength=norm(target);
  if(hasCoordinates&&dimensions[id]!==undefined&&Math.abs(currentLength-dimensions[id])>1e-9)throw Error('Inconsistent source joint spacing and XYZ: '+id);
  append(id,label,baseline,group,(_value,map)=>{
   if(target.every((x,i)=>Math.abs(x-v[i])<1e-15))return;
   const ratio=currentLength/baseline,delta=sub(target,mul(v,ratio));
   for(const childId of children){
    const child=node(childId),native=child.offset,mirror:V3=[1,child.group==='right'||child.group==='fr'||child.group==='rr'?-1:1,1];
    const next=add(mul(native,ratio),delta.map((x,i)=>x*mirror[i]) as V3),e=unit(native),f=unit(next),cos=dot(e,f),w=cross(e,f);
    const q=cos<-.999999999999?[0,...unit(cross(e,Math.abs(e[0])<.8?[1,0,0]:[0,1,0]))]:[1+cos,...w],qn=Math.hypot(...q),rotation=q.map(x=>x/qn) as [number,number,number,number];
    const R=[0,1,2].map(i=>[0,1,2].map(j=>{const basis:V3=[0,0,0];basis[j]=1;return rotate(rotation,basis)[i];}));
    const stretch=identity().map((row,i)=>row.map((x,j)=>x+(norm(next)/norm(native)-1)*e[i]*e[j])),A=product(R,stretch);
    compose(map,child.parent!,A);
   }
  });
  const distance=specs[specs.length-1];distance.value=currentLength;distance.edge=id;distance.reference=[reference.parent!,reference.id];
  for(let axis=0;axis<3;axis++){
   const bound=Math.max(.08,baseline*2.5);
   append(keys[axis],[label[0].replace(/ (?:origin )?spacing$/, '')+' · '+['X','Y','Z'][axis],label[1].replace(/(?:关节)?原点间距/g,'').trim()+' · '+['X','Y','Z'][axis]],v[axis],group,()=>{},-bound,bound);
   Object.assign(specs[specs.length-1],{value:target[axis],edge:id,axis,reference:distance.reference});
  }
 };
 const span=(id:string,label:[string,string],lo:string,hi:string,axis:number)=>{
  const a=node(lo),b=node(hi);if(a.parent!==b.parent)throw Error('Source attachment span must share its parent');const baseline=b.offset[axis]-a.offset[axis],centre=(a.offset[axis]+b.offset[axis])/2;
  append(id,label,baseline,'mount',(value,map)=>{if(value===baseline)return;const scale=value/baseline,A=identity(),shift:V3=[0,0,0];A[axis][axis]=scale;shift[axis]=centre*(1-scale);compose(map,a.parent!,A,shift);});
 };
 // Signed mount/TCP components translate the owner's complete mass layout and
 // every attachment. This avoids arbitrary scaling by a nearly zero offset.
 const coordinate=(id:string,label:[string,string],childId:string,axis:number,group:SourceParameterDefinition['group'],min:number,max:number)=>{
  const child=node(childId),baseline=child.offset[axis];append(id,label,baseline,group,(value,map)=>{if(value===baseline)return;const shift:V3=[0,0,0];shift[axis]=value-baseline;compose(map,child.parent!,identity(),shift);},min,max);
 };
 // Root installation offsets move only the named leg branches. The trunk's
 // own distribution and unrelated upper-body attachments stay in its frame.
 const rootCoordinate=(id:string,label:[string,string],children:string[],axis:number)=>{
  const baseline=node(children[0]).offset[axis];
  append(id,label,baseline,'mount',()=>{},baseline-.15,baseline+.15);
 };
 if(model.design.legModel==='go2'){
  const legs=['fl','fr','rl','rr'];
  rootCoordinate('hipMountZ',['Hip mounting height Z','髋安装高度 Z'],legs.map(p=>p+'_roll'),2);
  span('hipLength',['Front–rear hip-origin spacing','前后髋关节原点间距'],'rl_roll','fl_roll',0);
  span('hipWidth',['Left–right hip-origin spacing','左右髋关节原点间距'],'fr_roll','fl_roll',1);
  length('hipOffset',['Hip lateral offset','髋侧向偏置'],legs.map(p=>p+'_pitch'),'mount');
  length('thigh',['Thigh joint spacing','大腿关节原点间距'],legs.map(p=>p+'_knee'),'limb');
  length('shank',['Shank joint spacing','小腿关节原点间距'],legs.map(p=>p+'_foot'),'limb');
 }else if(model.design.legModel==='rp1'){
  const sides=['left','right'];
  rootCoordinate('hipMountX',['Hip mounting offset X','髋安装偏置 X'],sides.map(p=>p+'_pitch'),0);
  rootCoordinate('hipMountZ',['Hip mounting height Z','髋安装高度 Z'],sides.map(p=>p+'_pitch'),2);
  span('hipWidth',['Left–right hip pitch-origin spacing','左右髋俯仰关节原点间距'],'right_pitch','left_pitch',1);
  length('hipPitchRoll',['Hip pitch–roll origin spacing','髋俯仰—侧摆原点间距'],sides.map(p=>p+'_roll'),'mount');
  length('hipRollYaw',['Hip roll–yaw origin spacing','髋侧摆—偏航原点间距'],sides.map(p=>p+'_yaw'),'mount');
  length('thigh',['Hip yaw–knee spacing','髋偏航—膝关节原点间距'],sides.map(p=>p+'_knee'),'limb');
  length('shank',['Knee–ankle spacing','膝—踝关节原点间距'],sides.map(p=>p+'_ankle'),'limb');
  length('ankleOffset',['Ankle pitch–roll origin spacing','踝俯仰—侧摆原点间距'],sides.map(p=>p+'_ankle_roll'),'terminal');
 }else if(model.design.armModel==='aloha'){
  length('baseHeight',['Base–shoulder yaw origin spacing','基座—肩偏航原点间距'],['j1'],'mount');
  coordinate('shoulderX',['Shoulder offset X','肩部偏置 X'],'j2',0,'mount',-.15,.15);
  coordinate('shoulderY',['Shoulder lateral offset Y','肩部侧向偏置 Y'],'j2',1,'mount',-.15,.15);
  coordinate('shoulderZ',['Shoulder vertical offset Z','肩部竖向偏置 Z'],'j2',2,'mount',-.05,.25);
  length('upperArm',['Shoulder–elbow spacing','上臂 J2—J3 原点间距'],['j3'],'limb');
  length('forearm',['Elbow–wrist spacing','前臂 J3—J4 原点间距'],['j4'],'limb');
  length('wristPitchYaw',['Wrist pitch–yaw origin spacing','腕俯仰—偏航原点间距'],['j5'],'terminal');
  length('wristYawRoll',['Wrist yaw–roll origin spacing','腕偏航—滚转原点间距'],['j6'],'terminal');
  coordinate('tcpX',['End-assembly offset X (TCP datum)','末端总成偏置 X（TCP 基准）'],'tool',0,'terminal',-.15,.15);
  coordinate('tcpY',['End-assembly offset Y (TCP datum)','末端总成偏置 Y（TCP 基准）'],'tool',1,'terminal',-.15,.15);
  coordinate('tcpZ',['End-assembly offset Z (TCP datum)','末端总成偏置 Z（TCP 基准）'],'tool',2,'terminal',-.10,.35);
 }
 return specs;
}

/** Definitions always come from a newly generated, unedited source model.
 * The original-mode generator does not call this catalog, so no recursion or
 * repeated scaling can occur when editing an existing derived design. */
export function sourceParameterDefinitions(model:RobotModel):SourceParameterDefinition[]{
 if(!isSourceDesign(model.design))return[];
 const design=copyDesign(model.design);design.sourceMode='original';delete design.sourceDimensions;
 return parameterCatalog(generateRobot(design),model.design.sourceMode==='derived'?model.design.sourceDimensions:{}).map(({apply,...p})=>p);
}

/** Keep the paired distance/coordinate controls consistent before generation.
 * Input order cannot leave a stale length hidden behind explicit XYZ fields. */
export function editSourceDimension(model:RobotModel,id:string,value:number):Record<string,number>{
 const definitions=sourceParameterDefinitions(model),parameter=definitions.find(p=>p.id===id);
 if(!parameter||!Number.isFinite(value)||value<parameter.min||value>parameter.max)throw Error('Source dimension outside range: '+id);
 const dimensions={...model.design.sourceDimensions};
 if(!parameter.edge){dimensions[id]=value;return dimensions;}
 const keys=['X','Y','Z'].map(axis=>parameter.edge!+axis),v=keys.map(k=>definitions.find(p=>p.id===k)!.value) as V3;
 const next=parameter.axis===undefined?mul(v,value/norm(v)):v.map((x,i)=>i===parameter.axis?value:x) as V3;
 dimensions[parameter.edge]=norm(next);keys.forEach((key,i)=>dimensions[key]=next[i]);
 return dimensions;
}

function simpleGeometry(model:RobotModel,transforms:Map<string,Affine>){
 for(const n of model.nodes){
  delete n.member;
  // The source contact geometry defines support and is retained verbatim.
  if(n.tip==='foot'){
   n.components=n.components.filter(c=>c.collision||c.role==='foot');
   for(const c of n.components)if(c.shape!=='mesh')c.visible=true;
   continue;
  }
  if(n.id==='payload'||n.id==='extra_tool')continue;
  const components:Component[]=[],hadSourceCollision=n.components.some(c=>c.collision);
  if(n.id==='base'||n.id==='waist_yaw'){
   // Only the trunk/base gets a box, from the actual source visual bounds.
   // Inertial covariance does not determine an exterior/collision surface.
   const arm=alohaDescription.find(s=>s.name===n.sourceName) as any,raw=(model.design.legModel==='go2'?go2Description:rp1Description) as any;
   const bounds=model.design.armModel==='aloha'?arm?.visual:raw.links.find((s:any)=>s.name===n.sourceName)?.visualBounds;
   if(bounds){const T=transforms.get(n.id)??{A:identity(),b:[0,0,0] as V3},points=[0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>add(action(T.A,[bounds[x?'max':'min'][0],bounds[y?'max':'min'][1],bounds[z?'max':'min'][2]]),T.b)))),lo=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))) as V3,hi=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))) as V3;
    // Do not fabricate a base collision where the source has none (RP1 and
    // Aloha). A displayed bounding box may overlap a fitted waist/shoulder.
    components.push({role:'body',shape:'box',p:mul(add(lo,hi),.5),q:[1,0,0,0],size:sub(hi,lo),mass:0,material:'aluminium',collision:hadSourceCollision});
   }
  }
  for(const child of model.nodes.filter(c=>c.parent===n.id&&c.id!=='payload'&&c.id!=='extra_tool')){
   const L=norm(child.offset);if(L<1e-8)continue;
   const radius=Math.min(.012,L*.08),trim=Math.min(L*.20,radius*1.5),connection:Component={role:'collar',shape:'cylinder',p:mul(child.offset,.5),q:alignZ(child.offset),size:[radius,L,0],mass:0,material:'aluminium',collision:false};
   components.push(connection,{...connection,size:[radius,L-2*trim,0],collision:true,visible:false});
  }
  if(n.joint)components.push({role:'collar',shape:'cylinder',p:[0,0,0],q:alignZ(n.joint.axis),size:[.018,.018,0],mass:0,material:'aluminium',collision:false});
  if(n.tip==='tool')components.push({role:'tool',shape:'sphere',p:[0,0,0],q:[1,0,0,0],size:[.008,.008,.008],mass:0,material:'aluminium',collision:false});
  n.components=components;
 }
}

export function applySourceParameters(model:RobotModel):RobotModel{
 if(model.design.sourceMode!=='derived')return model;
 const originalNodes=model.nodes.map(n=>({...n})),dimensions=model.design.sourceDimensions??{},catalog=parameterCatalog(model,dimensions),allowed=new Set(catalog.map(p=>p.id)),transforms=new Map<string,Affine>();
 for(const key of Object.keys(dimensions))if(!allowed.has(key))throw Error('Unknown source dimension: '+key);
 for(const p of catalog){const raw=dimensions[p.id];if(raw!==undefined&&(!Number.isFinite(raw)||raw<p.min||raw>p.max))throw Error('Source dimension outside range: '+p.id);const value=p.value;if(!Number.isFinite(value)||value<p.min||value>p.max)throw Error('Source dimension outside range: '+p.id);p.apply(value,transforms);}
 for(const [id,{A,b}] of transforms){
  const owner=model.nodes.find(n=>n.id===id)!;owner.com=add(action(A,owner.com),b);owner.inertia=transformSourceInertia(owner.inertia,A);
  for(const child of model.nodes.filter(n=>n.parent===id))child.offset=add(action(A,child.offset),b);
 }
 for(const p of catalog.filter(p=>p.id==='hipMountX'||p.id==='hipMountZ')){
  const axis=p.id.endsWith('X')?0:2,ids=model.design.legModel==='go2'?['fl_roll','fr_roll','rl_roll','rr_roll']:['left_pitch','right_pitch'];
  for(const id of ids){const child=model.nodes.find(n=>n.id===id)!,raw=originalNodes.find(n=>n.id===id)!;child.offset[axis]=raw.offset[axis]+p.value-p.baseline;}
 }
 simpleGeometry(model,transforms);
 const members=applySourceMembers(model,originalNodes,transforms);
 const source:ModelSource=model.source??{id:'aloha',name:'Alohamini left arm',commit:'8459353ebc6af5800d809b96566b5073a7fcff880c67171ab07a0bd2f98ffee6',meshAsset:'models/alohamini-left/arm.glb',urdfAsset:'models/alohamini-left/source.urdf',collisionAssets:[],license:'See models/alohamini-left/LICENSE',modelAssumptions:['Source link inertias are engineering estimates; rotor inertia and motor friction are uncalibrated.']};
 // VFS is cached by original source id/commit, so preserve its complete source
 // asset manifest even though derived geometry references only foot meshes.
 model.source={...source,name:source.name+' · parametric concept',parameterization:{kind:'source-members-v1',dimensions:Object.fromEntries(catalog.map(p=>[p.id,p.value])),collision:'joint-envelopes-native-feet',members:members.map(m=>({nodeId:m.nodeId,childId:m.childId,referenceMaterial:m.reference.material,referenceMass:m.reference.mass,currentMass:m.currentMass,residualMass:m.residualMass,referenceSection:{section:m.reference.section,width:m.reference.width,height:m.reference.height,wall:m.reference.wall},referenceLength:m.reference.length}))},modelAssumptions:[
  'Derived concept: original joint tree, axes, reference angles and actuator limits; edited joint spacings.',
  ...(model.physicalSource?.assumptions??[]),
  'Selected members use an explicit 12 × 18 × 0.8 mm concept reference box section over the central 80% of the joint span; these are design assumptions, not original CAD sections.',
  'The reference member mass and full moments are subtracted from the source link; the positive-semidefinite remainder follows the geometric affine transform. The current member mass is density × section area × length.',
  'The remaining rigid mass budget is not identified motor mass. Elastic calculations attach this remainder at its COM-projected member station.',
  'Concept collision envelopes use thin joint connections and source trunk/base bounding boxes, not full source CAD. Native foot contacts are retained.',
  'Joint stiffness, source rotor terms not declared in the URDF, and whole-robot elastic modes are not inferred from these concept sections.',
  ...source.modelAssumptions.filter(s=>!s.startsWith('Native collision')&&!(model.physicalSource&&s.startsWith('Source link inertias')))]};
 if(model.design.robot!=='arm'){
  model.height=0;const poses=fk(model,model.home),low=Math.min(...model.nodes.filter(n=>n.tip==='foot').flatMap(n=>{const pose=poses[n.id]!;if(n.contactPoints)return n.contactPoints.map(p=>add(pose.p,rotate(pose.q,p))[2]);const c=n.components.find(c=>c.role==='foot')!;return[add(pose.p,rotate(pose.q,c.p))[2]-c.size[0]];}));model.height=-low+.001;
 }
 let hash=2166136261;const key=JSON.stringify([model.design,model.nodes,model.source]);for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);model.fingerprint=(hash>>>0).toString(16);
 return model;
}
