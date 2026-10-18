import { localizeSVG, type Language } from "./i18n.js";
import { C, FONT } from "./theme.js";
export { C } from "./theme.js";
import {
  gaussian,
  gaussianKL,
  entropy,
  crossEntropy,
  discreteKL,
  losses,
} from "./math.js";
import { informationDiagram, temporalDiagram, trainingDiagram } from "./teaching.js";

export const SIZE = { width: 800, height: 360 };
export const PLOT = {
  left: 64,
  right: 752,
  top: 88,
  bottom: 296,
  width: 688,
  height: 208,
};
export type Mode = "train" | "infer";
export type LossMode = "single" | "bimodal";
export type DiagramId =
  | "information"
  | "entropy"
  | "l1"
  | "gaussian"
  | "network"
  | "temporal"
  | "training";
export type State = {
  mode?: Mode;
  lossMode?: LossMode;
  mu?: number;
  sigma?: number;
  r0?: number;
  r1?: number;
  prediction?: number;
  probability?: number;
  coefficient?: number;
};
export const defaults: Record<DiagramId, State> = {
  information: { probability: 0.25 },
  entropy: { r0: 1 / 3, r1: 0.5 },
  l1: { lossMode: "single", prediction: 1 },
  gaussian: { mu: 0, sigma: 0.7 },
  network: { mode: "train" },
  temporal: { coefficient: 0.01 },
  training: {},
};
const text = (
  x: number,
  y: number,
  value: string | number,
  color = C.ink,
  size = 17,
  anchor = "start",
) =>
  `<text x="${x}" y="${y}" fill="${color === C.accent || color === C.target ? C.ink : color}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = C.grid,
  width = 1,
  dash = "",
) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
const path = (d: string, color = C.accent, width = 3, dash = "", gpu = false) =>
  `<path ${gpu ? 'data-gpu-ink=""' : ""} d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
const svg = (
  id: string,
  title: string,
  description: string,
  body: string,
  height = SIZE.height,
  width = SIZE.width,
) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" style="font-family:${FONT}"><title id="${id}-title">${title}</title><desc id="${id}-desc">${description}</desc><rect width="${width}" height="${height}" fill="white"/>${body}</svg>`;
const X = (value: number, lo: number, hi: number) =>
  PLOT.left + ((value - lo) / (hi - lo)) * PLOT.width;
const Y = (value: number, max: number) =>
  PLOT.bottom - (value / max) * PLOT.height;
