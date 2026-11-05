import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,property,exportMJCF} from '../.build/concept-model.js';
import {materials} from '../.build/lightweight-mechanics.js';
import {initialConditions,analyzeDesign} from '../.build/design-analysis.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';
import {prepareSourcePhysics,compileRobotPhysics} from '../.build/source-physics.js';

// Independent continuum/parallel-axis oracle; no production section,
// massProperties, alignZ, affine-inertia or decomposition helper is used.
const close=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const vecClose=(a,b,t)=>a.forEach((v,k)=>close(v,b[k],t));
const eye=()=>[[1,0,0],[0,1,0],[0,0,1]],zero=()=>[[0,0,0],[0,0,0],[0,0,0]];
const trans=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv=(A,v)=>A.map(r=>r.reduce((s,x,k)=>s+x*v[k],0));
const add=(a,b)=>a.map((v,k)=>v+b[k]);
const norm=v=>Math.hypot(...v);
const pack=I=>[I[0][0],I[1][1],I[2][2],I[0][1],I[0][2],I[1][2]];
const unpack=([xx,yy,zz,xy,xz,yz])=>[[xx,xy,xz],[xy,yy,yz],[xz,yz,zz]];
const trace=A=>A.reduce((s,r,k)=>s+r[k],0);
const shift=c=>eye().map((r,i)=>r.map((v,j)=>v*c.reduce((s,x)=>s+x*x,0)-c[i]*c[j]));
const det=A=>A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
function positiveSecondMoment(body){const S=body.I.map((r,i)=>r.map((v,j)=>(i===j?trace(body.I)/2:0)-v));assert.ok(body.mass>0);for(let i=0;i<3;i++){assert.ok(S[i][i]>=-1e-13);for(let j=i+1;j<3;j++)assert.ok(S[i][i]*S[j][j]-S[i][j]**2>=-1e-17);}assert.ok(det(S)>=-1e-22);}
function fromZ(vector){const [x,y,z]=vector.map(v=>v/norm(vector));if(z<-.999999)return[[1,0,0],[0,-1,0],[0,0,-1]];const K=[[0,0,x],[0,0,y],[-x,-y,0]],K2=mm(K,K);return eye().map((r,i)=>r.map((v,j)=>v+K[i][j]+K2[i][j]/(1+z)));}
function beam(vector,rho,{width:b=.012,height:h=.018,wall:t=.0008}={}){
 const L=.8*norm(vector),A=b*h-(b-2*t)*(h-2*t),Ix=(b*h**3-(b-2*t)*(h-2*t)**3)/12,Iy=(h*b**3-(h-2*t)*(b-2*t)**3)/12,mass=rho*A*L;
 const diag=[mass*(L*L/12+Ix/A),mass*(L*L/12+Iy/A),mass*(Ix+Iy)/A],R=fromZ(vector),I=mm(mm(R,diag.map((v,i)=>[0,1,2].map(j=>i===j?v:0))),trans(R));return{mass,c:vector.map(v=>v/2),I,cutLength:L,area:A};
}
const body=n=>({mass:n.mass,c:n.com,I:unpack(n.inertia)});
function combine(parts){const mass=parts.reduce((s,p)=>s+p.sign*p.body.mass,0),c=[0,1,2].map(k=>parts.reduce((s,p)=>s+p.sign*p.body.mass*p.body.c[k],0)/mass),H=zero();for(const {body:p,sign}of parts){const C=shift(p.c);for(let i=0;i<3;i++)for(let j=0;j<3;j++)H[i][j]+=sign*(p.I[i][j]+p.mass*C[i][j]);}const C=shift(c);return{mass,c,I:H.map((r,i)=>r.map((v,j)=>v-mass*C[i][j]))};}
function affine(p,A,b=[0,0,0]){const S=p.I.map((r,i)=>r.map((v,j)=>(i===j?trace(p.I)/2:0)-v)),T=mm(mm(A,S),trans(A));return{mass:p.mass,c:add(mv(A,p.c),b),I:T.map((r,i)=>r.map((v,j)=>(i===j?trace(T):0)-v))};}
function compareBody(n,p){close(n.mass,p.mass);vecClose(n.com,p.c);vecClose(n.inertia,pack(p.I));}
const cases={
 go2:{robot:'quadruped',legModel:'go2',member:'fl_pitch',child:'fl_knee',rho:2700,baseline:'aluminium',replacement:'steel'},
 rp1:{robot:'biped',legModel:'rp1',member:'right_knee',child:'right_ankle',rho:2700,baseline:'aluminium',replacement:'steel'},
 aloha:{robot:'arm',armModel:'aloha',member:'j2',child:'j3',rho:1058,baseline:'abs',replacement:'aluminium'},
};
const make=(id,extra={})=>{const {robot,legModel,armModel}=cases[id];return generateRobot({...copyDesign(initialConcept),robot,legModel,armModel,payload:0,toolMass:0,sourceMode:'derived',...extra});};
const physical=n=>({offset:n.offset,originQ:n.originQ,joint:n.joint,mass:n.mass,com:n.com,inertia:n.inertia});
function originalSplit(id){const c=cases[id],model=make(id,{sourceMode:'original'}),n=model.nodes.find(n=>n.id===c.member),v=model.nodes.find(n=>n.id===c.child).offset,b=beam(v,c.rho),residual=combine([{body:body(n),sign:1},{body:b,sign:-1}]);positiveSecondMoment(residual);return{model,n,v,b,residual};}

