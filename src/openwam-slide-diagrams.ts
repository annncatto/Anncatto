const ink='#273b43',blue='#237ab2',green='#4b9c80';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function label(x:number,y:number,en:string,zh:string,size=19,color=ink){
 const lines=(s:string)=>s.split('|').map((l,i,a)=>`<tspan x="${x}" dy="${i?size*1.35:-(a.length-1)*size*.675}">${esc(l)}</tspan>`).join('');
 return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" lang="en">${lines(en)}</text><text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" lang="zh-CN">${lines(zh)}</text>`;
}
function group(content:string,step=0){return `<g${step?` data-step="${step}"`:''}>${content}</g>`;}
function box(x:number,y:number,w:number,h:number,en:string,zh:string,tone='blue',step=0){return group(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${tone==='green'?'#edf6f2':tone==='gray'?'#f1f4f4':'#edf5fa'}" stroke="${tone==='green'?'#a7cdbd':tone==='gray'?'#c4d2d4':'#a7cadd'}" stroke-width="1.5"/>${label(x+w/2,y+h/2,en,zh)}`,step);}
function arrow(id:string,d:string,step=0,color=blue){return group(`<path class="flow-line" d="${d}" fill="none" stroke="${color}" stroke-width="2.5" marker-end="url(#${id}-arrow)"/>`,step);}
function both(id:string,d:string){return arrow(id,d).replace('<path ',`<path marker-start="url(#${id}-arrow)" `);}
function wrap(id:string,title:string,content:string,height=430){return `<svg viewBox="0 0 1000 ${height}" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${title}</title><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>${content}</svg>`;}
export function renderOpenwamDiagram(name:string):string{
 const id='ow-'+name;
 if(name==='roadmap')return wrap(id,'OpenWAM: infrastructure, controlled study and model recipe',
  box(20,80,280,105,'OpenWAM-Infra|Composable experiments','OpenWAM-Infra|可组合的实验基础设施')+
  arrow(id,'M310 132H352',1)+box(365,80,270,105,'OpenWAM-Study|Controlled comparisons','OpenWAM-Study|受控设计实验','green',1)+
  arrow(id,'M645 132H687',2)+box(700,80,280,105,'OpenWAM-α|Pretrained WAM','OpenWAM-α|整合配方并预训练','blue',2)+
  group(label(160,240,'Encoder · backbone · mask','编码器 · 骨干 · 可见性',18)+label(500,240,'Priors · synergy · transfer','先验 · 协同 · 迁移',18)+label(840,240,'Simulation + real robots','仿真 + 真实机器人',18),2),310);
 if(name==='composition')return wrap(id,'World and action streams with a frozen visual encoder',
  box(20,42,200,76,'Observed frame','当前观测帧','gray')+box(20,175,200,76,'Future video|training target','未来视频|训练标签','gray')+
  box(275,42,190,76,'Frozen encoder E','冻结视觉编码器 E')+arrow(id,'M225 80H266')+arrow(id,'M225 213H250V95H266')+
  box(520,42,210,76,'World stream W','世界流 W')+arrow(id,'M470 80H510')+
  box(520,236,210,76,'Action stream A','动作流 A','green',1)+box(275,236,190,76,'Noisy actions','加噪动作','green',1)+arrow(id,'M470 274H510',1)+
  arrow(id,'M600 128V225',2,green)+arrow(id,'M650 225V128',2)+
  box(795,42,185,76,'Future latents','未来视觉潜变量','blue',3)+arrow(id,'M738 80H785',3)+
  box(795,236,185,76,'Action chunk','动作块','green',3)+arrow(id,'M738 274H785',3,green)+
  group(label(625,177,'Mask M','注意力可见性 M',18),2)+label(185,350,'Text + current state condition both streams','文本与当前状态共同提供条件',17)+
  label(774,350,'C(E, S, M) separates representation, structure and visibility','C(E, S, M) 分别配置表征、网络与可见性',17),405);
 if(name==='compression'){
  let frames='';for(let i=0;i<4;i++)frames+=`<rect x="${55+i*92}" y="65" width="75" height="75" rx="8" fill="#edf5fa" stroke="#a7cadd"/><circle cx="${72+i*92+i*12}" cy="102" r="9" fill="${blue}"/>`+label(92+i*92,164,`Frame ${i+1}`,`第 ${i+1} 帧`,16);
  return wrap(id,'Temporal averaging and learned temporal compression',frames+
   arrow(id,'M425 103H485')+box(500,65,195,75,'Temporal mean','时间平均','gray')+arrow(id,'M705 103H765')+box(780,65,190,75,'Same mean|for reversed order','顺序颠倒|均值相同','gray')+
   group(box(55,245,340,85,'Causal 3D video encoder','因果 3D 视频编码器')+arrow(id,'M410 288H485')+box(500,245,195,85,'Learned compression','学习时序压缩','green')+arrow(id,'M705 288H765')+box(780,245,190,85,'Compact latents|with temporal context','紧凑潜变量|包含时序上下文','green'),1)+
   group(label(510,384,'Token count N ≠ channels C ≠ Transformer width D','token 数 N ≠ 通道数 C ≠ Transformer 隐藏宽度 D',20),2));
 }
 if(name==='capacity')return wrap(id,'Three backbone families: shared, separate and understanding-conditioned',
  label(165,30,'Single backbone','单骨干',21)+box(45,70,240,80,'Video + action tokens','视频 + 动作 token')+box(45,210,240,90,'One Transformer','共享 Transformer','gray')+arrow(id,'M165 160V198')+
  group(label(500,30,'Dual backbone','双骨干',21)+box(380,70,240,80,'Video DiT','视频 DiT')+box(380,250,240,80,'Action DiT','动作 DiT','green')+arrow(id,'M477 162V238',0,green)+arrow(id,'M523 238V162'),1)+
  group(label(835,30,'Tri backbone','三骨干',21)+box(715,70,240,80,'Frozen VLM features','冻结 VLM 特征','gray')+box(715,250,240,80,'Video + action streams','视频流 + 动作流','green')+arrow(id,'M835 162V238')+label(835,197,'Read-only context','只读上下文',16),2)+
  group(label(500,390,'Separate parameters preserve specialized capacity; attention controls communication','独立参数保留专门容量；注意力控制流间通信',19),2));
 if(name==='masks'){
  let matrix='';const labels=['O','V','A'];for(let r=0;r<3;r++)for(let c=0;c<3;c++){
   const base=r===c||c===0;matrix+=`<rect data-mask-cell="${r},${c}" x="${596+c*100}" y="${85+r*85}" width="92" height="77" rx="8" fill="${base?'#d7e9e1':'#f1f4f4'}" stroke="#ccdadd"/>`+
    `<text data-mask-mark="${r},${c}" x="${642+c*100}" y="${130+r*85}" text-anchor="middle" fill="${base?green:'#8b9da2'}" font-size="28">${base?'✓':'—'}</text>`;
  }
  return wrap(id,'Query–key visibility and observed-frame access',
   box(25,55,300,65,'O · observed frame','O · 当前观测帧','gray')+box(25,167,300,65,'V · future world tokens','V · 未来世界 token')+box(25,279,300,65,'A · action tokens','A · 动作 token','green')+
   `<path data-mask-edge="av" d="M340 195C475 195 475 310 340 310" stroke="${green}" stroke-width="3" fill="none" marker-end="url(#${id}-arrow)"/><path data-mask-edge="va" d="M355 300C520 300 520 205 355 205" stroke="${blue}" stroke-width="3" fill="none" marker-end="url(#${id}-arrow)"/>`+
   label(750,32,'Keys · readable sources','Key · 被读取的来源',18)+labels.map((l,c)=>label(642+c*100,65,l,l,20)).join('')+labels.map((l,r)=>label(563,130+r*85,l,l,20)).join('')+matrix+
   label(750,386,'Rows: queries · columns: keys','行：Query · 列：Key',18),425);
 }
 if(name==='flow')return wrap(id,'Independent noise times and joint flow-matching supervision',
  box(20,45,200,75,'Future latent z','未来潜变量 z')+box(20,230,200,75,'Action target a','动作标签 a','green')+
  group(box(285,45,220,75,'Mix noise at tᵥ','在 tᵥ 混入噪声')+arrow(id,'M230 82H275')+box(285,230,220,75,'Mix noise at tₐ','在 tₐ 混入噪声','green')+arrow(id,'M230 267H275',0,green),1)+
  group(box(580,115,195,120,'World + action|networks','世界 + 动作|网络')+arrow(id,'M515 82H545V145H570')+arrow(id,'M515 267H545V205H570',0,green),2)+
  group(box(835,45,145,75,'v̂ᵥ ≈ z − εᵥ','v̂ᵥ ≈ z − εᵥ')+box(835,230,145,75,'v̂ₐ ≈ a − εₐ','v̂ₐ ≈ a − εₐ','green')+arrow(id,'M785 145H807V82H825')+arrow(id,'M785 205H807V267H825',0,green),3)+
  label(510,377,'Training learns a vector field; inference integrates it from noise to a sample','训练拟合向量场；推理从噪声出发积分，得到动作样本',19));
 if(name==='schedule'){
  let grid='';for(let i=0;i<=5;i++){const x=160+i*116,y=370-i*64;grid+=`<path d="M${x} 50V370M160 ${y}H740" stroke="#e4edee" stroke-width="1"/>`+label(x,397,(i/5).toFixed(1),(i/5).toFixed(1),15)+label(127,y,(i/5).toFixed(1),(i/5).toFixed(1),15);}
  return wrap(id,'World and action denoising clocks after the backbone warp',grid+`<path d="M160 50V370H740" stroke="${ink}" fill="none"/><path d="M160 370L740 50" stroke="#bdccce" stroke-dasharray="7 6" fill="none"/><path data-schedule-path d="M160 370L740 50" stroke="${blue}" stroke-width="3" fill="none"/><g data-schedule-gridpoints></g><circle data-schedule-dot cx="160" cy="370" r="8" fill="${green}" stroke="white" stroke-width="3"/>`+
   label(450,432,'World time tᵥ · noise → data','世界时间 tᵥ · 噪声 → 数据',18)+label(452,24,'Action time tₐ · noise → data','动作时间 tₐ · 噪声 → 数据',18)+
   box(790,100,180,90,'10 Euler steps','10 步 Euler 积分','gray')+label(880,235,'ρ = 5', 'ρ = 5',22)+label(880,295,'t = gρ(r)','t = gρ(r)',20),465);
 }
 if(name==='alpha')return wrap(id,'OpenWAM-alpha: separate widths, shared attention bridges',
  box(20,35,220,80,'Frozen Wan VAE','冻结 Wan VAE','gray')+box(20,220,220,80,'80-D noisy actions','80 维加噪动作','green',1)+
  box(320,35,310,80,'Wan2.2 TI2V · 5B|Hidden width 3072','Wan2.2 TI2V · 5B|隐藏宽度 3072')+arrow(id,'M250 75H310')+
  box(320,220,310,80,'Action DiT · 1B|Hidden width 1024','Action DiT · 1B|隐藏宽度 1024','green',1)+arrow(id,'M250 260H310',1,green)+
  group(box(725,110,250,110,'Shared attention|24 heads × 128','共享注意力|24 头 × 128')+both(id,'M640 75H675V135H715')+both(id,'M715 190H675V260H640')+label(500,165,'30 layer-wise bridges','30 层逐层桥接',20),2)+
  group(box(20,355,400,60,'Frozen umT5 text features · 4096','冻结 umT5 文本特征 · 4096','gray')+box(515,355,460,60,'Current state · separate time conditioning','当前状态 · 独立的时间条件','gray'),3),450);
 if(name==='slots'){
  let slots='';const fields=[['EEF xyz',3],['Rotation',6],['Gripper',1],['Hand',24]] as const;let x=35;
  for(const [i,[text,n]] of fields.entries()){const w=[85,110,90,155][i];slots+=`<rect x="${x}" y="80" width="${w-3}" height="62" rx="4" fill="${text==='Hand'?'#d6e8e0':'#dbeaf3'}"/>`+label(x+w/2,176,`${text}|${n}`,`${text}|${n}`,15);x+=w;}
  return wrap(id,'Unified 80-dimensional action space with validity masking',
   label(240,35,'One side: 34 slots','单侧：34 个槽位',20)+slots+
   box(535,80,185,62,'Other side · 34','另一侧 · 34','green',1)+box(755,80,210,62,'Reserved · 12','预留 · 12','gray',1)+
   group(box(35,235,210,70,'Native action labels|normalize','原始动作标签|归一化')+arrow(id,'M255 270H295')+box(305,235,180,70,'Scatter → 80 D','映射到 80 维')+arrow(id,'M495 270H535')+box(545,235,190,70,'Masked action loss','有效槽位损失','green')+label(866,270,'Training targets','训练标签',18),2)+
   group(label(150,390,'Generated outputs','生成输出',18)+box(305,355,260,70,'Generated 80-D samples','生成的 80 维样本','green')+arrow(id,'M575 390H645')+box(655,355,310,70,'Gather + denormalize','取回并反归一化','green'),2),455);
 }
 throw new Error(`Unknown OpenWAM slide diagram: ${name}`);
}
