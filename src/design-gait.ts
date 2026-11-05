import {type V3} from './concept-model.js';
import {quadraticProgram} from './design-qp.js';

export interface CentroidalPlan{sample:(phase:number)=>{p:V3;v:V3;a:V3;zmp:V3};residual:number;valid:boolean;reason:string}
/** Periodic C² B-spline LIPM preview, with ZMP constrained to the planned
 * contact polygon. This plans a reference; full rigid-body feasibility is a
 * separate inverse-dynamics calculation, including angular momentum. */
export function planCentroidal(period:number,stride:number,height:number,origin:V3,polygon:(phase:number)=>V3[],events:number[]=[],offsetVelocity?:(phase:number)=>number):CentroidalPlan{
 const N=48,n=2*N,dt=period/N,H=Array.from({length:n},()=>Array(n).fill(0)),g=Array(n).fill(0),rows:number[][]=[],bounds:number[]=[];
 const basis=(phase:number,derivative=0)=>{
  const s=phase*N,i=Math.floor(s),u=s-i;
  const b=derivative===0?[(1-u)**3,3*u**3-6*u*u+4,-3*u**3+3*u*u+3*u+1,u**3].map(x=>x/6):derivative===1?[-3*(1-u)**2,9*u*u-12*u,-9*u*u+6*u+3,3*u*u].map(x=>x/(6*dt)):[6*(1-u),18*u-12,-18*u+6,6*u].map(x=>x/(6*dt*dt));
  const r=Array(N).fill(0);b.forEach((v,k)=>r[((i+k-1)%N+N)%N]+=v);return r;
 };
 const square=(row:number[],target:number,weight:number)=>{const indices=row.flatMap((v,i)=>v?[i]:[]);for(const i of indices){g[i]-=2*weight*target*row[i];for(const j of indices)H[i][j]+=2*weight*row[i]*row[j];}};
 for(let i=0;i<n;i++)H[i][i]=1e-7;
 let degenerate=false;
 const phases=[...new Set([...Array.from({length:2*N},(_,i)=>i/(2*N)),...events.flatMap(t=>[t-1e-7,t,t+1e-7]).filter(t=>t>=0&&t<1)])];
 for(const phase of phases){
  const b=basis(phase),v=basis(phase,1),a=basis(phase,2),z=b.map((x,k)=>x-height/9.80665*a[k]),hull=polygon(phase);
  for(let axis=0;axis<2;axis++){
   const row=Array(n).fill(0);b.forEach((x,k)=>row[axis*N+k]=x);square(row,0,axis===0?5:1);
   const acc=Array(n).fill(0);a.forEach((x,k)=>acc[axis*N+k]=x);square(acc,0,.012);
  }
  const forward=Array(n).fill(0);v.forEach((x,k)=>forward[k]=x);rows.push(forward);bounds.push((offsetVelocity?.(phase)??0)-stride/period*.60);
  if(hull.length<3){degenerate=true;continue;}
  for(let k=0;k<hull.length;k++){
   const p=hull[k]!,q=hull[(k+1)%hull.length]!,dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy),row=Array(n).fill(0);
   z.forEach((x,j)=>{row[j]=-dy*x;row[N+j]=dx*x;});
   rows.push(row);bounds.push(.012*length+dx*(p[1]-origin[1])-dy*(p[0]-origin[0]-stride*phase));
  }
 }
 let values=Array(n).fill(0),valid=!degenerate,reason=degenerate?'Contact polygon has no area':'',residual=Infinity;
 try{const result=quadraticProgram(H,g,rows,bounds);values=result.x;residual=result.residual;valid&&=residual<1e-7;}catch(e){valid=false;reason=String(e);}
 const sample=(phase:number)=>{
  const whole=Math.floor(phase),u=phase-whole,b=basis(u),v=basis(u,1),a=basis(u,2),p=[origin[0]+stride*phase,origin[1],height] as V3,velocity:V3=[stride/period,0,0],acceleration:V3=[0,0,0];
  for(let axis=0;axis<2;axis++)for(let j=0;j<N;j++){const x=values[axis*N+j];p[axis]+=b[j]*x;velocity[axis]+=v[j]*x;acceleration[axis]+=a[j]*x;}
  return{p,v:velocity,a:acceleration,zmp:[p[0]-height/9.80665*acceleration[0],p[1]-height/9.80665*acceleration[1],0] as V3};
 };
 return{sample,valid,reason,residual};
}
