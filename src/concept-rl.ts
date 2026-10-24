/** Gaussian residual policy, clipped PPO objective, GAE and Adam. No generated motion tables. */
export interface PolicyFile{schema:'anncatto.ppo.v1';fingerprint:string;observations:number;actions:number;weights:number[];value:number[];std:number;updates:number;steps:number;task:string;history:{steps:number;reward:number;episode:number;loss:number}[]}
export class RNG{constructor(public seed=42){}uniform(){this.seed|=0;this.seed=(this.seed+0x6d2b79f5)|0;let t=Math.imul(this.seed^this.seed>>>15,1|this.seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;}normal(){return Math.sqrt(-2*Math.log(Math.max(1e-12,this.uniform())))*Math.cos(2*Math.PI*this.uniform());}}
export interface Sample{obs:number[];action:number[];logp:number;reward:number;value:number;done:boolean}
export function gae(samples:Sample[],bootstrap:number,gamma=.99,lambda=.95){const advantages=Array(samples.length).fill(0) as number[],returns=Array(samples.length).fill(0) as number[];let next=bootstrap,a=0;for(let i=samples.length-1;i>=0;i--){const s=samples[i]!,mask=s.done?0:1,delta=s.reward+gamma*next*mask-s.value;a=delta+gamma*lambda*mask*a;advantages[i]=a;returns[i]=a+s.value;next=s.value;}const mean=advantages.reduce((a,b)=>a+b,0)/advantages.length,sd=Math.sqrt(advantages.reduce((a,b)=>a+(b-mean)**2,0)/advantages.length+1e-8);return{advantages:advantages.map(a=>(a-mean)/sd),returns};}
export class PPO{
 weights:Float64Array;valueWeights:Float64Array;std=.18;updates=0;steps=0;history:PolicyFile['history']=[];private am:Float64Array;private av:Float64Array;private vm:Float64Array;private vv:Float64Array;private tick=0;
 constructor(public observations:number,public actions:number,public fingerprint:string,public task:string,public rng=new RNG()){
  this.weights=new Float64Array((observations+1)*actions);this.valueWeights=new Float64Array(observations+1);this.am=new Float64Array(this.weights.length);this.av=new Float64Array(this.weights.length);this.vm=new Float64Array(observations+1);this.vv=new Float64Array(observations+1);
 }
 means(obs:number[]){const n=this.observations+1,out=[];for(let a=0;a<this.actions;a++){let s=this.weights[a*n+this.observations]!;for(let j=0;j<this.observations;j++)s+=this.weights[a*n+j]!*obs[j]!;out.push(Math.tanh(s));}return out;}
 value(obs:number[]){return obs.reduce((s,v,i)=>s+v*this.valueWeights[i]!,this.valueWeights[this.observations]!);}
 logp(action:number[],mean:number[]){return action.reduce((s,a,i)=>s-.5*((a-mean[i]!)**2/this.std**2+Math.log(2*Math.PI*this.std**2)),0);}
 act(obs:number[],sample=true){const mean=this.means(obs),action=sample?mean.map(v=>v+this.std*this.rng.normal()):mean;return{action,logp:this.logp(action,mean),value:this.value(obs)};}
 update(samples:Sample[],bootstrap:number){const {advantages,returns}=gae(samples,bootstrap),n=this.observations+1;let loss=0;
  for(let epoch=0;epoch<4;epoch++){
   const order=Array.from({length:samples.length},(_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(this.rng.uniform()*(i+1));[order[i],order[j]]=[order[j]!,order[i]!];}
   for(let start=0;start<order.length;start+=64){const ids=order.slice(start,start+64),grad=new Float64Array(this.weights.length),vg=new Float64Array(n);loss=0;
    for(const i of ids){const s=samples[i]!,mean=this.means(s.obs),ratio=Math.exp(Math.max(-12,Math.min(12,this.logp(s.action,mean)-s.logp))),a=advantages[i]!,active=!(a>0&&ratio>1.2||a<0&&ratio<.8);loss-=Math.min(ratio*a,Math.max(.8,Math.min(1.2,ratio))*a)/ids.length;
     if(active)for(let k=0;k<this.actions;k++){const dl=-a*ratio*(s.action[k]!-mean[k]!)/this.std**2*(1-mean[k]!**2)/ids.length;for(let j=0;j<n;j++)grad[k*n+j]!+=dl*(j===this.observations?1:s.obs[j]!);}
     const dv=(this.value(s.obs)-returns[i]!)/ids.length;for(let j=0;j<n;j++)vg[j]!+=.5*dv*(j===this.observations?1:s.obs[j]!);
    }
    const length=Math.sqrt(grad.reduce((s,v)=>s+v*v,0)+vg.reduce((s,v)=>s+v*v,0)),scale=length>.5?.5/length:1;this.tick++;
    const adam=(w:Float64Array,g:Float64Array,m:Float64Array,v:Float64Array,lr:number)=>{for(let j=0;j<w.length;j++){const a=g[j]!*scale;m[j]=.9*m[j]!+.1*a;v[j]=.999*v[j]!+.001*a*a;w[j]!-=lr*(m[j]!/(1-.9**this.tick))/(Math.sqrt(v[j]!/(1-.999**this.tick))+1e-8);}};
    adam(this.weights,grad,this.am,this.av,.00035);adam(this.valueWeights,vg,this.vm,this.vv,.001);
   }
  }this.updates++;this.steps+=samples.length;return loss;
 }
 save():PolicyFile{return{schema:'anncatto.ppo.v1',fingerprint:this.fingerprint,observations:this.observations,actions:this.actions,weights:[...this.weights],value:[...this.valueWeights],std:this.std,updates:this.updates,steps:this.steps,task:this.task,history:this.history};}
 load(p:PolicyFile){if(p.schema!=='anncatto.ppo.v1'||p.fingerprint!==this.fingerprint||p.actions!==this.actions||p.observations!==this.observations||p.weights.length!==this.weights.length||p.value.length!==this.valueWeights.length||![...p.weights,...p.value,p.std].every(Number.isFinite)||p.std<=0)throw Error('Policy and design do not match');this.weights.set(p.weights);this.valueWeights.set(p.value);this.std=p.std;this.updates=p.updates;this.steps=p.steps;this.history=p.history;}
}
