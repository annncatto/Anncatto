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
 if(name==='hypothesis')return frame(id,'OpenWAM couples world prediction and action generation',
  box(10,65,260,90,'Visual dynamics|from video','视频中的|视觉动态知识')+
  box(475,15,310,85,'World prediction','世界预测')+box(475,155,310,85,'Action generation','动作生成','green',1)+
  arrow(id,'M280 110H365V58H465')+arrow(id,'M630 110V145',1)+arrow(id,'M710 145V110',2,green)+
  box(995,65,255,90,'Robot actions|and task experience','机器人动作|与任务经验','green',2)+arrow(id,'M985 110H880V198H795',2,green)+
  text(860,126,'Joint learning','联合学习',20)+text(630,127,'Feature exchange','特征交换',20),250);
 if(name==='io')return frame(id,'Observed conditions and two jointly generated futures',
  box(10,25,255,170,'Current images o₁|Instruction ℓ|Current robot state q','当前图像 o₁|任务指令 ℓ|当前本体状态 q','gray')+
  box(480,50,290,120,'World–Action Model','世界—动作模型')+arrow(id,'M275 110H470')+
  box(985,15,260,85,'Future visual latents|z','未来视觉潜变量|z','blue',1)+box(985,155,260,85,'Action chunk a₁:ₕ|Robot commands','动作块 a₁:ₕ|机器人指令','green',2)+
  arrow(id,'M780 85H875V58H975',1)+arrow(id,'M780 138H875V198H975',2,green)+
  text(628,220,'Generate both from noise','两类变量均从噪声生成',22),255);
 if(name==='composition-v2')return frame(id,'Composable encoder, stream backbones, visibility and execution interfaces',
  box(10,30,315,95,'E · Visual encoder|Defines latent targets','E · 视觉编码器|定义潜变量预测目标','gray')+
  box(472,30,315,95,'S · Stream backbones|Own model parameters','S · 流的网络骨干|持有模型参数')+
  box(934,30,315,95,'M · Attention mask|Defines readable sources','M · 注意力掩码|定义可读取的信息','green')+
  arrow(id,'M168 138V168H420V190')+arrow(id,'M630 138V190',1)+arrow(id,'M1092 138V168H840V190',2,green)+
  box(260,200,740,60,'C: prepare → layer steps → finalize','C：准备 token → 逐层组织计算 → 输出预测','gray',2),275);
 if(name==='tokenization')return frame(id,'Video and action tokenization with a clean current frame',
  box(10,20,220,75,'Current frame','当前帧','gray')+box(10,145,220,75,'Future frames|groups of four','未来帧|每四帧一组')+
  box(340,65,230,110,'Frozen causal VAE','冻结因果 VAE','gray')+arrow(id,'M240 58H290V97H330')+arrow(id,'M240 182H290V145H330')+
  box(690,15,270,80,'Clean latent prefix|O','干净潜变量前缀|O')+box(690,145,270,80,'Future latent grid|V','未来潜变量网格|V','blue',1)+
  arrow(id,'M580 97H635V55H680')+arrow(id,'M580 145H635V185H680',1)+
  box(1060,65,190,110,'(1,2,2) patch|3D RoPE','(1,2,2) patch|3D RoPE','blue',2)+arrow(id,'M970 55H1006V97H1050',2)+arrow(id,'M970 185H1006V145H1050',2)+
  text(630,260,'Video: Nᵥ tokens × 3072     ·     Action: H tokens × 1024','视频：Nᵥ 个 token × 3072 维     ·     动作：H 个 token × 1024 维',22),280);
 if(name==='families-v2')return frame(id,'Three families with shared, dual and understanding-augmented backbones',
  box(15,15,365,70,'Video + action tokens','视频 + 动作 token')+arrow(id,'M198 95V120')+box(15,130,365,80,'One Transformer|Shared / routed FFNs','一个 Transformer|共享 / 路由前馈网络','gray')+
  box(447,15,365,70,'Video DiT','视频 DiT')+box(447,155,365,70,'Action DiT','动作 DiT','green',1)+arrow(id,'M590 95V145',1)+arrow(id,'M670 145V95',1,green)+
  box(880,15,365,70,'VLM → Understanding stream','VLM → 理解流','gray',2)+arrow(id,'M1062 95V120',2)+box(880,130,365,80,'World + action backbones|Read-only semantic context','世界 + 动作骨干|读取语义上下文','green',2),240);
 if(name==='bridge')return frame(id,'Stream-owned QKV, joint masked attention and separate residual paths',
  box(10,20,235,80,'World hidden states|Nᵥ × 3072','世界流隐藏状态|Nᵥ × 3072')+box(10,200,235,80,'Action hidden states|Nₐ × 1024','动作流隐藏状态|Nₐ × 1024','green')+
  box(305,20,195,80,'Own Qᵥ, Kᵥ, Vᵥ','独立 Qᵥ, Kᵥ, Vᵥ')+box(305,200,195,80,'Own Qₐ, Kₐ, Vₐ','独立 Qₐ, Kₐ, Vₐ','green')+
  arrow(id,'M255 60H295')+arrow(id,'M255 240H295',0,green)+
  box(580,65,300,170,'Concatenate token axis|Masked attention|Split token axis','沿 token 轴拼接|掩码注意力|按 token 位置拆分','gray',1)+
  arrow(id,'M510 60H545V110H570',1)+arrow(id,'M510 240H545V190H570',1,green)+
  box(965,20,285,80,'World output projection|Residual + FFN','世界流输出投影|残差 + 前馈网络','blue',2)+
  box(965,200,285,80,'Action output projection|Residual + FFN','动作流输出投影|残差 + 前馈网络','green',2)+
  arrow(id,'M890 110H925V60H955',2)+arrow(id,'M890 190H925V240H955',2,green)+
  text(730,270,'Per head: Nᵥ + Nₐ tokens, dₕ = 128','每个头：Nᵥ + Nₐ 个 token，dₕ = 128',20),300);
 if(name==='masks-v2'){
  const modes=[['Isolated','隔离',false,false],['World reads action','世界读取动作',true,false],['Action reads world','动作读取世界',false,true],['Mutual','互通',true,true]] as const;
  let content='';for(const [i,[en,zh,va,av]] of modes.entries()){
   const x=i*315;content+=text(x+157,20,en,zh,22);
   for(let j=0;j<3;j++)content+=text(x+120+j*60,57,['O','V','A'][j],['O','V','A'][j],20)+text(x+65,98+j*50,['O','V','A'][j],['O','V','A'][j],20);
   for(let r=0;r<3;r++)for(let c=0;c<3;c++){
    const allowed=r===c||c===0||(r===1&&c===2&&va)||(r===2&&c===1&&av);
    const fill=allowed?(r===0?'#e4ebed':r===2?'#d7e9e1':'#dbeaf3'):'#f5f7f7';
    content+=`<rect x="${x+93+c*60}" y="${76+r*50}" width="54" height="44" rx="5" fill="${fill}"/>`+text(x+120+c*60,98+r*50,allowed?'✓':'—',allowed?'✓':'—',22,allowed?ink:'#b1bec2');
   }
  }return frame(id,'Four side-by-side attention masks over observed, future-world and action tokens',content,238);
 }
 if(name==='conditions')return frame(id,'Conditioning pathways into each stream block',
  box(10,15,245,75,'Instruction ℓ → umT5|4096-D text features','指令 ℓ → umT5|4096 维文本特征','gray')+
  box(10,145,245,75,'Current state q → Linear|One context token','当前状态 q → 线性层|一个上下文 token','gray')+
  box(355,65,260,105,'Context c|Text + state','上下文 c|文本 + 状态')+arrow(id,'M265 52H300V100H345')+arrow(id,'M265 182H300V140H345')+
  box(770,15,295,75,'World cross-attention','世界流交叉注意力')+box(770,145,295,75,'Action cross-attention','动作流交叉注意力','green',1)+
  arrow(id,'M625 100H690V52H760')+arrow(id,'M625 140H690V182H760',1,green)+
  text(1165,52,'tᵥ → AdaLN','tᵥ → AdaLN',20)+text(1165,182,'tₐ → AdaLN','tₐ → AdaLN',20)+
  text(630,265,'RoPE locates tokens · AdaLN specifies noise level · Cross-attention reads task context','RoPE 标记 token 位置 · AdaLN 指定噪声水平 · 交叉注意力读取任务上下文',22),285);
 if(name==='flow-v2')return frame(id,'Joint flow training with independently noised paired targets',
  box(10,5,245,70,'Future latent target z','未来潜变量标签 z')+box(10,120,245,70,'Action target a','动作标签 a','green')+
  box(330,5,240,70,'Noise at tᵥ','在 tᵥ 加噪')+box(330,120,240,70,'Noise at tₐ','在 tₐ 加噪','green')+arrow(id,'M265 40H320')+arrow(id,'M265 155H320',0,green)+
  box(670,45,260,105,'Joint network|Given clean O and c','联合网络|以干净 O 与 c 为条件','gray',1)+arrow(id,'M580 40H620V80H660',1)+arrow(id,'M580 155H620V120H660',1,green)+
  box(1020,5,230,70,'World velocity v̂ᵥ','世界向量场速度 v̂ᵥ','blue',2)+box(1020,120,230,70,'Action velocity v̂ₐ','动作向量场速度 v̂ₐ','green',2)+arrow(id,'M940 80H980V40H1010',2)+arrow(id,'M940 120H980V155H1010',2,green),205);
 if(name==='jointloop'){
  let ticks='';for(let i=0;i<=10;i++)ticks+=`<circle data-joint-tick="${i}" cx="${320+i*60}" cy="230" r="7" fill="${i===0?green:'#d5e1e2'}"/>`;
  return frame(id,'Joint forward pass and coupled Euler updates repeated over ten steps',
   box(10,25,245,90,'Current observation O|Held fixed every step','当前观测 O|每一步始终固定','gray')+
   box(350,25,245,90,'Noisy world zᵢ|Noisy actions aᵢ','带噪世界 zᵢ|带噪动作 aᵢ')+
   box(685,25,245,90,'Joint forward|30 attention bridges','联合前向|30 层注意力桥接','gray',1)+
   box(1020,25,230,90,'Euler updates|zᵢ₊₁ and aᵢ₊₁','Euler 更新|zᵢ₊₁ 与 aᵢ₊₁','green',2)+
   arrow(id,'M132 25V5H807V15')+arrow(id,'M605 70H675',1)+arrow(id,'M940 70H1010',2,green)+
   arrow(id,'M1135 127V165H472V127',3,green)+text(805,165,'Repeat with new samples and noise time','用更新后的样本与噪声时间重复计算',22)+ticks+
   text(220,230,'Noise t = 0','噪声 t = 0',20)+text(1040,230,'Data t = 1','数据 t = 1',20),255);
 }
 if(name==='supervision')return frame(id,'Human and robot data share world prediction with masked robot-action supervision',
  box(10,15,275,75,'Human video|No robot action labels','人类视频|无机器人动作标签','gray')+
  box(10,155,275,75,'Robot video + q + a|Valid coordinate mask m','机器人视频 + q + a|有效坐标掩码 m','green')+
  box(480,65,295,115,'World–action network|Joint optimization','世界—动作网络|联合优化')+
  arrow(id,'M295 52H380V105H470')+arrow(id,'M295 192H380V145H470',1,green)+
  box(975,15,275,75,'World loss|Human + robot video','世界损失|人类 + 机器人视频','blue',1)+
  box(975,155,275,75,'Masked action loss|Robot labels','掩码动作损失|机器人标签','green',2)+
  arrow(id,'M785 105H880V52H965',1)+arrow(id,'M785 145H880V192H965',2,green)+
  text(630,250,'80-D semantic slots → one shared action head → gather native commands','80 维语义槽位 → 共享动作输出头 → 取回本体指令',22),270);
 if(name==='execution')return frame(id,'Physical control loop around joint generation',
  box(10,30,230,90,'Observe|Images + state','观测|图像 + 状态','gray')+
  box(330,30,230,90,'Joint generation|N denoising steps','联合生成|N 次去噪积分')+
  box(650,30,270,90,'Native action chunk|H predicted actions','本体动作块|H 个预测动作','green',1)+
  box(1010,30,240,90,'Execute n actions|Robot motion','执行 n 个动作|机器人运动','green',2)+
  arrow(id,'M250 75H320')+arrow(id,'M570 75H640',1)+arrow(id,'M930 75H1000',2,green)+
  arrow(id,'M1130 132V190H125V132',3,green)+text(630,190,'Observe again → correct the next action chunk','重新观测 → 修正下一动作块',22),225);
 if(name==='synthesis')return frame(id,'Training and inference use the same world–action feature connection',
  box(10,40,280,115,'Video generation prior|Dynamics in latent space','视频生成先验|潜变量空间的动态知识')+
  box(475,5,310,85,'World stream','世界流')+box(475,150,310,85,'Action stream','动作流','green',1)+
  arrow(id,'M300 98H375V48H465')+arrow(id,'M595 100V140',1)+arrow(id,'M665 140V100',1,green)+
  box(975,40,275,115,'Robot supervision|Executable actions','机器人监督|可执行动作','green',2)+arrow(id,'M965 98H885V192H795',2,green)+
  text(830,120,'Bridge','桥接',20),250);
 throw new Error(`Unknown OpenWAM slide diagram: ${name}`);
}
