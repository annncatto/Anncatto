import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSlide,slideState,denoisingPoint,resolveSlideHash,visibleAttentionSources,crossAttentionConnections} from '../.build/slides-state.js';
test('four masks expose four distinct directed cross-stream connections',()=>{
 const states=['isolated','video','action','mutual'].map(crossAttentionConnections);
 assert.deepEqual(states,[[],['AV'],['VA'],['AV','VA']]);
 assert.equal(new Set(states.map(s=>s.join(','))).size,4);
});
test('paper masks preserve a clean observation prefix and directional future access',()=>{
 for(const mode of ['isolated','video','action','mutual']) {
  assert.deepEqual(visibleAttentionSources(mode,'O'),['O']);
  for(const query of ['V','A']) {
   const sources=visibleAttentionSources(mode,query);
   assert.ok(sources.includes('O')&&sources.includes(query));
  }
 }
 assert.deepEqual(visibleAttentionSources('isolated','A'),['O','A']);
 assert.deepEqual(visibleAttentionSources('video','A'),['O','A']);
 assert.deepEqual(visibleAttentionSources('video','V'),['O','V','A']);
 assert.deepEqual(visibleAttentionSources('action','V'),['O','V']);
 assert.deepEqual(visibleAttentionSources('action','A'),['O','V','A']);
 for(const query of ['V','A'])assert.deepEqual(visibleAttentionSources('mutual',query),['O','V','A']);
});
test('slide links preserve old aliases while an empty URL starts at the first build',()=>{
 const slides=[{id:'overview',aliases:[]},{id:'attention',aliases:['capacity','families']}];
 assert.equal(resolveSlideHash('',slides),-1);
 assert.equal(resolveSlideHash('#',slides),-1);
 assert.equal(resolveSlideHash('#attention',slides),1);
 assert.equal(resolveSlideHash('#capacity',slides),1);
 assert.equal(resolveSlideHash('#missing',slides),-1);
 assert.equal(resolveSlideHash('#attention',[{id:'other',aliases:['attention']},...slides]),2);
});
test('slide navigation reveals builds and keeps reverse traversal reversible',()=>{
 const counts=[2,0,1];let s={index:0,step:0};
 const seen=[s];for(let i=0;i<5;i++){s=advanceSlide(s,1,counts);seen.push(s);}
 assert.deepEqual(seen,[{index:0,step:0},{index:0,step:1},{index:0,step:2},{index:1,step:0},{index:2,step:0},{index:2,step:1}]);
 for(let i=4;i>=0;i--){s=advanceSlide(s,-1,counts);assert.deepEqual(s,seen[i]);}
 assert.deepEqual(advanceSlide(s,-1,counts),s);
 assert.deepEqual(advanceSlide(s,1,counts,true),{index:1,step:0});
 assert.deepEqual(slideState(99,Infinity,counts),{index:2,step:0});
});
test('denoising clocks preserve endpoints and monotonicity for all schedules',()=>{
 for(const mode of ['sync','video-variance','action-variance','video-offset','action-offset']){
  assert.deepEqual(denoisingPoint(0,mode),{video:0,action:0});
  assert.deepEqual(denoisingPoint(1,mode),{video:1,action:1});
  let prev={video:0,action:0};for(let i=1;i<=10;i++){
   const now=denoisingPoint(i/10,mode,32,.8);assert.ok(now.video>=prev.video&&now.action>=prev.action);prev=now;
  }
 }
});
test('schedule uses backbone warp after modality progress, matching audited official grids',()=>{
 const p=denoisingPoint(.1,'action-variance',32,.8,5);
 assert.ok(Math.abs(p.action-.4155844155844156)<1e-12);
 assert.ok(Math.abs(p.video-.021739130434782608)<1e-12);
 assert.equal(denoisingPoint(.8,'video-offset',32,.8,5).action,0);
 const action=Array.from({length:11},(_,i)=>denoisingPoint(i/10,'video-offset',32,.8,5).action);
 assert.equal(action.slice(1).filter((v,i)=>v>action[i]).length,2);
 assert.throws(()=>denoisingPoint(.5,'sync',4,1),RangeError);
});
