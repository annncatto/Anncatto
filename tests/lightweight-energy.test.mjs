import test from 'node:test';
import assert from 'node:assert/strict';
import {cantileverEnergy,iSectionProperties,tensionArea,energyFigures,energyFigure} from '../.build/lightweight-energy.js';

const close=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
function simpson(f,a,b,n=400){
 const h=(b-a)/n;let total=f(a)+f(b);
 for(let i=1;i<n;i++)total+=(i%2?4:2)*f(a+i*h);
 return total*h/3;
}

test('cantilever energy integrates the internal moment and differentiates to displacement',()=>{
 const F=137,L=.63,EI=441;
 const actual=cantileverEnergy(F,L,EI);
 const integrated=simpson(x=>(F*(L-x))**2/(2*EI),0,L);
 close(actual.energy,integrated);
 const df=.001;
 const derivative=(cantileverEnergy(F+df,L,EI).energy-cantileverEnergy(F-df,L,EI).energy)/(2*df);
 close(actual.deflection,derivative,1e-11);
 const rotation=simpson(x=>F*(L-x)/EI,0,L);
 close(actual.rotation,rotation);
 close(simpson(x=>(F*(L-x))**2/(2*EI),0,L/2)/integrated,7/8);
 // Independent half-span moment field of a simply supported beam.
 const simplySupported=2*simpson(x=>(F*x/2)**2/(2*EI),0,L/2);
 close(actual.energy/simplySupported,16);
});

test('the equal-area I-section agrees with component area integrals and elastic capacity',()=>{
 const props=iSectionProperties(30,48,4,4);
 // Integrate three disjoint rectangles; do not reuse the outer-minus-inner formula.
 const area=simpson(()=>30,-24,-20)+simpson(()=>4,-20,20)+simpson(()=>30,20,24);
 const secondMoment=simpson(z=>30*z*z,-24,-20)+simpson(z=>4*z*z,-20,20)+simpson(z=>30*z*z,20,24);
 close(props.area,area);
 close(props.secondMoment,secondMoment,1e-7);
 close(props.sectionModulus*24,secondMoment,1e-7);
 const squareI=simpson(z=>20*z*z,-10,10);
 close(props.secondMoment/squareI,10.336);
 close(props.sectionModulus/(squareI/10),4.306666666666667);
});

test('tension and extension constraints give the stated minimum mass and multiple exact geometries',()=>{
 const F=10000,E=70e9,L=.5,rho=2700,allow=100e6;
 const strength=tensionArea(F,allow,E,L),stiff=tensionArea(F,allow,E,L,.0005);
 close(strength*rho*L,.135);
 close(stiff*rho*L,.19285714285714284);
 assert.ok(stiff>strength);
 for(const dm of [.04,.06]){
  const wall=stiff/(Math.PI*dm),outer=dm+wall,inner=outer-2*wall;
  const exact=Math.PI*(outer*outer-inner*inner)/4;
  close(exact,stiff,1e-16);
  close(F*L/(E*exact),.0005,1e-14);
  assert.ok(F/exact<=allow);
  assert.ok(wall<=outer/10);
  assert.ok(wall>=.0005);
 }
 // At the slide's t/D boundary, the outside-diameter approximation is 11.1% high.
 const D=.04,t=D/10;
 close((Math.PI*D*t)/(Math.PI*(D-t)*t)-1,1/9);
});

test('logarithmic tube constraints are equivalent to physical constraints and preserve feasible interpolation',()=>{
 const required=tensionArea(10000,100e6,70e9,.5,.0005),dr=.04,tr=.001;
 for(const dm of [.02,.025,.04,.06,.08])for(const wall of [.0005,.0008,.0015,.003]){
  const u=Math.log(dm/dr),v=Math.log(wall/tr);
  assert.equal(u+v>=Math.log(required/(Math.PI*dr*tr)),Math.PI*dm*wall>=required);
  assert.equal(v-u<=Math.log(dr/(9*tr)),wall<=dm/9);
 }
 // Interpolation in (u,v) gives a geometric mean of dimensions, with equal area.
 const d1=.04,d2=.06,t1=required/(Math.PI*d1),t2=required/(Math.PI*d2);
 for(const weight of [0,.2,.5,.8,1]){
  const dm=d1**weight*d2**(1-weight),wall=t1**weight*t2**(1-weight);
  close(Math.PI*dm*wall,required,1e-16);
  assert.ok(wall<=dm/9);
 }
});

test('the shaded tube domain excludes diameters below the area and wall-ratio intersection',()=>{
 const area=10000*.5/(70e9*.0005)*1e6;
 const intersection=Math.sqrt(9*area/Math.PI);
 assert.ok(area/(Math.PI*(intersection-.01))>(intersection-.01)/9);
 assert.ok(area/(Math.PI*(intersection+.01))<(intersection+.01)/9);
 const shaded=energyFigure('tubefeasible').match(/<path d="([^"]+)" fill="#dcefe4"/);
 assert.ok(shaded);
 const vertices=[...shaded[1].matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m=>({diameter:20+(Number(m[1])-100)/11.5,wall:(460-Number(m[2]))/100}));
 assert.ok(vertices.length>100);
 close(Math.min(...vertices.map(p=>p.diameter)),intersection,5e-5);
 for(const p of vertices){
  assert.ok(p.diameter>=intersection-5e-5);
  assert.ok(p.wall<=p.diameter/9+1e-5);
  assert.ok(Math.PI*p.diameter*p.wall>=area-.003);
 }
});

test('the three derived diagrams render bilingual finite SVGs with their declared identifiers',()=>{
 for(const id of energyFigures){
  const rendered=energyFigure(id);
  assert.ok(rendered.includes(`data-course-figure="${id}"`));
  assert.ok(rendered.includes('viewBox="0 0 900 '));
  assert.ok(rendered.includes('lang="en"')&&rendered.includes('lang="zh-CN"'));
  assert.doesNotMatch(rendered,/NaN|Infinity|undefined/);
 }
 assert.equal(energyFigure('not-an-energy-figure'),undefined);
});
