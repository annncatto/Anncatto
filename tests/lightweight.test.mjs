import test from 'node:test';
import {readArticleSource} from '../scripts/content.mjs';
import assert from 'node:assert/strict';
import {initialDesign,sectionProperties,evaluateDesign,cantileverCurve,exportURDF,exportConfiguration,presets,materials} from '../.build/lightweight-mechanics.js';
import {inverse2R,forward2R,footCycle} from '../.build/lightweight-kinematics.js';
import {relativeMaterialIndex,lightweightDiagram} from '../.build/lightweight-diagrams.js';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('closed tube section and cantilever equations preserve SI units',()=>{
 const s=sectionProperties({...initialDesign,width:.04,height:.06,wall:.002});
 close(s.area*1e6,384);close(s.I*1e12,193152);
 const a=evaluateDesign(initialDesign),L=Math.max(initialDesign.l1,initialDesign.l2);
 close(cantileverCurve(0,L,60,materials.aluminium.E,a.section.I),0);
 close(cantileverCurve(L,L,60,materials.aluminium.E,a.section.I),a.deflection);
 const twice=evaluateDesign({...initialDesign,force:120});close(twice.deflection,2*a.deflection);close(twice.stress,2*a.stress);close(twice.frequency,a.frequency);
 assert.throws(()=>evaluateDesign({...initialDesign,wall:.05}));
});
test('motor placement, section and gear changes have the stated physical effects',()=>{
 const a=evaluateDesign(initialDesign),p=evaluateDesign({...initialDesign,...presets.proximal}),thin=evaluateDesign({...initialDesign,...presets.thin});
 close(p.totalMass-a.totalMass,4*.16);assert.ok(p.M11<a.M11);
 assert.ok(thin.totalMass<a.totalMass);assert.ok(thin.stiffness<a.stiffness);assert.ok(thin.deflection>a.deflection);
 const gear=evaluateDesign({...initialDesign,ratio:2*initialDesign.ratio});close(gear.reflected,4*a.reflected);close(gear.totalMass,a.totalMass);
 for(const q2 of [-Math.PI,-1.2,0,1.2,Math.PI])for(const remote of [true,false]){
  const m=evaluateDesign({...initialDesign,q2,remote});assert.ok(m.M11>0&&m.M22>0&&m.M11*m.M22-m.M12*m.M12>0);
 }
});
test('URDF inertial masses sum to the analytical total for every architecture',()=>{
 for(const robot of ['quadruped','biped','arm'])for(const remote of [false,true])for(const section of ['box','tube','solid']){
  const d={...initialDesign,robot,remote,section},urdf=exportURDF(d);
  close([...urdf.matchAll(/<mass value="([^"]+)"/g)].reduce((n,m)=>n+Number(m[1]),0),evaluateDesign(d).totalMass);
  for(const m of urdf.matchAll(/<inertia ixx="([^"]+)" iyy="([^"]+)" izz="([^"]+)"/g)){
   const [x,y,z]=m.slice(1).map(Number);assert.ok(x>0&&y>0&&z>0);assert.ok(x+y>=z-1e-8&&x+z>=y-1e-8&&y+z>=x-1e-8);
  }
  assert.doesNotMatch(urdf,/NaN|undefined/);assert.equal(JSON.parse(exportConfiguration(d)).units,'SI');
 }
});
test('inverse kinematics reaches either branch and projects unreachable targets',()=>{
 for(const [l1,l2] of [[.28,.28],[.2,.4],[.4,.17]])for(const q1 of [-2,-.2,1.6])for(const q2 of [-2,-.5,.5,2]){
  const point=forward2R(l1,l2,q1,q2),ik=inverse2R(l1,l2,point.x,point.y,q2<0?-1:1);
  close(ik.x,point.x);close(ik.y,point.y);assert.ok(ik.reachable);assert.ok(ik.error<1e-10);assert.ok(Math.sign(ik.q2)===Math.sign(q2));
 }
 const outer=inverse2R(.2,.3,1,0),inner=inverse2R(.2,.3,.01,0);close(outer.x,.5);close(inner.x,.1);assert.equal(outer.reachable,false);assert.equal(inner.reachable,false);
 const folded=inverse2R(.3,.3,0,0);assert.ok(Number.isFinite(folded.q1));assert.ok(folded.error<1e-10);
});
test('foot cycle is periodic and has continuous position and velocity at stance transitions',()=>{
 const stride=.14,lift=.05,eps=1e-6;
 for(const p of [0,.62]){
  const a=footCycle(p-eps,stride,lift),b=footCycle(p,stride,lift),c=footCycle(p+eps,stride,lift);
  assert.ok(Math.hypot(c.x-a.x,c.y-a.y)<1e-5);
  close((b.x-a.x)/eps,(c.x-b.x)/eps,1e-4);close((b.y-a.y)/eps,(c.y-b.y)/eps,1e-4);
 }
 assert.equal(footCycle(.3,stride,lift).y,0);assert.ok(footCycle(.81,stride,lift).y>0);
 close(footCycle(.2,stride,lift).x,footCycle(1.2,stride,lift).x);
});
test('material-index comparisons and scientific plots stay finite in both languages',()=>{
 const al=materials.aluminium,st=materials.steel;
 close(relativeMaterialIndex(al.E,al.rho,1),1);assert.ok(relativeMaterialIndex(st.E,st.rho,.5)<1);
 close(1/relativeMaterialIndex(st.E,st.rho,.5),1.6691646480035358,.002);
 for(const [id,n] of [['ashby',3],['strength',3],['beam',2],['section',4],['reflection',5],['simp',2]])for(let choice=0;choice<n;choice++)for(const lang of ['en','zh']){
  const s=lightweightDiagram(id,choice,lang);assert.match(s,/<title/);assert.match(s,/role="img"/);assert.doesNotMatch(s,/NaN|undefined|Infinity/);
 }
});

test('chapter assembly preserves display-math delimiters and all modules',async()=>{
 const source=await readArticleSource('轻量化结构设计.html');
 assert.equal((source.match(/<h2 id=/g)||[]).length,11);
 assert.ok(source.includes('<div class="formula">$$'));
 assert.ok((source.match(/\$\$/g)||[]).length>80);
 assert.doesNotMatch(source,/\{\{chapter:/);
 await assert.rejects(readArticleSource('../package.json'));
});
