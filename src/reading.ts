import { language, onLanguageChange } from "./language.js";

export function mountReadingNavigation() {
  const sidebar = document.querySelector<HTMLElement>("[data-reading-sidebar]");
  const article = document.querySelector<HTMLElement>("[data-reading-article]");
  if (!sidebar || !article) return;
  const meter = sidebar.querySelector<HTMLElement>(".reading-meter")!;
  const fill = sidebar.querySelector<HTMLElement>("[data-reading-fill]")!;
  const percent = sidebar.querySelector<HTMLElement>("[data-reading-percent]")!;
  const remaining = sidebar.querySelector<HTMLElement>("[data-reading-remaining]")!;
  const contents = sidebar.querySelector<HTMLDetailsElement>(".article-contents")!;
  const navigation = sidebar.querySelector<HTMLElement>("nav")!;
  const desktop = matchMedia("(min-width: 1180px)");
  const sections = [...navigation.querySelectorAll<HTMLAnchorElement>("a[href^='#']")]
    .map(link => ({ link, target: document.getElementById(link.hash.slice(1))!, top: 0 }));
  let start = 0, end = 0, frame = 0;

  function update() {
    frame = 0;
    const progress = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
    const value = Math.round(progress * 100);
    const total = Number(language === "en" ? sidebar!.dataset.minutesEn : sidebar!.dataset.minutesZh);
    const minutes = Math.ceil(total * (1 - progress));
    fill.style.transform = `scaleX(${progress})`;
    percent.textContent = `${value}%`;
    meter.setAttribute("aria-valuenow", String(value));
    meter.setAttribute("aria-label", language === "en" ? "Reading progress" : "阅读进度");
    meter.setAttribute("aria-valuetext", language === "en" ? `${value}% read` : `已阅读 ${value}%`);
    remaining.textContent = progress >= 1 ? (language === "en" ? "Finished" : "已读完")
      : language === "en" ? `About ${minutes} min left` : `剩余约 ${minutes} 分钟`;
    navigation.setAttribute("aria-label", language === "en" ? "Contents" : "文章目录");
    let current = sections[0];
    for (const section of sections) {
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
    for (const section of sections) section.top = section.target.getBoundingClientRect().top + scrollY;
    schedule();
  }
  function setLayout() { contents.open = desktop.matches; measure(); }
  navigation.addEventListener("click", event => {
    if (!desktop.matches && (event.target as Element).closest("a")) contents.open = false;
  });
  desktop.addEventListener("change", setLayout);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", measure);
  new ResizeObserver(measure).observe(article);
  onLanguageChange(measure);
  void document.fonts.ready.then(measure);
  setLayout();
}
