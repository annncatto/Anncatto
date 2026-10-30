export interface ReadingBlock {
  top: number;
  bottom: number;
  seconds: number;
}

export function readingSeconds(text: string, formulas = 0, figures = 0, codeLines = 0) {
  const words = (text.match(/[A-Za-z0-9]+(?:['’−-][A-Za-z0-9]+)*/g) || []).length;
  const characters = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return words / 200 * 60 + characters / 350 * 60
    + formulas * 9 + figures * 20 + codeLines * 2;
}

// Map the scrollable article range to the full content range. This reaches the
// last block when the viewport reaches the article's bottom.
export function readingEdge(scroll: number, top: number, bottom: number, viewport: number) {
  const range = Math.max(1, bottom - top - viewport);
  const fraction = Math.max(0, Math.min(1, (scroll - top) / range));
  return top + fraction * Math.max(0, bottom - top);
}

export function readingEstimate(blocks: readonly ReadingBlock[], edge: number) {
  let total = 0, remaining = 0;
  for (const block of blocks) {
    const seconds = Math.max(0, block.seconds);
    const fraction = Math.max(0, Math.min(1,
      (edge - block.top) / Math.max(1, block.bottom - block.top)));
    total += seconds;
    remaining += seconds * (1 - fraction);
  }
  return {total, remaining, progress: total > 0 ? 1 - remaining / total : 0};
}
