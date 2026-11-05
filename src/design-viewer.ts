import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fk, rotate, type Component, type RobotModel, type Transform, type V3} from './concept-model.js';
import {armCirclePoint, groundFrame, type MotionFrame} from './design-motion.js';
import type {DynamicsFrame} from './design-dynamics.js';
import {designPalette as palette, displayComponentColor} from './design-palette.js';

export type DesignView = 'spatial' | 'front' | 'side';

function componentGeometry(c: Component): T.BufferGeometry {
  if(c.shape==='mesh')return importedMeshes.get(c.mesh!)!.clone();
  if (c.shape === 'box') return new T.BoxGeometry(...c.size);
  if (c.shape === 'sphere') return new T.SphereGeometry(c.size[0], 24, 16);
  if (c.shape === 'cylinder') {
    const geometry = new T.CylinderGeometry(c.size[0], c.size[0], c.size[1], 32);
    geometry.rotateX(Math.PI / 2); return geometry;
  }
  if (c.shape === 'belt') {
    // Transmission path, with its actual centreline and axial offset.
    return new T.BoxGeometry(.008, c.size[1], c.size[2]);
  }
  const m = c.section!, shape = new T.Shape();
  const w = m.section === 'tube' ? m.height : m.width, h = m.height, t = m.wall;
  if (m.section === 'tube') {
    shape.absarc(0, 0, h / 2, 0, Math.PI * 2, false);
    const hole = new T.Path(); hole.absarc(0, 0, h / 2 - t, 0, Math.PI * 2, true); shape.holes.push(hole);
  } else {
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
    if (m.section !== 'solid') {
      const hole = new T.Path(); hole.moveTo(-w / 2 + t, -h / 2 + t); hole.lineTo(-w / 2 + t, h / 2 - t);
      hole.lineTo(w / 2 - t, h / 2 - t); hole.lineTo(w / 2 - t, -h / 2 + t); hole.closePath(); shape.holes.push(hole);
    }
  }
  const geometry = new T.ExtrudeGeometry(shape, {depth:c.size[2], bevelEnabled:false, curveSegments:32});
  geometry.translate(0, 0, -c.size[2] / 2); return geometry;
}
const importedMeshes = new Map<string, T.BufferGeometry>();
const importedLinkGroups = new Map<string, T.Object3D>();
const meshLoads = new Map<string, Promise<void>>();

/** Source GLBs contain link-local groups, including each original visual frame. */
export function prepareDesignMeshes(model: RobotModel): Promise<void> {
  const required = model.nodes.flatMap(node => node.components.filter(c => c.visible !== false && c.shape === 'mesh').map(c => c.mesh!));
  if (!required.length) return Promise.resolve();
  const source = model.source;
  const url = new URL(`./${source?.meshAsset ?? 'models/alohamini-left/arm.glb'}`, import.meta.url);
  if (source) url.searchParams.set('source', source.commit);
  const key = url.href;
  let ready = meshLoads.get(key);
  if (!ready) {
    ready = new GLTFLoader().loadAsync(key).then(gltf => {
      if (source) {
        const groups = new Map(gltf.scene.children.map(group => [`${source.id}/${group.name}`, group]));
        for (const name of required) if (!groups.has(name)) throw new Error(`Source GLB is missing link group: ${name}`);
        for (const [name, group] of groups) importedLinkGroups.set(name, group);
      } else {
        gltf.scene.traverse(object => {
          if (object instanceof T.Mesh) {
            const geometry = object.geometry;
            geometry.computeVertexNormals(); importedMeshes.set(object.name, geometry);
          }
        });
      }
    }).catch(error => {meshLoads.delete(key); throw error;});
    meshLoads.set(key, ready);
  }
  return ready;
}

function cloneSourceVisual(name: string, id: string, role: Component['role']): T.Object3D {
  const source = importedLinkGroups.get(name);
  if (!source) throw new Error(`Source visuals are not ready: ${name}`);
  const visual = source.clone(true);
  visual.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    // Scene rebuilds dispose their own resources. Never dispose or recolor the
    // cached source geometry/materials shared by future model selections.
    object.geometry = object.geometry.clone();
    const cloneMaterial = (original: T.Material) => {
      const material = original.clone();
      if (material instanceof T.MeshStandardMaterial) {
        material.userData.sourceEmissive = material.emissive.clone();
        material.userData.sourceEmissiveIntensity = material.emissiveIntensity;
      }
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
    object.castShadow = object.receiveShadow = true;
    object.userData = {...object.userData, id, role, sourceLink: true};
  });
  return visual;
}

