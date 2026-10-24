import {type RobotModel,type Component,type Transform,type V3,fk,add,rotate,qm,sub,norm} from './concept-model.js';
import type {Language} from './i18n.js';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
export function componentWire(c:Component,t:Transform){const p=add(t.p,rotate(t.q,c.p)),q=qm(t.q,c.q),points:V3[]=[],edges:[number,number][]=[];
 const world=(v:V3)=>add(p,rotate(q,v));
 if(c.shape==='box'||c.shape==='member'||c.shape==='belt'){
  const size=c.shape==='member'?[c.section!.section==='tube'?c.section!.height:c.section!.width,c.section!.height,c.size[2]]:c.shape==='belt'?[2*c.size[0],c.size[1],c.size[2]+2*c.size[0]]:c.size;
  for(let k=0;k<8;k++)points.push(world([(k&1?1:-1)*size[0]!/2,(k&2?1:-1)*size[1]!/2,(k&4?1:-1)*size[2]!/2]));
  for(let k=0;k<8;k++)for(const bit of [1,2,4])if(!(k&bit))edges.push([k,k|bit]);
 }else{const r=c.size[0],h=c.shape==='sphere'?0:c.size[1]/2;for(const z of [-h,h])for(let i=0;i<16;i++)points.push(world([r*Math.cos(i*Math.PI/8),r*Math.sin(i*Math.PI/8),z]));for(let i=0;i<16;i++){edges.push([i,(i+1)%16],[i+16,(i+1)%16+16]);if(i%4===0)edges.push([i,i+16]);}}
 return{points,edges};
}
export function drawingSVG(model:RobotModel,q:Record<string,number>,selected:string,lang:Language='en',part=false){
 const poses=fk(model,q),nodes=part?model.nodes.filter(n=>n.id===selected):model.nodes,wire=nodes.flatMap(n=>n.components.map(c=>({...componentWire(c,poses[n.id]!),id:n.id}))),all=wire.flatMap(w=>w.points),min=[0,1,2].map(k=>Math.min(...all.map(p=>p[k]!))),max=[0,1,2].map(k=>Math.max(...all.map(p=>p[k]!))),tr=(en:string,zh:string)=>lang==='en'?en:zh;
 const views=[{a:0,b:2,x:20,name:tr('FRONT · XZ','主视 · XZ')},{a:1,b:2,x:420,name:tr('SIDE · YZ','侧视 · YZ')},{a:0,b:1,x:820,name:tr('TOP · XY','俯视 · XY')}];let out='';
 for(const v of views){const spanA=max[v.a]!-min[v.a]!,spanB=max[v.b]!-min[v.b]!,scale=Math.min(330/Math.max(.08,spanA),225/Math.max(.08,spanB)),cx=v.x+190,cy=160,px=(p:V3)=>cx+(p[v.a]!-(min[v.a]!+max[v.a]!)/2)*scale,py=(p:V3)=>cy-(p[v.b]!-(min[v.b]!+max[v.b]!)/2)*scale;
  out+=`<text x="${v.x+12}" y="20" fill="#59717b" font-size="13">${v.name}</text>`;
  for(const w of wire)out+=`<path d="${w.edges.map(([a,b])=>`M${px(w.points[a]!).toFixed(2)} ${py(w.points[a]!).toFixed(2)}L${px(w.points[b]!).toFixed(2)} ${py(w.points[b]!).toFixed(2)}`).join('')}" stroke="${w.id===selected?'#267da3':'#8599a0'}" stroke-width="${w.id===selected?1.4:.65}" fill="none"/>`;
  const x1=cx-spanA*scale/2,x2=cx+spanA*scale/2,y=299;out+=`<path d="M${x1} 284V307M${x2} 284V307M${x1} ${y}H${x2}" stroke="#9cabb1" stroke-width=".7"/><text x="${cx}" y="323" text-anchor="middle" font-size="13" fill="#4c6570">${(spanA*1000).toFixed(1)} mm</text>`;
 }
 const node=model.nodes.find(n=>n.id===selected)!,m=node.member;
 out+=`<text x="26" y="357" font-size="13" fill="#3a5867">${esc(selected)}${m?` · L ${ (m.length*1000).toFixed(1)} · ${tr('cut','下料')} ${(m.cutLength*1000).toFixed(1)} · ${m.width*1000} × ${m.height*1000} × ${m.wall*1000} mm`:''}</text><text x="1190" y="357" text-anchor="end" font-size="12" fill="#85969d">${tr('ORTHOGRAPHIC · mm','正投影 · mm')} · ${model.fingerprint}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1220 380" role="img" aria-label="${tr('Dimensioned orthographic assembly views','带尺寸的装配三视图')}" style="font-family:'IBM Plex Sans','Noto Sans SC',sans-serif;background:white"><rect width="1220" height="380" fill="white"/>${out}</svg>`;
}
export function exportDXF(model:RobotModel,q:Record<string,number>){const poses=fk(model,q),lines=['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES'];for(const n of model.nodes)for(const c of n.components){const w=componentWire(c,poses[n.id]!);for(const [a,b] of w.edges){const p=w.points[a]!,r=w.points[b]!;lines.push('0','LINE','8',c.role==='member'?'MEMBERS':'ASSEMBLY','10',String(p[0]*1000),'20',String(p[2]*1000),'30','0','11',String(r[0]*1000),'21',String(r[2]*1000),'31','0');}}lines.push('0','ENDSEC','0','EOF');return lines.join('\n')+'\n';}
