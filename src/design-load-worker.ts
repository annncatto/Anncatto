import {generateRobot,jointTorqueLimit,hasElasticModel,type ConceptDesign} from './concept-model.js';
import {dynamicsRuntime,createDynamics,type DynamicsFrame} from './design-dynamics.js';
import {motionDuration} from './design-motion.js';
import {motionMemberLoad,type MemberLoad} from './design-member-loads.js';
import {evaluateTracking} from './design-validation.js';
import {effectiveOutputStiffness,type DesignConditions} from './design-analysis.js';
const scope=globalThis as unknown as {postMessage:(v:unknown)=>void;onmessage:((e:MessageEvent)=>void)|null};
const runtime=dynamicsRuntime(p=>new URL(`./vendor/mujoco/${p}`,import.meta.url).href),pause=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
let token=0,engineToken:number|undefined,cycleReferenceValid=false,engine:ReturnType<typeof createDynamics>|undefined,robot:ReturnType<typeof generateRobot>,conditions:DesignConditions,member='',driver='';
function memberLoad(frame:DynamicsFrame,moving=true):MemberLoad{
 if(frame.referenceValid&&hasElasticModel(robot.design)&&robot.nodes.some(n=>n.id===member&&n.member))return motionMemberLoad(robot,frame,member,driver,effectiveOutputStiffness(conditions),moving);
 return{member,time:frame.time,normal:NaN,shear:NaN,bending:NaN,torsion:NaN,stress:NaN,deflection:NaN,beamDeflection:NaN,connectionDeflection:NaN,twist:NaN,bucklingUse:NaN,strengthUse:NaN,deflectionUse:NaN,torque:frame.referenceValid?frame.torque[driver]??NaN:NaN,elasticTorque:NaN,structuralDataComplete:false,feasible:frame.feasible};
}
scope.onmessage=async e=>{const v=e.data;try{
 if(v.type==='model'){
  const current=++token;engineToken=undefined;cycleReferenceValid=false;const mj=await runtime;if(current!==token)return;engine?.dispose();engine=undefined;robot=generateRobot(v.design as ConceptDesign);conditions=v.conditions;member=v.member;driver=v.driver;engine=createDynamics(mj,robot);engineToken=v.token;
  const cycle:{frame:DynamicsFrame;load:MemberLoad}[]=[];
  for(let i=0;i<=96;i++){
   if(current!==token)return;const frame=engine.evaluate(i/96*motionDuration(robot));
   if(!frame.referenceValid){scope.postMessage({type:'reference-invalid',token:v.token,fingerprint:robot.fingerprint,issue:frame.referenceIssue??{kind:'nonfinite',time:frame.time,trackingError:NaN,orientationError:NaN}});return;}
   cycle.push({frame,load:memberLoad(frame)});if(i%8===0)await pause();
  }
  if(current!==token)return;
  const peak:Record<string,number>={},rms:Record<string,number>={};for(const j of robot.active){peak[j.id]=Math.max(...cycle.map(c=>Math.abs(c.frame.torque[j.id]!)));rms[j.id]=Math.sqrt(cycle.reduce((s,c)=>s+c.frame.torque[j.id]!**2,0)/cycle.length);}
  const worst=cycle.reduce((a,b)=>b.load.strengthUse>a.load.strengthUse?b:a),maxDeflection=cycle.reduce((a,b)=>b.load.deflectionUse>a.load.deflectionUse?b:a),maxBuckling=Math.max(...cycle.map(c=>c.load.bucklingUse)),invalid=cycle.filter(c=>!c.frame.feasible).length,overloaded=robot.active.filter(j=>peak[j.id]!>jointTorqueLimit(robot,j)).map(j=>j.id);
  cycleReferenceValid=true;scope.postMessage({type:'ready',token:v.token,fingerprint:robot.fingerprint,peak,rms,invalid,overloaded,worst:worst.load,maxDeflection:maxDeflection.load,maxBuckling,samples:cycle.length});
 }else if(v.type==='frame'&&engine&&v.token===engineToken){const frame=engine.evaluate(v.time,v.moving),load=memberLoad(frame,v.moving);if(!frame.referenceValid)cycleReferenceValid=false;scope.postMessage({type:'frame',token:v.token,requestId:v.requestId,time:v.time,moving:v.moving,frame,load});}
 else if(v.type==='validate'&&engine&&v.token===engineToken&&cycleReferenceValid){const current=token,report=await evaluateTracking(await runtime,robot,10,async()=>{await pause();if(current!==token)throw Error('Design changed during evaluation');});if(current===token&&cycleReferenceValid)scope.postMessage({type:'validation',token:v.token,...(report.passed&&report.completed?{report}:{})});}
 }catch(error){scope.postMessage({type:'error',token:v.token,operation:v.type,requestId:v.requestId,message:error instanceof Error?error.message:String(error)});}};
