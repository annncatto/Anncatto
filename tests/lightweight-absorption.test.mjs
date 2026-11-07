import test from 'node:test';
import assert from 'node:assert/strict';
import {elasticPlasticEnergy,idealPlasticSEA} from '../.build/lightweight-absorption.js';
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('ideal aluminium SEA uses Pa and kg/m³ and reproduces the supplied exercise',()=>{
 close(idealPlasticSEA(300e6,.12,2700),13333.333333333334);
});

test('elastic-plastic specific work matches independent integration of a force-extension path',()=>{
 const E=70e9,sy=300e6,rho=2700,A=40e-6,L=.4,ey=sy/E,ef=.12,mass=rho*A*L;
 const strains=[0,ey/2,ey,.04,.08,ef],points=strains.map(e=>({x:e*L,F:Math.min(E*e,sy)*A}));
 const work=points.slice(1).reduce((sum,p,i)=>sum+(p.F+points[i].F)/2*(p.x-points[i].x),0);
 const q=elasticPlasticEnergy({modulus:E,yieldStress:sy,density:rho},ef);
 close(q.loading,work/mass);
 const returnWork=.5*sy*A*(sy/E*L);
 close(q.recoverable,returnWork/mass);
 close(q.dissipated,(work-returnWork)/mass);
 close(q.loading,q.recoverable+q.dissipated);
 close(q.plasticStrain,ef-ey);
});

test('loading and stored energy agree below yield and remain continuous at yield',()=>{
 const material={modulus:210e9,yieldStress:400e6,density:7800},ey=material.yieldStress/material.modulus;
 const elastic=elasticPlasticEnergy(material,.4*ey),yielded=elasticPlasticEnergy(material,ey),after=elasticPlasticEnergy(material,ey+1e-12);
 close(elastic.loading,(.4*material.yieldStress)**2/(2*material.modulus*material.density));
 assert.equal(elastic.dissipated,0);assert.equal(elastic.plasticStrain,0);
 close(yielded.loading,yielded.recoverable);close(after.recoverable,yielded.recoverable);
 close(after.dissipated,material.yieldStress*1e-12/material.density,1e-9);
});

test('normalized figure endpoint follows its constitutive model and loading-unloading area',()=>{
 const q=elasticPlasticEnergy({modulus:1,yieldStress:1,density:1},4);
 assert.equal(q.loading,3.5);assert.equal(q.recoverable,.5);assert.equal(q.dissipated,3);assert.equal(q.plasticStrain,3);
});
