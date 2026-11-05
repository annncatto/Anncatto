/** CAD section data and a separately scoped, clamped segment bending study.
 * Iu = integral(v² dA), Iv = integral(u² dA), Iuv = integral(u v dA).
 * This is not a joint/robot eigenmodel or a shell/bolt/printed-layer model. */
export interface CADSection{s:number;area:number;Iu:number;Iv:number;Iuv:number;boundary:[number,number][];loops?:{outer:boolean;points:[number,number][]}[];valid:boolean}
export interface CADPart{id:string;name:string;link:string;material:string;E:number;strength:number;density:number;mass:number;volume:number;sections:CADSection[];source:string;materialSource:string;massNote:string;geometryNote:string}
export interface CADStudy{start:number;end:number;force:number;angle:number;E:number;strength:number;tipMass:number}
export const absReference='https://www.stratasys.com/contentassets/5460e85552cf40a097148d125e8be84f/mds_fdm_abs-m30_0925a.pdf?v=4aa6a3';
// Conversion stays at the import boundary. All calculations below use SI.
export function alohaCADParts(data:any):CADPart[]{return data.parts.map((p:any)=>({
 id:p.definition,name:p.link==='left_Upper_Arm'?'Alohamini · 上臂 ABS 支架':'Alohamini · 前臂 ABS 支架',link:p.link,material:'ABS',E:2e9,strength:32.5e6,density:p.mass_kg/(p.source_volume_mm3*1e-9),mass:p.mass_kg,volume:p.source_volume_mm3*1e-9,
 source:'local CAD / alohamini2pro_20261027',materialSource:absReference,massNote:'CAD 重建质量；截段质量按实体体积分配。',geometryNote:'本地原始 B-rep；ABS 由用户确认。E 与强度参考 ABS-M30 试样，打印方向和填充尚未标定。',
 sections:p.cross_section_profiles.map((s:any)=>{const loops=(s.boundary_faces??[]).flatMap((f:any)=>f.loops.map((l:any)=>({outer:l.outer,points:l.uv_mm.map((v:number[])=>[v[0]*.001,v[1]*.001] as [number,number])})));return{s:s.station_from_joint_mm*.001,area:s.area_mm2*1e-6,Iu:s.Iu_mm4*1e-12,Iv:s.Iv_mm4*1e-12,Iuv:s.Iuv_mm4*1e-12,boundary:loops.flatMap((l:any)=>l.points),loops,valid:s.valid&&s.has_material!==false&&s.area_mm2>0};})
}));}
export function rp1CADPart(p:any):CADPart{return{id:p.partNo,name:'RP1 · 右小腿 '+p.partNo,link:p.linkName,material:'6061-T6',E:70e9,strength:220e6,density:2700,mass:(p.cadVolumeM3??p.volumeM3??p.sourceVolumeM3??0)*2700,volume:p.cadVolumeM3??p.volumeM3??p.sourceVolumeM3??0,
 source:'https://github.com/Roboparty/rp1_hardware',materialSource:'https://www.alumeco.com/media/1p5lryc3/6061_sheet.pdf',massNote:'截段质量按 CAD 体积与 2700 kg/m³ 计算。',geometryNote:'官方 STEP 与工程图指定 6061-T6。此件为小腿的一半，另一半及连接件未合并；E、强度为可修改的材料初筛值。',
 sections:p.sections.map((s:any)=>({s:s.sM,area:s.areaM2,Iu:s.iuuM4,Iv:s.ivvM4,Iuv:s.iuvM4,boundary:s.boundaryUVm,valid:s.valid&&s.areaM2>0}))};}
