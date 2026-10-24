import fs from 'node:fs/promises';
import path from 'node:path';

// Long articles keep reviewed chapters in separate files.
export async function readArticleSource(source) {
  const root=path.resolve('content');
  const read=async (name, parents=[]) => {
    const file=path.resolve(root,name);
    if (!file.startsWith(root+path.sep) || parents.includes(file)) throw Error(`Invalid chapter: ${name}`);
    const raw=await fs.readFile(file,'utf8');
    const matches=[...raw.matchAll(/\{\{chapter:([^}]+)\}\}/g)];
    let expanded=raw;
    for (const m of matches) {
      const chapter=await read(m[1],[...parents,file]);
      expanded=expanded.replace(m[0],()=>chapter);
    }
    return expanded;
  };
  return read(source);
}
