import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readArticleSource } from '../scripts/content.mjs';
import { sourceEditURL, articleSourceEdit, markSlideSources, addSlideEditLink } from '../scripts/source-edit.mjs';

test('GitHub editing preserves Unicode filenames and reserved URL characters', () => {
  const source = 'SmolVLA & 数值类型 #1.html';
  const url = new URL(sourceEditURL(source));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(decodeURIComponent(url.pathname), `/annncatto/Anncatto/edit/main/content/${source}`);
  assert.equal(url.search + url.hash, '');
  for (const invalid of ['../private.html', '/tmp/article.html', 'a/../b.html', 'a\\b.html'])
    assert.throws(() => sourceEditURL(invalid), /Invalid source path/);
});

test('nested slide chapters keep their own editable source instead of the parent wrapper', async t => {
  const directory = await fs.mkdtemp(path.resolve('content/.source-edit-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const prefix = path.basename(directory);
  await fs.writeFile(path.join(directory, 'deck.html'), `<nav class="deck-tools"></nav><section data-slide id="intro"></section>{{chapter:${prefix}/chapter.html}}`);
  await fs.writeFile(path.join(directory, 'chapter.html'), `<section id="chapter" data-slide=""></section>{{chapter:${prefix}/last.html}}`);
  await fs.writeFile(path.join(directory, 'last.html'), '<section data-slide-aliases="old" data-slide id="last"></section><section data-slide-aliases="not-a-slide"></section>');
  const source = `${prefix}/deck.html`;
  const html = addSlideEditLink(await readArticleSource(source, { transformSource: markSlideSources }), source);
  const targets = [...html.matchAll(/data-source-edit="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(targets, ['deck.html', 'chapter.html', 'last.html'].map(name => sourceEditURL(`${prefix}/${name}`)));
  assert.match(html, new RegExp(`data-slide-edit href="${sourceEditURL(source)}"`));
  assert.equal((html.match(/data-slide-edit /g) || []).length, 1);
  assert.ok(!html.includes('{{chapter:'));
  await fs.writeFile(path.join(directory, 'last.html'), `{{chapter:${prefix}/deck.html}}`);
  await assert.rejects(readArticleSource(source), /Invalid chapter/);
});

test('article editing lists each chapter once with its bilingual heading', () => {
  const sources = new Map([
    ['Article.html', '{{chapter:chapter.html}}'],
    ['chapter.html', '<h2 id="chapter"><span lang="en">Training &amp; loss</span><span lang="zh-CN">训练与损失</span></h2>'],
    ['figure.html', '<figure><figcaption><span lang="en">Attention paths</span><span lang="zh-CN">注意力路径</span></figcaption></figure>'],
  ]);
  const html = articleSourceEdit(sources);
  assert.match(html, /<details class="source-edit-menu">/);
  assert.match(html, /<span lang="zh-CN">训练与损失<\/span>/);
  assert.match(html, /<span lang="zh-CN">注意力路径<\/span>/);
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.ok(!html.includes('id="chapter"'));
  const single = articleSourceEdit(new Map([['Single.html', '<p>Article</p>']]));
  assert.match(single, /<a class="source-edit"/);
  assert.ok(!single.includes('<details'));
});
