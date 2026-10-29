import { language, onLanguageChange } from "./language.js";

export function mountReadingNavigation() {
  const sidebar = document.querySelector<HTMLElement>("[data-reading-sidebar]");
  const article = document.querySelector<HTMLElement>("[data-reading-article]");
  if (!sidebar || !article) return;
  const meter = sidebar.querySelector<HTMLElement>(".reading-meter")!;
  const fill = sidebar.querySelector<HTMLElement>("[data-reading-fill]")!;
  const percent = sidebar.querySelector<HTMLElement>("[data-reading-percent]")!;
  const time = sidebar.querySelector<HTMLElement>("[data-reading-time]")!;
  const cat = sidebar.querySelector<HTMLElement>("[data-reading-cat]")!;
  const contents = sidebar.querySelector<HTMLDetailsElement>(".article-contents")!;
  const navigation = sidebar.querySelector<HTMLElement>("nav")!;
  const desktop = matchMedia("(min-width: 1180px)");
  const sections = [...navigation.querySelectorAll<HTMLAnchorElement>("a[href^='#']")]
    .map(link => ({ link, target: document.getElementById(link.hash.slice(1))!, top: 0, visible: true }));
  let start = 0, end = 0, frame = 0;
  let scrollStop: ReturnType<typeof setTimeout> | undefined;

  function update() {
    frame = 0;
    const progress = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
    const value = Math.round(progress * 100);
    const total = Number(language === "en" ? sidebar!.dataset.minutesEn : sidebar!.dataset.minutesZh);
    const minutes = Math.max(1, Math.round(total * (1 - progress)));
    fill.style.transform = `scaleX(${progress})`;
    cat.style.left = `${Math.max(0, Math.min(meter.clientWidth - cat.offsetWidth, progress * meter.clientWidth - cat.offsetWidth / 2))}px`;
    percent.textContent = `${value}%`;
    meter.setAttribute("aria-valuenow", String(value));
    meter.setAttribute("aria-label", language === "en" ? "Reading progress" : "阅读进度");
    meter.setAttribute("aria-valuetext", language === "en" ? `${value}% read` : `已阅读 ${value}%`);
    time.textContent = progress >= 1 ? (language === "en" ? "Finished" : "已读完")
      : progress > 0 ? (language === "en" ? `About ${minutes} min left` : `还剩约 ${minutes} 分钟`)
      : language === "en" ? `${total} min read` : `预计 ${total} 分钟`;
    navigation.setAttribute("aria-label", language === "en" ? "Contents" : "文章目录");
    let current = sections[0];
    for (const section of sections) {
      if (!section.visible) continue;
      if (section.top <= scrollY + 132) current = section;
      else break;
    }
    for (const section of sections) {
      if (section === current) section.link.setAttribute("aria-current", "location");
      else section.link.removeAttribute("aria-current");
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  function measure() {
    start = article!.getBoundingClientRect().top + scrollY;
    end = article!.getBoundingClientRect().bottom + scrollY - innerHeight;
    for (const section of sections) {
      section.visible = section.target.checkVisibility();
      section.top = section.target.getBoundingClientRect().top + scrollY;
    }
    schedule();
  }
  function setLayout() { contents.open = desktop.matches; measure(); }
  navigation.addEventListener("click", event => {
    if (!desktop.matches && (event.target as Element).closest("a")) contents.open = false;
  });
  desktop.addEventListener("change", setLayout);
  addEventListener("scroll", () => {
    cat.classList.add("is-moving");
    clearTimeout(scrollStop);
    scrollStop = setTimeout(() => cat.classList.remove("is-moving"), 240);
    schedule();
  }, { passive: true });
  addEventListener("resize", measure);
  new ResizeObserver(measure).observe(article);
  onLanguageChange(measure);
  void document.fonts.ready.then(measure);
  setLayout();
}
