import type {MainModule,MjVFS} from '@mujoco/mujoco';
import {type RobotModel,exportMJCF} from './concept-model.js';

const runtimes=new WeakMap<MainModule,Map<string,{vfs:MjVFS;ready:Promise<void>}>>();
async function readAsset(path:string):Promise<Uint8Array>{
 if(new URL(import.meta.url).protocol==='file:'){
  const moduleName='node:fs/promises',fs=await import(moduleName);
  return new Uint8Array(await fs.readFile(new URL('../public/'+path,import.meta.url)));
 }
 const response=await fetch(new URL('./'+path,import.meta.url));if(!response.ok)throw Error(`Source collision asset ${path}: HTTP ${response.status}`);return new Uint8Array(await response.arrayBuffer());
}
/** Load the unmodified source collision meshes into a private MuJoCo VFS.
 * Visual meshes and physics meshes keep their separate source definitions. */
export function prepareSourcePhysics(mj:MainModule,model:RobotModel){
 if(!model.source?.collisionAssets.length)return Promise.resolve();
 let cache=runtimes.get(mj);if(!cache){cache=new Map();runtimes.set(mj,cache);}
 const key=model.source.id+':'+model.source.commit;let item=cache.get(key);
 if(!item){const vfs=new mj.MjVFS();const ready=Promise.all(model.source.collisionAssets.map(async asset=>vfs.addBuffer(asset.vfsPath,await readAsset(asset.path)))).then(()=>{}).catch(error=>{cache!.delete(key);vfs.delete();throw error;});item={vfs,ready};cache.set(key,item);}
 return item.ready;
}
export function compileRobotPhysics(mj:MainModule,model:RobotModel,xml=exportMJCF(model)){
 if(!model.source?.collisionAssets.length)return mj.MjModel.from_xml_string(xml);
 const item=runtimes.get(mj)?.get(model.source.id+':'+model.source.commit);if(!item)throw Error('Source collision assets have not been loaded');
 return mj.MjModel.from_xml_string(xml,item.vfs);
}