function axes(max: number, ticks: number[], label: string) {
  let body = text(PLOT.left, 68, label, C.muted, 16);
  for (const v of ticks)
    body +=
      line(PLOT.left, Y(v, max), PLOT.right, Y(v, max)) +
      text(PLOT.left - 12, Y(v, max) + 6, v, C.muted, 16, "end");
  return body;
}
function curve(fn: (x: number) => number, lo: number, hi: number, max: number) {
  return Array.from({ length: 689 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / 688;
    return `${i ? "L" : "M"}${X(x, lo, hi).toFixed(3)},${Y(fn(x), max).toFixed(3)}`;
  }).join(" ");
}
function legend(x: number, label: string, color: string, dashed = false) {
  return (
    line(x, 24, x + 38, 24, color, 3, dashed ? "8 5" : "") +
    text(x + 48, 30, label, color, 18)
  );
}
export function gaussianDiagram(mu = 0, sigma = 1) {
  let body =
    legend(64, "先验 p", C.accent) +
    legend(424, "后验 q", C.target, true) +
    axes(1, [0, 0.5, 1], "概率密度");
  for (const x of [-4, -2, 0, 2, 4])
    body += text(X(x, -5, 5), 324, x, C.muted, 16, "middle");
  body += text(752, 349, "潜变量 z", C.muted, 16, "end");
  body += path(
    curve((x) => gaussian(x, mu, sigma), -5, 5, 1),
    C.accent,
    3,
    "",
    true,
  );
  body += path(
    curve((x) => gaussian(x, 1.4, 0.7), -5, 5, 1),
    C.target,
    3,
    "8 5",
    true,
  );
  body += line(
    X(mu, -5, 5),
    296,
    X(mu, -5, 5),
    Y(gaussian(mu, mu, sigma), 1),
    C.accent,
    1.5,
    "3 5",
  );
  body += `<circle cx="${X(mu, -5, 5)}" cy="${Y(gaussian(mu, mu, sigma), 1)}" r="7" fill="${C.accent}" stroke="white" stroke-width="2"/>`;
  return svg(
    "gaussian",
    "KL 衡量后验与先验的失配",
    "蓝色实线和圆点表示可调先验；绿色虚线表示固定后验。两者均值和标准差都相同时 KL 为零。",
    body,
  );
}
export function entropyDiagram(r0 = 0.25, r1 = 0.5) {
  const p = [0.15, 0.7, 0.15],
    r = [r0, (1 - r0) * r1, (1 - r0) * (1 - r1)];
  let body =
    `<rect x="64" y="14" width="24" height="18" fill="#eff9f4" stroke="${C.target}" stroke-width="2"/>` + text(102, 30, "目标分布 P", C.ink, 18) +
    `<rect x="424" y="14" width="24" height="18" fill="${C.accent}"/>` + text(462, 30, "预测分布 R", C.ink, 18) +
    axes(1, [0, 0.5, 1], "类别概率");
  for (let i = 0; i < 3; i++) {
    const x = PLOT.left + (PLOT.width * (i + 0.5)) / 3;
    for (const [j, values] of [p, r].entries()) {
      const left = x + (j ? 10 : -46),
        value = values[i],
        color = j ? C.accent : C.target;
      body += `<rect x="${left}" y="${Y(value, 1)}" width="36" height="${value * PLOT.height}" fill="${j ? C.accent : "#eff9f4"}" stroke="${color}" stroke-width="2"/>`;
      body += text(
        left + 18,
        Y(value, 1) - 10,
        value.toFixed(2),
        color,
        16,
        "middle",
      );
    }
    body += text(x, 324, ["负向", "停止", "正向"][i], C.ink, 18, "middle");
  }
  return svg(
    "entropy",
    "交叉熵等于目标熵加预测失配",
    "每类左侧绿色空心柱为目标，右侧蓝色实心柱为预测。匹配目标后 KL 为零，交叉熵仍等于非零的目标熵。",
    body,
  );
}
export function l1Diagram(mode: LossMode = "single", prediction = 1) {
  const targets = mode === "single" ? [0] : [-1, 1];
  const current = losses(prediction, targets).l1;
  let body = legend(64, "L1 损失", C.accent) + legend(424, "示范值", C.target, true);
  body += axes(2, [0, 0.5, 1, 1.5, 2], "绝对误差");
  for (const value of [-2, -1, 0, 1, 2])
    body += text(X(value, -2, 2), 324, value, C.muted, 16, "middle");
  for (const target of targets)
    body += line(X(target, -2, 2), PLOT.top, X(target, -2, 2), PLOT.bottom, C.target, 2, "5 5");
  body += path(curve((x) => losses(x, targets).l1, -2, 2, 2), C.accent, 3, "", true);
  body += line(X(prediction, -2, 2), Y(current, 2), X(prediction, -2, 2), PLOT.bottom, C.muted, 1, "3 5");
  body += `<circle cx="${X(prediction, -2, 2)}" cy="${Y(current, 2)}" r="6" fill="${C.accent}" stroke="white" stroke-width="2"/>`;
  if (mode === "single") {
    body += `<defs><marker id="l1-direction" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${C.target}"/></marker></defs>`;
    for (const sign of [-1, 1]) {
      body += `<path d="M${X(sign*1.3,-2,2)},${Y(1.3,2)-24} L${X(sign*0.6,-2,2)},${Y(0.6,2)-24}" fill="none" stroke="${C.target}" stroke-width="2.5" marker-end="url(#l1-direction)"/>`;
      body += text(X(sign*1.05,-2,2), Y(1.05,2)-52, sign < 0 ? "预测增大" : "预测减小", C.ink, 17, "middle");
    }
  }
  body += text(752, 349, "动作预测值", C.muted, 16, "end");
  return svg("l1", "L1：预测与示范的距离", `蓝色曲线为 L1，绿色虚线标出示范值。当前预测 ${prediction.toFixed(2)}，损失 ${current.toFixed(2)}。`, body);
}
export function networkDiagram(_mode: Mode = "train") {
  const colors = { blue: C.accent, green: C.target };
  let body = `<defs>${Object.entries(colors).map(([name, color]) => `<marker id="network-arrow-${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`).join("")}</defs>`;
  const node = (x: number, y: number, width: number, label: string, color = C.grid) =>
    `<rect x="${x}" y="${y}" width="${width}" height="40" rx="4" fill="white" stroke="${color}" stroke-width="1.5"/>` + text(x+width/2, y+26, label, C.ink, 16, "middle");
  const arrow = (d: string, color: keyof typeof colors = "blue", dashed = false) =>
    `<path d="${d}" fill="none" stroke="${colors[color]}" stroke-width="1.8" ${dashed ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#network-arrow-${color})"/>`;
  body += text(24,26,"TRAIN · image and demonstration",C.ink,18);
  body += node(24,52,132,"Image + demo") + node(196,52,160,"Posterior q",C.target) + node(396,52,88,"z ∼ q",C.target) + node(524,52,116,"ACT(I, z)") + node(680,52,96,"Actions");
  body += arrow("M156 72H196","green") + arrow("M356 72H396","green") + arrow("M484 72H524","green") + arrow("M640 72H680","green");
  body += node(24,130,132,"Image") + node(196,130,160,"Prior p",C.accent) + node(396,130,88,"KL(q ‖ p)");
  body += arrow("M156 150H196") + arrow("M356 150H396","blue",true);
  body += arrow("M276 92V110H440V130","green",true);
  body += text(524,147,"Match p to q",C.ink,16) + text(524,169,"for the same image",C.muted,15);
  body += line(24,198,776,198);
  body += text(24,232,"ROLLOUT · image only",C.ink,18);
  body += node(24,258,132,"Image") + node(196,258,160,"Prior p",C.accent) + node(396,258,88,"z ∼ p",C.accent) + node(524,258,116,"ACT(I, z)") + node(680,258,96,"Actions");
  body += arrow("M156 278H196") + arrow("M356 278H396") + arrow("M484 278H524") + arrow("M640 278H680");
  body += text(440,324,"or use the prior mean",C.muted,15,"middle");
  return svg("network", "Posterior in training, prior in rollout", "Top: image and demonstration produce posterior q; z sampled from q enters ACT with image features. KL matches the image-conditioned prior p to q. Bottom: only the image is available, so z comes from p. Both paths feed image features directly to ACT, represented by I in ACT(I,z).", body, 340);
}
function rawDiagram(id: DiagramId, state: State = defaults[id]) {
  switch (id) {
    case "information":
      return informationDiagram(state.probability);
    case "entropy":
      return entropyDiagram(state.r0, state.r1);
    case "l1":
      return l1Diagram(state.lossMode, state.prediction);
    case "gaussian":
      return gaussianDiagram(state.mu, state.sigma);
    case "network":
      return networkDiagram(state.mode);
    case "temporal":
      return temporalDiagram(state.coefficient);
    case "training":
      return trainingDiagram();
  }
}

