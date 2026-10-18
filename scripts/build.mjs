import fs from "node:fs/promises";
import path from "node:path";
import katex from "katex";
import { basePath } from "./paths.mjs";
import { renderDiagram, defaults, examples, diagramReadout } from "../.build/diagrams.js";
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
function figure(id) {
  const captions = {
    information: ["1　概率与信息量", "独立抛公平硬币，比较连续正面事件的信息量。"],
    entropy: ["2　交叉熵与分布匹配", "示意目标为软分布；实际单条底盘标签为 one-hot。数值以 bit 显示。"],
    l1: ["3　L1 与预测误差", "示范值固定为 0；预测越接近示范，L1 越小。"],
    gaussian: ["4　后验与先验", "固定后验 q：均值 1.4、标准差 0.7。实线为先验，虚线为后验。"],
    network: ["5　条件潜变量", "实线：数据流；虚线：参与 KL 计算的分布。V 为图像特征的汇总。"],
    temporal: ["6　时序融合", "每列对应同一执行时刻，蓝框选中对 t 的预测；下方为融合权重。"],
  };
  const caption = captions[id];
  if (!caption) throw Error(`Unknown figure: ${id}`);
  const modes = id === "network"
    ? '<div class="modes" role="group" aria-label="网络阶段"><button data-mode="train" aria-pressed="true">训练</button><button data-mode="infer" aria-pressed="false">推理</button></div>'
    : "";
  const choices = (examples[id] || []).map(({ label, state }, i) => {
    const active = Object.entries(state).every(([key, value]) => defaults[id][key] === value);
    return `<button data-example="${i}" aria-pressed="${active}">${label}</button>`;
  }).join("");
  return `<figure data-diagram="${id}"><div class="figure-heading"><span>图 ${caption[0]}</span><a href="/figures/${id}.svg" data-export download aria-label="导出图 ${caption[0]} 的 SVG">SVG</a></div><div class="controls figure-modes">${modes}${choices ? `<div class="examples" role="group" aria-label="${caption[0]}的情境">${choices}</div>` : ""}${id === "l1" ? '<p class="interaction-hint">也可直接点击曲线区域，改变预测值。</p>' : ""}</div><p class="figure-scroll-hint">横向滑动查看完整图表</p><div class="diagram-frame" tabindex="0" role="region" aria-label="图 ${caption[0]}"><div class="canvas-stage"><div class="svg-layer">${renderDiagram(id)}</div></div></div>${diagramReadout(id) ? `<p class="figure-readout" data-readout aria-live="polite">${diagramReadout(id)}</p>` : ""}<figcaption>${caption[1]}</figcaption></figure>`;
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
<html lang="zh-CN">
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
<a class="skip" href="#main">跳至正文</a>
<header class="sitebar container"><nav aria-label="主导航"><a href="/">Anncatto</a></nav></header>
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
  const raw = await fs.readFile(path.join("content", p.source), "utf8"),
    content = math(raw.replace(/\{\{figure:(\w+)\}\}/g, (_, id) => figure(id)));
  const header = `<header class="article-header"><h1>${esc(p.title)}</h1><p class="meta"><time datetime="${p.date}">${p.date}</time></p></header>`;
  const toc = p.sections.length ? `<nav class="toc" aria-label="文章目录"><ol>${p.sections.map(([id, t], i) => `<li><a href="#${id}"><span class="toc-number">${i + 1}</span>${esc(t)}</a></li>`).join("")}</ol></nav>` : "";
  await write(
    `notes/${p.slug}/index.html`,
    shell(
      p.title,
      p.description,
      `<main id="main" class="container"><article>${header}${toc}<noscript><p class="noscript-note">当前显示静态图。</p></noscript>${content}</article></main>`,
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
