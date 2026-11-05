import {solveQP} from 'quadprog';
/** Zero-based public interface; the upstream Goldfarb–Idnani port is one-based. */
export function quadraticProgram(H:number[][],g:number[],rows:number[][],bounds:number[],equalities=0){
 const n=g.length,D=[[],...H.map(row=>[0,...row])],d=[0,...g.map(x=>-x)],A=[[],...Array.from({length:n},(_,i)=>[0,...rows.map(row=>row[i]??0)])];
 const result=solveQP(D,d,A,[0,...bounds],equalities);
 if(result.message)throw Error(result.message);
 const x=result.solution.slice(1);
 if(x.length!==n||!x.every(Number.isFinite))throw Error('Non-finite quadratic-program solution');
 const residual=Math.max(0,...rows.map((row,i)=>{const r=bounds[i]!-row.reduce((s,a,k)=>s+a*x[k]!,0);return i<equalities?Math.abs(r):r;}));
 return{x,residual};
}
