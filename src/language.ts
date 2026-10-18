import { type Language } from "./i18n.js";
export let language: Language = "en";
const listeners = new Set<() => void>();
try { if (localStorage.getItem("article-language") === "zh") language = "zh"; } catch {}
function setLanguage(next: Language) {
  language = next;
  document.documentElement.dataset.language = language;
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  for (const button of document.querySelectorAll<HTMLElement>("[data-language-choice]"))
    button.setAttribute("aria-pressed", String(button.dataset.languageChoice === language));
  try { localStorage.setItem("article-language", language); } catch {}
  listeners.forEach(update => update());
}
export function onLanguageChange(update: () => void) { listeners.add(update); }
document.documentElement.classList.add("js");
for (const button of document.querySelectorAll<HTMLElement>("[data-language-choice]"))
  button.addEventListener("click", () => setLanguage(button.dataset.languageChoice as Language));
setLanguage(language);
