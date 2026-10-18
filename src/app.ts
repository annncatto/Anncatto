import {
  renderDiagram,
  defaults,
  PLOT,
  SIZE,
  type DiagramId,
  type Mode,
  type LossMode,
} from "./diagrams.js";
import { clamp } from "./math.js";
import { mountCurveRenderer, type CurveRenderer } from "./gpu.js";
const states = structuredClone(defaults);
document.documentElement.classList.add("js");
for (const fig of document.querySelectorAll<HTMLElement>("[data-diagram]")) {
  const id = fig.dataset.diagram as DiagramId;
  const frame = fig.querySelector<HTMLElement>(".diagram-frame")!;
  const surface = fig.querySelector<HTMLElement>(".canvas-stage")!;
  const layer = fig.querySelector<HTMLElement>(".svg-layer")!;
  const note = fig.querySelector<HTMLElement>("[data-network-note]");
  let renderer: CurveRenderer | null = null;
  function update() {
    layer.innerHTML = renderDiagram(id, states[id]);
    for (const input of fig.querySelectorAll<HTMLInputElement>(
      "input[data-key]",
    )) {
      const key = input.dataset.key as
          | "mu"
          | "sigma"
          | "r0"
          | "r1"
          | "prediction"
          | "probability"
          | "coefficient",
        val = states[id][key]!;
      input.value = String(val);
      fig.querySelector<HTMLOutputElement>(`[data-out="${key}"]`)!.value =
        val.toFixed(2);
    }
    for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-mode]"))
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.mode === states[id].mode),
      );
    for (const btn of fig.querySelectorAll<HTMLButtonElement>(
      "[data-loss-mode]",
    ))
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.lossMode === states[id].lossMode),
      );
    if (note)
      note.textContent =
        states[id].mode === "infer"
          ? "推理只读取当前观测。mean 使用当前先验均值；sample + phase 复用采样的 z，直到显式刷新。完整空间图像特征仍直接输入 ACT。"
          : "训练时，示范动作进入后验和损失计算；不会进入先验。先验和后验共用视觉汇总器，图中合并在对应模块内。KL 的虚线箭头表示分布输入，不表示动作传递或反向梯度。";
    renderer?.draw(states[id]);
  }
  for (const input of fig.querySelectorAll<HTMLInputElement>("input[data-key]"))
    input.addEventListener("input", () => {
      states[id][
        input.dataset.key as
          | "mu"
          | "sigma"
          | "r0"
          | "r1"
          | "prediction"
          | "probability"
          | "coefficient"
      ] = Number(input.value);
      update();
    });
  for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-mode]"))
    btn.addEventListener("click", () => {
      states[id].mode = btn.dataset.mode as Mode;
      update();
    });
  for (const btn of fig.querySelectorAll<HTMLButtonElement>("[data-loss-mode]"))
    btn.addEventListener("click", () => {
      states[id].lossMode = btn.dataset.lossMode as LossMode;
      update();
    });
  fig.querySelector("[data-reset]")?.addEventListener("click", () => {
    states[id] = structuredClone(defaults[id]);
    update();
  });
  fig.querySelector("[data-match]")?.addEventListener("click", () => {
    if (id === "gaussian") states[id] = { mu: 1.4, sigma: 0.7 };
    if (id === "entropy") states[id] = { r0: 0.15, r1: 0.7 / 0.85 };
    update();
  });
  fig.querySelector("[data-export]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const blob = new Blob([renderDiagram(id, states[id])], {
        type: "image/svg+xml;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${id}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  let pointer: number | null = null;
  frame.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof Element) || !e.target.matches("[data-drag]"))
      return;
    pointer = e.pointerId;
    frame.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  frame.addEventListener("pointermove", (e) => {
    if (pointer !== e.pointerId) return;
    const box = surface.getBoundingClientRect(),
      x = ((e.clientX - box.left) / box.width) * SIZE.width;
    if (id === "gaussian")
      states[id].mu = clamp(((x - PLOT.left) / PLOT.width) * 10 - 5, -2, 3);
    update();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    frame.addEventListener(type, () => {
      pointer = null;
    });
  update();
  if (id === "gaussian" || id === "l1")
    void mountCurveRenderer(surface, id, states[id])
      .then((r) => {
        renderer = r;
        renderer?.draw(states[id]);
      })
      .catch((error) => console.warn("SVG fallback retained:", error));
}
