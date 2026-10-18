import { faces, vertices, type Vec3 } from "./d20.js";
import type { Frame } from "./roll.js";

export type Renderer = { draw(frame: Frame, time: number): void; resize(): void; destroy(): void };
function asset(path: string): URL {
  const url = new URL(`../${path}`, import.meta.url);
  url.search = new URL(import.meta.url).search;
  return url;
}
async function shader(device: GPUDevice, name: string) {
  const response = await fetch(asset(`shaders/${name}.wgsl`));
  if (!response.ok) throw Error(`Could not load ${name}`);
  const module = device.createShaderModule({ label: name, code: await response.text() });
  const errors = (await module.getCompilationInfo()).messages.filter(message => message.type === "error");
  if (errors.length) throw Error(errors.map(error => `${name}:${error.lineNum} ${error.message}`).join("\n"));
  return module;
}
export async function createRenderer(canvas: HTMLCanvasElement, failed: () => void): Promise<Renderer | null> {
  if (!navigator.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) { device.destroy(); return null; }
  const buffers: GPUBuffer[] = [], textures: GPUTexture[] = [];
  let dead = false, volume: GPUTexture | null = null;
  function destroy() {
    if (dead) return;
    dead = true;
    buffers.forEach(buffer => buffer.destroy());
    textures.forEach(texture => texture.destroy());
    volume?.destroy();
    context?.unconfigure();
    device.destroy();
  }
  try {
    device.addEventListener("uncapturederror", () => { failed(); destroy(); });
    void device.lost.then(() => { if (!dead) { failed(); destroy(); } });
    const [body, dust, imageResponse] = await Promise.all([
      shader(device, "d20"), shader(device, "particles"), fetch(asset("textures/blue-noise.png")),
      document.fonts.load('500 96px "IBM Plex Sans"'),
    ]);
    if (!imageResponse.ok) throw Error("Could not load noise texture");
    const image = await createImageBitmap(await imageResponse.blob(), { colorSpaceConversion: "none" });
    const blue = device.createTexture({ size: [64,64], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    textures.push(blue);
    device.queue.copyExternalImageToTexture({ source: image }, { texture: blue }, [64,64]);
    image.close();
    const atlas = document.createElement("canvas"); atlas.width = 640; atlas.height = 512;
    const pen = atlas.getContext("2d")!;
    pen.font = '500 96px "IBM Plex Sans"'; pen.textAlign = "center"; pen.textBaseline = "middle"; pen.fillStyle = "#ffffff";
    for (let value=1; value<=20; value++) pen.fillText(String(value), ((value-1)%5)*128+64, Math.floor((value-1)/5)*128+65);
    const numbers = device.createTexture({ size: [640,512], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    textures.push(numbers);
    device.queue.copyExternalImageToTexture({ source: atlas }, { texture: numbers }, [640,512]);
    const uniform = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const geometry = device.createBuffer({ size: 20*64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    buffers.push(uniform, geometry);
    const mesh = device.createBuffer({ size: 60*16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    buffers.push(mesh);
    device.queue.writeBuffer(mesh,0,new Float32Array(faces.flatMap(face => face.indices.flatMap(index => [...vertices[index],1]))));
    device.queue.writeBuffer(geometry, 0, new Float32Array(faces.flatMap(face => [
      ...face.normal, face.distance, ...face.right, face.value, ...face.up, 0, ...face.center, 0,
    ])));
    const count = matchMedia("(max-width: 600px)").matches ? 850 : 1600;
    const seeds = new Float32Array(count*8);
    let randomState = 0x71c3a91;
    const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0)/2**32; };
    for (let i=0; i<count; i++) {
      let p: Vec3;
      do { p = [random()*2-1,random()*2-1,random()*2-1]; }
      while (faces.some(face => face.normal.reduce((sum,v,j) => sum+v*p[j],0) > face.distance));
      seeds.set([...p,1,random(),random(),random(),random()],i*8);
    }
    const particles = device.createBuffer({ size: seeds.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    buffers.push(particles); device.queue.writeBuffer(particles,0,seeds);
    const format = navigator.gpu.getPreferredCanvasFormat();
    const [volumePipeline, bodyPipeline, dustPipeline] = await Promise.all([
      device.createRenderPipelineAsync({ label: "Ink volume", layout: "auto", vertex: { module: body, entryPoint: "vertex_main" }, fragment: { module: body, entryPoint: "volume_main", targets: [{ format: "rgba8unorm" }] }, primitive: { topology: "triangle-list" } }),
      device.createRenderPipelineAsync({ label: "Crisp edges and numbers", layout: "auto", vertex: { module: body, entryPoint: "surface_vertex" }, fragment: { module: body, entryPoint: "fragment_main", targets: [{ format }] }, primitive: { topology: "triangle-list", cullMode: "back" } }),
      device.createRenderPipelineAsync({ label: "Dissolving ink", layout: "auto", vertex: { module: dust, entryPoint: "vertex_main" }, fragment: { module: dust, entryPoint: "fragment_main", targets: [{ format, blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } } }] }, primitive: { topology: "triangle-list" } }),
    ]);
    const volumeBind = device.createBindGroup({ layout: volumePipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: { buffer: geometry } },
    ] });
    const sampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
    let bodyBind: GPUBindGroup;
    const dustBind = device.createBindGroup({ layout: dustPipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: { buffer: particles } },
    ] });
    let quality = adapter.info.isFallbackAdapter ? .7 : 1, pending = false, measurements = 0, duration = 0;
    let queued: { frame: Frame; time: number } | null = null;
    function resize() {
      if (dead) return;
      const box = canvas.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 2, Math.sqrt(1_800_000 / Math.max(1,box.width*box.height)));
      const width = Math.max(1,Math.round(box.width*scale)), height = Math.max(1,Math.round(box.height*scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
        context!.configure({ device, format, alphaMode: "opaque" });
      }
      const volumeScale = Math.min(1,Math.sqrt(450_000/(width*height))) * quality;
      const volumeWidth = Math.max(1,Math.round(width*volumeScale)), volumeHeight = Math.max(1,Math.round(height*volumeScale));
      if (!volume || volume.width !== volumeWidth || volume.height !== volumeHeight) {
        volume?.destroy();
        volume = device.createTexture({ label: "Ink density layer", size: [volumeWidth,volumeHeight], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
        bodyBind = device.createBindGroup({ layout: bodyPipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: { buffer: geometry } },
          { binding: 2, resource: blue.createView() }, { binding: 3, resource: numbers.createView() },
          { binding: 4, resource: sampler }, { binding: 5, resource: volume.createView() },
          { binding: 6, resource: { buffer: mesh } },
        ] });
      }
    }
    resize();
    const renderer: Renderer = {
      resize, destroy,
      draw(frame, time) {
        if (dead) return;
        if (pending) { queued={ frame,time }; return; }
        queued=null;
        device.queue.writeBuffer(uniform,0,new Float32Array([
          canvas.width, canvas.height, time, frame.dissolve, ...frame.rotation,
          frame.scatter, frame.lift, frame.stage === "result" ? 1 : 0, 0,
          volume!.width, volume!.height, 0, 0,
        ]));
        const encoder = device.createCommandEncoder();
        const volumePass = encoder.beginRenderPass({ colorAttachments: [{ view: volume!.createView(), loadOp: "clear", storeOp: "store", clearValue: { r:1,g:1,b:1,a:1 } }] });
        volumePass.setPipeline(volumePipeline); volumePass.setBindGroup(0,volumeBind); volumePass.draw(3); volumePass.end();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r:1,g:1,b:1,a:1 } }] });
        pass.setPipeline(bodyPipeline); pass.setBindGroup(0,bodyBind); pass.draw(60);
        if (frame.scatter > 0) { pass.setPipeline(dustPipeline); pass.setBindGroup(0,dustBind); pass.draw(6,count); }
        pass.end();
        const start = performance.now();
        device.queue.submit([encoder.finish()]);
        pending = true;
        // Measure actual queue completion rather than assuming a device's performance.
        void device.queue.onSubmittedWorkDone().then(() => {
          pending = false;
          if (dead) return;
          duration += performance.now()-start;
          if (++measurements >= 30) {
            if (duration/measurements > 45 && quality > .5) { quality = Math.max(.5,quality*.8); resize(); }
            measurements=0; duration=0;
          }
          const next=queued;
          queued=null;
          if (next) renderer.draw(next.frame,next.time);
        }).catch(() => { pending=false; });
      },
    };
    return renderer;
  } catch (error) {
    destroy();
    console.warn("Dice uses its static rendering:", error);
    return null;
  }
}
