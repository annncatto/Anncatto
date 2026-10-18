import { renderDiagram, defaults, examples, diagramReadout, PLOT, SIZE, type DiagramId, type Mode } from "./diagrams.js";
import { clamp } from "./math.js";
import { mountCurveRenderer, type CurveRenderer } from "./gpu.js";
const states = structuredClone(defaults);
document.documentElement.classList.add("js");
for (const fig of document.querySelectorAll<HTMLElement>("[data-diagram]")) {
  const id = fig.dataset.diagram as DiagramId;
  const frame = fig.querySelector<HTMLElement>(".diagram-frame")!;
  const surface = fig.querySelector<HTMLElement>(".canvas-stage")!;
  const layer = fig.querySelector<HTMLElement>(".svg-layer")!;
  let renderer: CurveRenderer | null = null;
  function update() {
    layer.innerHTML = renderDiagram(id, states[id]);
    const readout = fig.querySelector("[data-readout]");
    if (readout) readout.textContent = diagramReadout(id, states[id]);
    for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-mode]"))
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === states[id].mode));
    for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-example]")) {
      const state = examples[id]![Number(btn.dataset.example)]!.state;
      btn.setAttribute("aria-pressed", String(Object.entries(state).every(([key, value]) => states[id][key as keyof typeof state] === value)));
    }
    renderer?.draw(states[id]);
  }
  for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-mode]"))
    btn.addEventListener("click", () => {
      states[id].mode = btn.dataset.mode as Mode;
      update();
    });
  for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-example]"))
    btn.addEventListener("click", () => {
      Object.assign(states[id], examples[id]![Number(btn.dataset.example)]!.state);
      update();
    });
  // Presets provide keyboard access; clicking the plot allows a precise comparison.
  if (id === "l1") frame.addEventListener("click", (event) => {
    const box = surface.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * SIZE.width;
    const y = (event.clientY - box.top) / box.height * SIZE.height;
    if (x < PLOT.left || x > PLOT.right || y < PLOT.top || y > PLOT.bottom + 32) return;
    states[id].prediction = Math.round(clamp((x - PLOT.left) / PLOT.width * 4 - 2, -2, 2) * 100) / 100;
    update();
  });
  fig.querySelector("[data-export]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const blob = new Blob([renderDiagram(id, states[id])], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = `${id}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  update();
  if (id === "gaussian" || id === "l1")
    void mountCurveRenderer(surface, id, states[id])
      .then((r) => { renderer = r; renderer?.draw(states[id]); })
      .catch((error) => console.warn("SVG fallback retained:", error));
}
