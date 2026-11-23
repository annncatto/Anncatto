const editBase = 'https://github.com/annncatto/Anncatto/edit/main/content/';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const bilingual = (en, zh) => `<span lang="en">${en}</span><span lang="zh-CN">${zh}</span>`;
const pencil = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>';

export function sourceEditURL(source) {
  if (!source || source.startsWith('/') || source.includes('\\') || source.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error(`Invalid source path: ${source}`);
  return editBase + source.split('/').map(encodeURIComponent).join('/');
}

function sourceLabel(source, raw) {
  const heading = raw.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1]
    || raw.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1];
  if (!heading) return escape(source.split('/').at(-1).replace(/\.html$/, ''));
  const text = html => html.replace(/<[^>]*>/g, '').trim();
  // Preserve only heading text and the two language spans, never heading controls.
  const en = heading.match(/<span\b[^>]*lang="en"[^>]*>([\s\S]*?)<\/span>/)?.[1];
  const zh = heading.match(/<span\b[^>]*lang="zh-CN"[^>]*>([\s\S]*?)<\/span>/)?.[1];
  return en && zh ? bilingual(text(en), text(zh)) : text(heading);
}

export function articleSourceEdit(sources) {
  const entries = [...sources];
  const label = pencil + bilingual('Edit on GitHub', '在 GitHub 编辑');
  if (entries.length === 1)
    return `<a class="source-edit" href="${sourceEditURL(entries[0][0])}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const links = entries.map(([source, raw], index) => `<li><a href="${sourceEditURL(source)}" target="_blank" rel="noopener noreferrer">${index === 0 ? bilingual('Article structure', '文章结构') : sourceLabel(source, raw)}</a></li>`).join('');
  return `<details class="source-edit-menu"><summary class="source-edit">${label}</summary><ul>${links}</ul></details>`;
}

export function markSlideSources(raw, source) {
  return raw.replace(/<section\b(?=[^>]*\sdata-slide(?:\s|=|>))[^>]*>/g,
    tag => tag.replace(/>$/, ` data-source-edit="${sourceEditURL(source)}">`));
}

export function addSlideEditLink(html, fallbackSource) {
  const firstSource = html.match(/\bdata-source-edit="([^"]+)"/)?.[1] || sourceEditURL(fallbackSource);
  const link = `<a class="source-edit deck-source-edit" data-slide-edit href="${firstSource}" target="_blank" rel="noopener noreferrer">${pencil}<span class="source-edit-label">${bilingual('Edit', '编辑')}</span></a>`;
  return html.replace(/<(?:nav|div)\b[^>]*\bclass="[^"]*\bdeck-tools\b[^"]*"[^>]*>/, tag => tag + link);
}
