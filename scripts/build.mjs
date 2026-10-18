import fs from "node:fs/promises";
import path from "node:path";
import katex from "katex";
import { basePath } from "./paths.mjs";
import { renderDiagram, defaults } from "../.build/diagrams.js";
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
function slider(label, key, min, max, step, value) {
  return `<label class="control"><span>${label}</span><output data-out="${key}">${value.toFixed(2)}</output><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}"></label>`;
}
function figure(id) {
  const captions = {
    information: [
      "1　为什么用负对数表示信息量",
      "事件越少见，发生时携带的信息越多。图中以 2 为底，单位为 bit；训练交叉熵用自然对数，数值需乘 ln 2。",
    ],
    entropy: [
      "2　预测分布匹配后，交叉熵为什么仍不为零",
      "每组左侧橙色空心柱是目标 P，右侧蓝色实心柱是预测 R。软目标用于演示分解；实际单条底盘标签是 one-hot。点击“匹配目标”，观察 KL 归零而目标熵不变。数值显示经过舍入。",
    ],
    l1: [
      "3　回归误差与动作折中是两个问题",
      "先看单个目标：移动预测值，比较两种误差惩罚。再切到两种等概率的相反示范：L1 的最优解可以是整个区间，平方 L2 选择中点。横轴是动作预测值，不是训练步数；示意数值无物理单位。",
    ],
    gaussian: [
      "4　KL 小，只说明两种分布接近",
      "蓝色实线及圆点为推理先验 p，橙色虚线为训练后验 q。均值相同不够，标准差也需匹配。此图固定 q 便于观察；训练中 q、p 都会更新。",
    ],
    network: [
      "5　训练看得到动作，推理看不到",
      "训练时，示范动作进入后验和损失计算；不会进入先验。先验和后验共用视觉汇总器，图中合并在对应模块内。KL 的虚线箭头表示分布输入，不表示动作传递或反向梯度。",
    ],
    temporal: [
      "6　时序融合对齐的是同一个执行时刻",
      "蓝色方框选中各个动作块对时刻 t 的预测，再按权重融合。i 从旧到新编号，所以正系数越大，越偏向旧预测。这张图只讨论参与融合的连续动作。",
    ],
  };
  const caption = captions[id];
  if (!caption) throw Error(`Unknown figure: ${id}`);
  let parameters = "",
    actions = "",
    modes = "";
  if (id === "network")
    modes =
      '<div class="modes"><button data-mode="train" aria-pressed="true">训练</button><button data-mode="infer" aria-pressed="false">推理</button></div>';
  if (id === "information")
    parameters = slider("事件概率 p", "probability", 0.02, 1, 0.01, 0.25);
  if (id === "temporal")
    parameters = slider(
      "融合系数 m（0 为等权）",
      "coefficient",
      0,
      0.5,
      0.01,
      0.01,
    );
  if (id === "gaussian") {
    parameters =
      slider("先验均值 μp", "mu", -2, 3, 0.01, 0) +
      slider("先验标准差 σp", "sigma", 0.45, 2, 0.01, 1);
    actions = "<button data-match>匹配后验</button>";
  }
  if (id === "entropy") {
    parameters =
      slider("负向概率 R₋", "r0", 0.02, 0.96, 0.001, 0.25) +
      slider("剩余概率中，停止所占比例", "r1", 0.02, 0.98, 0.001, 0.5);
    actions = "<button data-match>匹配目标</button>";
  }
  if (id === "l1") {
    modes =
      '<div class="modes"><button data-loss-mode="single" aria-pressed="true">单个目标</button><button data-loss-mode="bimodal" aria-pressed="false">两种相反示范</button></div>';
    parameters = slider("预测值 â", "prediction", -2, 2, 0.01, 0.5);
  }
  if (parameters) actions += "<button data-reset>重置</button>";
  return `<figure data-diagram="${id}"><div class="figure-heading"><span>图 ${caption[0]}</span><a href="/figures/${id}.svg" data-export download aria-label="导出图 ${caption[0]} 的 SVG">SVG</a></div><div class="controls figure-modes">${modes}</div><p class="figure-scroll-hint">横向滑动查看完整图表</p><div class="diagram-frame" tabindex="0" role="region" aria-label="图 ${caption[0]}"><div class="canvas-stage"><div class="svg-layer">${renderDiagram(id)}</div></div></div>${parameters ? `<div class="controls"><div class="parameter-grid">${parameters}</div><div class="actions">${actions}</div></div>` : ""}<figcaption ${id === "network" ? 'data-network-note aria-live="polite"' : ""}>${caption[1]}</figcaption></figure>`;
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
