import test from 'node:test';
import assert from 'node:assert/strict';
import {quantizeFloat,roundingSeries,latencyBudget} from '../.build/smolvla-math.js';

test('binary formats preserve known values, subnormals, overflow, and even ties',()=>{
 assert.equal(quantizeFloat(.01,'bf16'),.010009765625);
 assert.equal(quantizeFloat(1+2**-8,'bf16'),1);
 assert.equal(quantizeFloat(1+3*2**-8,'bf16'),1+2**-6);
 assert.equal(quantizeFloat(2**-24,'fp16'),2**-24);
 assert.equal(quantizeFloat(2**-25,'fp16'),0);
 assert.equal(quantizeFloat(65504,'fp16'),65504);
 assert.equal(quantizeFloat(65520,'fp16'),Infinity);
 assert.equal(quantizeFloat(-.01,'bf16'),-.010009765625);
 for(const x of [1.23456789,1e-20,1e30,2**-149])assert.equal(quantizeFloat(x,'fp32'),Math.fround(x));
});
test('tiny direct BF16 writes vanish while FP32 storage accumulates',()=>{
 const points=roundingSeries(.01,1e-5,'bf16'),a=points[0],b=points.at(-1);
 assert.equal(a.direct,b.direct);
 assert.ok(Math.abs((a.master-b.master)-.001)<1e-7);
 assert.notEqual(b.compute,a.compute);
 const fp32=roundingSeries(.01,1e-5,'fp32');
 assert.equal(fp32.at(-1).direct,fp32.at(-1).master);
});
test('queue budget separates buffer, latency and control rate',()=>{
 const sufficient=latencyBudget(50,30,.4,200);
 assert.equal(sufficient.elapsedSteps,6);assert.equal(sufficient.idle,0);
 const empty=latencyBudget(50,30,0,200);assert.equal(empty.idle,.2);
 assert.ok(Math.abs(latencyBudget(25,30,0,106).syncHz-26.61462)<.001);
 assert.throws(()=>latencyBudget(50,0,.5,100));
});
