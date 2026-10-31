import { language, onLanguageChange } from './language.js';
import { advanceSlide, slideState, resolveSlideHash, type SlideState } from './slides-state.js';
import { mountOpenwamAttention } from './openwam-attention.js';

const deck = document.querySelector<HTMLElement>('[data-deck]');
if (deck) {
  const slides = [...deck.querySelectorAll<HTMLElement>('[data-slide]')];
  const builds = slides.map(el => Math.max(0, ...[...el.querySelectorAll<HTMLElement>('[data-step]')].map(el => Number(el.dataset.step))));
  const overview = document.querySelector<HTMLDialogElement>('[data-slide-overview]')!;
  const list = overview.querySelector<HTMLElement>('[data-slide-list]')!;
  const prev = document.querySelector<HTMLButtonElement>('[data-slide-prev]')!;
  const next = document.querySelector<HTMLButtonElement>('[data-slide-next]')!;
  const count = document.querySelector<HTMLElement>('[data-slide-count]')!;
  const buildControls = document.querySelector<HTMLElement>('[data-slide-builds]')!;
  const progress = document.querySelector<HTMLElement>('[data-slide-progress]')!;
  const status = document.querySelector<HTMLElement>('[data-slide-status]')!;
  let state: SlideState = {index: 0, step: 0};
  let overviewOrigin: HTMLElement | null = null;
  const title = (el: HTMLElement) => {
    const node = el.querySelector(`h1 [lang="${language === 'en' ? 'en' : 'zh-CN'}"],h2 [lang="${language === 'en' ? 'en' : 'zh-CN'}"]`);
    return node?.textContent || el.querySelector('h1,h2')?.textContent || '';
  };
  function render(announce = true) {
    slides.forEach((el, i) => {
      const active = i === state.index;
      el.classList.toggle('is-active', active);
      el.inert = !active;
      el.setAttribute('aria-hidden', String(!active));
      if (active) for (const image of el.querySelectorAll<HTMLImageElement>('img')) image.loading = 'eager';
      for (const fragment of el.querySelectorAll<HTMLElement>('[data-step]')) {
        const visible = deck!.dataset.filled === 'true' || Number(fragment.dataset.step) <= (active ? state.step : builds[i]);
        fragment.classList.toggle('is-visible', visible);
        fragment.classList.toggle('is-emphasized', active && state.step > 0 && Number(fragment.dataset.step) === state.step);
        fragment.setAttribute('aria-hidden', String(!visible));
        if (fragment instanceof HTMLElement) fragment.inert = !visible;
      }
    });
    deck!.dataset.step = String(state.step);
    count.textContent = `${String(state.index + 1).padStart(2, '0')} / ${slides.length}`;
    prev.disabled = state.index === 0 && state.step === 0;
    next.disabled = state.index === slides.length - 1 && state.step === builds[state.index];
    const more = state.step < builds[state.index];
    next.textContent = language === 'en' ? (more ? 'Next step →' : 'Next →') : (more ? '下一步 →' : '下一页 →');
    prev.textContent = language === 'en' ? '← Back' : '← 上一步';
    progress.style.width = `${(state.index + 1) / slides.length * 100}%`;
    progress.parentElement?.setAttribute('aria-valuenow', String(state.index + 1));
    buildControls.replaceChildren();
    if (builds[state.index]) for (let i = 0; i <= builds[state.index]; i++) {
      const b = document.createElement('button'); b.type = 'button';
      b.setAttribute('aria-label', language === 'en' ? `Build ${i + 1} of ${builds[state.index] + 1}` : `第 ${i + 1} 步，共 ${builds[state.index] + 1} 步`);
      b.setAttribute('aria-pressed', String(state.step === i));
      b.addEventListener('click', () => go({index: state.index, step: i})); buildControls.append(b);
    }
    if (announce) status.textContent = `${state.index + 1} / ${slides.length} · ${title(slides[state.index])}`;
    for (const b of list.querySelectorAll<HTMLElement>('button')) b.setAttribute('aria-current', String(Number(b.dataset.index) === state.index));
  }
  function go(nextState: SlideState, updateURL = true) {
    const previous = state.index; state = slideState(nextState.index, nextState.step, builds);
    if (previous !== state.index) slides[state.index].scrollTop = 0;
    render();
    // Builds stay in history state; copying a slide URL opens its complete explanation.
    if (updateURL) history.replaceState({slideStep: state.step}, '', `#${slides[state.index].id}`);
    window.dispatchEvent(new CustomEvent('slidechange', {detail: {...state}}));
  }
  function fromURL() {
    const hash = location.hash.slice(1);
    const i = resolveSlideHash(hash, slides.map(s => ({id: s.id, aliases: (s.dataset.slideAliases || '').split(' ').filter(Boolean)})));
    go(i >= 0 ? {index: i, step: builds[i]} : {index: 0, step: 0}, i >= 0 && slides[i].id !== hash);
  }
  prev.addEventListener('click', () => go(advanceSlide(state, -1, builds)));
  next.addEventListener('click', () => go(advanceSlide(state, 1, builds)));
  document.querySelector('[data-slide-show-all]')?.addEventListener('click', () => go({...state, step: builds[state.index]}));
  const closeOverview = () => {overview.close(); overviewOrigin?.focus({preventScroll: true});};
  document.querySelector('[data-slide-menu]')?.addEventListener('click', event => {
    overviewOrigin = event.currentTarget as HTMLElement; overview.showModal();
    list.querySelector<HTMLElement>(`[data-index="${state.index}"]`)?.focus();
  });
  overview.querySelector('[data-slide-close]')?.addEventListener('click', closeOverview);
  overview.addEventListener('click', event => {if (event.target === overview) closeOverview();});
  const papers = document.querySelector<HTMLDialogElement>('[data-paper-index]');
  document.querySelector('[data-paper-menu]')?.addEventListener('click', () => papers?.showModal());
  papers?.querySelector('[data-paper-close]')?.addEventListener('click', () => papers.close());
  papers?.addEventListener('click', event => {if (event.target === papers) papers.close();});
  for (const [index, slide] of slides.entries()) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.index = String(index);
    button.addEventListener('click', () => {closeOverview(); go({index, step: builds[index]});}); list.append(button);
  }
  const fsButton = document.querySelector<HTMLButtonElement>('[data-slide-fullscreen]')!;
  if (!document.fullscreenEnabled) fsButton.hidden = true;
  fsButton.addEventListener('click', async () => {
    try {if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();} catch {fsButton.hidden = true;}
  });
  function updateFullscreen() {fsButton.setAttribute('aria-pressed', String(!!document.fullscreenElement));}
  document.addEventListener('fullscreenchange', updateFullscreen);
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey) return;
    const targetElement = event.target as Element;
    if (targetElement.closest('input,select,textarea,[contenteditable="true"]')) return;
    const control = targetElement.closest('button,a');
    if (control && [' ', 'Enter'].includes(event.key)) return;
    let target: SlideState | undefined;
    if (['ArrowRight', ' ', 'PageDown'].includes(event.key)) target = advanceSlide(state, 1, builds, event.key === 'PageDown' || event.shiftKey);
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) target = advanceSlide(state, -1, builds, event.key === 'PageUp' || event.shiftKey);
    else if (event.key === 'Home') target = {index: 0, step: 0};
    else if (event.key === 'End') target = {index: slides.length - 1, step: builds.at(-1)!};
    if (target) {event.preventDefault(); go(target);}
  });
  // Swipe navigation excludes figures, controls and text selections.
  let touch: {x: number; y: number} | null = null;
  deck.addEventListener('touchstart', e => {
    touch = (e.target as Element).closest('figure,a,button,input,select,table') ? null : {x: e.touches[0].clientX, y: e.touches[0].clientY};
  }, {passive: true});
  deck.addEventListener('touchend', e => {
    if (!touch || window.getSelection()?.toString()) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 85 && Math.abs(dy) < 40) go(advanceSlide(state, dx < 0 ? 1 : -1, builds)); touch = null;
  }, {passive: true});
  window.addEventListener('hashchange', fromURL);
  onLanguageChange(() => {
    [...list.children].forEach((button, i) => {button.textContent = `${String(i + 1).padStart(2, '0')}   ${title(slides[i])}`;});
    render(false);
  });
  [...list.children].forEach((button, i) => {button.textContent = `${String(i + 1).padStart(2, '0')}   ${title(slides[i])}`;});
  document.documentElement.classList.add('slides-ready'); fromURL();
  deck.querySelectorAll<HTMLElement>('[data-mask-demo]').forEach(mountOpenwamAttention);
}
