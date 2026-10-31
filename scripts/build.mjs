import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import katex from "katex";
import { basePath } from "./paths.mjs";
import { renderDiagram, defaults, examples, diagramReadout } from "../.build/diagrams.js";
import { translateLabel } from "../.build/i18n.js";
import { pixelCatSVG } from "../.build/pixel-cat.js";
import { renderPi07Figure } from "../.build/pi07-diagrams.js";
import { renderCourseFigure } from '../.build/lightweight-course.js';
import { renderLightweightFigure } from '../.build/lightweight-diagrams.js';
import { readArticleSource } from './content.mjs';
import { renderSmolFigure, renderSmolMedia } from '../.build/smolvla-figures.js';
import { renderOpenwamDiagram } from '../.build/openwam-slide-diagrams.js';
import { build as bundle } from 'esbuild';
await bundle({entryPoints:['src/lightweight-lab.ts'],outfile:'.build/lightweight-lab.js',bundle:true,format:'esm',target:'es2022',minify:true,external:['./language.js'],legalComments:'eof',banner:{js:'/*! Includes Three.js (MIT). License: assets/licenses/three-LICENSE.txt */'}});
await bundle({entryPoints:['src/concept-worker.ts'],outfile:'.build/concept-worker.js',bundle:true,format:'esm',target:'es2022',minify:true,plugins:[{name:'mujoco-runtime',setup(build){build.onResolve({filter:/^@mujoco\/mujoco$/},()=>({path:'./vendor/mujoco/mujoco.js',external:true}));}}]});
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
await fs.mkdir(path.join(out,'assets/vendor/mujoco'),{recursive:true});
for(const name of ['mujoco.js','mujoco.wasm'])await fs.copyFile(path.join('node_modules/@mujoco/mujoco',name),path.join(out,'assets/vendor/mujoco',name));
const moduleNames = (await fs.readdir(".build")).filter(name => name.endsWith(".js")).sort();
const versionHash = createHash("sha256");
for (const name of moduleNames) versionHash.update(await fs.readFile(path.join(".build", name)));
versionHash.update(await fs.readFile("public/style.css"));
versionHash.update(await fs.readFile("public/fonts.css"));
versionHash.update(await fs.readFile("public/slides.css"));
const assetVersion = versionHash.digest("hex").slice(0, 12);
for (const name of moduleNames) {
  const source = await fs.readFile(path.join(".build", name), "utf8");
  const versioned = source.replace(/((?:from\s*|import\s*)["'])(\.[^"']+\.js)(["'])/g,
    (_, start, rel, end) => `${start}${rel}?v=${assetVersion}${end}`);
  await fs.writeFile(path.join(out, "assets", name), versioned);
}

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
function shell(title, description, body, interactive = false, module = '', presentation = false) {
  return `<!doctype html>
<html lang="en" data-language="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#ffffff">
<title>${esc(title)} · Anncatto</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/style.css">
${presentation ? '<link rel="stylesheet" href="/assets/slides.css">' : ''}
${interactive ? '<link rel="stylesheet" href="/assets/katex/katex.min.css"><script type="module" src="/assets/app.js"></script>' : '<script type="module" src="/assets/language.js"></script>'}
${module ? `<script type="module" src="/assets/${module}.js"></script>` : ''}
</head>
<body${presentation ? ' class="presentation-page"' : ''}>
<a class="skip" href="#main">${bilingual("Skip to content", "跳至正文")}</a>
${presentation ? '' : `<header class="sitebar container"><nav aria-label="Main navigation"><a href="/">Anncatto</a></nav><nav class="language-switch" aria-label="Article language"><button data-language-choice="en" aria-pressed="true">EN</button><button data-language-choice="zh" aria-pressed="false">中文</button></nav></header>`}
${body}
</body>
</html>`.replace(/\b(href|src|poster)="\/(?!\/)/g, `$1="${basePath}/`)
    .replace(/(href|src)="([^"?]*\/assets\/[^"?]+\.(?:js|css))"/g, `$1="$2?v=${assetVersion}"`);
}

async function write(rel, text) {
  const dest = path.join(out, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, text);
}
function readingMinutes(raw, language) {
  const code = [...raw.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)];
  const prose = [...raw.matchAll(new RegExp('<(p|ul|ol) lang="' + language + '">([\\s\\S]*?)</\\1>', 'g'))]
    .map(match => match[2].replace(/\$[^$]*\$/g, ' ').replace(/<[^>]*>/g, ' ')).join(' ');
  const words = (prose.match(/[A-Za-z0-9]+(?:['’−-][A-Za-z0-9]+)*/g) || []).length;
  const characters = (prose.match(/[\u3400-\u9fff]/g) || []).length;
  const formulas = [...raw.matchAll(/\$\$[\s\S]*?\$\$/g)].length;
  const figures = [...raw.matchAll(/\{\{figure:|\{\{pi07:|\{\{lightweight:|\{\{course:|\{\{smolvla:|\{\{svmedia:|<figure\b/g)].length;
  const tableText = [...raw.matchAll(new RegExp(`<span lang="${language}">([\\s\\S]*?)<\\/span>`, "g"))]
    .filter(match => raw.lastIndexOf("<table", match.index) > raw.lastIndexOf("</table>", match.index))
    .map(match => match[1].replace(/<[^>]*>/g, " ")).join(" ");
  const tableWords = (tableText.match(/[A-Za-z0-9]+(?:['’−-][A-Za-z0-9]+)*/g) || []).length;
  const tableCharacters = (tableText.match(/[\u3400-\u9fff]/g) || []).length;
  const codeLines = code.reduce((sum, match) => sum + match[1].split("\n").length, 0);
  return Math.max(1, Math.ceil((words + tableWords) / 200 + (characters + tableCharacters) / 350 + (formulas * 9 + figures * 20 + codeLines * 2) / 60));
}
function readingSidebar(raw, title, titleEn=title, maxDepth=3) {
  const sections = [];
  const parents = [];
  for (const match of raw.matchAll(/<h([234])\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const level = Number(match[1]);
    if (level > maxDepth) continue;
    const heading = language => (match[3].match(new RegExp(`<span lang="${language}">([\\s\\S]*?)<\\/span>`))?.[1] || match[3]).replace(/<[^>]*>/g, "");
    const section = { id: match[2], en: heading("en"), zh: heading("zh-CN"), children: [] };
    while (parents.length && parents.at(-1).level >= level) parents.pop();
    if (parents.length) parents.at(-1).section.children.push(section);
    else sections.push(section);
    parents.push({level, section});
  }
  const contentsLink = section => `<a href="#${esc(section.id)}">${bilingual(esc(section.en), esc(section.zh))}</a>`;
  const contentsItems = items => items.map(section => `<li>${contentsLink(section)}${section.children.length ? `<ol class="contents-subsections">${contentsItems(section.children)}</ol>` : ""}</li>`).join("");
  const tree = contentsItems(sections);
  const en = readingMinutes(raw, "en"), zh = readingMinutes(raw, "zh-CN");
  return `<aside class="reading-sidebar" data-reading-sidebar data-minutes-en="${en}" data-minutes-zh="${zh}"><div class="reading-status"><div class="reading-summary"><span data-reading-time>${bilingual(`Full article: ~${en} min`, `全文约 ${zh} 分钟`)}</span><span data-reading-percent>0%</span></div><div class="reading-meter" role="progressbar" aria-label="Reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-reading-fill></span><span class="reading-cat" data-reading-cat aria-hidden="true">${pixelCatSVG()}</span></div></div><details class="article-contents" open><summary>${bilingual("Contents", "目录")}</summary><nav aria-label="Contents"><p class="contents-title">${bilingual("Contents", "目录")}</p><a class="contents-root" href="#article-top" aria-current="location">${bilingual(esc(titleEn),esc(title))}</a><ol>${tree}</ol></nav></details></aside>`;
}
for (const p of posts) {
  let figureNumber = 0;
  const raw = await readArticleSource(p.source),
    content = math(raw.replace(/\{\{figure:(\w+)\}\}/g, (_, id) => figure(id, ++figureNumber))
      .replace(/\{\{pi07:(\w+)\}\}/g, (_, id) => renderPi07Figure(id))
      .replace(/\{\{lightweight:(\w+)\}\}/g, (_, id) => renderLightweightFigure(id))
      .replace(/\{\{course:(\w+)\}\}/g, (_, id) => renderCourseFigure(id))
      .replace(/\{\{smolvla:(\w+)\}\}/g, (_, id) => renderSmolFigure(id))
      .replace(/\{\{svmedia:([\w|\-]+)\}\}/g, (_, ids) => renderSmolMedia(ids)));
  const header = `<header class="article-header"><h1>${p.titleEn?bilingual(esc(p.titleEn),esc(p.title)):esc(p.title)}</h1><p class="meta"><time datetime="${p.date}">${p.date}</time>${p.presentation ? ` · <a href="/notes/${p.slug}/slides/">${bilingual('Presentation ↗','幻灯片 ↗')}</a>` : ''}</p></header>`;
  const sidebar = readingSidebar(raw, p.title, p.titleEn, p.tocDepth ?? (p.module === "dit-heads" ? 4 : 3));
  await write(
    `notes/${p.slug}/index.html`,
    shell(
      p.title,
      p.descriptionEn,
      `<main id="main" class="container article-layout">${sidebar}<article id="article-top" data-reading-article>${header}<noscript><p class="noscript-note">Static figures are shown.</p></noscript>${content}<footer class="article-end"><a class="article-home" data-article-home href="/"><svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true"><path d="M36 12H5M15 3L5 12l10 9"/></svg><span>${bilingual("Home", "首页")}</span></a></footer></article></main>`,
      true,
      p.module || '',
    ),
  );
  if (p.presentation) {
    const slides = math((await readArticleSource(p.presentation))
      .replace(/\{\{openwam:([\w-]+)\}\}/g, (_, id) => renderOpenwamDiagram(id)));
    await write(`notes/${p.slug}/slides/index.html`, shell(p.title, p.descriptionEn, slides, true, 'slides', true));
  }
}
const listing = posts
  .map(
    (p) =>
      `<li class="entry"><article><h2><a href="/notes/${p.slug}/${p.presentation ? 'slides/' : ''}">${p.titleEn?bilingual(esc(p.titleEn),esc(p.title)):esc(p.title)}</a></h2><p>${bilingual(esc(p.descriptionEn),esc(p.description))}</p><div class="entry-meta"><time datetime="${p.date}">${p.date}</time>${p.presentation ? ` <a class="entry-format" href="/notes/${p.slug}/">${bilingual('Full article','全文')}</a>` : ''}</div></article></li>`,
  )
  .join("");
await write(
  "index.html",
  shell(
    "Articles",
    "AI and robotics articles by Anncatto.",
    `<main id="main" class="container"><h1>${bilingual("Articles","文章")}</h1><ul class="entries">${listing}</ul><section class="home-tools" aria-labelledby="tools-heading"><h2 id="tools-heading">${bilingual("Interactive tools","交互工具")}</h2></section></main>`,
  ),
);
await write(
  "404.html",
  shell(
    "Page not found",
    "Find an article in the index.",
    `<main id="main" class="container"><h1>${bilingual("Page not found","页面不存在")}</h1><p><a href="/">${bilingual("Back to articles","返回文章列表")}</a></p></main>`,
  ),
);
await write('labs/lightweight-robot/index.html',shell('Lightweight Concept Design','Parametric robot assemblies, material and section sizing, manufacturing and contact dynamics.',await fs.readFile('content/lightweight-lab.html','utf8'),true,'lightweight-lab'));
for (const id of Object.keys(defaults))
  await write(`figures/${id}.svg`, renderDiagram(id));
await write("figures/reading-cat.svg", pixelCatSVG());
console.log(
  `Built ${posts.length} article(s), TypeScript modules, WGSL, ${Object.keys(defaults).length} SVG fallbacks and local KaTeX.`,
);
