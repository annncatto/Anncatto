import fs from "node:fs/promises";
import path from "node:path";
import { stripBasePath } from "./paths.mjs";
const root = path.resolve("dist");
async function walk(p) {
  const a = [];
  for (const e of await fs.readdir(p, { withFileTypes: true })) {
    let n = path.join(p, e.name);
    a.push(...(e.isDirectory() ? await walk(n) : [n]));
  }
  return a;
}
const files = await walk(root);
let count = 0;
for (const file of files.filter((f) => f.endsWith(".html"))) {
  const html = await fs.readFile(file, "utf8");
  if (/\{\{figure:|katex-error/.test(html))
    throw Error(`Unrendered content in ${file}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  if (new Set(ids).size !== ids.length) throw Error(`Duplicate IDs: ${file}`);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = m[1];
    if (!link.startsWith("/") && !link.startsWith("#")) continue;
    const [p, hash] = link.split("#");
    let target = p ? path.join(root, stripBasePath(p.split("?")[0])) : file;
    if (p.endsWith("/")) target = path.join(target, "index.html");
    await fs.access(target);
    if (hash) {
      let text = target === file ? html : await fs.readFile(target, "utf8");
      if (!text.includes(`id="${hash}"`))
        throw Error(`Missing anchor ${link} in ${file}`);
    }
    count++;
  }
}
const posts = JSON.parse(await fs.readFile("content/posts.json", "utf8"));
for (const post of posts) {
  const source = await fs.readFile(path.join("content", post.source), "utf8");
  const article = await fs.readFile(
    path.join(root, "notes", post.slug, "index.html"),
    "utf8",
  );
  for (const [, id] of source.matchAll(/\{\{figure:(\w+)\}\}/g)) {
    if (!article.includes(`data-diagram="${id}"`)) {
      throw Error(`Missing ${id} diagram in ${post.slug}`);
    }
  }
  if (source.includes("$") && !article.includes("<math")) {
    throw Error(`Missing accessible math in ${post.slug}`);
  }
}
console.log(
  `Checked ${count} internal references; all article diagrams and MathML present.`,
);
