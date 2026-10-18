import { C, PLOT, SIZE, type State } from "./diagrams.js";
type Shared = {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  format: GPUTextureFormat;
};
let shared: Promise<Shared | null> | undefined;
function resources(): Promise<Shared | null> {
  return (shared ??= (async () => {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "low-power",
    });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const response = await fetch(
      new URL("./shaders/curves.wgsl", import.meta.url),
    );
    if (!response.ok) throw Error("Shader download failed");
    const module = device.createShaderModule({
      label: "Analytic density and losses",
      code: await response.text(),
    });
    const info = await module.getCompilationInfo();
    if (info.messages.some((m) => m.type === "error"))
      throw Error("WGSL compilation failed");
    const format = navigator.gpu.getPreferredCanvasFormat();
    const pipeline = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module, entryPoint: "vertex_main" },
      fragment: { module, entryPoint: "fragment_main", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    return { device, pipeline, format };
  })().catch((error) => {
    console.warn("Curve renderer uses SVG fallback:", error);
    return null;
  }));
}
export type CurveRenderer = {
  draw: (state: State) => void;
  destroy: () => void;
};
export async function mountCurveRenderer(
  surface: HTMLElement,
  kind: "gaussian" | "l1",
  initial: State,
): Promise<CurveRenderer | null> {
  const r = await resources();
  if (!r) return null;
  const { device, pipeline, format } = r,
    canvas = document.createElement("canvas");
  canvas.className = "gpu-curves";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("webgpu");
  if (!context) return null;
  const uniform = device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniform } }],
  });
  let state = { ...initial },
    dead = false,
    request = 0;
  const render = () => {
    if (dead || !surface.isConnected) return;
    try {
      const box = surface.getBoundingClientRect(),
        scale = Math.min(devicePixelRatio || 1, 2);
      const width = Math.min(
        device.limits.maxTextureDimension2D,
        Math.max(1, Math.round(box.width * scale)),
      );
      const height = Math.max(
        1,
        Math.round((width * SIZE.height) / SIZE.width),
      );
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.configure({ device, format, alphaMode: "premultiplied" });
      }
      const data = new Float32Array([
        width,
        height,
        SIZE.width,
        SIZE.height,
        PLOT.left,
        PLOT.top,
        PLOT.width,
        PLOT.height,
        kind === "gaussian" ? -5 : -2,
        kind === "gaussian" ? 10 : 4,
        kind === "gaussian" ? 1 : 2,
        kind === "gaussian" ? 0 : 1,
        state.mu ?? 0,
        state.sigma ?? 1,
        state.lossMode === "bimodal" ? 1 : 0,
        0,
        ...[C.accent, C.target].flatMap((color) => [
          parseInt(color.slice(1, 3), 16) / 255,
          parseInt(color.slice(3, 5), 16) / 255,
          parseInt(color.slice(5, 7), 16) / 255,
          1,
        ]),
      ]);
      device.queue.writeBuffer(uniform, 0, data);
      const encoder = device.createCommandEncoder(),
        pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      surface.classList.add("gpu-ready");
    } catch (error) {
      console.warn("Curve renderer restored SVG:", error);
      destroy();
    }
  };
  const schedule = () => {
    cancelAnimationFrame(request);
    request = requestAnimationFrame(render);
  };
  const observer = new ResizeObserver(schedule);
  const onError = () => destroy();
  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(request);
    observer.disconnect();
    device.removeEventListener("uncapturederror", onError);
    surface.classList.remove("gpu-ready");
    canvas.remove();
    uniform.destroy();
    context?.unconfigure();
  }
  surface.append(canvas);
  observer.observe(surface);
  device.addEventListener("uncapturederror", onError);
  void device.lost.then(destroy);
  schedule();
  return {
    draw(next) {
      state = { ...next };
      schedule();
    },
    destroy,
  };
}
