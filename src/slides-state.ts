/** Navigation uses a build index within each slide; direct links start fully visible. */
export type SlideState = { index: number; step: number };
export function resolveSlideHash(hash: string, slides: {id: string; aliases: string[]}[]): number {
  const id = hash.replace(/^#/, '');
  if (!id) return -1;
  const canonical = slides.findIndex(slide => slide.id === id);
  return canonical >= 0 ? canonical : slides.findIndex(slide => slide.aliases.includes(id));
}
export function slideState(index: number, step: number, builds: number[]): SlideState {
  const i = Math.max(0, Math.min(builds.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
  return { index: i, step: Math.max(0, Math.min(builds[i] ?? 0, Number.isFinite(step) ? Math.trunc(step) : 0)) };
}
export function advanceSlide(state: SlideState, direction: 1 | -1, builds: number[], pageOnly = false): SlideState {
  const {index, step} = slideState(state.index, state.step, builds);
  if (direction === 1) {
    if (!pageOnly && step < builds[index]) return {index, step: step + 1};
    return index < builds.length - 1 ? {index: index + 1, step: 0} : {index, step: builds[index]};
  }
  if (!pageOnly && step > 0) return {index, step: step - 1};
  return index > 0 ? {index: index - 1, step: builds[index - 1]} : {index: 0, step: 0};
}
export type DenoisingMode = 'sync' | 'video-variance' | 'action-variance' | 'video-offset' | 'action-offset';
export function denoisingPoint(s: number, mode: DenoisingMode, alpha = 4, offset = .5, rho = 5) {
  if (!(alpha > 0) || !(rho > 0) || offset < 0 || offset >= 1) throw new RangeError('Invalid schedule parameters');
  s = Math.max(0, Math.min(1, s));
  const f = (t: number) => alpha * t / (1 + (alpha - 1) * t);
  const h = (t: number) => Math.max((t - offset) / (1 - offset), 0);
  const g = (t: number) => t / (rho - (rho - 1) * t);
  const v = mode === 'video-variance' ? f(s) : mode === 'action-offset' ? h(s) : s;
  const a = mode === 'action-variance' ? f(s) : mode === 'video-offset' ? h(s) : s;
  return {video: g(v), action: g(a)};
}

export type VisibilityMode = 'isolated' | 'video' | 'action' | 'mutual';
export type AttentionStream = 'O' | 'V' | 'A';
/** Rows are queries, columns are keys. O is the first, clean observation frame. */
export function visibleAttentionSources(mode: VisibilityMode, query: AttentionStream): AttentionStream[] {
  if (query === 'O') return ['O'];
  if (query === 'V') return mode === 'video' || mode === 'mutual' ? ['O', 'V', 'A'] : ['O', 'V'];
  return mode === 'action' || mode === 'mutual' ? ['O', 'V', 'A'] : ['O', 'A'];
}
