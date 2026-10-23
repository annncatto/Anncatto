import { language, onLanguageChange } from "./language.js";
import { accessDiagram, accessMessage, tokenDiagram, tokenMessage, latentDiagram, latentMessage, type TokenMode, type LatentMode } from "./pi07-diagrams.js";

export function mountPi07Explainers() {
  for (const figure of document.querySelectorAll<HTMLElement>("[data-pi07-explainer]")) {
    let group = 3, query = 0, mode: TokenMode = "bidirectional", latent: LatentMode = "video";
    const display = figure.querySelector<HTMLElement>("[data-pi07-display]")!;
    const message = figure.querySelector<HTMLElement>("[data-pi07-message]")!;
    function update() {
      const matrix = figure.dataset.pi07Explainer === "access";
      const isLatent = figure.dataset.pi07Explainer === "latent";
      display.innerHTML = isLatent ? latentDiagram(latent, language) : matrix ? accessDiagram(group, language) : tokenDiagram(mode, query, language);
      message.textContent = isLatent ? latentMessage(latent, language) : matrix ? accessMessage(group, language) : tokenMessage(mode, query, language);
      for (const button of figure.querySelectorAll<HTMLButtonElement>("button")) {
        const active = button.hasAttribute("data-access-group") ? Number(button.dataset.accessGroup) === group
          : button.hasAttribute("data-token-mode") ? button.dataset.tokenMode === mode
          : button.hasAttribute("data-latent-mode") ? button.dataset.latentMode === latent : Number(button.dataset.tokenIndex) === query;
        button.setAttribute("aria-pressed", String(active));
      }
    }
    figure.addEventListener("click", event => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button");
      if (!button || !figure.contains(button)) return;
      if (button.hasAttribute("data-access-group")) group = Number(button.dataset.accessGroup);
      if (button.hasAttribute("data-token-index")) query = Number(button.dataset.tokenIndex);
      if (button.hasAttribute("data-token-mode")) mode = button.dataset.tokenMode as TokenMode;
      if (button.hasAttribute("data-latent-mode")) latent = button.dataset.latentMode as LatentMode;
      update();
    });
    onLanguageChange(update);
    update();
  }
}
