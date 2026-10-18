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
