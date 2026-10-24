import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {forward2R,inverse2R,footCycle} from './lightweight-kinematics.js';
import {materials, type Design} from './lightweight-mechanics.js';

export function createRobotScene(host:HTMLElement,onPose:(q1:number,q2:number,manual?:boolean)=>void) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.setAttribute('aria-label','Interactive three-dimensional robot structure');
  host.prepend(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#eef3f4');
  const camera=new T.PerspectiveCamera(38,1,.01,30);camera.position.set(1.25,1.1,1.35);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.42,0);controls.enableDamping=true;controls.minDistance=.45;controls.maxDistance=4;
  const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromScene(new RoomEnvironment(),.04);scene.environment=environment.texture;
  scene.add(new T.HemisphereLight(0xffffff,0x8b9da5,2.2));
  const sun=new T.DirectionalLight(0xffffff,4);sun.position.set(-1,2.5,1.5);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1.4;sun.shadow.camera.right=1.4;sun.shadow.camera.top=1.4;sun.shadow.camera.bottom=-1.4;sun.shadow.bias=-.0003;sun.shadow.normalBias=.008;scene.add(sun);
  const rim=new T.DirectionalLight(0xc7e6ff,2);rim.position.set(1,.7,-1.5);scene.add(rim);
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:'#eef3f4',roughness:.85,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
  const grid=new T.GridHelper(2,20,0xb5c9ce,0xd8e3e6);grid.position.y=.001;scene.add(grid);
  const model=new T.Group();scene.add(model);
  let d:Design,playing=false,visible=true,clock=0,last=performance.now(),lastMetrics=0;
  let limbs:{upper:T.Group;knee:T.Group;phase:number}[]=[];
  let workspace=true,dragging=false,armTarget:T.Mesh|undefined,workspaceGroup:T.Group|undefined,playStart=0,armHeight=.17;
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),dragPlane=new T.Plane(new T.Vector3(0,0,1),-.06);
  let mode:'geometry'|'inertia'|'deflection'='geometry';
  const weave=document.createElement('canvas');weave.width=128;weave.height=128;
  const ctx=weave.getContext('2d')!;ctx.fillStyle='#39464c';ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=8)for(let x=0;x<128;x+=8){ctx.fillStyle=(x/8+y/8)%2?'#4e6067':'#28383f';ctx.fillRect(x,y,7,7);}
  const carbon=new T.CanvasTexture(weave);carbon.wrapS=carbon.wrapT=T.RepeatWrapping;carbon.repeat.set(2,8);carbon.colorSpace=T.SRGBColorSpace;
  function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D=model) {const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function mat(color:T.ColorRepresentation,metalness=.55,roughness=.35){return new T.MeshStandardMaterial({color,metalness,roughness});}
  function rod(parent:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,m:T.Material){const delta=b.clone().sub(a);const o=mesh(new T.CylinderGeometry(r,r,delta.length(),24),m,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
  function rr(w:number,h:number,r:number) {
    const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
  }
  function member(parent:T.Object3D,length:number,m:T.Material) {
    let s:T.Shape;
    if(d.section==='tube') {s=new T.Shape();s.absarc(0,0,d.height/2,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,d.height/2-d.wall,0,Math.PI*2,true);s.holes.push(hole);}
    else {s=rr(d.width,d.height,.001);if(d.section!=='solid'){const inner=rr(d.width-2*d.wall,d.height-2*d.wall,.0006);s.holes.push(new T.Path(inner.getPoints(24).reverse()));}}
    const o=mesh(new T.ExtrudeGeometry(s,{depth:length,bevelEnabled:false,curveSegments:20,steps:1}),m,parent);
    o.setRotationFromMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,-1),new T.Vector3(0,1,0),new T.Vector3(1,0,0)));
    return o;
  }
  function actuator(parent:T.Object3D,x:number,z:number,accent:T.Material) {
    const g=new T.Group();g.position.set(x,0,z);parent.add(g);
    for(const [r,len,oz,color] of [[.046,.049,0,'#283b49'],[.047,.006,.027,'#a9bec6'],[.031,.008,.034,'#277baa']] as const){const o=mesh(new T.CylinderGeometry(r,r,len,64),mat(color),g);o.rotation.x=Math.PI/2;o.position.z=oz;}
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const bolt=mesh(new T.CylinderGeometry(.0028,.0028,.004,12),accent,g);bolt.rotation.x=Math.PI/2;bolt.position.set(.038*Math.cos(a),.038*Math.sin(a),.031);}
    return g;
  }
  function rebuild(next:Design,reset=false) {
    d={...next};clock=0;playStart=0;
    model.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});model.clear();limbs=[];armTarget=undefined;workspaceGroup=undefined;
    const metal=mat(materials[d.material].color,.5,.31);if(d.material==='carbon'){metal.map=carbon;metal.metalness=.18;metal.roughness=.42;}
    const dark=mat('#273d49',.4,.45),blue=mat('#2a83ae',.5,.3),rubber=mat('#304248',0,.8);
    const n=d.robot==='quadruped'?4:d.robot==='biped'?2:1;
    const minFoot=Math.min(0,d.l1*Math.sin(d.q1)+d.l2*Math.sin(d.q1+d.q2));
    const hip=d.robot==='arm'?d.l1+d.l2+.05:-minFoot+.027;armHeight=hip;
    if(d.robot==='quadruped') {
      const body=mesh(new RoundedBoxGeometry(.48,.17,.255,5,.028),dark);body.position.y=hip+.055;
      const panel=mesh(new RoundedBoxGeometry(.38,.012,.23,4,.005),metal);panel.position.y=hip+.147;
      for(const side of [-1,1]) {const rail=mesh(new RoundedBoxGeometry(.37,.025,.014,3,.004),blue);rail.position.set(0,hip+.055,side*.129);}
      const sensor=mesh(new T.CylinderGeometry(.036,.036,.035,48),dark);sensor.position.set(.12,hip+.175,0);
      for(const x of [-.19,.19])for(const z of [-.09,.09]){const bolt=mesh(new T.CylinderGeometry(.004,.004,.003,16),blue);bolt.position.set(x,hip+.155,z);}
    } else if(d.robot==='biped') {
      const torso=mesh(new RoundedBoxGeometry(.19,.28,.18,5,.03),metal);torso.position.y=hip+.22;
      const pelvis=mesh(new RoundedBoxGeometry(.21,.10,.18,5,.022),dark);pelvis.position.y=hip+.025;
      const head=mesh(new RoundedBoxGeometry(.11,.105,.10,5,.022),dark);head.position.y=hip+.435;
      const visor=mesh(new RoundedBoxGeometry(.015,.038,.086,4,.008),blue);visor.position.set(.053,hip+.44,0);
      for(const side of [-1,1]){rod(model,new T.Vector3(0,hip+.32,side*.14),new T.Vector3(.02,hip+.13,side*.17),.025,dark);}
    } else {
      const pedestal=mesh(new T.CylinderGeometry(.075,.105,hip-.055,64),dark);pedestal.position.y=(hip-.055)/2+.02;
      const base=mesh(new T.CylinderGeometry(.17,.17,.02,64),metal);base.position.y=.01;
    }
    for(let i=0;i<n;i++) {
      const root=new T.Group(),upper=new T.Group(),knee=new T.Group();
      const x=d.robot==='quadruped'?(i<2?.19:-.19):0;
      const z=n===1?0:(i%2?.15:-.15);root.position.set(x,hip,z);model.add(root);root.add(upper);upper.add(knee);knee.position.x=d.l1;
      member(upper,d.l1,metal);member(knee,d.l2,metal);
      actuator(root,0,z>0?.018:-.018,blue);
      if(d.remote) {
        actuator(root,0,z>0?-.085:.085,blue);
        // A timing-belt envelope, shown on the moving upper link.
        const path=new T.CurvePath<T.Vector3>(),r=.029,oz=z>0?-.056:.056;
        path.add(new T.LineCurve3(new T.Vector3(0,r,oz),new T.Vector3(d.l1,r,oz)));
        const pts:T.Vector3[]=[];for(let j=0;j<=64;j++){const a=Math.PI/2-j*Math.PI/64;pts.push(new T.Vector3(d.l1+r*Math.cos(a),r*Math.sin(a),oz));}path.add(new T.CatmullRomCurve3(pts));
        path.add(new T.LineCurve3(new T.Vector3(d.l1,-r,oz),new T.Vector3(0,-r,oz)));
        const pts2:T.Vector3[]=[];for(let j=0;j<=64;j++){const a=-Math.PI/2-j*Math.PI/64;pts2.push(new T.Vector3(r*Math.cos(a),r*Math.sin(a),oz));}path.add(new T.CatmullRomCurve3(pts2));
        mesh(new T.TubeGeometry(path,140,.003,10,false),rubber,upper);
        for(const px of [0,d.l1]){const p=mesh(new T.CylinderGeometry(r*.87,r*.87,.009,48),blue,upper);p.rotation.x=Math.PI/2;p.position.set(px,0,oz);}
      } else actuator(upper,d.l1,z>0?.01:-.01,blue);
      const foot=mesh(new T.SphereGeometry(.026,32,20),rubber,knee);foot.position.x=d.l2;
      if(d.robot==='biped'){const shoe=mesh(new RoundedBoxGeometry(.11,.035,.065,4,.01),dark,knee);shoe.position.set(d.l2,.012,0);}
      if(d.robot==='arm'){for(const side of [-1,1]){const finger=mesh(new RoundedBoxGeometry(.07,.012,.015,3,.004),dark,knee);finger.position.set(d.l2+.028,side*.035,0);}}
      if(mode==='inertia') {
        const marker=mesh(new T.SphereGeometry(.015,28,16),new T.MeshStandardMaterial({color:'#90d4b4',emissive:'#327957',emissiveIntensity:.25}),upper);marker.position.set(d.l1/2,0,.035);
        const marker2=mesh(new T.SphereGeometry(.015,28,16),mat('#80c4e3',.1,.4),knee);marker2.position.set(d.l2/2,0,.035);
      }
      if(mode==='deflection' && i===0) {
        const E=materials[d.material].E;
        const b=d.width,h=d.height,t=d.wall;
        const I=d.section==='tube'?Math.PI*(h**4-(h-2*t)**4)/64:(b*h**3-(d.section==='solid'?0:(b-2*t)*(h-2*t)**3))/12;
        const L=Math.max(d.l1,d.l2),def=d.force*L**3/(3*E*I),scale=def>0?Math.min(150,.08/def):1;
        const pts=Array.from({length:41},(_,j)=>{const x=L*j/40,y=-d.force*x*x*(3*L-x)/(6*E*I)*scale;return new T.Vector3(x,y,.045);});
        mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),60,.004,12,false),blue,d.l1>=d.l2?upper:knee);
        host.dataset.deformationScale=scale.toFixed(0);
      }
      limbs.push({upper,knee,phase:i===1||i===2?Math.PI:0});
    }
    if(d.robot==='arm') {
      workspaceGroup=new T.Group();model.add(workspaceGroup);workspaceGroup.position.y=hip;workspaceGroup.visible=workspace;
      for(const radius of [Math.abs(d.l1-d.l2),d.l1+d.l2])if(radius>1e-5){const points=Array.from({length:129},(_,i)=>new T.Vector3(radius*Math.cos(i*Math.PI/64),radius*Math.sin(i*Math.PI/64),0));const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#8bbec9',transparent:true,opacity:.6}));workspaceGroup.add(line);}
      armTarget=mesh(new T.SphereGeometry(.022,32,20),new T.MeshBasicMaterial({color:'#47b795'}));
      const halo=mesh(new T.TorusGeometry(.030,.002,12,48),new T.MeshBasicMaterial({color:'#328ba4'}),armTarget);
      halo.rotation.y=0;armTarget.userData.ikHandle=true;
    }
    pose();
    if(reset){const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const distance=Math.max(size.y,size.x,size.z)*2.15;controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(1.1,.8,1.2).normalize().multiplyScalar(distance));controls.update();}
  }
  function pose() {
    if(!d)return;
    let first={q1:d.q1,q2:d.q2};
    limbs.forEach((limb,i)=>{
      let q1=d.q1,q2=d.q2;
      if(playing&&d.robot!=='arm') {
        const base=forward2R(d.l1,d.l2,d.q1,d.q2),cycle=footCycle(clock*.65+.31+limb.phase/(2*Math.PI),Math.min(.16,(d.l1+d.l2)*.25),Math.min(.06,d.l2*.18));
        const blend=Math.min(1,(clock-playStart)/.4),ik=inverse2R(d.l1,d.l2,base.x+blend*cycle.x,base.y+blend*cycle.y,d.q2<=0?-1:1);
        q1=ik.q1;q2=ik.q2;
      } else if(playing) {q1+=.16*Math.sin((clock-playStart)*1.6);q2+=.20*Math.sin((clock-playStart)*1.6);}
      limb.upper.rotation.z=q1;limb.knee.rotation.z=q2;
      if(i===0)first={q1,q2};
    });
    if(armTarget){const end=forward2R(d.l1,d.l2,first.q1,first.q2);armTarget.position.set(end.x,armHeight+end.y,.06);}
    host.dataset.jointPose=`${first.q1.toFixed(5)},${first.q2.toFixed(5)}`;
    return first;
  }
  function pointOnPlane(event:PointerEvent) {
    const rect=renderer.domElement.getBoundingClientRect();pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
    raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(dragPlane,new T.Vector3());
  }
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(d?.robot!=='arm'||!armTarget)return;pointOnPlane(event);
    if(raycaster.intersectObject(armTarget,true).length===0)return;
    dragging=true;playing=false;clock=0;playStart=0;controls.enabled=false;renderer.domElement.setPointerCapture(event.pointerId);renderer.domElement.style.cursor='grabbing';event.stopImmediatePropagation();event.preventDefault();
  },{capture:true});
  renderer.domElement.addEventListener('pointermove',event=>{
    const target=pointOnPlane(event);if(!dragging||!target||!d)return;
    const ik=inverse2R(d.l1,d.l2,target.x,target.y-armHeight,d.q2<=0?-1:1);d.q1=ik.q1;d.q2=ik.q2;pose();
    host.dataset.ikError=ik.error.toFixed(6);host.dataset.ikReachable=String(ik.reachable);onPose(d.q1,d.q2,true);
    event.stopImmediatePropagation();event.preventDefault();
  },{capture:true});
  const endDrag=()=>{dragging=false;controls.enabled=true;renderer.domElement.style.cursor='grab';};
  renderer.domElement.addEventListener('pointerup',endDrag,{capture:true});renderer.domElement.addEventListener('pointercancel',endDrag,{capture:true});
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([e])=>{visible=e!.isIntersecting;}).observe(host);
  function tick(now:number){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(!visible||document.hidden)return;if(playing){clock+=dt;const current=pose();if(now-lastMetrics>120&&current){lastMetrics=now;onPose(current.q1,current.q2);}}controls.update();renderer.render(scene,camera);if(armTarget){const p=armTarget.position.clone().project(camera);host.dataset.ikHandleX=String((p.x+1)*host.clientWidth/2);host.dataset.ikHandleY=String((1-p.y)*host.clientHeight/2);}}
  requestAnimationFrame(tick);resize();
  return {update:rebuild,play:(v:boolean)=>{playing=v;},workspace:(v:boolean)=>{workspace=v;if(workspaceGroup)workspaceGroup.visible=v;},mode:(v:typeof mode)=>{mode=v;rebuild(d);},resetCamera:()=>{rebuild(d,true);},capture:()=>renderer.domElement.toDataURL('image/png'),exportGLB:async()=>new GLTFExporter().parseAsync(model,{binary:true}) as Promise<ArrayBuffer>};
}