test('ABS preset uses the pinned Stratasys typical data and an explicitly assumed isotropic shear modulus',()=>{
 assert.equal(materials.abs.rho,1058);assert.equal(materials.abs.E,2e9);assert.equal(materials.abs.strength,32.5e6);assert.equal(property('abs').nu,.35);close(materials.abs.G,2e9/(2*(1+.35)));assert.match(materials.abs.en,/reference/);
});

test('default concept beams reproduce every original rigid-body field and have physical residual budgets',()=>{
 for(const id of Object.keys(cases)){
  const a=make(id,{sourceMode:'original'}),b=make(id);assert.deepEqual(b.nodes.map(physical),a.nodes.map(physical));assert.equal(b.mass,a.mass);
  const members=b.nodes.filter(n=>n.member);assert.equal(members.length,id==='go2'?8:id==='rp1'?4:2);
  for(const n of members){assert.equal(n.member.material,cases[id].baseline);assert.equal(n.member.width,.012);assert.equal(n.member.height,.018);assert.equal(n.member.wall,.0008);close(n.member.cutLength,.8*n.member.length);const components=n.member.inertialComponents;assert.equal(components.length,2);const residual=components.find(c=>c.role!=='member');assert.ok(residual?.inertia);positiveSecondMoment({mass:residual.mass,c:residual.p,I:unpack(residual.inertia)});}
 }
});

test('changing one member material replaces only its beam mass, first moment and full central inertia',()=>{
 for(const [id,c]of Object.entries(cases)){
  const old=originalSplit(id),rho=materials[c.replacement].rho,nextBeam=beam(old.v,rho),expected=combine([{body:old.residual,sign:1},{body:nextBeam,sign:1}]);
  const model=make(id,{parts:{[c.member]:{material:c.replacement}}}),n=model.nodes.find(n=>n.id===c.member);compareBody(n,expected);close(model.mass,old.model.mass+nextBeam.mass-old.b.mass);
  assert.equal(n.member.material,c.replacement);close(n.member.prop.rho,rho);
  for(const other of model.nodes.filter(n=>n.id!==c.member))assert.deepEqual(physical(other),physical(old.model.nodes.find(n=>n.id===other.id)));
  const overridden=make(id,{parts:{[c.member]:{material:c.replacement,properties:{rho:1234}}}}),custom=combine([{body:old.residual,sign:1},{body:beam(old.v,1234),sign:1}]);compareBody(overridden.nodes.find(n=>n.id===c.member),custom);
  const ignored=make(id,{sourceMode:'original',parts:{[c.member]:{material:c.replacement,properties:{rho:1234},width:.02,height:.03,wall:.001}}});assert.deepEqual(ignored.nodes.map(physical),old.model.nodes.map(physical));
 }
});