export function renderDiagram(id: DiagramId, state: State = defaults[id], language: Language = "en") {
  return localizeSVG(rawDiagram(id, state), id, language);
}

export const examples: Partial<Record<DiagramId, { label: string; state: State }[]>> = {
  information: [
    { label: "一次正面", state: { probability: 0.5 } },
    { label: "连续两次正面", state: { probability: 0.25 } },
    { label: "连续五次正面", state: { probability: 1 / 32 } },
  ],
  entropy: [
    { label: "三类均匀", state: { r0: 1 / 3, r1: 0.5 } },
    { label: "偏向负向", state: { r0: 0.7, r1: 0.5 } },
    { label: "匹配目标", state: { r0: 0.15, r1: 0.7 / 0.85 } },
  ],
  l1: [
    { label: "预测 −1", state: { prediction: -1 } },
    { label: "预测 0", state: { prediction: 0 } },
    { label: "预测 +1", state: { prediction: 1 } },
  ],
  gaussian: [
    { label: "均值不同", state: { mu: 0, sigma: 0.7 } },
    { label: "宽度不同", state: { mu: 1.4, sigma: 1.4 } },
    { label: "完全匹配", state: { mu: 1.4, sigma: 0.7 } },
  ],
  temporal: [
    { label: "等权 · 0", state: { coefficient: 0 } },
    { label: "轻微偏旧 · 0.01", state: { coefficient: 0.01 } },
    { label: "明显偏旧 · 0.5", state: { coefficient: 0.5 } },
  ],
};