type V2=[number,number];
const dot2=(a:V2,b:V2)=>a[0]*b[0]+a[1]*b[1];
function inverseAction(s:CADSection,v:V2,E:number):V2{const det=s.Iu*s.Iv-s.Iuv*s.Iuv;if(!(s.area>0&&s.Iu>0&&s.Iv>0&&det>0&&s.valid))throw Error('截段内存在空截面或无效截面');return[(s.Iu*v[0]-s.Iuv*v[1])/(det*E),(s.Iv*v[1]-s.Iuv*v[0])/(det*E)];}
function mix(a:CADSection,b:CADSection,t:number):CADSection{return{...a,s:a.s+(b.s-a.s)*t,area:a.area+(b.area-a.area)*t,Iu:a.Iu+(b.Iu-a.Iu)*t,Iv:a.Iv+(b.Iv-a.Iv)*t,Iuv:a.Iuv+(b.Iuv-a.Iuv)*t,valid:a.valid&&b.valid};}
export function defaultCADStudy(p:CADPart,force:number):CADStudy{
 // An explicit study segment, not an inferred physical mount. Keep clear of
 // bearing bosses; the UI exposes both section stations for review/editing.
 const count=p.sections.length,start=Math.floor((count-1)*.2),end=Math.ceil((count-1)*.8);
 return{start,end,force,angle:0,E:p.E,strength:p.strength,tipMass:0};
}
export function analyzeCADSegment(p:CADPart,c:CADStudy){
 if(!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<0||c.end>=p.sections.length||c.end<=c.start)throw Error('施力截面必须位于夹持截面之后');
 if(![c.force,c.angle,c.E,c.strength,c.tipMass,p.density].every(Number.isFinite)||c.force<0||c.E<=0||c.strength<=0||c.tipMass<0||p.density<=0)throw Error('请输入有效的载荷、材料与质量参数');
 const sections=p.sections.slice(c.start,c.end+1),first=sections[0]!,last=sections.at(-1)!,L=last.s-first.s;
 if(!(L>0))throw Error('截面位置应递增');
 const d:V2=[Math.cos(c.angle),Math.sin(c.angle)],w:V2[]=[[0,0],[0,0]],slope:V2[]=[[0,0],[0,0]],K=[0,0,0],M=[0,0,0];let mass=0,stress=0,worst=first;
 // Use one curvature polynomial for displacement, strain energy and modal
 // mass. Adaptive quarter-point checks control its error between CAD stations;
 // five-point Gauss quadrature integrates the polynomial energy/mass exactly
 // when A and the area moments vary linearly over the station interval.
 const tolerance=1e-6;let integrationSegments=0;
 const gauss:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[[.046910077030668,.118463442528095],[.230765344947158,.239314335249683],[.5,.284444444444444],[.769234655052842,.239314335249683],[.953089922969332,.118463442528095]];
 const curvature=(s:CADSection)=>[inverseAction(s,[last.s-s.s,0],c.E),inverseAction(s,[0,last.s-s.s],c.E)];
 function integrate(a:CADSection,b:CADSection,depth=0){
  const mid=mix(a,b,.5),k=[curvature(a),curvature(mid),curvature(b)],h=b.s-a.s;
  const A=k[0]!.map((v,j)=>v.map((x,axis)=>4*k[1]![j]![axis]!-3*x-k[2]![j]![axis]!) as V2),B=k[0]!.map((v,j)=>v.map((x,axis)=>2*x-4*k[1]![j]![axis]!+2*k[2]![j]![axis]!) as V2);
  const polynomial=(j:number,t:number):V2=>[0,1].map(axis=>k[0]![j]![axis]!+A[j]![axis]!*t+B[j]![axis]!*t*t) as V2;
  let error=0;
  for(const t of [.25,.75]){const exact=curvature(mix(a,b,t));for(let j=0;j<2;j++){const trial=polynomial(j,t),scale=Math.max(...k.map(values=>Math.hypot(...values[j]!)),Math.hypot(...exact[j]!),1e-30);error=Math.max(error,Math.hypot(trial[0]-exact[j]![0],trial[1]-exact[j]![1])/scale);}}
  if(error>tolerance){if(depth>=20)throw Error('截面变化过快，曲率积分尚未收敛');integrate(a,mid,depth+1);integrate(mid,b,depth+1);return;}
  if(++integrationSegments>32768)throw Error('截面积分尚未收敛，请缩小截段');
  for(const [t,weight] of gauss){
   const s=mix(a,b,t),shape=w.map((x,j)=>[0,1].map(axis=>x[axis]!+slope[j]![axis]!*h*t+h*h*(k[0]![j]![axis]!*t*t/2+A[j]![axis]!*t**3/6+B[j]![axis]!*t**4/12)) as V2),bend=[polynomial(0,t),polynomial(1,t)];
   mass+=h*weight*s.area*p.density;
   for(const [index,j,l] of [[0,0,0],[1,0,1],[2,1,1]]){
    const u=bend[j!]!,v=bend[l!]!;
    K[index!]+=h*weight*c.E*(s.Iv*u[0]*v[0]+s.Iuv*(u[0]*v[1]+u[1]*v[0])+s.Iu*u[1]*v[1]);
    M[index!]+=h*weight*s.area*p.density*dot2(shape[j!]!,shape[l!]!);
   }
  }
  for(let j=0;j<2;j++)for(let axis=0;axis<2;axis++){
   w[j]![axis]!+=slope[j]![axis]!*h+h*h*(k[0]![j]![axis]!+2*k[1]![j]![axis]!)/6;
   slope[j]![axis]!+=h*(k[0]![j]![axis]!+4*k[1]![j]![axis]!+k[2]![j]![axis]!)/6;
  }
 }
 for(let i=0;i<sections.length-1;i++){const a=sections[i]!,b=sections[i+1]!;if(!(b.s>a.s))throw Error('截面位置应递增');integrate(a,b);}

 for(const s of sections){const k=inverseAction(s,[d[0]*(last.s-s.s),d[1]*(last.s-s.s)],c.E);if(!s.boundary.length)throw Error('截面缺少真实边界，无法求外缘应力');const value=Math.max(...s.boundary.map(uv=>Math.abs(c.E*c.force*dot2(k,uv))));if(value>stress){stress=value;worst=s;}}
 for(const [index,j,l] of [[0,0,0],[1,0,1],[2,1,1]])M[index!]+=c.tipMass*dot2(w[j!]!,w[l!]!);
 const detK=K[0]!*K[2]!-K[1]!**2,detM=M[0]!*M[2]!-M[1]!**2,trace=K[0]!*M[2]!+K[2]!*M[0]!-2*K[1]!*M[1]!,disc=Math.max(0,trace*trace-4*detK*detM);
 const eigenvalue=2*detK/(trace+Math.sqrt(disc));
 const displacement:V2=[c.force*(w[0]![0]*d[0]+w[1]![0]*d[1]),c.force*(w[0]![1]*d[0]+w[1]![1]*d[1])];
 return{L,mass,stress,worst,integrationSegments,integrationTolerance:tolerance,displacement,deflection:Math.hypot(...displacement),frequency:detK>0&&detM>0?Math.sqrt(eigenvalue)/(2*Math.PI):NaN,compliance:dot2(d,[w[0]![0]*d[0]+w[1]![0]*d[1],w[0]![1]*d[0]+w[1]![1]*d[1]]),stiffness:K,modalMass:M};
}
