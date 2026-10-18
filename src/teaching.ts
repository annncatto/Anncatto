import { C, FONT } from "./theme.js";
const palette = { ...C, blue: C.accent, green: C.target };

const escape = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function label(
  x: number,
  y: number,
  value: string | number,
  options: {
    color?: string;
    size?: number;
    anchor?: string;
    weight?: number;
  } = {},
): string {
  return `<text x="${x}" y="${y}" fill="${options.color ?? palette.ink}" font-size="${options.size ?? 17}" text-anchor="${options.anchor ?? "start"}" font-weight="${options.weight ?? 400}">${escape(value)}</text>`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = palette.grid,
  width = 1,
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
}

function frame(
  id: string,
  title: string,
  description: string,
  body: string,
  height: number,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" style="font-family:${FONT}"><title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">${escape(description)}</desc><rect width="800" height="${height}" fill="white"/>${body}</svg>`;
}

/** Self-information in bits; the selected example denotes the true class probability. */
export function informationDiagram(probability = 0.25): string {
  const p = Number.isFinite(probability)
    ? Math.max(0.02, Math.min(1, probability))
    : 0.25;
  const information = -Math.log2(p);
  const x = (value: number) => 76 + 650 * value;
  const y = (value: number) => 306 - 34 * value;
  let body = label(28, 32, "一次正面的概率为 ½，连续 n 次为 (½)ⁿ", {
    size: 18,
    weight: 600,
  });
  body += label(28, 62, "I(p) = −log₂(p)", {
    color: palette.muted,
  });
  body += label(76, 88, "信息量 / bit", { color: palette.muted, size: 16 });
  for (const tick of [0, 1, 2, 3, 4, 5, 6]) {
    body += line(76, y(tick), 726, y(tick));
    body += label(62, y(tick) + 5, tick, {
      anchor: "end",
      color: palette.muted,
      size: 16,
    });
  }
  body += line(76, 102, 76, 306, palette.ink, 1.5);
  body += line(76, 306, 726, 306, palette.ink, 1.5);
  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    body += line(x(tick), 306, x(tick), 312, palette.ink);
    body += label(x(tick), 333, tick, {
      anchor: "middle",
      color: palette.muted,
      size: 16,
    });
  }
  body += label(726, 358, "事件概率 p", {
    anchor: "end",
    color: palette.muted,
    size: 16,
  });
  const path = Array.from({ length: 301 }, (_, i) => {
    const value = 0.02 + (0.98 * i) / 300;
    return `${i ? "L" : "M"}${x(value).toFixed(2)},${y(-Math.log2(value)).toFixed(2)}`;
  }).join(" ");
  body += `<path d="${path}" fill="none" stroke="${palette.blue}" stroke-width="3"/>`;
  body += line(x(p), y(information), x(p), 306, palette.green, 1.5);
  body += `<circle cx="${x(p)}" cy="${y(information)}" r="7" fill="${palette.green}" stroke="white" stroke-width="2"/>`;
  body += label(
    28,
    381,
    `● 当前概率 ${Number(p.toFixed(5))} → 信息量 ${information.toFixed(2)} bit`,
    { color: palette.green, size: 18, weight: 500 },
  );
  body += label(
    28,
    408,
    "概率每减半，信息量增加 1 bit。",
    { color: palette.muted, size: 17 },
  );
  return frame(
    "information",
    "概率与自信息",
    `自信息为负的二进制对数。当前概率为 ${Number(p.toFixed(5))}，信息量为 ${information.toFixed(2)} bit。概率 0.5 对应 1 bit，概率 0.25 对应 2 bit。`,
    body,
    420,
  );
}

/** Original ACT convention: index zero is the oldest available prediction. */
export function temporalDiagram(coefficient = 0.01): string {
  const m = Number.isFinite(coefficient) ? Math.max(0, coefficient) : 0.01;
  const raw = [1, Math.exp(-m), Math.exp(-2 * m)];
  const total = raw.reduce((sum, value) => sum + value, 0);
  const weights = raw.map((value) => value / total);
  const columns = ["t − 2", "t − 1", "t", "t + 1", "t + 2"];
  const sources = ["t − 2", "t − 1", "t"];
  const centers = [259, 367, 475, 583, 691];
  let body = label(28, 32, "三个动作块，同一个执行时刻 t", {
    size: 18,
    weight: 600,
  });
  body += label(28, 62, "每行是一个动作块，蓝框标出要融合的动作。", {
    color: palette.muted,
  });
  body += label(28, 94, "预测产生时刻", { size: 16, color: palette.muted });
  body += `<rect x="423" y="101" width="104" height="165" rx="7" fill="#edf6fc" stroke="${palette.blue}" stroke-width="2"/>`;
  for (let column = 0; column < columns.length; column++) {
    body += label(centers[column]!, 94, columns[column]!, {
      anchor: "middle",
      size: 18,
      weight: column === 2 ? 600 : 400,
      color: column === 2 ? palette.blue : palette.muted,
    });
  }
  for (let row = 0; row < 3; row++) {
    const top = 113 + 53 * row;
    body += label(28, top + 18, `来自 ${sources[row]}`, { weight: 600 });
    body += label(
      28,
      top + 38,
      `${row === 0 ? "最旧" : row === 2 ? "最新" : "中间"} · i = ${row}`,
      { size: 16, color: palette.muted },
    );
    for (let column = row; column <= row + 2; column++) {
      const selected = column === 2;
      body += `<rect x="${centers[column]! - 44}" y="${top}" width="88" height="40" rx="4" fill="white" stroke="${selected ? palette.blue : palette.grid}" stroke-width="${selected ? 2.5 : 1.5}"/>`;
      body += label(
        centers[column]!,
        top + 26,
        selected ? "取这一项" : columns[column]!,
        {
          anchor: "middle",
          size: 16,
          color: selected ? palette.blue : palette.muted,
          weight: selected ? 600 : 400,
        },
      );
    }
  }
  body += label(28, 293, "蓝框内的三项 → 加权得到 t 时刻的动作", {
    size: 18,
    color: palette.blue,
    weight: 600,
  });
  const mLabel =
    (m < 0.001 && m > 0) || m >= 10000
      ? m.toExponential(1)
      : String(Number(m.toFixed(3)));
  body += label(
    28,
    322,
    `权重 ∝ exp(−m × i)；m = ${mLabel}`,
    { size: 17 },
  );
  for (let row = 0; row < 3; row++) {
    const top = 338 + 36 * row;
    body += label(28, top + 18, `${sources[row]} 产生的预测`, {
      size: 16,
      color: row === 0 ? palette.green : palette.ink,
    });
    body += `<rect x="230" y="${top}" width="430" height="23" rx="3" fill="#eff5f5"/>`;
    body += `<rect x="230" y="${top}" width="${(430 * weights[row]!).toFixed(3)}" height="23" rx="3" fill="${row === 0 ? palette.green : palette.blue}"/>`;
    body += label(678, top + 18, `${(100 * weights[row]!).toFixed(1)}%`, {
      size: 17,
      weight: 600,
    });
  }
  body += label(
    28,
    461,
    "浅色底条表示 100%；绿色为最旧预测。",
    { color: palette.muted, size: 16 },
  );
  return frame(
    "temporal",
    "ACT 时间集成的对齐与权重",
    `三次动作块预测来自 t 减 2、t 减 1 和 t。只抽取各块对执行时刻 t 的预测进行融合。系数为 ${mLabel}，由旧到新权重分别为 ${weights.map((value) => `${(value * 100).toFixed(1)}%`).join("、")}。`,
    body,
    472,
  );
}
