import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCADSegment} from '../.build/source-structure.js';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t*Math.max(Math.abs(b),1e-20),`${a} != ${b}`);
function tapered(a=3,count=1,angle=0){
 const L=.5,E=69e9,I0=1e-8,area=.001,rho=2700,cos=Math.cos(angle),sin=Math.sin(angle);
 const sections=Array.from({length:count+1},(_,i)=>{const Iv=I0*(1+a*i/count),Iu=1000*I0;return{s:L*i/count,area,Iv:cos*cos*Iv+sin*sin*Iu,Iu:sin*sin*Iv+cos*cos*Iu,Iuv:cos*sin*(Iv-Iu),boundary:[[-.01,-.02],[.01,-.02],[.01,.02],[-.01,.02]].map(([u,v])=>[cos*u-sin*v,sin*u+cos*v]),valid:true};});
 return{part:{density:rho,sections},input:{start:0,end:count,force:30,angle,E,strength:240e6,tipMass:0},L,E,I0};
}

test('linearly varying second moment recovers the independent logarithmic tip-compliance integral',()=>{
 for(const a of [1,3,9,99,-.9]){
  const {part,input,L,E,I0}=tapered(a),r=analyzeCADSegment(part,input),integral=((1+a)**2*Math.log1p(a)-a-1.5*a*a)/(a*a*a),exact=L**3/(E*I0)*integral;
  close(r.compliance,exact);close(r.deflection,input.force*exact);assert.ok(r.integrationSegments>1);
  // For the unit-force static shape, twice strain energy equals tip work.
  close(r.stiffness[0],r.compliance,2e-6);
 }
});

test('refining identical tapered-section data preserves displacement and modal results',()=>{
 const coarse=tapered(99),fine=tapered(99,40),a=analyzeCADSegment(coarse.part,coarse.input),b=analyzeCADSegment(fine.part,fine.input);
 close(a.compliance,b.compliance);close(a.frequency,b.frequency,2e-6);close(a.mass,b.mass);close(a.stress,b.stress);
});

test('coupled tapered bending remains invariant under a common rotation of sections and load',()=>{
 const original=tapered(9),rotated=tapered(9,1,.42),a=analyzeCADSegment(original.part,original.input),b=analyzeCADSegment(rotated.part,rotated.input);
 close(a.deflection,b.deflection);close(a.stress,b.stress);close(a.frequency,b.frequency,2e-6);
});
