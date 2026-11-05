// Tests compare the parsed model against pinned upstream URDF/STL bytes.
// Download fixtures for CI only; build.mjs excludes these from the public site.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const lock=JSON.parse(await fs.readFile(new URL('./source-robots.lock.json',import.meta.url),'utf8')).models['rp1-24'];
const root=new URL('../../public/models/rp1-24/',import.meta.url);
for(const file of lock.files){
 const target=new URL('source/'+file.path,root);
 let data=await fs.readFile(target).catch(()=>null);
 if(!data){
  const response=await fetch(`https://raw.githubusercontent.com/${lock.repository}/${lock.commit}/${file.path}`);
  if(!response.ok)throw Error(`${file.path}: HTTP ${response.status}`);
  data=Buffer.from(await response.arrayBuffer());
 }
 const sha=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
 if(data.length!==file.bytes||sha!==file.gitBlobSha)throw Error(`Fixture hash mismatch: ${file.path}`);
 await fs.mkdir(path.dirname(target.pathname),{recursive:true});
 await fs.writeFile(target,data);
 if(file.path===lock.urdf)await fs.writeFile(new URL('source.urdf',root),data);
}
console.log('Verified pinned RP1 test fixtures (excluded from public assets).');
