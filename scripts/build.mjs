import fs from "node:fs/promises";
import path from "node:path";
import katex from "katex";
import { basePath } from "./paths.mjs";
import { renderDiagram, defaults, examples, diagramReadout } from "../.build/diagrams.js";
import { translateLabel } from "../.build/i18n.js";
const out = path.resolve("dist");
const esc = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
await fs.cp("public", path.join(out, "assets"), { recursive: true });
await fs.cp("content/images", path.join(out, "assets/content"), {
  recursive: true,
});
await fs.cp(".build", path.join(out, "assets"), { recursive: true });
await fs.mkdir(path.join(out, "assets/katex"), { recursive: true });
await fs.copyFile(
  "node_modules/katex/dist/katex.min.css",
  path.join(out, "assets/katex/katex.min.css"),
);
await fs.cp(
  "node_modules/katex/dist/fonts",
  path.join(out, "assets/katex/fonts"),
  { recursive: true },
);
await fs.copyFile(
  "node_modules/katex/LICENSE",
  path.join(out, "assets/katex/LICENSE"),
);
const posts = JSON.parse(await fs.readFile("content/posts.json", "utf8"));
const bilingual = (en, zh) => `<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
function figure(id, number) {
  const captions = {
    information: ["Probability and information", "概率与信息量", "Independent fair-coin tosses: compare the information carried by consecutive heads.", "独立抛公平硬币，比较连续正面事件的信息量。"],
    entropy: ["Cross-entropy and distribution matching", "交叉熵与分布匹配", "The target here is a soft distribution. Individual velocity labels are one-hot. Values are in bits.", "示意目标为软分布；实际单条底盘标签为 one-hot。数值以 bit 显示。"],
    l1: ["L1 and the direction of improvement", "L1 的调整方向", "The demonstrated action is zero. Arrows show the direction that reduces prediction error.", "示范动作固定为 0，箭头表示减小预测误差的方向。"],
    training: ["Action prediction and backpropagation", "动作预测与反向传播", "Solid: forward computation. Dashed: L1 and CE gradients flowing back through the network.", "实线表示前向计算，虚线表示 L1 和 CE 的梯度反传。"],
    gaussian: ["Posterior and prior", "后验与先验", "Fixed posterior q: mean 1.4, standard deviation 0.7. Solid: prior. Dashed: posterior.", "固定后验 q：均值 1.4、标准差 0.7。实线为先验，虚线为后验。"],
    network: ["Training and rollout", "训练与推理", "Training uses posterior q; rollout uses prior p. ACT(I, z) receives image features and z in both paths.", "训练从后验 q 采样，推理从先验 p 取值。ACT(I, z) 表示两条路径都使用图像特征和 z。"],
    temporal: ["Temporal ensembling", "时序融合", "Each column is an execution time. The blue outline selects predictions for t; bars show their weights.", "每列对应同一执行时刻，蓝框选中对 t 的预测；下方为融合权重。"],
  };
  const c = captions[id];
  if (!c) throw Error(`Unknown figure: ${id}`);
  const choices = (examples[id] || []).map(({ label, state }, i) => {
    const active = Object.entries(state).every(([key, value]) => defaults[id][key] === value);
    return `<button data-example="${i}" aria-pressed="${active}">${bilingual(translateLabel(label,"en"),label)}</button>`;
  }).join("");
  const title = bilingual(`Figure ${number}. ${c[0]}`, `图 ${number}　${c[1]}`);
  const readout = diagramReadout(id);
  return `<figure data-diagram="${id}"><div class="controls figure-modes">${choices ? `<div class="examples" role="group" aria-label="Examples">${choices}</div>` : ""}${id === "l1" ? `<p class="interaction-hint">${bilingual("Click the plot to change the prediction.","点击曲线可改变预测值。")}</p>` : ""}</div><p class="figure-scroll-hint">${bilingual("Scroll horizontally to see the full figure.","横向滑动查看完整图表")}</p><div class="diagram-frame" tabindex="0" role="region" aria-label="Figure ${number}"><div class="canvas-stage"><div class="svg-layer">${renderDiagram(id)}</div></div></div><figcaption><span class="figure-title">${title}</span>${readout ? `<span class="figure-readout" data-readout aria-live="polite">${readout}</span>` : ""}<span class="figure-description">${bilingual(c[2],c[3])}</span><a class="figure-export" href="/figures/${id}.svg" data-export download aria-label="Download Figure ${number} as SVG">SVG</a></figcaption></figure>`;
}

function math(s) {
  return s
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, x) =>
      katex.renderToString(
        x
          .replaceAll("&amp;", "&")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">"),
        {
          displayMode: true,
          throwOnError: true,
          output: "htmlAndMathml",
        },
      ),
    )
    .replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g, (_, x) =>
      katex.renderToString(
        x
          .replaceAll("&amp;", "&")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">"),
        {
          displayMode: false,
          throwOnError: true,
          output: "htmlAndMathml",
        },
      ),
    );
}
function shell(title, description, body, interactive = false) {
  return `<!doctype html>