function chineseReadout(id: DiagramId, state: State = defaults[id]): string {
  if (id === "information") {
    const p = state.probability ?? 0.25;
    return `概率 1/${Math.round(1 / p)} · 信息量 ${(-Math.log2(p)).toFixed(0)} bit`;
  }
  if (id === "entropy") {
    const p = [0.15, 0.7, 0.15], r0 = state.r0 ?? 1 / 3, r1 = state.r1 ?? 0.5;
    const r = [r0, (1-r0)*r1, (1-r0)*(1-r1)];
    return `交叉熵 ${crossEntropy(p,r).toFixed(3)} = 目标熵 ${entropy(p).toFixed(3)} + KL ${discreteKL(p,r).toFixed(3)}（bit）`;
  }
  if (id === "l1") return `预测 ${(state.prediction ?? 1).toFixed(2)} → 绝对误差 ${Math.abs(state.prediction ?? 1).toFixed(2)}`;
  if (id === "gaussian") return `先验均值 ${(state.mu ?? 0).toFixed(1)}，标准差 ${(state.sigma ?? 0.7).toFixed(1)} · KL ${gaussianKL(1.4,0.7,state.mu ?? 0,state.sigma ?? 0.7).toFixed(3)} nat`;
  return "";
}

export function diagramReadout(id: DiagramId, state: State = defaults[id], language: Language = "en"): string {
  if (language === "zh") return chineseReadout(id, state);
  if (id === "information") {
    const p = state.probability ?? 0.25;
    return `Probability 1/${Math.round(1/p)} · Information ${(-Math.log2(p)).toFixed(0)} bit`;
  }
  if (id === "entropy") {
    const p = [0.15,0.7,0.15], r0 = state.r0 ?? 1/3, r1 = state.r1 ?? 0.5;
    const r = [r0,(1-r0)*r1,(1-r0)*(1-r1)];
    return `Cross-entropy ${crossEntropy(p,r).toFixed(3)} = Entropy ${entropy(p).toFixed(3)} + KL ${discreteKL(p,r).toFixed(3)} (bit)`;
  }
  if (id === "l1") return `Prediction ${(state.prediction ?? 1).toFixed(2)} → Absolute error ${Math.abs(state.prediction ?? 1).toFixed(2)}`;
  if (id === "gaussian") return `Prior mean ${(state.mu ?? 0).toFixed(1)}, std ${(state.sigma ?? 0.7).toFixed(1)} · KL ${gaussianKL(1.4,0.7,state.mu ?? 0,state.sigma ?? 0.7).toFixed(3)} nat`;
  return "";
}
