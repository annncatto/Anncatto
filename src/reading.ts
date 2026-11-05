import { language, onLanguageChange } from "./language.js";
import { readingEdge, readingEstimate, readingSeconds, type ReadingBlock } from "./reading-math.js";

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
  const unitSelector = "p,li,table,pre,figure,.katex-display";
  const units = [...article.querySelectorAll<HTMLElement>(unitSelector)]
    .filter(element => !element.closest(".article-header,.article-end,noscript"))
    .filter(element => {
      const parent = element.parentElement?.closest(unitSelector);
      return !parent || !article.contains(parent);
    })
    .map(element => {
      const cost = (lang: "en" | "zh") => {
        const owner = element.closest<HTMLElement>("[lang]");
        if (owner && article.contains(owner) && owner.lang.split("-")[0] !== lang) return 0;
        if (element.tagName === "FIGURE") return readingSeconds("", 0, 1);
        if (element.classList.contains("katex-display")) return readingSeconds("", 1);
        if (element.tagName === "PRE") return readingSeconds("", 0, 0,
          (element.textContent || "").trim().split("\n").length);
        const clone = element.cloneNode(true) as HTMLElement;
        for (const node of clone.querySelectorAll<HTMLElement>("[lang]"))
          if (node.lang.split("-")[0] !== lang) node.remove();
        const formulas = clone.querySelectorAll(".katex-display").length;
        const figures = clone.querySelectorAll("figure").length;
        const codeLines = [...clone.querySelectorAll("pre")]
          .reduce((n, pre) => n + (pre.textContent || "").trim().split("\n").length, 0);
        for (const node of clone.querySelectorAll("script,style,button,input,select,svg,.katex-display,.katex,figure,pre"))
          node.remove();
        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        const text: string[] = [];
        while (walker.nextNode()) text.push(walker.currentNode.textContent || "");
        return readingSeconds(text.join(" "), formulas, figures, codeLines);
      };
      return {element, en: cost("en"), zh: cost("zh")};
    });
  let start = 0, bottom = 0, frame = 0, measureFrame = 0;
  let blocks: ReadingBlock[] = [];
  let scrollStop: ReturnType<typeof setTimeout> | undefined;

  function update() {
    frame = 0;
    const estimate = readingEstimate(blocks, readingEdge(scrollY, start, bottom, innerHeight));
    const progress = estimate.progress;
    const value = progress >= 1 ? 100 : Math.min(99, Math.floor(progress * 100));
    const total = Math.max(1, Math.ceil(estimate.total / 60));
    const minutes = Math.max(1, Math.ceil(estimate.remaining / 60));
    fill.style.transform = `scaleX(${progress})`;
    cat.style.left = `${Math.max(0, Math.min(meter.clientWidth - cat.offsetWidth, progress * meter.clientWidth - cat.offsetWidth / 2))}px`;
    percent.textContent = `${value}%`;
    meter.setAttribute("aria-valuenow", String(value));
    meter.setAttribute("aria-label", language === "en" ? "Reading progress" : "阅读进度");
    meter.setAttribute("aria-valuetext", language === "en" ? `${value}% read` : `已阅读 ${value}%`);
    time.textContent = progress >= 1 ? (language === "en" ? "End of article" : "已到文末")
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
    measureFrame = 0;
    start = article!.getBoundingClientRect().top + scrollY;
    bottom = article!.getBoundingClientRect().bottom + scrollY;
    blocks = units.filter(unit => unit.element.checkVisibility()).map(unit => {
      const rect = unit.element.getBoundingClientRect();
      return {top: rect.top + scrollY, bottom: rect.bottom + scrollY, seconds: unit[language]};
    });
    for (const section of sections) {
      section.visible = section.target.checkVisibility();
      section.top = section.target.getBoundingClientRect().top + scrollY;
    }
    schedule();
  }
  function scheduleMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }
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
  addEventListener("resize", scheduleMeasure);
  article.addEventListener("toggle", scheduleMeasure, true);
  new ResizeObserver(scheduleMeasure).observe(article);
  onLanguageChange(scheduleMeasure);
  void document.fonts.ready.then(scheduleMeasure);
  setLayout();
}
