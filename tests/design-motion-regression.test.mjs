import test from 'node:test';
import assert from 'node:assert/strict';
import {initialConcept,copyDesign,generateRobot,exportMJCF,fk,rotate} from '../.build/concept-model.js';
import {motionFrame,motionDuration,preparationTime,groundFrame,footSole,soleCorners,polygonMargin} from '../.build/design-motion.js';
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const make=(robot,extra={})=>generateRobot({...copyDesign(initialConcept),robot,...extra});

test('quadruped knee geometry folds rearward while ground-frame motion advances forward',()=>{
 const model=make('quadruped');
 for(const t of [0,1,1.4,2,2.6,3.2,4.1]){
  const frame=groundFrame(motionFrame(model,t));
  for(const prefix of ['fl','fr','rl','rr']){
   const knee=model.nodes.find(n=>n.id===`${prefix}_knee`).joint;
   assert.ok(frame.q[knee.id]<0,'negative +Y knee flexion uses the rear-folding branch');
   assert.ok(frame.poses[knee.id].p[0]<frame.poses[`${prefix}_pitch`].p[0],'knee lies behind its hip along +X');
   assert.ok(frame.q[knee.id]>=knee.min&&frame.q[knee.id]<=knee.max);
  }
 }
});

test('humanoid stance width is measured at foot centres and survives link and hip-spacing changes',()=>{
 for(const stanceWidth of [.20,.26,.34])for(const geometry of [{},{l1:.36,l2:.28,bodyWidth:.27,jointDistances:{left_pitch:.075,right_pitch:.075}}]){
  const model=make('biped',{stanceWidth,...geometry}),poses=fk(model,model.home),feet=model.nodes.filter(n=>n.tip==='foot');
  const centres=feet.map(n=>footSole(n,poses[n.id]));close(centres[0][1]-centres[1][1],stanceWidth,1e-10);
  for(const n of feet){const normal=rotate(poses[n.id].q,[0,0,1]);close(normal[2],1);}
  const frame=motionFrame(model,1.3);assert.ok(frame.trackingError<1e-8);assert.ok(frame.orientationError<1e-7);
 }
 const model=make('biped'),poses=fk(model,model.home);close(footSole(model.nodes.find(n=>n.id==='left_ankle_roll'),poses.left_ankle_roll)[1]-.13,0);
 assert.throws(()=>make('biped',{stanceWidth:.09}),/motion parameter/);
 assert.throws(()=>make('biped',{stanceWidth:.26,joints:{left_roll:{min:-.01,max:.01}}}),/stance width/);
});

test('motion starts at the design pose without a frame or joint jump',()=>{
 for(const robot of ['quadruped','biped','arm']){
  const model=make(robot),pose=motionFrame(model,0,false),start=motionFrame(model,0);
  for(const node of model.nodes){pose.poses[node.id].p.forEach((x,k)=>close(x,start.poses[node.id].p[k]));if(node.joint)close(pose.q[node.id],start.q[node.id]);}
  const next=motionFrame(model,.0001);assert.ok(Math.max(...model.nodes.map(n=>Math.hypot(...next.poses[n.id].p.map((x,k)=>x-start.poses[n.id].p[k]))))<.00002);
 }
});

test('reference contacts exclude feet above the actual ground plane',()=>{
 const model=make('quadruped',{parts:{fl_pitch:{length:.45}}}),frame=motionFrame(model,0,false);
 assert.equal(frame.contacts.length,1);
 assert.ok(frame.contacts.every(p=>Math.abs(p[2])<=.002));
 assert.ok(footSole(model.nodes.find(n=>n.id==='fr_foot'),frame.poses.fr_foot)[2]>.1);
 assert.ok(frame.supportMargin<0);
});

test('ground-frame stance feet remain fixed through preparation, steps and cycle boundaries',()=>{
 for(const robot of ['quadruped','biped']){
  const model=make(robot),T=motionDuration(model);
  for(let i=0;i<192;i++){
   const t=preparationTime(model)+i*T/96,f=motionFrame(model,t),later=motionFrame(model,t+.0001),world=groundFrame(f),next=groundFrame(later);
   assert.ok(f.trackingError<1e-8);assert.ok(f.orientationError<1e-7);assert.ok(f.plannerValid);assert.ok(polygonMargin(f.zmp,f.supportPolygon)>.009,'planned ZMP stays inside the stance footprint');
   for(const node of model.nodes.filter(n=>n.tip==='foot')){
    const local=footSole(node,f.poses[node.id]),p=footSole(node,world.poses[node.id]);
    close(p[0],local[0]+f.travel);
    const onGround=frame=>frame.contacts.some(c=>Math.hypot(...c.map((v,k)=>v-footSole(node,frame.poses[node.id])[k]))<1e-7);
    if(onGround(f)&&onGround(later)){
     const q=footSole(node,next.poses[node.id]);close(p[0],q[0],1e-7);close(p[1],q[1],1e-7);
    }
    assert.ok(soleCorners(node,world.poses[node.id]).every(p=>p[2]>-1e-8));
   }
  }
 }
});

test('locked joints stay fixed and infeasible flat-foot targets retain a measured error',()=>{
 const model=make('biped',{joints:{left_ankle:{active:false}}});
 const altered={...model.home,left_ankle:1};const a=fk(model,model.home),b=fk(model,altered);
 a.left_ankle.q.forEach((x,k)=>close(x,b.left_ankle.q[k]));
 assert.ok(model.nodes.filter(n=>n.tip==='foot').flatMap(n=>soleCorners(n,a[n.id])).every(p=>p[2]>=.00099999),'initial height uses rotated sole corners');
 assert.ok(motionFrame(model,0,false).contacts.every(p=>Math.abs(p[2])<=.002));
 const frame=motionFrame(model,2);
 close(frame.q.left_ankle,model.home.left_ankle);
 assert.ok(frame.trackingError>.001||frame.orientationError>.035);
});

test('sampled animated transforms agree with independent MuJoCo FK in the ground frame',async()=>{
 const {loadPhysics}=await import('../.build/concept-physics.js');const mj=await loadPhysics();
 for(const model of [make('quadruped'),make('quadruped',{remote:true}),make('biped'),make('biped',{joints:{left_ankle:{active:false}}}),make('arm'),make('arm',{joints:{j4:{active:false},j6:{active:false}}})]){
  const robot=model.design.robot,m=mj.MjModel.from_xml_string(exportMJCF(model)),data=new mj.MjData(m);
  for(const fraction of [0,.03,.17,.31,.48,.67,.86,1]){
   const frame=groundFrame(motionFrame(model,motionDuration(model)*fraction));
   mj.mj_resetData(m,data);
   if(robot!=='arm'){const base=frame.poses.base;data.qpos.set(base.p,0);data.qpos.set(base.q,3);}
   for(const joint of model.active){const id=mj.mj_name2id(m,3,joint.id);data.qpos[m.jnt_qposadr[id]]=frame.q[joint.id];}
   if(robot==='arm'){const id=mj.mj_name2id(m,3,'finger_mirror');data.qpos[m.jnt_qposadr[id]]=frame.q.gripper;}
   mj.mj_forward(m,data);
   for(const node of model.nodes){const id=mj.mj_name2id(m,1,node.id),pose=frame.poses[node.id];pose.p.forEach((v,k)=>close(v,data.xpos[3*id+k],2e-7));const dot=pose.q.reduce((s,v,k)=>s+v*data.xquat[4*id+k],0);close(Math.abs(dot),1,1e-7);}
  }
  data.delete();m.delete();
 }
});
