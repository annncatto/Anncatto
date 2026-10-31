const ink='#273b43', blue='#237ab2', green='#4b9c80';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function text(x:number,y:number,en:string,zh:string,size=22,color=ink){
 const lines=(s:string)=>s.split('|').map((l,i,a)=>`<tspan x="${x}" dy="${i?size*1.3:-(a.length-1)*size*.65}">${esc(l)}</tspan>`).join('');
 return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" lang="en">${lines(en)}</text><text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" lang="zh-CN">${lines(zh)}</text>`;
}
function group(content:string,step=0){return `<g${step?` data-step="${step}"`:''}>${content}</g>`;}
function box(x:number,y:number,w:number,h:number,en:string,zh:string,tone='blue',step=0){
 return group(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${tone==='green'?'#edf6f2':tone==='gray'?'#f1f4f4':'#edf5fa'}" stroke="${tone==='green'?'#a7cdbd':tone==='gray'?'#c4d2d4':'#a7cadd'}" stroke-width="1.5"/>${text(x+w/2,y+h/2,en,zh)}`,step);
}
function arrow(id:string,d:string,step=0,color=blue){return group(`<path class="flow-line" d="${d}" fill="none" stroke="${color}" stroke-width="2.5" marker-end="url(#${id}-arrow)"/>`,step);}
function frame(id:string,title:string,content:string,height=250){return `<svg viewBox="0 0 1260 ${height}" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${title}</title><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>${content}</svg>`;}
export function renderOpenwamDiagram(name:string):string{
 const id='ow-'+name;
 if(name==='contributions')return frame(id,'OpenWAM: three parallel contributions and the research workflow',
  text(210,22,'OpenWAM-Infra','OpenWAM-Infra',26)+text(630,22,'OpenWAM-Study','OpenWAM-Study',26)+text(1050,22,'OpenWAM-α','OpenWAM-α',26)+
  box(10,55,390,82,'Encoder · backbones · mask|One train / deploy / eval stack','编码器 · 骨干 · 掩码|统一训练／部署／评测','gray')+
  box(435,55,390,82,'Priors · interaction · transfer|Controlled design studies','先验 · 交互 · 迁移|受控设计研究')+
  box(860,55,390,82,'Video DiT + ActionDiT|Human–robot pretraining','视频 DiT + ActionDiT|人类—机器人预训练','green')+
  box(10,180,360,55,'Composable experiments','可组合实验配置','gray')+arrow(id,'M380 207H425')+
  box(435,180,360,55,'Evidence-backed recipe','实验支持的设计原则')+arrow(id,'M805 207H850')+
  box(860,180,390,55,'Pretrained model + evaluation','预训练模型与验证','green'),245);
 if(name==='training-contract')return renderOpenwamDiagram('flow-v2').replace(/ data-step="\d+"/g,'');
 if(name==='alpha-detail')return frame(id,'OpenWAM-alpha attention bridge with stream-owned parameters and context paths',
  box(965,5,285,60,'Text + current-state token c','文本 + 当前状态 token c','gray')+
  box(10,115,235,90,'World states|Nᵥ × 3072','世界流状态|Nᵥ × 3072')+box(10,310,235,90,'Action states|H × 1024','动作流状态|H × 1024','green')+
  box(305,115,195,90,'Own Qᵥ, Kᵥ, Vᵥ','独立 Qᵥ, Kᵥ, Vᵥ')+box(305,310,195,90,'Own Qₐ, Kₐ, Vₐ','独立 Qₐ, Kₐ, Vₐ','green')+
  arrow(id,'M255 160H295')+arrow(id,'M255 355H295',0,green)+
  box(580,175,300,170,'Concatenate token axis|24 heads × 128|Masked joint attention','沿 token 轴拼接|24 头 × 128 维|掩码联合注意力','gray')+
  arrow(id,'M510 160H545V215H570')+arrow(id,'M510 355H545V305H570',0,green)+
  box(965,110,285,110,'Own output projection|Cross-attention(c) + FFN','独立输出投影|交叉注意力(c) + 前馈网络')+
  box(965,305,285,110,'Own output projection|Cross-attention(c) + FFN','独立输出投影|交叉注意力(c) + 前馈网络','green')+
  arrow(id,'M890 215H925V165H955')+arrow(id,'M890 305H925V360H955',0,green)+
  arrow(id,'M1107 75V100')+arrow(id,'M1240 35H1257V360H1250',0,green)+
  text(730,385,'Split by token index','按 token 位置拆回两流',22)+
  text(630,465,'AdaLN: separate noise times tᵥ and tₐ · observed tokens pinned at tᵥ = 1','AdaLN：各自的噪声时间 tᵥ、tₐ · 观测 token 固定在 tᵥ = 1',22),490);
 if(name==='flow-v2')return frame(id,'Joint flow training with independently noised paired targets',
  box(10,5,245,70,'Future latent target z','未来潜变量标签 z')+box(10,120,245,70,'Action target a','动作标签 a','green')+
  box(330,5,240,70,'Noise at tᵥ','在 tᵥ 加噪')+box(330,120,240,70,'Noise at tₐ','在 tₐ 加噪','green')+arrow(id,'M265 40H320')+arrow(id,'M265 155H320',0,green)+
  box(670,45,260,105,'Joint network|Given clean O and c','联合网络|以干净 O 与 c 为条件','gray',1)+arrow(id,'M580 40H620V80H660',1)+arrow(id,'M580 155H620V120H660',1,green)+
  box(1020,5,230,70,'World velocity v̂ᵥ','世界向量场速度 v̂ᵥ','blue',2)+box(1020,120,230,70,'Action velocity v̂ₐ','动作向量场速度 v̂ₐ','green',2)+arrow(id,'M940 80H980V40H1010',2)+arrow(id,'M940 120H980V155H1010',2,green),205);
 throw new Error(`Unknown OpenWAM slide diagram: ${name}`);
}
