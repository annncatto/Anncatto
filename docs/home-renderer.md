# Homepage renderer

The homepage loads `assets/hero/index.js`. Article pages load their own chart entry point. The existing curve renderer is independent.

- `src/hero/d20.ts`: unit icosahedron, face numbers, upright result orientations, SVG fallback.
- `src/hero/roll.ts`: unbiased 1–20 sampling and the animation timeline. Opposite faces sum to 21.
- `src/hero/index.ts`: pointer/keyboard input, language, visibility, reduced motion, lifecycle.
- `src/hero/renderer.ts`: WebGPU resources, number atlas, rendering, adaptive resolution.
- `public/shaders/d20.wgsl`: convex-plane ray intersection and 28-step density integration; a separate twenty-triangle surface pass draws edges, face numbers, and erosion.
- `public/shaders/particles.wgsl`: seeded particles following the curl of a smooth vector potential plus outward drift.

The animation runs at up to 30 updates per second. Only one submission is kept in flight. Density is rendered separately at up to 450,000 pixels; this layer's resolution falls if measured queue completion exceeds the budget. Outlines and numbers retain the canvas resolution (up to 1,800,000 pixels). Software adapters start with a smaller density layer. These are quality adjustments, not a guaranteed frame rate.

Offscreen and hidden pages stop requesting frames; the animation clock pauses. Reduced motion shows the sampled face immediately. If WebGPU is unavailable or the device is lost, SVG continues to show the selected result. JavaScript-free pages retain the initial SVG and article links.

## Blue-noise texture

`public/textures/blue-noise.png` is an original, reproducible 64×64 grayscale tile. No third-party image is included. Generate it with `python scripts/blue-noise.py` in an environment with NumPy. Generation is an offline maintenance step; deployment and rendering do not require Python.

The generator uses periodic Gaussian energy and the void-and-cluster algorithm. It checks the uniform 8-bit histogram and suppression of low-frequency power at 50% coverage. The renderer keeps the tile fixed in screen space, while a continuous 3D erosion field changes coverage. This avoids independent frame-to-frame resampling; it is not a temporally reconstructed blue-noise sequence.

Method references: [Ulichney, 1993](https://cv.ulichney.com/papers/1993-void-cluster.pdf), [Alan Wolfe’s implementation discussion](https://blog.demofox.org/2019/06/25/generating-blue-noise-textures-with-void-and-cluster/), [Stable Fiddusion](https://acko.net/blog/stable-fiddusion/).

## Validation

```sh
BASE_PATH=/Anncatto npm run build
BASE_PATH=/Anncatto npm run check
npm test
BASE_PATH=/Anncatto npm run preview
```

Tests cover topology, opposite numbering, all twenty result orientations, rejection sampling, and state transitions. Browser review should also cover mouse/touch/keyboard input, number readability, the dissolve/recovery cycle, language switching, pause/resume, reduced motion, and the SVG fallback. Measure performance on the target device; software WebGPU is useful for correctness checks only.
