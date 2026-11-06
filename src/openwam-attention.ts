import { language, onLanguageChange } from './language.js';
import { crossAttentionConnections, type CrossAttentionConnection, type VisibilityMode } from './slides-state.js';

export function mountOpenwamAttention(root: HTMLElement) {
  let mode: VisibilityMode = 'action', animation = 0;
  const directions: CrossAttentionConnection[] = ['AV', 'VA'];
  const edges = directions.map(key => root.querySelector<SVGPathElement>(`[data-mask-edge="${key}"]`)!);
  const packets = directions.map(key => root.querySelector<SVGCircleElement>(`[data-mask-packet="${key}"]`)!);
  const readouts = {
    en: {
      isolated: 'Isolated: Qᵥ cannot read action Kₐ/Vₐ, and Qₐ cannot read video Kᵥ/Vᵥ. Self- and observation attention remain.',
      video: 'A → V: video Qᵥ matches action Kₐ; attention weights combine action Vₐ to update video tokens.',
      action: 'V → A: action Qₐ matches video Kᵥ; attention weights combine video Vᵥ to update action tokens.',
      mutual: 'Mutual: video Qᵥ reads action Kₐ/Vₐ; action Qₐ reads video Kᵥ/Vᵥ. Each output updates its Query stream.',
    },
    zh: {
      isolated: '隔离：视频 Qᵥ 不读取动作 Kₐ/Vₐ，动作 Qₐ 不读取视频 Kᵥ/Vᵥ；两流保留流内注意力与观测通路。',
      video: 'A → V：Qᵥ 来自未来视频 token，匹配动作 Kₐ，并加权汇总 Vₐ；结果更新视频 token。',
      action: 'V → A：Qₐ 来自动作 token，匹配视频 Kᵥ，并加权汇总 Vᵥ；结果更新动作 token。',
      mutual: '双向：视频 Qᵥ 读取动作 Kₐ/Vₐ，动作 Qₐ 读取视频 Kᵥ/Vᵥ；两路注意力分别更新各自 token。',
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
