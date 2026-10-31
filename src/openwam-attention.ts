import { language, onLanguageChange } from './language.js';
import { visibleAttentionSources, type AttentionStream, type VisibilityMode } from './slides-state.js';

export function mountOpenwamAttention(root: HTMLElement) {
  let mode: VisibilityMode = 'action', query: AttentionStream = 'A', animation = 0;
  const streams: AttentionStream[] = ['O', 'V', 'A'];
  const edges = streams.map(key => root.querySelector<SVGPathElement>(`[data-mask-edge="${key}"]`)!);
  const packets = streams.map(key => root.querySelector<SVGCircleElement>(`[data-mask-packet="${key}"]`)!);
  const stop = () => {cancelAnimationFrame(animation); packets.forEach(p => p.setAttribute('opacity', '0'));};
  function render(animate = false) {
    stop();
    const sources = visibleAttentionSources(mode, query);
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mask-mode]')) {
      const selected = button.dataset.maskMode === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.closest('tr')?.classList.toggle('is-selected', selected);
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mask-reader]')) {
      button.setAttribute('aria-pressed', String(button.dataset.maskReader === query));
    }
    root.querySelector('[data-mask-query]')!.textContent = `${query} · Query`;
    root.querySelector('[data-mask-readout]')!.textContent = language === 'en'
      ? `${query} reads ${sources.join(' + ')}.` : `${query} 读取 ${sources.join('＋')}。`;
    edges.forEach((edge, i) => {
      const allowed = sources.includes(streams[i]);
      edge.dataset.allowed = String(allowed);
      edge.setAttribute('stroke', allowed ? '#237ab2' : '#d2dcde');
      edge.setAttribute('stroke-dasharray', allowed ? 'none' : '4 5');
    });
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const started = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / 750);
      edges.forEach((edge, i) => {
        if (!sources.includes(streams[i])) return;
        const point = edge.getPointAtLength(edge.getTotalLength() * progress);
        packets[i].setAttribute('cx', String(point.x)); packets[i].setAttribute('cy', String(point.y));
        packets[i].setAttribute('opacity', progress < 1 ? '1' : '0');
      });
      if (progress < 1) animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
  }
  root.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.dataset.maskMode) mode = button.dataset.maskMode as VisibilityMode;
    else if (button.dataset.maskReader) query = button.dataset.maskReader as AttentionStream;
    else return;
    render(true);
  });
  onLanguageChange(() => render());
  window.addEventListener('slidechange', stop);
  document.addEventListener('visibilitychange', stop);
  render();
}
