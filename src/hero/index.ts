import { language, onLanguageChange } from "../language.js";
import { fallbackDie } from "./d20.js";
import { createRenderer, type Renderer } from "./renderer.js";
import { DiceRoll, type Frame, type Stage } from "./roll.js";

const root = document.querySelector<HTMLElement>("[data-dice]");
if (root) void mount(root);
async function mount(root: HTMLElement) {
  const trigger = root.querySelector<HTMLButtonElement>("[data-dice-trigger]")!;
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const fallback = root.querySelector<HTMLElement>("[data-dice-fallback]")!;
  const output = root.querySelector<HTMLOutputElement>("[data-dice-result]")!;
  const hint = root.querySelector<HTMLElement>("[data-dice-hint]")!;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const roll = new DiceRoll();
  let renderer: Renderer | null = null, visible = true, dead = false, request = 0, clock = 0, flowClock = 0, previous = 0;
  let frame = roll.frame(0), stage: Stage | "" = "", hasResult = false;
  let staticResult = false;
  function updateText() {
    root.setAttribute("aria-label",language === "en" ? "Twenty-sided die" : "二十面骰子");
    trigger.setAttribute("aria-label",language === "en" ? "Roll a twenty-sided die" : "投掷二十面骰子");
    const busy = !["idle","result"].includes(frame.stage) || (frame.stage === "result" && !motion.matches && !staticResult);
    trigger.setAttribute("aria-disabled",String(busy));
    hint.textContent = language === "en"
      ? ({ idle: "Click to roll", rolling: "Rolling…", result: "Click to roll", dissolving: "Dissolving…", restoring: "Returning…" }[frame.stage])
      : ({ idle: "点击投掷", rolling: "投掷中…", result: "点击投掷", dissolving: "消散中…", restoring: "恢复中…" }[frame.stage]);
    if (busy && frame.stage === "result") hint.textContent = language === "en" ? "Result" : "结果";
    output.textContent = hasResult ? `${frame.result} / 20` : "";
    output.setAttribute("aria-label", hasResult ? (language === "en" ? `Result: ${frame.result}` : `结果：${frame.result}`) : "");
  }
  function draw() {
    if (renderer) renderer.draw(frame,motion.matches ? 0 : flowClock);
    else if (frame.stage !== "rolling") fallback.innerHTML = fallbackDie(frame.result);
  }
  function apply(next: Frame) {
    frame = next;
    if (frame.stage !== stage) {
      stage = frame.stage;
      root.dataset.stage = stage;
      if (stage === "result") hasResult = true;
      updateText();
    }
    draw();
  }
  function reduceMotion() {
    if (!motion.matches || staticResult) return;
    staticResult=true;
    if (frame.stage !== "idle") { hasResult=true; apply(roll.settle()); }
    else draw();
    updateText();
  }
  function tick(now: number) {
    request = 0;
    if (!visible || document.hidden || dead) return;
    reduceMotion();
    if (previous && now-previous < 1000/30-1) { request=requestAnimationFrame(tick); return; }
    const delta = previous ? Math.min((now-previous)/1000,.12) : 0;
    clock += delta;
    flowClock += delta * (frame.stage === "result" ? .12 : 1);
    previous = now;
    if (!staticResult) apply(roll.frame(clock)); else draw();
    if (renderer && !motion.matches) request=requestAnimationFrame(tick);
  }
  function resume() {
    cancelAnimationFrame(request); request=0; previous=0;
    if (visible && !document.hidden && !dead) request=requestAnimationFrame(tick);
  }
  trigger.addEventListener("click",() => {
    if (!["idle","result"].includes(frame.stage) || (frame.stage === "result" && renderer && !motion.matches && !staticResult)) return;
    staticResult = motion.matches || !renderer;
    if (!roll.roll(clock,motion.matches || !renderer)) return;
    hasResult = staticResult;
    apply(roll.frame(clock));
    updateText(); resume();
  });
  function fail() {
    root.dataset.renderer = "static"; renderer?.destroy(); renderer=null;
    cancelAnimationFrame(request);
    if (!["idle","result"].includes(frame.stage)) frame = { ...frame, stage: "result", dissolve: 0, scatter: 0 };
    staticResult = true; hasResult = frame.stage === "result";
    apply(frame); updateText();
  }
  const intersection = new IntersectionObserver(entries => { visible=entries[0].isIntersecting; resume(); }, { threshold: .02 });
  intersection.observe(root);
  const resize = new ResizeObserver(() => { renderer?.resize(); resume(); }); resize.observe(canvas);
  document.addEventListener("visibilitychange",resume);
  motion.addEventListener("change",() => {
    reduceMotion();
    resume();
  });
  onLanguageChange(updateText);
  updateText();
  trigger.disabled = false;
  renderer = await createRenderer(canvas,fail).catch(() => null);
  if (dead) { renderer?.destroy(); return; }
  root.dataset.renderer = renderer ? "webgpu" : "static";
  if (!renderer) staticResult = true;
  apply(frame); resume();
  addEventListener("pagehide",event => {
    cancelAnimationFrame(request);
    if (!event.persisted) { dead=true; renderer?.destroy(); intersection.disconnect(); resize.disconnect(); document.removeEventListener("visibilitychange",resume); }
  });
  addEventListener("pageshow",resume);
}