/** Orthographic, depth-tested geometry. Camera bounds are fixed for a design. */
export function createDesignViewer(host: HTMLElement, onSelect: (id: string) => void) {
  const renderer = new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#f7f7f7');renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Robot structure and ground contacts');
  renderer.domElement.tabIndex = 0; host.prepend(renderer.domElement);
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, .01, 80);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minZoom = .45; controls.maxZoom = 6;
  scene.add(new T.HemisphereLight(0xffffff, 0xa6adbb, 1.9));
  const light = new T.DirectionalLight(0xffffff, 2.3); light.position.set(2, -3, 5);
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = light.shadow.camera.bottom = -3;
  light.shadow.camera.right = light.shadow.camera.top = 3; light.shadow.bias = -.0002; scene.add(light);
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({opacity:.18}));
  floor.position.z = -.003; floor.receiveShadow = true; scene.add(floor);
  const grid = new T.GridHelper(8, 80, 0xa6b2c7, 0xd8dee8); grid.rotation.x = Math.PI / 2; grid.position.z = -.002; scene.add(grid);
  scene.add(new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(-.30,-.40,.012),.35,0x2457df,.045,.020));
  const assembly = new T.Group(), axis = new T.Group(), support = new T.Group(); scene.add(assembly, axis, support);
  const targetPath=new T.LineLoop(new T.BufferGeometry(),new T.LineDashedMaterial({color:'#5d8dfd',dashSize:.008,gapSize:.005}));scene.add(targetPath);
  const reactions=new T.Group(),zmp=new T.Mesh(new T.SphereGeometry(.009,16,10),new T.MeshBasicMaterial({color:'#2457df'}));scene.add(reactions,zmp);zmp.visible=false;
  const front=new T.Mesh(new T.BoxGeometry(.004,.09,.035),new T.MeshStandardMaterial({color:'#2457df'}));scene.add(front);
  const axisArrow = new T.ArrowHelper(new T.Vector3(0, 0, 1), new T.Vector3(), .105, 0xf7883e, .025, .012);
  (axisArrow.line.material as T.Material).depthTest = false; (axisArrow.cone.material as T.Material).depthTest = false;
  axisArrow.renderOrder = 2; axis.add(axisArrow);
  const com = new T.Mesh(new T.SphereGeometry(.012, 20, 12), new T.MeshBasicMaterial({color:palette.red}));
  const projection = new T.Mesh(new T.RingGeometry(.014, .020, 28), new T.MeshBasicMaterial({color:palette.red, side:T.DoubleSide}));
  const comLine = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({color:palette.red, dashSize:.018, gapSize:.012}));
  (com.material as T.Material).depthTest = false; com.renderOrder = 10;
  (comLine.material as T.Material).depthTest = false; comLine.renderOrder = 9;
  const polygon = new T.LineLoop(new T.BufferGeometry(), new T.LineBasicMaterial({color:'#4e7b23'}));
  const patch = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({color:'#4e7b23', transparent:true, opacity:.1, side:T.DoubleSide, depthWrite:false}));
  const contacts = Array.from({length:4}, () => new T.Mesh(new T.SphereGeometry(.009, 16, 10), new T.MeshBasicMaterial({color:'#4e7b23'})));
  support.add(com, projection, comLine, polygon, patch, ...contacts);
  let model: RobotModel, current: MotionFrame | undefined, groups: Record<string, T.Group> = {}, meshes: T.Mesh[] = [];
  let member = '', driver = '', view: DesignView = 'spatial', travel = 0, visible = true, dirty = true;
  let bounds = new T.Box3(), fitPoints: T.Vector3[] = [], supportVisible = true, raf = 0, paintNextFrame = false;
  const point = new T.Vector2(), ray = new T.Raycaster(); let down: [number, number] = [0, 0];
  const dispose = (group: T.Object3D) => {
    group.traverse(object => {if (object instanceof T.Mesh || object instanceof T.Line) {
      object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose());
    }}); group.clear();
  };
  function apply(poses: Record<string, Transform>) {
    for (const [id, pose] of Object.entries(poses)) {
      const group = groups[id]; if (!group) continue;
      group.position.set(...pose.p); group.quaternion.set(pose.q[1], pose.q[2], pose.q[3], pose.q[0]);
    }
    assembly.updateMatrixWorld(true); dirty = true;
  }
  function collectFitPoints() {
    for (const mesh of meshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) fitPoints.push(new T.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
    }
  }
  function setTravel(next: number) {
    travel = next; // All geometry is in a fixed ground frame; the camera stays still.
  }
  function updateAxis(poses: Record<string, Transform>) {
    const node = model.nodes.find(n => n.id === driver), pose = node && poses[node.id];
    axisArrow.visible = !!(node?.joint && pose); if (!node?.joint || !pose) return;
    const direction = rotate(pose.q, node.joint.axis);
    axisArrow.position.set(...pose.p); axisArrow.setDirection(new T.Vector3(...direction));
  }
  function updateSupport(frame: MotionFrame) {
    support.visible = supportVisible; if (!supportVisible) return;
    com.position.set(...frame.com); projection.position.set(frame.com[0], frame.com[1], .003);
    comLine.geometry.dispose(); comLine.geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(...frame.com), new T.Vector3(frame.com[0], frame.com[1], .003)]); comLine.computeLineDistances();
    contacts.forEach((dot, i) => {dot.visible = i < frame.contacts.length; if (dot.visible) dot.position.set(frame.contacts[i]![0], frame.contacts[i]![1], .007);});
    const hull = frame.supportPolygon;
    polygon.visible = patch.visible = hull.length >= 3;
    if (hull.length >= 3) {
      polygon.geometry.dispose(); polygon.geometry = new T.BufferGeometry().setFromPoints(hull.map(p => new T.Vector3(p[0], p[1], .004)));
      const shape = new T.Shape(hull.map(p => new T.Vector2(p[0], p[1]))); patch.geometry.dispose(); patch.geometry = new T.ShapeGeometry(shape); patch.position.z = .002;
    }
  }
  function frame(next: MotionFrame, showSupport = true) {
    current = next; supportVisible = showSupport; const world = groundFrame(next);
    setTravel(next.travel); apply(world.poses); updateAxis(world.poses); updateSupport(world);
    const root=world.poses.base;front.visible=!model.source&&model.design.robot==='quadruped';if(root&&front.visible){const p=rotate(root.q,[model.design.bodyLength/2+.003,0,0]);front.position.set(root.p[0]+p[0],root.p[1]+p[1],root.p[2]+p[2]);front.quaternion.set(root.q[1],root.q[2],root.q[3],root.q[0]);}
    if(paintNextFrame){renderer.render(scene,camera);dirty=false;paintNextFrame=false;}
  }
  function loads(data?:DynamicsFrame){
    dispose(reactions);zmp.visible=!!data?.zmp&&supportVisible;
    if(data?.zmp)zmp.position.set(data.zmp[0],data.zmp[1],.012);
    for(const c of data?.forces??[]){const vector=new T.Vector3(...c.force),length=vector.length();if(length<.01)continue;const arrow=new T.ArrowHelper(vector.normalize(),new T.Vector3(...c.point),Math.min(.24,.3*length/(model.mass*9.80665)),0x2457df,.025,.012);reactions.add(arrow);}
    reactions.visible=supportVisible;dirty=true;
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (!bounds.isEmpty()) {
      const centre = controls.target.clone();
      const inverse = camera.quaternion.clone().invert();
      let x = .1, y = .1;
      for (const point of fitPoints) {
        const p = point.clone().sub(centre).applyQuaternion(inverse); x = Math.max(x, Math.abs(p.x)); y = Math.max(y, Math.abs(p.y));
      }
      const half = Math.max(y, x / (w / h)) * 1.08;
      camera.left = -half * w / h; camera.right = half * w / h; camera.top = half; camera.bottom = -half;
      camera.updateProjectionMatrix();
    }
    dirty = true;
  }
  function fit() {
    if (bounds.isEmpty()) return;
    const centre = bounds.getCenter(new T.Vector3());
    const direction = view === 'front' ? new T.Vector3(1, 0, 0) : view === 'side' ? new T.Vector3(0, 1, 0) : new T.Vector3(1.6, 2, 1.05).normalize();
    controls.target.copy(centre); camera.position.copy(centre).add(direction.multiplyScalar(4)); camera.zoom = 1;
    camera.lookAt(centre);
    const inverse = camera.quaternion.clone().invert(), projected = new T.Box3(), modelCentre = bounds.getCenter(new T.Vector3());
    for (const point of fitPoints) projected.expandByPoint(point.clone().sub(modelCentre).applyQuaternion(inverse));
    if (!projected.isEmpty()) {
      const offset = projected.getCenter(new T.Vector3()); offset.z = 0; offset.applyQuaternion(camera.quaternion);
      camera.position.add(offset); controls.target.add(offset);
    }
    controls.update(); resize();
  }
  function select(id: string, axisId = id, force = false) {
    if (!force && member === id && driver === axisId) return;
    member = id; driver = axisId;
    for (const mesh of meshes) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(material instanceof T.MeshStandardMaterial)) continue;
        if (mesh.userData.sourceLink) {
          material.emissive.copy(material.userData.sourceEmissive as T.Color);
          material.emissiveIntensity = material.userData.sourceEmissiveIntensity as number;
          if (mesh.userData.id === member) {
            material.emissive.add(new T.Color(palette.selected).multiplyScalar(.18));
            material.emissiveIntensity = Math.max(.6, material.emissiveIntensity);
          }
        } else {
          const selected = mesh.userData.id === member && (mesh.userData.role === 'member' || model.design.armModel === 'aloha' && mesh.userData.role !== 'payload');
          material.color.set(selected ? palette.selected : mesh.userData.baseColor);
        }
      }
    }
    if (current) updateAxis(groundFrame(current).poses); dirty = true;
  }
  function build(next: RobotModel, reset = false) {
    const old = model; model = next; current = undefined; paintNextFrame = true; setTravel(0); dispose(assembly); groups = {}; meshes = [];
    front.visible = !model.source && model.design.robot === 'quadruped';
    targetPath.visible=model.design.robot==='arm';if(targetPath.visible){targetPath.geometry.dispose();targetPath.geometry=new T.BufferGeometry().setFromPoints(Array.from({length:128},(_,i)=>new T.Vector3(...armCirclePoint(model,i/128))));targetPath.computeLineDistances();}
    for (const node of model.nodes) {
      const group = new T.Group(); group.name = node.id; groups[node.id] = group; assembly.add(group);
      for (const c of node.components) {
        if (c.visible === false) continue;
        if (c.role === 'payload' && c.mass < .00001) continue;
        if (model.source && c.shape === 'mesh') {
          const visual = cloneSourceVisual(c.mesh!, node.id, c.role);
          const placement = new T.Group();
          placement.position.set(...c.p); placement.quaternion.set(c.q[1], c.q[2], c.q[3], c.q[0]);
          placement.add(visual); group.add(placement);
          visual.traverse(object => {if (object instanceof T.Mesh) meshes.push(object);});
          continue;
        }
        const color = displayComponentColor(c, model.design.armModel === 'aloha');
        const geometry = componentGeometry(c), material = new T.MeshStandardMaterial({color, roughness:.83, metalness:.03});
        const mesh = new T.Mesh(geometry, material); mesh.position.set(...c.p); mesh.quaternion.set(c.q[1], c.q[2], c.q[3], c.q[0]);
        mesh.castShadow = mesh.receiveShadow = true; mesh.userData = {id:node.id, role:c.role, baseColor:color};
        if (c.shape!=='mesh'&&['body', 'member', 'payload'].includes(c.role)) mesh.add(new T.LineSegments(new T.EdgesGeometry(geometry, 25), new T.LineBasicMaterial({color:palette.muted, transparent:true, opacity:.24})));
        group.add(mesh); meshes.push(mesh);
      }
    }
    apply(fk(model, model.home)); fitPoints = []; collectFitPoints(); bounds = new T.Box3().setFromObject(assembly).expandByScalar(.018); select(member, driver, true);
    if (reset || !old) fit(); else resize();
  }
  /** Compute the envelope once; animation never refits or recentres the camera. */
  function envelope(frames: MotionFrame[], reset = false) {
    const box = new T.Box3(); fitPoints = []; apply(fk(model, model.home)); collectFitPoints(); box.union(new T.Box3().setFromObject(assembly));
    for (const f of frames) {apply(groundFrame(f).poses); collectFitPoints(); box.union(new T.Box3().setFromObject(assembly));}
    bounds = box.expandByScalar(.018); if (reset) fit(); else resize();
    if (current) frame(current, supportVisible); else apply(fk(model, model.home));
  }
  renderer.domElement.addEventListener('pointerdown', event => {down = [event.clientX, event.clientY];});
  renderer.domElement.addEventListener('pointerup', event => {
    if (Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect(); point.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(point, camera); const hit = ray.intersectObjects(meshes, false)[0]; if (hit) onSelect(hit.object.userData.id);
  });
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(entries => {visible = entries[0]!.isIntersecting;}); visibilityObserver.observe(host);
  controls.addEventListener('change', () => {dirty = true;});
  const tick = () => {raf = requestAnimationFrame(tick); controls.update(); if (visible && dirty) {renderer.render(scene, camera); dirty = false;}}; tick();
  return {build, select, frame, loads, envelope, fit,
    view: (next: DesignView) => {view = next; controls.enableRotate = view === 'spatial'; fit();},
    capture: () => {renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');},
    exportGLB: async () => await new GLTFExporter().parseAsync(assembly, {binary:true}) as ArrayBuffer,
    project: (p: V3) => {const v = new T.Vector3(...p).project(camera); return {x:(v.x + 1) * host.clientWidth / 2, y:(1 - v.y) * host.clientHeight / 2};},
    dispose: () => {cancelAnimationFrame(raf); controls.dispose(); resizeObserver.disconnect(); visibilityObserver.disconnect(); dispose(assembly); dispose(axis); renderer.dispose();},
  };
}
