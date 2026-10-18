import { C, FONT } from "./theme.js";
const escape = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function label(x: number, y: number, value: string | number, size = 17, anchor = "start", muted = false) {
  return `<text x="${x}" y="${y}" fill="${muted ? C.muted : C.ink}" font-size="${size}" text-anchor="${anchor}">${escape(value)}</text>`;
}
function line(x1: number, y1: number, x2: number, y2: number, color = C.grid, width = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
}
function frame(id: string, title: string, description: string, body: string, height: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" style="font-family:${FONT}"><title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">${escape(description)}</desc><rect width="800" height="${height}" fill="white"/>${body}</svg>`;
}
export function informationDiagram(probability = 0.25): string {
  const p = Number.isFinite(probability) ? Math.max(0.02, Math.min(1, probability)) : 0.25;
  const bits = -Math.log2(p), x = (p: number) => 64 + 688 * p, y = (v: number) => 296 - 208 * v / 6;
  let body = label(64, 30, "I(p) = −log₂(p)", 18) + label(64, 68, "信息量 / bit", 16, "start", true);
  for (const tick of [0, 1, 2, 3, 4, 5, 6]) {
    body += line(64, y(tick), 752, y(tick));
    body += label(52, y(tick) + 5, tick, 16, "end", true);
  }
  for (const tick of [0, 0.25, 0.5, 0.75, 1]) body += label(x(tick), 324, tick, 16, "middle", true);
  body += label(752, 349, "事件概率 p", 16, "end", true);
  const path = Array.from({length: 301}, (_, i) => {
    const value = 0.02 + 0.98 * i / 300;
    return `${i ? "L" : "M"}${x(value).toFixed(2)},${y(-Math.log2(value)).toFixed(2)}`;
  }).join(" ");
  body += `<path d="${path}" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
  body += line(x(p), y(bits), x(p), 296, C.target, 2);
  body += `<circle cx="${x(p)}" cy="${y(bits)}" r="6" fill="${C.target}" stroke="white" stroke-width="2"/>`;
  return frame("information", "概率与信息量", `当前概率 ${p}，信息量 ${bits.toFixed(2)} bit。`, body, 360);
}
export function temporalDiagram(coefficient = 0.01): string {
  const m = Number.isFinite(coefficient) ? Math.max(0, coefficient) : 0.01;
  const raw = [1, Math.exp(-m), Math.exp(-2*m)], total = raw.reduce((a,b) => a+b, 0), weights = raw.map(x => x / total);
  const times = ["t − 2", "t − 1", "t", "t + 1", "t + 2"], centers = [300, 392, 484, 576, 668];
  let body = label(64, 25, "观测时刻", 16, "start", true);
  body += `<rect x="441" y="37" width="86" height="129" rx="4" fill="#edf6fc" stroke="${C.accent}" stroke-width="1.5"/>`;
  for (let i = 0; i < 5; i++) body += label(centers[i], 25, times[i], 17, "middle");
  for (let row = 0; row < 3; row++) {
    const y = 44 + row * 43;
    body += label(64, y+21, `${times[row]} 的预测`, 17);
    for (let column = row; column < row+3; column++) {
      const selected = column === 2;
      body += `<rect x="${centers[column]-39}" y="${y}" width="78" height="30" rx="3" fill="${selected ? '#edf6fc' : 'white'}" stroke="${selected ? C.accent : C.grid}" stroke-width="${selected ? 1.7 : 1}"/>`;
      body += label(centers[column], y+21, `第 ${column-row+1} 步`, 16, "middle");
    }
  }
  body += line(64, 184, 752, 184);
  body += label(64, 208, "融合权重", 16, "start", true);
  for (let row = 0; row < 3; row++) {
    const y = 222 + row*32;
    body += label(64, y+16, `${times[row]}${row === 0 ? ' · 最旧' : row === 2 ? ' · 最新' : ''}`, 16);
    body += `<rect x="230" y="${y}" width="430" height="20" rx="3" fill="#f0f5f3"/><rect x="230" y="${y}" width="${430*weights[row]}" height="20" rx="3" fill="${row === 0 ? C.target : C.accent}"/>`;
    body += label(752, y+16, `${(weights[row]*100).toFixed(1)}%`, 17, "end");
  }
  return frame("temporal", "对齐同一执行时刻的预测", `蓝框标出三次预测中对应 t 时刻的动作。系数 ${m}，由旧到新权重为 ${weights.map(x=>(x*100).toFixed(1)+'%').join('、')}。`, body, 318);
}

export function trainingDiagram(): string {
  let body = `<defs><marker id="training-forward" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${C.accent}"/></marker><marker id="training-backward" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${C.target}"/></marker></defs>`;
  const box = (x: number, y: number, w: number, value: string, backward = false) =>
    `<rect x="${x}" y="${y}" width="${w}" height="36" rx="4" fill="${backward ? '#f3faf6' : 'white'}" stroke="${backward ? C.target : C.grid}" stroke-width="1.5"/>` + label(x+w/2, y+24, value, 16, "middle");
  const arrow = (d: string, backward = false) =>
    `<path d="${d}" fill="none" stroke="${backward ? C.target : C.accent}" stroke-width="1.6" ${backward ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#training-${backward ? 'backward' : 'forward'})"/>`;
  body += label(24, 24, "前向计算", 16, "start", true);
  for (const [i, name] of ["图像 I", "状态 s", "潜变量 z"].entries()) {
    const y = 44 + i*56;
    body += box(24,y,100,name) + box(152,y,128,i === 0 ? "ResNet-18" : "输入投影");
    body += arrow(`M124 ${y+18}H152`);
  }
  body += box(328,100,128,"ACT 主干");
  body += arrow("M280 62H304V108H328") + arrow("M280 118H328") + arrow("M280 174H304V128H328");
  body += box(506,44,116,"连续值 â") + box(506,100,116,"分数 u") + box(506,172,116,"概率 R");
  body += arrow("M456 110H480V62H506") + arrow("M456 122H506");
  body += arrow("M564 136V172") + label(578,159,"softmax",14,"start",true);
  body += box(664,44,112,"L1") + box(664,172,112,"CE");
  body += arrow("M622 62H664") + arrow("M622 190H664");
  body += label(720,22,"示范值 a",15,"middle") + arrow("M720 27V44");
  body += label(720,150,"示范类别 y",15,"middle") + arrow("M720 155V172");
  body += line(24,230,776,230);
  body += label(24,256,"反向传播",16,"start",true);
  body += box(152,274,128,"骨干与投影",true) + box(328,274,128,"ACT 主干",true) + box(506,274,116,"动作头",true) + box(664,274,112,"损失梯度",true);
  body += arrow("M664 292H622",true) + arrow("M506 292H456",true) + arrow("M328 292H280",true);
  body += arrow("M776 62H790V292H776",true) + `<path d="M776 190H790" fill="none" stroke="${C.target}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  return frame("training", "动作预测与反向传播", "图像经过 ResNet-18，状态与潜变量经过投影，共同输入 ACT。连续预测与示范值计算 L1，类别分数经过 softmax，与示范类别计算 CE。两种损失的梯度反传到动作头、主干、视觉骨干与输入投影。", body, 328);
}
