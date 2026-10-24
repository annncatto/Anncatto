import {FONT} from './theme.js';
export interface TopologyFrame{iteration:number;compliance:number;volume:number;free_residual:number;density:string;benefit:string;benefit_p99:number;density_change:number;grey_fraction:number}
export interface TopologyRun{schema:'anncatto.simp.v1';mesh:[number,number];encoding:string;penalty:number;volume_fraction:number;filter_radius:number;frames:TopologyFrame[]}
export function decodeField(encoded:string,n:number){const raw=atob(encoded);if(raw.length!==n)throw Error('Invalid topology field');return Uint8Array.from(raw,c=>c.charCodeAt(0));}
const txt=(x:number,y:number,s:string,size=13,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#526b76">${s}</text>`;
export function densitySVG(run:TopologyRun,step:number,field:'density'|'benefit',lang:'en'|'zh'){
 const [nx,ny]=run.mesh,frame=run.frames[step]!,values=decodeField(frame[field],nx*ny),cw=560/nx,ch=168/ny,groups=Array.from({length:64},()=>''),en=lang==='en';
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){const v=values[x*ny+y]!,bucket=Math.round(v/255*63);if(!bucket)continue;groups[bucket]+=`M${(60+x*cw).toFixed(2)} ${(70+(ny-1-y)*ch).toFixed(2)}h${(cw+.02).toFixed(2)}v${(ch+.02).toFixed(2)}h-${(cw+.02).toFixed(2)}Z`;}
 const paths=groups.map((d,i)=>{const t=i/63,c=field==='density'?[Math.round(247-220*t),Math.round(251-161*t),Math.round(253-139*t)]:[Math.round(246-197*t),Math.round(251-133*t),Math.round(248-157*t)];return d?`<path d="${d}" fill="rgb(${c.join(',')})"/>`:'';}).join('');
 const label=field==='density'?(en?'Relative material density':'材料相对密度'):(en?'Filtered material sensitivity':'滤波后的材料增益敏度');
 return `<svg viewBox="0 0 680 320" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" style="font-family:${FONT}"><title>${label} · ${en?'iteration':'迭代'} ${step}</title><defs><marker id="topo-force" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#417895"/></marker></defs><rect x="60" y="70" width="560" height="168" fill="#f7fafb" stroke="#c5d5dc"/>${paths}<path d="M340 34V65" stroke="#417895" stroke-width="1.8" marker-end="url(#topo-force)"/>${txt(340,24,'F = 1',14)}<path d="M60 238L51 252H69ZM620 238L611 250H629Z" fill="#92b5a8" stroke="#588b7b"/><path d="M46 255H74M606 261H634" stroke="#75958a"/><circle cx="615" cy="255" r="3" fill="white" stroke="#75958a"/><circle cx="625" cy="255" r="3" fill="white" stroke="#75958a"/>${txt(60,284,en?'Pin · ux = uy = 0':'铰支承 · ux = uy = 0',13,'start')}${txt(620,284,en?'Roller · uy = 0':'滚动支承 · uy = 0',13,'end')}${txt(340,310,label+' · 0 → 1',13)}</svg>`;
}
export function convergenceSVG(run:TopologyRun,step:number,lang:'en'|'zh'){
 const X=(i:number)=>60+i/(run.frames.length-1)*560,Y=(v:number)=>165-v*130,c0=run.frames[0]!.compliance;let grid='';
 for(const v of [0,.5,1])grid+=`<path d="M60 ${Y(v)}H620" stroke="#e1eaed"/>`+txt(48,Y(v)+4,String(v),12,'end');
 for(const i of [0,20,40,60,80])grid+=txt(X(i),187,String(i),12);
 const d=run.frames.map((f,i)=>`${i?'L':'M'}${X(i).toFixed(2)} ${Y(f.compliance/c0).toFixed(2)}`).join(' '),f=run.frames[step]!,x=X(step),y=Y(f.compliance/c0);
 return `<svg viewBox="0 0 680 212" role="img" aria-label="${lang==='en'?'Compliance history':'柔度随迭代变化'}" xmlns="http://www.w3.org/2000/svg" style="font-family:${FONT}"><title>${lang==='en'?'Normalized compliance history':'归一化柔度收敛曲线'}</title>${grid}<path d="${d}" fill="none" stroke="#508ba5" stroke-width="2"/><path d="M${x} 31V165" stroke="#8eaba2" stroke-dasharray="4 4"/><circle cx="${x}" cy="${y}" r="4" fill="#37758f"/>${txt(60,18,lang==='en'?'Compliance / initial compliance':'柔度／初始柔度',13,'start')}${txt(620,206,lang==='en'?'Iteration':'迭代次数',12,'end')}</svg>`;
}
