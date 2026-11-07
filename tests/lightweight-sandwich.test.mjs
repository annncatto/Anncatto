import test from 'node:test';
import assert from 'node:assert/strict';
import {sandwichSection,sandwichBuckling,sandwichWrinkling,sandwichSizingData} from '../.build/lightweight-sandwich.js';

const close=(actual,expected,relative=1e-10)=>assert.ok(Math.abs(actual-expected)<=relative*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);

test('the layered section agrees with direct integration and the 1 mm / 20 mm exercise',()=>{
 const b=.13,t=.001,c=.020,Ef=70e9,Ec=70e6,section=sandwichSection(b,t,c,Ef,Ec);
 const layers=[[-c/2-t,-c/2,Ef],[-c/2,c/2,Ec],[c/2,c/2+t,Ef]];
 const directD=layers.reduce((sum,[z0,z1,E])=>sum+E*b*(z1**3-z0**3)/3,0);
 const directEA=layers.reduce((sum,[z0,z1,E])=>sum+E*b*(z1-z0),0);
 close(section.bending,directD);close(section.axial,directEA);
 close(section.height,.022);close(section.distance,.021);
 close(section.faceI/b*1e9,220.66666666666666);close(section.coreI/b*1e9,666.6666666666666);
 close(section.coreBending/section.faceBending,.0030211480362537765);
 // An equal-modulus stack must become one homogeneous rectangle.
 const uniform=sandwichSection(b,t,c,Ef,Ef);close(uniform.bending,Ef*b*(c+2*t)**3/12);
});

test('shear buckling and wrinkling retain their physical limits and distinct modulus exponents',()=>{
 close(sandwichBuckling(10000,10000),5000);
 assert.ok(sandwichBuckling(1e12,10000)<10000);close(sandwichBuckling(1e12,10000),10000,1e-7);
 const baseline=sandwichWrinkling(70e9,80e6,30e6);
 close(sandwichWrinkling(70e9,160e6,60e6)/baseline,2**(2/3));
 close(sandwichWrinkling(70e9,160e6,30e6)/baseline,2**(1/3));
 close(baseline/1e6,275.8924176381118);
});

// Independent scalar minimization, using the positive quadratic root and the
// original objective rather than the stationary-point formula under test.
function independentMinimum(p){
 const M=p.load*p.length/4,V=p.load/2,limit=Math.min(p.faceAllow,p.wrinkleCoefficient*(p.faceE*p.coreE*p.coreG)**(1/3));
 const lower=Math.max(p.coreMinimum,V/(p.width*p.coreShearAllow));
 const objective=c=>{const t=Math.max(p.faceMinimum,(-c+Math.sqrt(c*c+4*M/(p.width*limit)))/2);return p.width*p.length*(2*p.faceDensity*t+p.coreDensity*c);};
 let lo=lower,hi=p.coreMaximum;
 for(let i=0;i<160;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(objective(a)<=objective(b))hi=b;else lo=a;}
 const candidates=[lower,p.coreMaximum,(lo+hi)/2];return candidates.map(core=>({core,mass:objective(core)})).reduce((a,b)=>a.mass<b.mass?a:b);
}

test('the computed thickness minimum satisfies equilibrium and beats all sampled feasible boundaries',()=>{
 const data=sandwichSizingData({},2001),{parameters:p,optimum:o}=data,independent=independentMinimum(p);
 close(data.moment,125);close(data.shear,250);close(data.lowerCore,.003125);
 close(o.core,.023186748657006824);close(o.face,.0003539961627023944);close(o.mass,.3766519171153476);
 close(o.mass,independent.mass);close(o.core,independent.core,1e-8);
 close(o.faceStress,150e6);assert.ok(o.coreShear<p.coreShearAllow);assert.ok(o.face>p.faceMinimum);
 close(p.width*o.face*(o.core+o.face)*o.faceStress,data.moment);
 close(p.width*o.core*o.coreShear,data.shear);
 for(const s of data.samples){assert.ok(s.mass>=o.mass-1e-12);assert.ok(s.faceStress<=data.faceLimit*(1+1e-12));assert.ok(s.coreShear<=p.coreShearAllow*(1+1e-12));}
 // The objective contour is tangent: its slope equals the active boundary slope.
 close(-p.coreDensity/(2*p.faceDensity),(-1+o.core/Math.sqrt(o.core**2+4*data.K))/2);
 assert.ok(data.manufacturingIntersection>o.core);
 close(data.check.bendingDeflection*1000,14.988714103433896);close(data.check.shearDeflection*1000,1.7970034213518495);
 assert.ok(data.check.bendingDeflection+data.check.shearDeflection>.010);
});

test('manufacturing and shear limits can move the optimum from a tangent to a constraint intersection',()=>{
 const gauge=sandwichSizingData({faceMinimum:.0006}),shear=sandwichSizingData({coreShearAllow:.1e6});
 close(gauge.optimum.face,.0006);close(gauge.optimum.core,gauge.manufacturingIntersection);
 close(shear.optimum.core,shear.lowerCore);close(shear.optimum.coreShear,.1e6);
 for(const data of [gauge,shear])close(data.optimum.mass,independentMinimum(data.parameters).mass);
 assert.throws(()=>sandwichSizingData({coreShearAllow:.04e6}),/No feasible/);
});
