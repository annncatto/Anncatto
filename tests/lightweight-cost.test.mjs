import test from 'node:test';
import assert from 'node:assert/strict';
import {designCost,designCostSlope,valueTangent,costMinimumMass,valueAdjustedMass,massValue} from '../.build/lightweight-cost.js';
import {decodeField,densitySVG,convergenceSVG} from '../.build/topology-figures.js';
import {readFile} from 'node:fs/promises';

test('cost diagram minima and marginal mass value agree with its plotted tangent',()=>{
 assert.equal(designCostSlope(costMinimumMass),0);assert.ok(valueAdjustedMass<costMinimumMass);assert.ok(massValue>0);
 assert.equal(designCostSlope(valueAdjustedMass)+massValue,0);
 assert.equal(valueTangent(valueAdjustedMass),designCost(valueAdjustedMass));
 for(let i=0;i<=100;i++){const m=i/100;assert.ok(designCost(m)>=designCost(costMinimumMass)-1e-12);assert.ok(valueTangent(m)<=designCost(m)+1e-12);assert.ok(designCost(m)+massValue*m>=designCost(valueAdjustedMass)+massValue*valueAdjustedMass-1e-12);}
});

test('interactive SIMP fields contain all solved frames and preserve volume and residual evidence',async()=>{
 const run=JSON.parse(await readFile('content/images/lightweight/topology-evolution.json','utf8'));
 assert.equal(run.schema,'anncatto.simp.v1');assert.equal(run.frames.length,81);const n=run.mesh[0]*run.mesh[1];
 for(const [i,f] of run.frames.entries()){
  assert.equal(f.iteration,i);assert.ok(Math.abs(f.volume-.4)<1e-4);assert.ok(f.free_residual<1e-7);assert.ok(f.benefit_p99>0);assert.ok(f.density_change<=.20001);
  const density=decodeField(f.density,n),benefit=decodeField(f.benefit,n);assert.equal(benefit.length,n);assert.ok(Math.abs(density.reduce((s,x)=>s+x/255,0)/n-.4)<.002);
 }
 for(const lang of ['en','zh'])for(const step of [0,15,40,80]){
  for(const mode of ['density','benefit']){const svg=densitySVG(run,step,mode,lang);assert.match(svg,/Pin|铰支承/);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);}
  assert.doesNotMatch(convergenceSVG(run,step,lang),/NaN|undefined|Infinity/);
 }
 assert.ok(run.frames[80].compliance/run.frames[0].compliance<.14);
});
