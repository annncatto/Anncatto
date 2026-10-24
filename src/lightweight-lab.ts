import {language,onLanguageChange} from './language.js';
import {createRobotScene} from './lightweight-scene.js';
import {initialDesign,materials,evaluateDesign,presets,exportConfiguration,exportURDF,type Design,type RobotType} from './lightweight-mechanics.js';
const root=document.querySelector<HTMLElement>('[data-structure-studio]');
if(root) {
  const $=<T extends HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const form=$<HTMLFormElement>('[data-design-form]'),view=$('[data-robot-view]');
  let design={...initialDesign},reference={...initialDesign},animating=false,mode='geometry',scene:ReturnType<typeof createRobotScene>|undefined;
  const tr=(en:string,zh:string)=>language==='en'?en:zh;
  const f=(n:number,d=2)=>Number.isFinite(n)?n.toFixed(d):'∞';
  const names:Record<RobotType,[string,string]>={quadruped:['Quadruped','四足机器人'],biped:['Biped','双足机器人'],arm:['Two-link arm','二连杆机械臂']};
  const massColors=['#a6b7bf','#83bbce','#2b7ba2','#455d69','#b8dec9'];
  const scales:Record<string,number>={l1:1000,l2:1000,width:1000,height:1000,wall:1000,q1:180/Math.PI,q2:180/Math.PI};
  function setFields(){
    const material=$<HTMLSelectElement>('select[name=material]');
    material.innerHTML=Object.entries(materials).map(([key,m])=>`<option value="${key}">${language==='en'?m.en:m.zh}</option>`).join('');
    for(const e of form.elements)if(e instanceof HTMLInputElement||e instanceof HTMLSelectElement){const key=e.name as keyof Design;if(key in design)e.value=String(typeof design[key]==='number'?Number(((design[key] as number)*(scales[key]||1)).toFixed(2)):design[key]);}
    const labels=[['section',['Box tube','Circular tube','Solid rectangle'],['矩形闭口管','圆管','实心矩形']],['remote',['At the joint','At the limb root'],['关节处','肢体根部']]] as const;
    for(const [name,en,zh] of labels){const s=$<HTMLSelectElement>(`select[name=${name}]`);[...s.options].forEach((o,i)=>o.textContent=(language==='en'?en:zh)[i]!);}
    for(const b of root!.querySelectorAll<HTMLButtonElement>('[data-robot]'))b.setAttribute('aria-pressed',String(b.dataset.robot===design.robot));
    $('[data-workspace]').hidden=design.robot!=='arm';
    $<HTMLInputElement>('input[name=width]').disabled=design.section==='tube';$<HTMLInputElement>('input[name=wall]').disabled=design.section==='solid';
  }
  function metrics(pose=design){
    const a=evaluateDesign(pose),b=evaluateDesign({...reference,robot:design.robot});
    const difference=(v:number,r:number)=>`${v>=r?'+':''}${f(100*(v/r-1),1)}%`;
    const entries=[
      [tr('Total robot mass','整机质量'),f(a.totalMass),'kg',difference(a.totalMass,b.totalMass)],
      [tr('Limb root inertia · M₁₁','单肢根部惯量 · M₁₁'),f(a.M11,4),'kg·m²',difference(a.M11,b.M11)],
      [tr('Member tip deflection','单杆末端挠度'),f(a.deflection*1000,3),'mm',tr('linear cantilever','线性悬臂梁')],
      [tr('Member bending stress','单杆弯曲应力'),f(a.stress/1e6,1),'MPa',`${tr('reference / stress','参考强度 / 应力')} ${f(a.strengthReserve,1)}`],
      [tr('Member frequency estimate','单杆频率估计'),f(a.frequency,1),'Hz',tr('with assumed tip mass','包含假定端部质量')],
      [tr('Reflected rotor inertia','转子反射惯量'),f(a.reflected,5),'kg·m²',`N²Jₘ · ${design.ratio}:1`],
      [tr('Member bending stiffness','单杆弯曲刚度'),f(a.stiffness/1000,1),'N/mm',tr('F / bending deflection','载荷 / 弯曲挠度')],
      [tr('Member torsional stiffness','单杆抗扭刚度'),f(materials[design.material].G*a.section.J/Math.max(design.l1,design.l2),1),'N·m/rad',tr('GJ / L','GJ / L')],
    ];
    $('[data-metrics]').innerHTML=entries.map(([label,value,unit,delta])=>`<div class="studio-metric"><span>${label}</span><strong>${value}<small>${unit}</small></strong><em>${delta}</em></div>`).join('');
    const labels=language==='en'?['Body + accessories','Members','Actuators','End pieces','Remote transmission']:['机身与附件','结构杆件','驱动模组','端部件','远程传动'];
    $('[data-mass-stack]').innerHTML=a.massBreakdown.map((m,i)=>`<span style="width:${100*m/a.totalMass}%;background:${massColors[i]}" title="${labels[i]} ${f(m)} kg"></span>`).join('');
    $('[data-mass-legend]').innerHTML=a.massBreakdown.map((m,i)=>m>0?`<li><i style="background:${massColors[i]}"></i>${labels[i]}<b>${f(m)} kg</b></li>`:'').join('');
    $('[data-report]').textContent=tr(`Static joint torques under the vertical end load: ${f(Math.abs(a.torque1),1)} / ${f(Math.abs(a.torque2),1)} N·m. These are load demands, not rated motor outputs.`,`竖直末端载荷下的静态关节力矩：${f(Math.abs(a.torque1),1)} / ${f(Math.abs(a.torque2),1)} N·m，表示载荷需求。`);
    $('[data-pose-readout]').textContent=`q₁ ${f(pose.q1*180/Math.PI,1)}° · q₂ ${f(pose.q2*180/Math.PI,1)}°`;
    $('[data-model-name]').textContent=names[design.robot][language==='en'?0:1];
  }
  function note(){
    $('[data-view-note]').textContent=mode==='deflection'?tr(`Blue curve: the longer member treated as a cantilever; deformation ×${view.dataset.deformationScale||'150'}.`,`蓝色曲线：较长杆件的悬臂梁挠曲，变形放大 ${view.dataset.deformationScale||'150'} 倍。`):mode==='inertia'?tr('Markers show geometric member centres. Move the motor to see its spatial distribution change.','圆点标出杆件几何中心；切换电机位置，比较运动质量的空间分配。'):tr('Hollow members, joint modules and transmission use the same dimensions as the calculations.','空心杆件、关节模组与传动位置使用计算中的同一组尺寸参数。');
    $('[data-animate]').textContent=design.robot==='arm'?tr(animating?'Pause motion':'Animate joints',animating?'暂停运动':'关节运动'):tr(animating?'Pause gait':'Start gait',animating?'暂停步态':'开启步态');
    $('[data-motion-note]').textContent=design.robot==='arm'?tr('Drag the green end target in its motion plane. Unreachable targets project to the reach boundary; joint limits and obstacles are omitted.','拖动绿色末端目标，在运动平面内逆解。不可达目标投影到可达边界；未加入关节限位与障碍物。'):tr('A stationary-body treadmill cycle: stance moves backward and swing lifts forward. This illustrates geometry, without contact or balance dynamics.','原地步态循环：支撑段向后、摆动段抬起向前，用于展示机构几何。');
    if(design.robot==='arm'&&view.dataset.ikReachable==='false')$('[data-motion-note]').textContent+=tr(` Target outside reach by ${f(Number(view.dataset.ikError)*1000,1)} mm.`,`目标超出可达范围 ${f(Number(view.dataset.ikError)*1000,1)} mm。`);
  }
  function update(reset=false){try{evaluateDesign(design);scene?.update(design,reset);metrics();note();$('[data-input-error]').textContent='';}catch(e){$('[data-input-error]').textContent=tr('Check the section and numeric dimensions.','请检查截面尺寸；壁厚应小于最小外尺寸的一半。');}}
  try{scene=createRobotScene(view,(q1,q2,manual)=>{if(manual){design={...design,q1,q2};animating=false;$('[data-animate]').setAttribute('aria-pressed','false');setFields();note();}metrics({...design,q1,q2});});}catch(e){const status=$('[data-render-status]');status.hidden=false;status.textContent=tr('3D rendering could not start. Enable browser graphics acceleration and reload.','三维渲染未能启动，请启用浏览器图形加速后刷新。');}
  form.addEventListener('change',event=>{const e=event.target;if(!(e instanceof HTMLInputElement||e instanceof HTMLSelectElement))return;const key=e.name as keyof Design;
    const value=key==='remote'?e.value==='true':typeof design[key]==='number'?Number(e.value)/(scales[key]||1):e.value;
    const previous=design;design={...design,[key]:value};try{evaluateDesign(design);setFields();update();}catch{design=previous;$('[data-input-error]').textContent=tr('Enter a positive dimension and a valid wall thickness.','请输入有效尺寸，壁厚应小于最小外尺寸的一半。');}});
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-robot]'))b.addEventListener('click',()=>{design.robot=b.dataset.robot as RobotType;design.q1=design.robot==='arm'?.9:-1.05;design.q2=design.robot==='arm'?-1.3:-.95;setFields();update(true);});
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-preset]'))b.addEventListener('click',()=>{const robot=design.robot;design={...design,...presets[b.dataset.preset!]!,robot};if(robot==='arm'){design.q1=.9;design.q2=-1.3;}setFields();update(true);});
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-view]'))b.addEventListener('click',()=>{mode=b.dataset.view!;scene?.mode(mode as 'geometry'|'inertia'|'deflection');for(const x of root!.querySelectorAll<HTMLButtonElement>('[data-view]'))x.setAttribute('aria-pressed',String(x===b));note();});
  $('[data-camera]').addEventListener('click',()=>scene?.resetCamera());
  $('[data-reference]').addEventListener('click',()=>{const [q1,q2]=(view.dataset.jointPose||`${design.q1},${design.q2}`).split(',').map(Number);reference={...design,q1:q1!,q2:q2!};metrics(reference);});
  $('[data-animate]').addEventListener('click',()=>{animating=!animating;scene?.play(animating);$('[data-animate]').setAttribute('aria-pressed',String(animating));if(!animating){const [q1,q2]=(view.dataset.jointPose||`${design.q1},${design.q2}`).split(',').map(Number);metrics({...design,q1:q1!,q2:q2!});}note();});
  $('[data-workspace]').addEventListener('click',()=>{const b=$('[data-workspace]'),enabled=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(enabled));scene?.workspace(enabled);});
  function download(data:string|ArrayBuffer,type:string,name:string){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  for(const b of root.querySelectorAll<HTMLButtonElement>('[data-download]'))b.addEventListener('click',async()=>{const type=b.dataset.download;if(type==='png'){if(!scene)return;const a=document.createElement('a');a.href=scene.capture();a.download='robot-structure.png';a.click();}else if(type==='glb'){if(scene)download(await scene.exportGLB(),'model/gltf-binary','robot-structure.glb');}else download(type==='urdf'?exportURDF(design):exportConfiguration(design),type==='urdf'?'application/xml':'application/json',`robot-structure.${type}`);});
  onLanguageChange(()=>{setFields();metrics();note();});setFields();update(true);
}