test('elastic-modulus edits change beam compliance without changing mass or fixed-load bending stress',()=>{
 for(const [id,c]of Object.entries(cases)){
  const base=make(id),n=base.nodes.find(n=>n.id===c.member),changed=make(id,{parts:{[c.member]:{properties:{E:n.member.prop.E*2}}}}),a=analyzeDesign(base,initialConditions,c.member),b=analyzeDesign(changed,initialConditions,c.member);
  close(changed.mass,base.mass);compareBody(changed.nodes.find(n=>n.id===c.member),body(n));assert.ok(Number.isFinite(a.beamCompliance)&&a.beamCompliance>0);close(b.beamCompliance,a.beamCompliance/2);close(b.beamDeflection,a.beamDeflection/2);close(b.driveCompliance,a.driveCompliance);close(b.stress,a.stress);assert.ok(a.stress>0);
 }
});

test('section and length edits combine fixed-mass residual stretch with density times the new beam volume',()=>{
 const old=originalSplit('aloha'),target=.16,ratio=target/norm(old.v),e=old.v.map(v=>v/norm(old.v)),A=eye().map((r,i)=>r.map((v,j)=>v+(ratio-1)*e[i]*e[j])),nextV=old.v.map(v=>v*ratio),shape={width:.015,height:.020,wall:.001};
 const model=make('aloha',{sourceDimensions:{upperArm:target},parts:{j2:{...shape,material:'aluminium'}}}),newBeam=beam(nextV,2700,shape),expected=combine([{body:affine(old.residual,A),sign:1},{body:newBeam,sign:1}]);
 compareBody(model.nodes.find(n=>n.id==='j2'),expected);vecClose(model.nodes.find(n=>n.id==='j3').offset,nextV);close(model.mass,old.model.mass+newBeam.mass-old.b.mass);close(model.nodes.find(n=>n.id==='j2').member.cutLength,.8*target);
 assert.ok(Math.abs(model.mass-old.model.mass)>1e-4,'a fixed-density edited beam does not keep total link mass fixed');
});

function quaternionMatrix([w,x,y,z]){return[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];}
test('material-edited MJCF compiles with independently calculated masses, COMs and full inertias',async()=>{
 const mj=await dynamicsRuntime();
 for(const [id,c]of Object.entries(cases)){
  const old=originalSplit(id),expected=combine([{body:old.residual,sign:1},{body:beam(old.v,materials[c.replacement].rho),sign:1}]),robot=make(id,{parts:{[c.member]:{material:c.replacement}}});await prepareSourcePhysics(mj,robot);const m=compileRobotPhysics(mj,robot,exportMJCF(robot));
  try{close(Array.from(m.body_mass).reduce((s,v)=>s+v,0),old.model.mass+expected.mass-old.n.mass,2e-8);const bid=mj.mj_name2id(m,1,c.member);assert.ok(bid>0);close(m.body_mass[bid],expected.mass,2e-9);vecClose(Array.from(m.body_ipos.slice(3*bid,3*bid+3)),expected.c,2e-9);
   const R=quaternionMatrix(Array.from(m.body_iquat.slice(4*bid,4*bid+4))),D=Array.from(m.body_inertia.slice(3*bid,3*bid+3)),I=mm(mm(R,D.map((v,i)=>[0,1,2].map(j=>i===j?v:0))),trans(R));vecClose(pack(I),pack(expected.I),2e-9);
  }finally{m.delete();}
 }
});
