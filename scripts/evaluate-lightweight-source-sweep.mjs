/** Local engineering evidence only; never copied into the website or sent to hardware. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateRobot,copyDesign,initialConcept} from '../.build/concept-model.js';
import {motionSettings} from '../.build/design-motion.js';
import {dynamicsRuntime} from '../.build/design-dynamics.js';
import {evaluateTracking} from '../.build/design-validation.js';

const args=process.argv.slice(2),outIndex=args.indexOf('--out'),output=outIndex<0?'/tmp/lightweight-source-sweep.json':args[outIndex+1];
if(!output)throw Error('--out requires a path');
const controllerSources={};
for(const file of ['src/concept-model.ts','src/design-motion.ts','src/design-gait.ts','src/design-dynamics.ts','src/design-wbc.ts','src/design-validation.ts','src/source-leg-kinematics.ts','src/source-robot.ts','src/source-robot-data.ts','src/source-physics.ts'])controllerSources[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
const result={schema:'anncatto.source-motion-sweep.v1',createdAt:new Date().toISOString(),hardwareValidated:false,parametersOnly:true,scope:'Six RP1 reference-motion combinations at 0.025 m lift and ground friction 0.7, with unchanged controller and thresholds. Tracking metrics compare states at the same integration time. Nominal rigid-body simulation cases, not a verified operating region or hardware results.',controllerSources,cases:[]},mj=await dynamicsRuntime();
for(const strideLength of [.06,.09])for(const gaitPeriod of [2,2.4,2.8]){
 const design={...copyDesign(initialConcept),robot:'biped',legModel:'rp1',gaitPeriod,strideLength,stepHeight:.025,groundFriction:.7};
 const robot=generateRobot(design),{samples,...report}=await evaluateTracking(mj,robot,10);
 result.cases.push({design,source:robot.source,motion:motionSettings(robot),report});
 console.log(JSON.stringify({gaitPeriod,strideLength,...report}));
}
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(`Report: ${output}`);
