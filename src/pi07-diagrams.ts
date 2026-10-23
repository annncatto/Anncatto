import type { Language } from "./i18n.js";
import { FONT } from "./theme.js";

export type Access = "all" | "causal" | "blocked";
export type TokenMode = "causal" | "bidirectional";
export type LatentMode = "video" | "policy" | "planning";
export const latentModes: readonly LatentMode[] = ["video", "policy", "planning"];
export const latentRoutes = {
  video: {
    nodes: ["frame-pair", "inverse", "latent", "state", "dynamics", "future"],
    edges: [["frame-pair", "inverse"], ["inverse", "latent"], ["latent", "dynamics"], ["state", "dynamics"], ["dynamics", "future"]],
  },
  policy: {
    nodes: ["observation", "policy", "latent", "embodiment", "decoder", "command"],
    edges: [["observation", "policy"], ["policy", "latent"], ["latent", "decoder"], ["embodiment", "decoder"], ["decoder", "command"]],
  },
  planning: {
    nodes: ["candidate", "projector", "latent", "state", "dynamics", "future"],
    edges: [["candidate", "projector"], ["projector", "latent"], ["latent", "dynamics"], ["state", "dynamics"], ["dynamics", "future"]],
  },
} as const;
export const groups = ["Images", "Text", "Goals", "Flow", "FAST"] as const;
const access: readonly (readonly Access[])[] = [
  ["all", "blocked", "blocked", "blocked", "blocked"],
  ["all", "causal", "blocked", "blocked", "blocked"],
  ["all", "all", "all", "blocked", "blocked"],
  ["all", "all", "all", "all", "blocked"],
  ["all", "all", "all", "blocked", "causal"],
];
export function groupAccess(query: number, key: number): Access {
  if (!Number.isInteger(query) || !Number.isInteger(key) || query < 0 || key < 0 || query >= 5 || key >= 5)
    throw new RangeError("Token group must be an integer from 0 to 4");
  return access[query]![key]!;
}
export function readableTokens(mode: TokenMode, query: number): number[] {
  if (!Number.isInteger(query) || query < 0 || query > 3) throw new RangeError("Query token must be from 0 to 3");
  return [0, 1, 2, 3].filter(key => mode === "bidirectional" || key <= query);
}
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const bi = (en: string, zh: string) => `<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
function svg(id: string, height: number, description: string, body: string, width = 640) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-description" style="font-family:${FONT}"><title id="${id}-description">${esc(description)}</title>${body}</svg>`;
}
function text(x: number, y: number, value: string, size = 15, anchor = "middle", color = "#273b43") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}">${esc(value)}</text>`;
}
export function accessMessage(query: number, language: Language): string {
  const label = groups[query]!;
  const visible = groups.filter((_, key) => groupAccess(query, key) !== "blocked").join(", ");
  const causal = query === 1 || query === 4;
  return language === "en"
    ? `${label} reads ${visible}.${causal ? " Its own group is causal: current and earlier tokens only." : " Reading within its own group is bidirectional."}`
    : `${label} 读取 ${visible}。${causal ? "组内采用因果注意力，只读当前位置及此前的 tokens。" : "组内采用双向注意力，可以读取所有位置。"}`;
}
export function accessDiagram(query = 3, language: Language = "en"): string {
  let body = text(152, 22, language === "en" ? "Query ↓ / Keys →" : "查询 ↓ / 读取 →", 14, "end");
  for (const [col, group] of groups.entries()) body += text(211 + col * 86, 22, group);
  for (const [row, group] of groups.entries()) {
    const y = 40 + row * 46;
    if (row === query) body += `<rect x="64" y="${y - 3}" width="572" height="44" rx="4" fill="#edf6fb"/>`;
    body += text(151, y + 23, group, 15, "end");
    for (let col = 0; col < 5; col++) {
      const kind = groupAccess(row, col), x = 170 + col * 86;
      const fill = kind === "blocked" ? "white" : kind === "causal" ? "#e3f0fa" : "#e1f3e9";
      body += `<rect x="${x}" y="${y}" width="82" height="38" rx="3" fill="${fill}" stroke="${row === query ? '#79abc8' : '#d6e4e5'}"/>`;
      body += text(x + 41, y + 24, kind === "blocked" ? "×" : kind === "causal" ? "≤ i" : "All", 15, "middle", kind === "blocked" ? "#8a9a9f" : "#273b43");
    }
  }
  body += text(320, 297, language === "en" ? "All: full group    ≤ i: current and earlier    ×: blocked" : "All：全组    ≤ i：当前位置及此前    ×：禁止读取", 14, "middle", "#61747b");
  return svg("pi07-access", 310, accessMessage(query, language), body);
}
export function tokenMessage(mode: TokenMode, query: number, language: Language): string {
  const keys = readableTokens(mode, query).map(x => String(x + 1)).join(", ");
  return language === "en"
    ? `Token ${query + 1} reads positions ${keys}. ${mode === "causal" ? "Later positions are masked." : "All four positions are available together."}`
    : `Token ${query + 1} 读取位置 ${keys}。${mode === "causal" ? "后续位置被掩掉。" : "四个位置同时可用。"}`;
}
export function tokenDiagram(mode: TokenMode = "bidirectional", query = 0, language: Language = "en"): string {
  const keys = readableTokens(mode, query), xs = [44, 134, 224, 314], dest = xs[query]!;
  let body = `<defs><marker id="pi07-token-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#237ab2"/></marker></defs>`;
  body += text(180, 20, language === "en" ? "Key / value positions" : "键值所在位置", 14, "middle", "#61747b");
  for (const [key, x] of xs.entries()) {
    if (keys.includes(key)) body += `<path d="M${x} 75 C${x} 116 ${dest} 116 ${dest} 158" fill="none" stroke="#237ab2" stroke-width="1.8" marker-end="url(#pi07-token-arrow)"/>`;
    body += `<rect x="${x - 35}" y="37" width="70" height="38" rx="5" fill="${keys.includes(key) ? '#e1f3e9' : '#f6f8f8'}" stroke="${keys.includes(key) ? '#8ab6a0' : '#d6e4e5'}"/>`;
    body += text(x, 62, `Token ${key + 1}`, 13, "middle", keys.includes(key) ? "#273b43" : "#8a9a9f");
  }
  body += `<rect x="${dest - 39}" y="161" width="78" height="38" rx="5" fill="#e3f0fa" stroke="#237ab2"/>`;
  body += text(dest, 186, `Query ${query + 1}`, 13);
  body += text(180, 227, language === "en" ? "Keys / values → query" : "键值 → 查询", 14, "middle", "#61747b");
  return svg("pi07-tokens", 240, tokenMessage(mode, query, language), body, 360);
}
export function latentMessage(mode: LatentMode, language: Language): string {
  const messages = {
    video: ["Training: infer u from two observed frames, then predict the next features from the current features and u.", "训练：用两帧已记录的画面推断 u，再用当前特征和 u 预测后续特征。"],
    policy: ["Execution: predict u from the current observation and task, then decode a command for this robot.", "执行：根据已有观测与任务预测 u，再结合本体状态与接口解码成机器人命令。"],
    planning: ["Planning: map each candidate robot command into u, predict its outcome, and rank the candidates.", "规划：将候选机器人命令映射为 u，预测后果，再对候选动作排序。"],
  };
  return messages[mode][language === "en" ? 0 : 1]!;
}
export function latentDiagram(mode: LatentMode = "video", language: Language = "en"): string {
  const labels: Record<string, readonly [string, string, string, string]> = {
    "frame-pair": ["Frame pair", "Now + next", "两帧画面", "当前 + 后续"],
    inverse: ["Inverse model", "Infer change", "逆模型", "推断变化"],
    latent: ["Latent action", "u", "潜动作", "u"],
    state: ["Current frame", "Features z(t)", "当前画面", "特征 z(t)"],
    dynamics: ["Dynamics", "Predict change", "动力学模型", "预测变化"],
    future: ["Future features", "Predicted z(t+1)", "未来特征", "预测 z(t+1)"],
    observation: ["Observation", "+ task", "已有观测", "+ 任务"],
    policy: ["Latent policy", "Predict u", "潜动作策略", "预测 u"],
    embodiment: ["Robot state", "+ interface", "本体状态", "+ 控制接口"],
    decoder: ["Command head", "Decode u", "动作解码器", "解码 u"],
    command: ["Robot action", "a", "机器人动作", "a"],
    candidate: ["Candidate", "Robot action a", "候选命令", "机器人动作 a"],
    projector: ["Projector", "Map a to u", "动作投影", "将 a 映射为 u"],
  };
  const route = latentRoutes[mode], points = new Map<string, { x: number; y: number }>();
  route.nodes.forEach((node, i) => points.set(node, { x: 10 + (i % 3) * 120, y: i < 3 ? 28 : 140 }));
  let body = `<defs><marker id="pi07-latent-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#237ab2"/></marker></defs>`;
  for (const [from, to] of route.edges) {
    const p = points.get(from)!, q = points.get(to)!;
    const path = p.y === q.y ? `M${p.x + 100} ${p.y + 25} H${q.x - 3}`
      : `M${p.x + 50} ${p.y + 50} V108 H${q.x + 50} V${q.y - 3}`;
    body += `<path data-from="${from}" data-to="${to}" d="${path}" fill="none" stroke="#237ab2" stroke-width="1.6" marker-end="url(#pi07-latent-arrow)"/>`;
  }
  for (const node of route.nodes) {
    const p = points.get(node)!, label = labels[node]!, offset = language === "en" ? 0 : 2;
    body += `<g data-node="${node}"><rect x="${p.x}" y="${p.y}" width="100" height="50" rx="5" fill="${node === 'latent' ? '#e1f3e9' : '#f1f7fb'}" stroke="${node === 'latent' ? '#8ab6a0' : '#9dbed1'}"/>`;
    body += text(p.x + 50, p.y + 21, label[offset]!, 12.5);
    body += text(p.x + 50, p.y + 39, label[offset + 1]!, 11.5, "middle", "#61747b") + "</g>";
  }
  const note = mode === "video" ? ["Match predicted and observed future features", "将预测与实际后续特征匹配"]
    : mode === "policy" ? ["Execute a, then observe again", "执行 a，再获取新的观测"]
    : ["Compare outcomes, then select a command", "比较预测结果，选择候选命令"];
  body += text(180, 225, note[language === "en" ? 0 : 1]!, 13, "middle", "#61747b");
  return svg("pi07-latent", 240, latentMessage(mode, language), body, 360);
}
function renderLatentFigure(): string {
  const labels = { video: ["Video · training", "视频 · 训练"], policy: ["Policy · execution", "策略 · 执行"], planning: ["Model · planning", "模型 · 规划"] };
  const buttons = latentModes.map(mode => `<button type="button" data-latent-mode="${mode}" aria-pressed="${mode === 'video'}">${bi(labels[mode][0]!, labels[mode][1]!)}</button>`).join("");
  return `<figure class="pi07-explainer" data-pi07-explainer="latent"><div class="pi07-controls" role="group" aria-label="Latent action interface">${buttons}</div><div class="pi07-diagram-frame" tabindex="0" role="region" aria-label="Latent action information flow"><div data-pi07-display>${latentDiagram()}</div></div><figcaption><span class="figure-title">Latent actions: training and control</span><p class="pi07-message" data-pi07-message aria-live="polite">${bi(latentMessage("video", "en"), latentMessage("video", "zh"))}</p><span class="figure-description">${bi("Switch between learning from recorded video and two possible control interfaces. The diagrams summarize design patterns.", "切换查看视频学习与两种控制接口。图中概括的是设计思路。")}</span></figcaption></figure>`;
}
export function renderPi07Figure(id: string): string {
  if (id === "latent") return renderLatentFigure();
  const matrix = id === "access";
  if (!matrix && id !== "tokens") throw Error(`Unknown π0.7 figure: ${id}`);
  const buttons = matrix
    ? groups.map((group, i) => `<button type="button" data-access-group="${i}" aria-pressed="${i === 3}">${group}</button>`).join("")
    : `<div class="pi07-mode">${(["causal", "bidirectional"] as const).map(mode => `<button type="button" data-token-mode="${mode}" aria-pressed="${mode === 'bidirectional'}">${bi(mode === "causal" ? "Text · causal" : "Actions · bidirectional", mode === "causal" ? "文本 · 因果" : "动作 · 双向")}</button>`).join("")}</div><div class="pi07-query">${[0, 1, 2, 3].map(i => `<button type="button" data-token-index="${i}" aria-pressed="${i === 0}">Token ${i + 1}</button>`).join("")}</div>`;
  return `<figure class="pi07-explainer" data-pi07-explainer="${id}"><div class="pi07-controls" role="group" aria-label="${matrix ? 'Query group' : 'Attention mode and query position'}">${buttons}</div><div class="pi07-diagram-frame" tabindex="0" role="region" aria-label="${matrix ? 'Token group visibility' : 'Token information paths'}"><div data-pi07-display>${matrix ? accessDiagram() : tokenDiagram()}</div></div><figcaption><span class="figure-title">${matrix ? 'Token visibility' : 'Causal and bidirectional attention'}</span><p class="pi07-message" data-pi07-message aria-live="polite">${bi(matrix ? accessMessage(3,"en") : tokenMessage("bidirectional",0,"en"), matrix ? accessMessage(3,"zh") : tokenMessage("bidirectional",0,"zh"))}</p><span class="figure-description">${bi(matrix ? 'Choose a query group to inspect its permitted inputs. Cells describe the mask.' : 'Choose a mode and query position. Four positions illustrate the token dependencies.', matrix ? '点击查询组查看允许读取的输入；格子表示掩码。' : '切换模式并选择查询位置，用四个位置展示 token 之间的依赖。')}</span><span class="figure-source">${bi('Adapted from ', '依据 ')}<a href="https://arxiv.org/html/2604.15483v2#A1.F19">π0.7, Fig. 19</a></span></figcaption></figure>`;
}
