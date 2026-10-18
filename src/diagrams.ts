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
import { informationDiagram, temporalDiagram } from "./teaching.js";

export const SIZE = { width: 800, height: 420 };
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
  | "temporal";
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
};
const text = (
  x: number,
  y: number,
  value: string | number,
  color = C.ink,
  size = 17,
  anchor = "start",
) =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
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
) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" style="font-family:${FONT}"><title id="${id}-title">${title}</title><desc id="${id}-desc">${description}</desc><rect width="800" height="${height}" fill="white"/>${body}</svg>`;
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
    legend(64, "先验 p（蓝实线）", C.accent) +
    legend(424, "后验 q（绿虚线）", C.target, true) +
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
  body += text(
    64,
    377,
    `μp = ${mu.toFixed(2)}，σp = ${sigma.toFixed(2)}`,
    C.accent,
    18,
  );
  body += text(
    752,
    377,
    `KL(q ‖ p) = ${gaussianKL(1.4, 0.7, mu, sigma).toFixed(3)} nat`,
    C.ink,
    18,
    "end",
  );
  body += text(
    64,
    407,
    "固定后验 q：μq = 1.4，σq = 0.7。",
    C.muted,
    16,
  );
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
    text(64, 30, "目标 P · 绿空心", C.target, 18) +
    text(424, 30, "预测 R · 蓝实心", C.accent, 18) +
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
  body += text(
    64,
    377,
    `交叉熵 H₂(P, R) = ${crossEntropy(p, r).toFixed(3)} bit`,
    C.ink,
    18,
  );
  body += text(
    752,
    377,
    `额外代价 KL₂ = ${discreteKL(p, r).toFixed(3)} bit`,
    C.accent,
    18,
    "end",
  );
  body += text(
    64,
    407,
    `目标熵 H₂(P) = ${entropy(p).toFixed(3)} bit`,
    C.muted,
    16,
  );
  return svg(
    "entropy",
    "交叉熵等于目标熵加预测失配",
    "每类左侧绿色空心柱为目标，右侧蓝色实心柱为预测。匹配目标后 KL 为零，交叉熵仍等于非零的目标熵。",
    body,
  );
}
export function l1Diagram(mode: LossMode = "single", prediction = 0.5) {
  const targets = mode === "single" ? [0] : [-1, 1];
  const current = losses(prediction, targets);
  let body =
    legend(64, "L1：绝对误差", C.accent) +
    legend(424, "平方 L2：平方误差", C.target, true) +
    axes(
      5,
      [0, 1, 2, 3, 4, 5],
      targets.length === 1
        ? "损失（目标 a = 0）"
        : "平均损失（示范 −1、+1，各 50%）",
    );
  for (const x of [-2, -1, 0, 1, 2])
    body += text(X(x, -2, 2), 324, x, C.muted, 16, "middle");
  if (mode === "bimodal")
    body += `<rect x="${X(-1, -2, 2)}" y="${Y(1, 5) - 7}" width="${X(1, -2, 2) - X(-1, -2, 2)}" height="14" fill="#e5f3fb"/>`;
  body +=
    path(
      curve((x) => losses(x, targets).l1, -2, 2, 5),
      C.accent,
      3,
      "",
      true,
    ) +
    path(
      curve((x) => losses(x, targets).l2, -2, 2, 5),
      C.target,
      3,
      "8 5",
      true,
    );
  for (const target of targets)
    body += line(X(target, -2, 2), 290, X(target, -2, 2), 302, C.ink, 3);
  body += line(
    X(prediction, -2, 2),
    88,
    X(prediction, -2, 2),
    296,
    C.muted,
    1,
    "3 5",
  );
  body += `<circle cx="${X(prediction, -2, 2)}" cy="${Y(current.l1, 5)}" r="6" fill="${C.accent}" stroke="white" stroke-width="2"/>`;
  body += `<rect x="${X(prediction, -2, 2) - 5}" y="${Y(current.l2, 5) - 5}" width="10" height="10" fill="${C.target}" stroke="white" stroke-width="1.5"/>`;
  body += text(752, 349, "预测值 â（示意单位）", C.muted, 16, "end");
  body +=
    text(
      64,
      377,
      `â = ${prediction.toFixed(2)}；L1 = ${current.l1.toFixed(2)}`,
      C.accent,
      18,
    ) +
    text(752, 377, `平方 L2 = ${current.l2.toFixed(2)}`, C.target, 18, "end");
  body += text(
    64,
    407,
    mode === "single"
      ? "目标为 0：两条曲线都在 0 处取得最小值。"
      : "L1 在 [−1, +1] 都最优；平方 L2 只在 0 处最优。",
    C.muted,
    16,
  );
  return svg(
    "l1",
    mode === "single"
      ? "单个目标下 L1 与平方 L2 如何惩罚误差"
      : "两种相反示范下回归为什么可能输出折中动作",
    "蓝实线和圆点为 L1；绿虚线和方点为平方 L2。横轴短线是示范目标，竖虚线是当前预测，不是训练迭代次数。",
    body,
  );
}
function box(
  x: number,
  y: number,
  width: number,
  title: string,
  sub: string,
  color = C.ink,
  height = 64,
) {
  return (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="white" stroke="${color}" stroke-width="1.8"/>` +
    text(x + width / 2, y + 27, title, color, 18, "middle") +
    text(x + width / 2, y + 51, sub, C.muted, 16, "middle")
  );
}
export function networkDiagram(mode: Mode = "train") {
  let body = `<defs>${[
    ["blue", C.accent],
    ["green", C.target],
    ["gray", C.muted],
  ]
    .map(
      ([name, color]) =>
        `<marker id="network-arrow-${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`,
    )
    .join("")}</defs>`;
  const arrow = (
    d: string,
    tone: "blue" | "green" | "gray" = "gray",
    dash = false,
  ) =>
    `<path d="${d}" fill="none" stroke="${tone === "blue" ? C.accent : tone === "green" ? C.target : C.muted}" stroke-width="2" ${dash ? 'stroke-dasharray="6 5"' : ""} marker-end="url(#network-arrow-${tone})"/>`;
  if (mode === "train") {
    body += text(
      32,
      28,
      "训练 · 后验读取示范动作",
      C.ink,
      18,
    );
    body +=
      box(32, 80, 216, "图像特征", "完整空间 tokens") +
      box(296, 80, 216, "示范动作 A", "仅训练时可用", C.target);
    body += box(
      32,
      212,
      216,
      "图像条件先验 p",
      "视觉汇总 → μp、σp",
      C.accent,
    );
    body += box(
      296,
      212,
      216,
      "图像—动作后验 q",
      "读取视觉汇总与示范",
      C.target,
    );
    body += box(552, 212, 216, "ACT 主干", "读取空间特征与 z");
    body += box(296, 344, 216, "重参数化采样 z", "μq + σq ⊙ ε", C.target);
    body += box(552, 344, 216, "动作预测", "连续值／类别 logits");
    body += box(
      32,
      476,
      480,
      "KL(q ‖ p)",
      "约束后验与先验的差异",
    );
    body += box(552, 476, 216, "与示范比较", "L1 + CE");
    body += arrow("M140 144V212", "blue");
    body += arrow("M248 112H272V244H296");
    body += arrow("M140 80V52H660V212");
    body += text(670, 183, "空间特征", C.muted, 16);
    body += arrow("M404 144V212", "green") + arrow("M404 276V344", "green");
    body += arrow("M512 376H536V244H552", "green");
    body += text(540, 308, "z", C.target, 17);
    body += arrow("M660 276V344") + arrow("M660 408V476");
    body += arrow("M140 276V476", "blue", true);
    body += arrow("M296 262H264V448H404V476", "green", true);
    body += text(
      32,
      578,
      "实线：数据流向　　虚线：参与 KL 计算",
      C.muted,
      16,
    );
  } else {
    body += text(32, 28, "推理 · 从图像条件先验取得 z", C.ink, 18);
    body += box(32, 80, 216, "当前图像", "每次新预测重新读取");
    body += box(296, 80, 216, "图像特征", "完整空间 tokens");
    body += box(
      296,
      212,
      216,
      "图像条件先验 p",
      "由视觉汇总预测 μp、σp",
      C.accent,
    );
    body += box(296, 344, 216, "选择潜变量 z", "mean 或 sample", C.accent);
    body += box(552, 344, 216, "ACT 主干", "当前空间特征 + z");
    body += box(552, 476, 216, "动作输出", "连续值／argmax 类别");
    body +=
      arrow("M248 112H296") +
      arrow("M404 144V212", "blue") +
      arrow("M404 276V344", "blue") +
      arrow("M512 376H552", "blue");
    body += arrow("M512 112H660V344") + arrow("M660 408V476");
    body += text(
      32,
      578,
      "mean：取先验均值　　sample：从先验采样",
      C.muted,
      16,
    );
  }
  return svg(
    "network",
    "条件 CVAE 的训练与推理路径",
    "每个箭头都在目标模块边缘终止。训练后验读取示范动作，推理只使用先验；完整空间图像特征始终直接输入动作主干。",
    body,
    604,
  );
}
export function renderDiagram(id: DiagramId, state: State = defaults[id]) {
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
  }
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
