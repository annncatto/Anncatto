import { language, onLanguageChange } from './language.js';
import { crossAttentionConnections, type CrossAttentionConnection, type VisibilityMode } from './slides-state.js';

export function mountOpenwamAttention(root: HTMLElement) {
  let mode: VisibilityMode = 'action', animation = 0;
  const directions: CrossAttentionConnection[] = ['AV', 'VA'];
  const edges = directions.map(key => root.querySelector<SVGPathElement>(`[data-mask-edge="${key}"]`)!);
  const packets = directions.map(key => root.querySelector<SVGCircleElement>(`[data-mask-packet="${key}"]`)!);
  const readouts = {
    en: {
      isolated: 'No cross-stream connection; each stream attends within itself and to O.',
      video: 'A → V: the world stream reads action features.',
      action: 'V → A: the action stream reads world features.',
      mutual: 'A ↔ V: the world and action streams read each other.',
    },
    zh: {
      isolated: '无跨流连接；两流各自进行流内注意力并读取 O。',
      video: 'A → V：世界流读取动作特征。',
      action: 'V → A：动作流读取世界特征。',
      mutual: 'A ↔ V：世界流与动作流相互读取。',
    },
  };
  const stop = () => {cancelAnimationFrame(animation); packets.forEach(p => p.setAttribute('opacity', '0'));};
  function render(animate = false) {
    stop();
    const connections = crossAttentionConnections(mode);
    root.dataset.maskMode = mode;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mask-mode]')) {
      const selected = button.dataset.maskMode === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.closest('tr')?.classList.toggle('is-selected', selected);
    }
    root.querySelector('[data-mask-readout]')!.textContent = readouts[language][mode];
    edges.forEach((edge, i) => {
      const allowed = connections.includes(directions[i]);
      edge.dataset.allowed = String(allowed);
      edge.setAttribute('stroke', allowed ? (directions[i] === 'AV' ? '#4b9c80' : '#237ab2') : '#d2dcde');
      edge.setAttribute('stroke-dasharray', allowed ? 'none' : '4 5');
    });
    if (!animate || !connections.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const started = performance.now();
    const frame = (now: number) => {
      const elapsed = now - started;
      if (elapsed >= 1600) {stop(); return;}
      const progress = (elapsed % 800) / 800;
      edges.forEach((edge, i) => {
        if (!connections.includes(directions[i])) return;
        const point = edge.getPointAtLength(edge.getTotalLength() * progress);
        packets[i].setAttribute('cx', String(point.x)); packets[i].setAttribute('cy', String(point.y));
        packets[i].setAttribute('opacity', '1');
      });
      animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
  }
  root.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (!button.dataset.maskMode) return;
    mode = button.dataset.maskMode as VisibilityMode;
    render(true);
  });
  onLanguageChange(() => render());
  window.addEventListener('slidechange', stop);
  document.addEventListener('visibilitychange', stop);
  render();
}
