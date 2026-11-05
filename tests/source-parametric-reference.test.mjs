import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialConcept,copyDesign,generateRobot,fk,rotate,exportMJCF} from '../.build/concept-model.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';
import {prepareSourcePhysics,compileRobotPhysics} from '../.build/source-physics.js';

// This oracle reads original XML. It does not use adapter data, its quaternion
// helpers, the parameter implementation, or generated URDF as the reference.
const sources={
 go2:{file:'public/models/go2/source.urdf',sha:'7d19fe48e2e689ee1a032ab99f2a4a8b671d87e73de48d3e65811682a5b48b9e',design:{robot:'quadruped',legModel:'go2'},mass:16.087},
 rp1:{file:'public/models/rp1-24/source.urdf',sha:'d0c86d45773974d91445b728d148ecec965267746ec73e71afc6a7ffbce708d5',design:{robot:'biped',legModel:'rp1'},mass:39.10931784},
 aloha:{file:'public/models/alohamini-left/source.urdf',sha:'70713a50a9fdf3235d6f9e766792d1c8f4fc6904a2cb90438da61fba8b0dd20a',design:{robot:'arm',armModel:'aloha',armInertia:'urdf'},mass:2},
};
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const blocks=(s,tag)=>[...s.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'g'))].map(m=>({attrs:attrs(m[1]),text:m[2]}));
const tag=(s,name)=>attrs(s.match(new RegExp(`<${name}\\b([^>]*)>`))?.[1]??'');
const vector=(s='0 0 0')=>s.split(/\s+/).map(Number);
const eye=()=>[[1,0,0],[0,1,0],[0,0,1]];
const transpose=A=>A[0].map((_,j)=>A.map(row=>row[j]));
const matmul=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,x,k)=>s+x*B[k][j],0)));
const mv=(A,v)=>A.map(row=>row.reduce((s,x,k)=>s+x*v[k],0));
const add=(a,b)=>a.map((x,k)=>x+b[k]);
const norm=v=>Math.hypot(...v);
function rotation(axis,angle){const [x,y,z]=axis.map(v=>v/norm(axis)),c=Math.cos(angle),s=Math.sin(angle),t=1-c;return[[t*x*x+c,t*x*y-s*z,t*x*z+s*y],[t*x*y+s*z,t*y*y+c,t*y*z-s*x],[t*x*z-s*y,t*y*z+s*x,t*z*z+c]];}
const rpy=([r,p,y])=>matmul(matmul(rotation([0,0,1],y),rotation([0,1,0],p)),rotation([1,0,0],r));
const unpack=([xx,yy,zz,xy,xz,yz])=>[[xx,xy,xz],[xy,yy,yz],[xz,yz,zz]];
const pack=I=>[I[0][0],I[1][1],I[2][2],I[0][1],I[0][2],I[1][2]];
const close=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tol ${t})`);
const closeVector=(a,b,t)=>{assert.equal(a.length,b.length);a.forEach((v,k)=>close(v,b[k],t));};
function parseURDF(xml){
 const links=blocks(xml,'link').map(e=>{const i=blocks(e.text,'inertial')[0]?.text??'',o=tag(i,'origin'),p=tag(i,'inertia'),R=rpy(vector(o.rpy));return{name:e.attrs.name,mass:Number(tag(i,'mass').value??0),com:vector(o.xyz),I:matmul(matmul(R,unpack(['ixx','iyy','izz','ixy','ixz','iyz'].map(k=>Number(p[k]??0)))),transpose(R))};});
 // Include empty links, which appear as self-closing XML elements.
 for(const match of xml.matchAll(/<link\b([^>]*?)\/>/g)){const name=attrs(match[1]).name;if(!links.some(l=>l.name===name))links.push({name,mass:0,com:[0,0,0],I:[[0,0,0],[0,0,0],[0,0,0]]});}
 const joints=blocks(xml,'joint').filter(e=>e.attrs.type).map(e=>{const o=tag(e.text,'origin');return{name:e.attrs.name,type:e.attrs.type,parent:tag(e.text,'parent').link,child:tag(e.text,'child').link,xyz:vector(o.xyz),rpy:vector(o.rpy),axis:vector(tag(e.text,'axis').xyz??'1 0 0'),limit:Object.fromEntries(Object.entries(tag(e.text,'limit')).map(([k,v])=>[k,Number(v)]))};});
 const children=new Set(joints.map(j=>j.child)),roots=links.filter(l=>!children.has(l.name));assert.equal(roots.length,1);return{links,joints,root:roots[0].name};
}
const original={};for(const [id,s]of Object.entries(sources)){const bytes=await fs.readFile(s.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha,`${id}: pinned source changed`);original[id]=parseURDF(bytes.toString());}
function independentFK(raw,q,height=0){
 const poses={[raw.root]:{p:[0,0,height],R:eye()}},todo=[...raw.joints];
 while(todo.length){const k=todo.findIndex(j=>poses[j.parent]);assert.ok(k>=0,'disconnected source tree');const j=todo.splice(k,1)[0],parent=poses[j.parent],jointR=matmul(parent.R,rpy(j.rpy));let p=add(parent.p,mv(parent.R,j.xyz)),R=jointR;
  if(j.type==='prismatic')p=add(p,mv(jointR,j.axis.map(v=>v*(q[j.name]??0))));else if(j.type!=='fixed')R=matmul(jointR,rotation(j.axis,q[j.name]??0));poses[j.child]={p,R};
 }return poses;
}
const make=(id,extra={})=>generateRobot({...copyDesign(initialConcept),...sources[id].design,payload:0,toolMass:0,...extra});
const physical=n=>({id:n.id,sourceName:n.sourceName,parent:n.parent,offset:n.offset,originQ:n.originQ,joint:n.joint,mass:n.mass,com:n.com,inertia:n.inertia});
const knownHome={
 go2:Object.fromEntries(['FL','FR','RL','RR'].flatMap(p=>[[`${p}_hip_joint`,p.endsWith('L')?-.1:.1],[`${p}_thigh_joint`,.9],[`${p}_calf_joint`,-1.8]])),
 rp1:{left_hip_pitch_joint:-.1,left_knee_joint:-.3,left_ankle_pitch_joint:-.2,right_hip_pitch_joint:.1,right_knee_joint:.3,right_ankle_pitch_joint:-.2,left_shoulder_pitch_joint:.2,left_shoulder_roll_joint:.2,left_elbow_joint:-1.2,right_shoulder_pitch_joint:-.2,right_shoulder_roll_joint:-.2,right_elbow_joint:1.2},
 aloha:{left_shoulder_pan:-.35,left_shoulder_lift:-1.2,left_elbow_flex:1.8,left_wrist_flex:-.25,left_wrist_yaw_joint:.4,left_wrist_roll:-.6,left_gripper:0},
};
function compareFK(model,raw,q){
 const sourceQ=Object.fromEntries(model.active.map(j=>[j.sourceName,q[j.id]])),expected=independentFK(raw,sourceQ,model.height),actual=fk(model,q);
 for(const n of model.nodes){const a=actual[n.id],b=expected[n.sourceName];assert.ok(b,`unexpected node ${n.id}`);closeVector(a.p,b.p);for(let col=0;col<3;col++){const v=[0,0,0];v[col]=1;closeVector(rotate(a.q,v),b.R.map(row=>row[col]));}}
 return expected;
}

test('derived defaults preserve every source physical field and independently match the pinned XML',()=>{
 for(const id of Object.keys(sources)){
  const source=make(id),derived=make(id,{sourceMode:'derived'}),raw=original[id];
  assert.deepEqual(derived.nodes.map(physical),source.nodes.map(physical),`${id} zero-change physical identity`);assert.deepEqual(derived.home,source.home);assert.equal(derived.height,source.height);assert.equal(derived.mass,source.mass);close(derived.mass,sources[id].mass);assert.equal(derived.nodes.length,raw.links.length);
  const byChild=new Map(raw.joints.map(j=>[j.child,j]));
  for(const n of derived.nodes){const link=raw.links.find(l=>l.name===n.sourceName);assert.ok(link);assert.equal(n.mass,link.mass);assert.deepEqual(n.com,link.com);closeVector(n.inertia,pack(link.I));const j=byChild.get(n.sourceName);if(!j)continue;
   assert.deepEqual(n.offset,j.xyz);const R=rpy(j.rpy);for(let col=0;col<3;col++){const v=[0,0,0];v[col]=1;closeVector(rotate(n.originQ??[1,0,0,0],v),R.map(row=>row[col]));}
   if(j.type!=='fixed'){closeVector(n.joint.axis,j.axis.map(v=>v/norm(j.axis)));assert.equal(n.joint.min,j.limit.lower);assert.equal(n.joint.max,j.limit.upper);assert.equal(n.joint.effortLimit,j.limit.effort);assert.equal(n.joint.velocityLimit,j.limit.velocity);assert.equal(n.joint.home,knownHome[id][j.name]??0);}
  }
  compareFK(derived,raw,derived.home);
  compareFK(derived,raw,Object.fromEntries(derived.active.map((j,i)=>[j.id,j.min+(j.max-j.min)*(.5+.15*Math.sin(i*.7))])));
 }
});

// Independent remainder-plus-concept-beam oracle. The 12 x 18 x 0.8 mm
// box and 0.8-span clear length are declared design assumptions, not source CAD.
function beamChild(raw,owner){
 if(raw.root==='base'){const match=owner.match(/^(FL|FR|RL|RR)_(thigh|calf)$/);return match?match[1]+'_'+(match[2]==='thigh'?'calf':'foot'):undefined;}
 if(raw.root==='base_link'){const match=owner.match(/^(left|right)_(hip_yaw|knee)_link$/);return match?match[1]+'_'+(match[2]==='hip_yaw'?'knee':'ankle_pitch')+'_link':undefined;}
 return({left_Upper_Arm:'left_Lower_Arm',left_Lower_Arm:'left_Wrist_Pitch_Roll'})[owner];
}
function referenceBeam(raw,owner){
 const child=beamChild(raw,owner);if(!child)return;
 const v=raw.joints.find(j=>j.child===child).xyz,L=.8*Math.hypot(...v),rho=raw.root==='left_Base'?1058:2700,b=.012,h=.018,t=.0008,area=b*h-(b-2*t)*(h-2*t),Ix=(b*h**3-(b-2*t)*(h-2*t)**3)/12,Iy=(h*b**3-(h-2*t)*(b-2*t)**3)/12,mass=rho*area*L;
 const [x,y,z]=v.map(x=>x/Math.hypot(...v)),K=[[0,0,x],[0,0,y],[-x,-y,0]],KK=matmul(K,K),R=z<-.999999?[[1,0,0],[0,-1,0],[0,0,-1]]:eye().map((row,i)=>row.map((x,j)=>x+K[i][j]+KK[i][j]/(1+z))),d=[mass*(L*L/12+Ix/area),mass*(L*L/12+Iy/area),mass*(Ix+Iy)/area];
 return{mass,com:v.map(x=>x/2),I:matmul(matmul(R,d.map((x,i)=>[0,1,2].map(j=>i===j?x:0))),transpose(R))};
}
const parallel=c=>eye().map((row,i)=>row.map((x,j)=>x*c.reduce((s,v)=>s+v*v,0)-c[i]*c[j]));
function signedAssembly(parts){
 const mass=parts.reduce((s,[p,sign])=>s+sign*p.mass,0),com=[0,1,2].map(k=>parts.reduce((s,[p,sign])=>s+sign*p.mass*p.com[k],0)/mass),H=[[0,0,0],[0,0,0],[0,0,0]];
 for(const [p,sign]of parts){const P=parallel(p.com);for(let i=0;i<3;i++)for(let j=0;j<3;j++)H[i][j]+=sign*(p.I[i][j]+p.mass*P[i][j]);}const P=parallel(com);return{mass,com,I:H.map((row,i)=>row.map((x,j)=>x-mass*P[i][j]))};
}
function affine(raw,owner,A,b=[0,0,0]){
 const link=raw.links.find(l=>l.name===owner),beam=referenceBeam(raw,owner),remainder=beam?signedAssembly([[link,1],[beam,-1]]):link,trace=remainder.I.reduce((s,row,k)=>s+row[k],0),S=remainder.I.map((row,i)=>row.map((x,j)=>(i===j?trace/2:0)-x)),next=matmul(matmul(A,S),transpose(A)),sum=next.reduce((s,row,k)=>s+row[k],0);
 const changed={mass:remainder.mass,com:add(mv(A,remainder.com),b),I:next.map((row,i)=>row.map((x,j)=>(i===j?sum:0)-x))};
 for(const j of raw.joints.filter(j=>j.parent===owner))j.xyz=add(mv(A,j.xyz),b);
 Object.assign(link,beam?signedAssembly([[changed,1],[referenceBeam(raw,owner),1]]):changed);
}
function stretch(raw,child,target){const j=raw.joints.find(j=>j.child===child),L=norm(j.xyz),e=j.xyz.map(x=>x/L),A=eye().map((row,r)=>row.map((x,c)=>x+(target/L-1)*e[r]*e[c]));affine(raw,j.parent,A);}
function width(raw,left,right,target){const a=raw.joints.find(j=>j.child===left),b=raw.joints.find(j=>j.child===right);assert.equal(a.parent,b.parent);const centre=(a.xyz[1]+b.xyz[1])/2,s=target/(a.xyz[1]-b.xyz[1]);affine(raw,a.parent,[[1,0,0],[0,s,0],[0,0,1]],[0,centre*(1-s),0]);}
const changes={
 go2:{values:{hipWidth:.117,thigh:.245},apply(raw){width(raw,'FL_hip','FR_hip',.117);for(const p of ['FL','FR','RL','RR'])stretch(raw,`${p}_calf`,.245);}},
 rp1:{values:{hipWidth:.152,shank:.33},apply(raw){width(raw,'left_hip_pitch_link','right_hip_pitch_link',.152);const left=raw.joints.find(j=>j.child==='left_ankle_pitch_link'),ratio=.33/norm(left.xyz);for(const side of ['left','right']){const child=`${side}_ankle_pitch_link`,L=norm(raw.joints.find(j=>j.child===child).xyz);stretch(raw,child,L*ratio);}}},
 aloha:{values:{shoulderY:-.019035,upperArm:.16},apply(raw){affine(raw,'left_Rotation_Pitch',eye(),[0,.01,0]);stretch(raw,'left_Lower_Arm',.16);}},
};

test('changed dimensions follow independent residual affine plus beam-volume COM/inertia and original-axis FK',()=>{
 for(const [id,change]of Object.entries(changes)){
  const source=make(id),raw=structuredClone(original[id]);change.apply(raw);const model=make(id,{sourceMode:'derived',sourceDimensions:change.values});
  close(model.mass,raw.links.reduce((s,l)=>s+l.mass,0));assert.notEqual(model.fingerprint,source.fingerprint);let changed=0;
  for(const n of model.nodes){const link=raw.links.find(l=>l.name===n.sourceName),old=source.nodes.find(l=>l.id===n.id),j=raw.joints.find(j=>j.child===n.sourceName);close(n.mass,link.mass);closeVector(n.com,link.com);closeVector(n.inertia,pack(link.I));if(j)closeVector(n.offset,j.xyz);assert.deepEqual(n.originQ,old.originQ);assert.deepEqual(n.joint,old.joint);if(JSON.stringify(n.inertia)!==JSON.stringify(old.inertia))changed++;}
  assert.ok(changed>0,`${id} inertia changes with dimensions`);compareFK(model,raw,model.home);
  const untouched=make(id,{sourceDimensions:change.values});assert.deepEqual(untouched.nodes.map(physical),source.nodes.map(physical),`${id} original mode ignores derived dimensions`);
 }
});

test('exported changed MJCF matches independent source-tree FK at home and asymmetric configurations',async()=>{
 const mj=await dynamicsRuntime();
 for(const [id,change]of Object.entries(changes)){
  const raw=structuredClone(original[id]);change.apply(raw);const robot=make(id,{sourceMode:'derived',sourceDimensions:change.values});await prepareSourcePhysics(mj,robot);const m=compileRobotPhysics(mj,robot,exportMJCF(robot)),d=new mj.MjData(m);
  try{
   close(Array.from(m.body_mass).reduce((s,x)=>s+x,0),raw.links.reduce((s,l)=>s+l.mass,0),2e-8);
   for(const q of [robot.home,Object.fromEntries(robot.active.map((j,i)=>[j.id,j.min+(j.max-j.min)*(.5+.12*Math.sin(i*.83))]))]){
    const expected=compareFK(robot,raw,q);mj.mj_resetData(m,d);for(const j of robot.active){const ji=mj.mj_name2id(m,3,j.id);assert.ok(ji>=0);d.qpos[m.jnt_qposadr[ji]]=q[j.id];}mj.mj_forward(m,d);
    for(const n of robot.nodes){const body=mj.mj_name2id(m,1,n.id),pose=expected[n.sourceName];assert.ok(body>0);for(let r=0;r<3;r++){close(d.xpos[body*3+r],pose.p[r],3e-8);for(let c=0;c<3;c++)close(d.xmat[body*9+3*r+c],pose.R[r][c],3e-8);}}
   }
  }finally{d.delete();m.delete();}
 }
});