<html lang="${interactive ? "en" : "zh-CN"}"${interactive ? ' data-language="en"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#ffffff">
<title>${esc(title)} · Anncatto</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/style.css">
${interactive ? '<link rel="stylesheet" href="/assets/katex/katex.min.css"><script type="module" src="/assets/app.js"></script>' : ""}
</head>
<body>
<a class="skip" href="#main">${interactive ? bilingual("Skip to article", "跳至正文") : "跳至正文"}</a>
<header class="sitebar container"><nav aria-label="Main navigation"><a href="/">Anncatto</a></nav>${interactive ? '<nav class="language-switch" aria-label="Article language"><button data-language-choice="en" aria-pressed="true">EN</button><button data-language-choice="zh" aria-pressed="false">中文</button></nav>' : ""}</header>
${body}
</body>
</html>`.replace(/\b(href|src)="\/(?!\/)/g, `$1="${basePath}/`);
}

async function write(rel, text) {
  const dest = path.join(out, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, text);
}
for (const p of posts) {
  let figureNumber = 0;
  const raw = await fs.readFile(path.join("content", p.source), "utf8"),
    content = math(raw.replace(/\{\{figure:(\w+)\}\}/g, (_, id) => figure(id, ++figureNumber)));
  const header = `<header class="article-header"><h1>${esc(p.title)}</h1><p class="meta"><time datetime="${p.date}">${p.date}</time></p></header>`;
  const toc = p.sections.length ? `<nav class="toc" aria-label="文章目录"><ol>${p.sections.map(([id, t], i) => `<li><a href="#${id}"><span class="toc-number">${i + 1}</span>${esc(t)}</a></li>`).join("")}</ol></nav>` : "";
  await write(
    `notes/${p.slug}/index.html`,
    shell(
      p.title,
      p.description,
      `<main id="main" class="container"><article>${header}${toc}<noscript><p class="noscript-note">Static figures are shown.</p></noscript>${content}</article></main>`,
      true,
    ),
  );
}
const listing = posts
  .map(
    (p) =>
      `<li class="entry"><article><h2><a href="/notes/${p.slug}/">${esc(p.title)}</a></h2><p>${esc(p.description)}</p><time datetime="${p.date}">${p.date}</time></article></li>`,
  )
  .join("");
await write(
  "index.html",
  shell(
    "文章",
    "Anncatto 的 AI 与机器人技术文章。",
    `<main id="main" class="container"><h1>文章</h1><ul class="entries">${listing}</ul></main>`,
  ),
);
await write(
  "404.html",
  shell(
    "页面不存在",
    "请从文章索引查找。",
    '<main id="main" class="container"><h1>页面不存在</h1><p><a href="/">返回文章列表</a>。</p></main>',
  ),
);
for (const id of Object.keys(defaults))
  await write(`figures/${id}.svg`, renderDiagram(id));
console.log(
  `Built ${posts.length} article(s), TypeScript modules, WGSL, ${Object.keys(defaults).length} SVG fallbacks and local KaTeX.`,
);
