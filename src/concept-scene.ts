import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {type RobotModel,type Component,type Transform,type V3,type Q4,fk,add,rotate} from './concept-model.js';
import {materials} from './lightweight-mechanics.js';
export function createConceptScene(host:HTMLElement,onSelect:(id:string)=>void,onTarget:(target:V3)=>void){
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#f6f8f9');host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','Robot concept assembly');
 const scene=new T.Scene(),perspective=new T.PerspectiveCamera(36,1,.01,50),ortho=new T.OrthographicCamera(-1,1,1,-1,.01,50);let camera:T.PerspectiveCamera|T.OrthographicCamera=perspective;camera.up.set(0,0,1);ortho.up.set(0,0,1);perspective.position.set(1.3,-1.7,1.1);
 const controls=new OrbitControls<T.PerspectiveCamera|T.OrthographicCamera>(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.15;controls.maxDistance=8;controls.target.set(0,0,.4);
 scene.add(new T.HemisphereLight(0xffffff,0x9baab1,2.4));const sun=new T.DirectionalLight(0xffffff,3.2);sun.position.set(2,-3,4);scene.add(sun);
 const grid=new T.GridHelper(3,30,0xb6c8ce,0xe2e8eb);grid.rotation.x=Math.PI/2;grid.position.z=-.002;scene.add(grid);
 const modelGroup=new T.Group();scene.add(modelGroup);const marker=new T.Mesh(new T.SphereGeometry(.012,12,8),new T.MeshBasicMaterial({color:'#59a984'}));scene.add(marker);marker.visible=false;
 let model:RobotModel,poses:Record<string,Transform>,selected='',groups:Record<string,T.Group>={},meshes:T.Mesh[]=[],axesGroup=new T.Group(),wireOnly=false,showAxes=false,fitRadius=1,active=true,dirty=true;
 scene.add(axesGroup);const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0];
 const transform=new TransformControls(camera,renderer.domElement);transform.setSize(.72);transform.setSpace('world');scene.add(transform.getHelper());transform.attach(marker);transform.enabled=false;transform.getHelper().visible=false;
 transform.addEventListener('dragging-changed',e=>{controls.enabled=!e.value;});transform.addEventListener('objectChange',()=>{onTarget(marker.position.toArray() as V3);dirty=true;});
 const dispose=(g:T.Object3D)=>{g.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});g.clear();};
 function geometry(c:Component):T.BufferGeometry{
  if(c.shape==='box')return new T.BoxGeometry(...c.size);
  if(c.shape==='sphere')return new T.SphereGeometry(c.size[0],16,12);
  if(c.shape==='cylinder'){const g=new T.CylinderGeometry(c.size[0],c.size[0],c.size[1],20);g.rotateX(Math.PI/2);return g;}
  if(c.shape==='belt'){
   const r=c.size[0],L=c.size[2],s=new T.Shape();s.absarc(0,0,r,0,Math.PI,false);s.lineTo(-r,-L);s.absarc(0,-L,r,Math.PI,Math.PI*2,false);s.lineTo(r,0);
   const h=new T.Path(),ri=r-.003;h.absarc(0,0,ri,0,-Math.PI,true);h.lineTo(-ri,-L);h.absarc(0,-L,ri,Math.PI,0,true);h.lineTo(ri,0);s.holes.push(h);
   const g=new T.ExtrudeGeometry(s,{depth:c.size[1],bevelEnabled:false,curveSegments:12});g.translate(0,L/2,-c.size[1]/2);g.rotateX(Math.PI/2);return g;
  }
  const m=c.section!,s=new T.Shape(),w=m.section==='tube'?m.height:m.width,h=m.height,t=m.wall;
  if(m.section==='tube'){s.absarc(0,0,h/2,0,Math.PI*2,false);const p=new T.Path();p.absarc(0,0,h/2-t,0,Math.PI*2,true);s.holes.push(p);}else{s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();if(m.section!=='solid'){const p=new T.Path();p.moveTo(-w/2+t,-h/2+t);p.lineTo(-w/2+t,h/2-t);p.lineTo(w/2-t,h/2-t);p.lineTo(w/2-t,-h/2+t);p.closePath();s.holes.push(p);}}
  const g=new T.ExtrudeGeometry(s,{depth:c.size[2],bevelEnabled:false,curveSegments:18});g.translate(0,0,-c.size[2]/2);return g;
 }
 function build(next:RobotModel,reset=false){model=next;dispose(modelGroup);groups={};meshes=[];
  for(const n of model.nodes){const group=new T.Group();group.name=n.id;modelGroup.add(group);groups[n.id]=group;
   for(const c of n.components){const color=c.role==='member'?materials[c.material].color:c.role==='body'?'#c4d0d5':c.role==='motor'?'#435965':c.role==='tool'?'#4a7f94':c.role==='payload'?'#b4d6c3':c.role==='foot'?'#465864':c.role==='belt'?'#579eb8':'#8babb8';const mat=new T.MeshStandardMaterial({color,roughness:.78,metalness:.12,wireframe:wireOnly});const mesh=new T.Mesh(geometry(c),mat);mesh.position.set(...c.p);mesh.quaternion.set(c.q[1],c.q[2],c.q[3],c.q[0]);mesh.userData.id=n.id;mesh.userData.baseColor=color;mesh.userData.role=c.role;group.add(mesh);meshes.push(mesh);
    if(c.role==='motor'){
     const face=new T.Group();mesh.add(face);for(let k=0;k<6;k++){const bolt=new T.Mesh(new T.CylinderGeometry(.0023,.0023,.003,6),new T.MeshStandardMaterial({color:'#a9bec8',roughness:.6}));bolt.rotation.x=Math.PI/2;bolt.position.set(c.size[0]*.78*Math.cos(k*Math.PI/3),c.size[0]*.78*Math.sin(k*Math.PI/3),c.size[1]/2+.001);face.add(bolt);}
    }
   }
  }
  apply(fk(model,model.home));select(selected&&groups[selected]?selected:model.nodes.find(n=>n.member)!.id);if(reset)fit();dirty=true;
 }
 function apply(next:Record<string,Transform>){poses=next;for(const [id,p] of Object.entries(next)){const g=groups[id];if(g){g.position.set(...p.p);g.quaternion.set(p.q[1],p.q[2],p.q[3],p.q[0]);}}axes();dirty=true;}
 function axes(){dispose(axesGroup);if(!model)return;
  for(const n of model.nodes)if(n.joint&&(showAxes||n.id===selected)){const p=poses[n.id]!,a=rotate(p.q,n.joint.axis),arrow=new T.ArrowHelper(new T.Vector3(...a),new T.Vector3(...p.p),.095,n.id===selected?0x257fa5:0x9cbbbf,.018,.008);axesGroup.add(arrow);}
  const n=model.nodes.find(n=>n.id===selected);if(n?.member){const p=poses[n.id]!,tip=add(p.p,rotate(p.q,n.member.vector));axesGroup.add(new T.ArrowHelper(new T.Vector3(0,0,-1),new T.Vector3(...add(tip,[0,0,.1])),.095,0x529e83,.014,.007));}
 }
 function select(id:string){selected=id;for(const m of meshes){const mat=m.material as T.MeshStandardMaterial;mat.color.set(m.userData.id===id&&m.userData.role==='member'?'#71b2cb':m.userData.baseColor);mat.emissive.set(m.userData.id===id?'#163140':'#000000');mat.emissiveIntensity=.08;}axes();dirty=true;}
 function fit(){const box=new T.Box3().setFromObject(modelGroup),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());fitRadius=Math.max(.25,size.length()*.58);controls.target.copy(center);perspective.position.copy(center).add(new T.Vector3(1.15,-1.7,.9).normalize().multiplyScalar(fitRadius*3.1));ortho.position.copy(center).add(new T.Vector3(0,-fitRadius*3,0));resize();controls.update();dirty=true;}
 function view(name:string){camera=name==='perspective'?perspective:ortho;controls.object=camera;transform.camera=camera;if(camera===ortho){const p=controls.target.clone(),offset=name==='front'?new T.Vector3(0,-1,0):name==='side'?new T.Vector3(1,0,0):new T.Vector3(0,0,1);ortho.up.set(...(name==='top'?[0,1,0]:[0,0,1]) as V3);ortho.position.copy(p).add(offset.multiplyScalar(fitRadius*3));}controls.update();resize();dirty=true;}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);perspective.aspect=w/h;perspective.updateProjectionMatrix();const s=fitRadius*.95;ortho.left=-s*w/h;ortho.right=s*w/h;ortho.top=s;ortho.bottom=-s;ortho.updateProjectionMatrix();dirty=true;}
 renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});renderer.domElement.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-down[0]!,e.clientY-down[1]!)>4||transform.dragging)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(meshes,false)[0];if(hit)onSelect(hit.object.userData.id);});
 const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',()=>dirty=true);const io=new IntersectionObserver(entries=>{active=entries[0]!.isIntersecting;});io.observe(host);
 let raf=0;const tick=()=>{raf=requestAnimationFrame(tick);controls.update();if(active&&dirty){renderer.render(scene,camera);dirty=false;}};tick();
 return{build,pose:(q:Record<string,number>)=>apply(fk(model,q)),physical:apply,select,fit,view,axes:(on:boolean)=>{showAxes=on;axes();},wire:(on:boolean)=>{wireOnly=on;for(const m of meshes)(m.material as T.MeshStandardMaterial).wireframe=on;dirty=true;},target:(p:V3,on=true)=>{marker.position.set(...p);marker.visible=on;transform.enabled=on;transform.getHelper().visible=on;dirty=true;},hideTarget:()=>{marker.visible=false;transform.enabled=false;transform.getHelper().visible=false;dirty=true;},capture:()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},exportGLB:async()=>{const r=await new GLTFExporter().parseAsync(modelGroup,{binary:true});return r as ArrayBuffer;},project:(p:V3)=>{const v=new T.Vector3(...p).project(camera);return{x:(v.x+1)*host.clientWidth/2,y:(1-v.y)*host.clientHeight/2};},dispose:()=>{cancelAnimationFrame(raf);observer.disconnect();io.disconnect();controls.dispose();transform.dispose();dispose(modelGroup);dispose(axesGroup);renderer.dispose();}};
}
