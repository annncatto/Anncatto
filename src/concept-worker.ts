import {loadPhysics,Physics,type Task} from './concept-physics.js';
import {generateRobot,type ConceptDesign} from './concept-model.js';
import type {PolicyFile} from './concept-rl.js';
const scope=globalThis as unknown as {postMessage:(x:unknown)=>void;onmessage:((e:MessageEvent)=>void)|null};
let physics:Physics|undefined,playing=false,training=false,learned=false,token=0;
const send=(type:string,data:unknown)=>scope.postMessage({type,data});
const ready=loadPhysics(path=>new URL(`./vendor/mujoco/${path}`,import.meta.url).href);
const pause=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
scope.onmessage=async e=>{try{
 const v=e.data;
 if(v.type==='model'){const current=++token;playing=false;training=false;const mj=await ready;if(current!==token)return;physics?.dispose();physics=new Physics(mj,generateRobot(v.design as ConceptDesign),v.task||'stand');physics.reset(false,v.q);send('ready',{fingerprint:physics.robot.fingerprint});send('snapshot',physics.snapshot());}
 else if(v.type==='run'){if(!physics)return;training=false;learned=v.learned;physics.task=v.task as Task;physics.target={...physics.robot.home,...v.q};physics.reset(false,v.q);playing=v.play;if(playing)run(++token);}
 else if(v.type==='stop'){playing=false;training=false;token++;if(physics)send('snapshot',physics.snapshot());}
 else if(v.type==='train'){if(!physics)return;playing=false;training=true;physics.task=v.task;physics.policy.task=v.task;physics.reset(true);const current=++token;for(let i=0;i<v.updates&&training&&current===token;i++){const stats=physics.trainBatch(512);send('training',stats);send('snapshot',physics.snapshot());await pause();}if(current===token){training=false;send('policy',physics.policy.save());send('trained',{steps:physics.policy.steps});}}
 else if(v.type==='policy'){physics?.loadPolicy(v.policy as PolicyFile);send('policy',physics?.policy.save());}
 }catch(e){send('error',e instanceof Error?e.message:String(e));}};
async function run(current:number){let then=performance.now();while(playing&&current===token&&physics){const now=performance.now();const count=Math.min(4,Math.max(1,Math.floor((now-then)/20)));for(let i=0;i<count;i++){physics.step(learned?physics.policy.act(physics.observe(),false).action:physics.robot.active.map(()=>0));if(physics.snapshot().fallen){playing=false;send('stopped',{reason:'fallen'});break;}}then=now;send('snapshot',physics.snapshot());await new Promise<void>(r=>setTimeout(r,16));}}
