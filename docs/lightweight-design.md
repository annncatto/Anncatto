# Lightweight structural design

2026-11-02 运动载荷、全身控制、Alohamini、Go2 与 RP1 原模型的运行接入及仿真／实机边界见[运动载荷与闭环验证](lightweight-control.md)。固定模型版本、网格转换和许可见[开源模型来源核对](lightweight-model-sources.md)；当前九组闭环结果见[验证记录](lightweight-validation.json)，RP1 六组动作参数比较见[参数测试记录](lightweight-source-sweep.json)。

For current rendering, motion validation and the open-source review, see [rendering and kinematics](lightweight-rendering.md). For the current material-selection interface, simplified FK diagram, Springer sources and sizing derivation, see [materials and mechanism display](lightweight-materials.md). The independent-application description below records the earlier Three.js interface baseline; the linked material document and handoff describe the current interface.

Read [the current tool handoff](lightweight-tool-handoff.md) before resuming local development. Course-note authoring follows [the course-note workflow](course-note-workflow.md).

The bilingual article is assembled from the chapters in `content/lightweight/`. `content/轻量化结构设计.html` defines their order. `scripts/content.mjs` expands includes with replacement callbacks to preserve LaTeX dollar delimiters.

| Module | Content |
| --- | --- |
| 01 | Introduction, complete material/cost comparison, cost–mass tradeoff, material properties and four verification/design diagrams |
| 02 | Classical methods: materials, structural performance, design concepts and manufacturing |
| 03 | Integrated methods: active and passive functions, structural energy storage |
| 04 | Concept design, load analysis, accuracy requirements and robot/manipulator research |
| 05 | Dynamics, mass distribution, reflected inertia, backdrivability, stiffness, contact energy |
| 06 | Axial/beam/plate/torsion indices, stress and curvature, official Ashby charts, material tables, fatigue and thermal properties |
| 07 | Shape factors, thin-wall manufacture and the fixed-diameter/fixed-wall tube exercise |
| 08 | Thin-wall efficiency, direct load paths and fully stressed design |
| 09 | SIMP, computed simply supported beam evolution, manufacturable realization and the design loop |
| 10 | Robot passive/active integration, joint/SEA architecture, M/D/F/P/A cases, system metrics and the arm mass-layout exercise |
| 11 | Section loads, stress/strain, elastic laws, beam kinematics and fields, shear models, yield and capacity/self-weight indices |
| 12 | Constraint-dependent load efficiency, specific energy absorption, elastic recovery and plastic dissipation |
| 13 | Strain energy, Castigliano displacement, equal-area I-sections, tensile-tube sizing and convex reformulation |
| 14 | Sandwich stiffness, shear-flexible buckling, local failures, wrinkling and constrained sizing |
| 99 | Shared, initially collapsed references after the final chapter |

[Source coverage](lightweight-source-coverage.md) maps 118 embedded figures from 16 Obsidian notes to article anchors. The JSON companion records source hashes. Obsidian files are read-only inputs.

`src/lightweight-foundations.ts` adds twelve bilingual native SVG/HTML figures, including calculated shear-error and normalized material-index plots. `src/lightweight-frameworks.ts` renders the earlier relationship diagrams. `src/lightweight-course.ts` assembles bilingual figures; `src/lightweight-diagrams.ts` evaluates selectable scientific plots. Original image credits appear beside the figures. Ansys Granta charts retain their copyright notices and property definitions.

Regenerate the SIMP PNG stages, animated GIF, convergence history and interactive fields with Python, NumPy, SciPy, Matplotlib and Pillow:

```sh
python scripts/figures/lightweight-topology.py
```

The model uses 120 × 36 Q4 plane-stress elements, a central top load, lower-left pin, lower-right vertical roller, material fraction 0.4, penalty 3 and sensitivity-filter radius 2.2. `topology-evolution.json` stores all 81 solved states, including filtered sensitivity, compliance, volume, equilibrium residual and maximum density update. Fields are quantized to unsigned bytes for display; numerical metrics retain their solve precision. `src/topology-figures.ts` renders density/sensitivity and convergence plots, and `src/lightweight-topology.ts` connects them to playback and iteration selection. Playback starts only on request. Tests check every frame's field size, volume and free-DOF equilibrium residual.

The qualitative cost diagram uses the cost function and its analytical derivative in `src/lightweight-cost.ts`. The same function determines the curve, its minimum A and the tangent at B. B minimizes cost plus a linear operating-mass value; its tangent is not positioned independently.

## Shared article navigation

`scripts/build.mjs` adds the Home footer to every article. `src/article-navigation.ts`, mounted by the shared `src/app.ts`, provides its short departure animation and the in-page figure viewer. Reduced-motion settings bypass the delay. Figure captions receive an enlarge button; raster pictures and static course diagrams also open on click. Interactive plots retain their own click behavior.

The viewer uses a native dialog with an independently scrolling body and persistent Close button. Escape and backdrop clicks dismiss it, restore page overflow and return focus without moving the reading position. Its title follows the selected language. Styles are shared in `public/style.css`; the article source contains no navigation markup.

## Earlier concept-design application baseline

This section preserves the earlier implementation and its limitations. The current interface includes source robot selection, full-width joint loads and actual MuJoCo closed-loop replay; use the control document and handoff linked above for current behavior and validation results.

`/labs/lightweight-robot/` is linked only from this local preview's Interactive tools section. The public homepage keeps that heading without entries; this redesign is not released. The workbench prioritizes design variables and comparable calculations over individual joint posing. Its first section has an outcome strip, structure/material inputs, a central motion view and drive/load inputs. Equations, substitutions, screening judgments and a member/transmission schematic follow below. The interface is scrollable; it no longer compresses every control and drawing into one viewport.

- `concept-model.ts`: canonical joint tree, connected components, mass/COM/full inertia tensors, spatial IK, selected-member sizing, URDF/MJCF/JSON.
- `concept-drawing.ts`: orthographic engineering SVG and DXF.
- `concept-scene.ts`: mesh geometry, part selection, TCP manipulation and GLB/PNG.
- `concept-physics.ts`: 500 Hz dynamics, 50 Hz PD plus gravity compensation and residual-policy environment.
- `concept-rl.ts`: Gaussian residual policy, GAE, clipped PPO and Adam. Policy files are tied to a design fingerprint.
- `concept-worker.ts`: simulation, training, policy import and snapshots without blocking the interface.

Default assemblies have 12 quadruped joints, 23 humanoid joints, or six arm axes plus one gripper-opening coordinate. Joint activation, axes, member dimensions, properties, payload and manufacturing parameters are editable. Material sizing screens the selected member against stress and displacement limits at a fixed outer section; it is an analytical sizing calculation, separate from the rigid-body contact solve. Manufacturing checks include minimum wall, stock usage, access ratio and material/process compatibility. These checks are not full finite-element or manufacturing-process simulations.

URDF/MJCF exports share the canonical assembly mass and inertia. The physics controller has verified standing/pose-holding defaults. PPO uses measured rewards and state transitions. Locomotion depends on the design and controller; the current velocity-tracking controller and short trained walking policy have not passed a sustained-walking evaluation. Training plots must not be interpreted as proof of successful locomotion.

Draft was reviewed at `3b03e144735098ef94b938e85756806f45628f83`: https://github.com/davidhnguyen2000/draft. Its Python/Viser generator is not a dependency. The application uses an independent canonical assembly model and browser physics.

## Build and verification

```sh
BASE_PATH=/Anncatto npm run build
npm test
BASE_PATH=/Anncatto npm run check
BASE_PATH=/Anncatto PORT=5181 npm run preview
```

Preview paths are `/Anncatto/notes/lightweight-structural-design/` and `/Anncatto/labs/lightweight-robot/`. The article tests check assembly order, source anchors, metadata exclusion, scientific plots and the SIMP solve. Concept tests compare canonical mass/FK against MuJoCo, verify standing, IK, sizing and PPO serialization/updates. Browser checks cover both languages, mobile widths, SVG label collisions, playback, controls, exports and one-screen application layout.

Three.js MIT and MuJoCo Apache 2.0 notices are distributed under `assets/licenses/`. `main` publishes GitHub Pages; draft work remains on `draft/lightweight-structure`, and D20 work stays on `local/d20-homepage`.

## November 1 article update

Read all 46 image occurrences in the topology, robot-design and fundamentals inputs; 44 newly inventoried attachments supplement the two existing topology figures. The article retains the computed SIMP solve and its original anchors, adds engineering realization, and appends robot integration followed by mechanics foundations. The former further-reading anchor now points to a compact, initially collapsed reference list at the end.

The source-coverage audit records corrections to Cassie motor placement, LWR mass, beam signs, shear applicability, equivalent-stress evaluation and the buckling material index. The public text contains the resulting technical explanation rather than editorial history. The local tool and empty homepage tools heading are unchanged.

Validation: 39 tests; production build and internal-reference/MathML check; desktop English/Chinese figures, SVG text collision audit, 390 px page overflow, reference disclosure and figure-viewer Close/Escape.

The functional-design case sections now separate legs and manipulators. Leg examples include tendon–bone load sharing, Mini Cheetah proximal drive and its point-mass calculation, Cassie spring energy and ANYdrive; arm examples include the five LWR III design mechanisms, distinct joint implementations, WAM cable transmission, payload conditions and the mass-spiral calculation. New leg diagrams retain their model assumptions.

Source-table correction: method definitions use five distinct rows; case matrices reproduce 5 quadruped, 5 humanoid and 6 arm entries with M/D/F/P/A codes. Passive examples, the traditional/passive/active comparison and four closing trade-offs preserve their source fields. Case tables use a scoped 600 px minimum width and horizontal scrolling on narrow screens.

## November 7 article continuation

The 27 images and the convex-optimization prompt in `1107.md` are covered in chapters 12–14, after the existing mechanics foundations. The references have moved into `99-references.html` and remain last. Existing chapters received a prose review, replacing vague material-volume, leverage and benefit metaphors with density, section, stiffness and torque relationships.

Seven bilingual native SVGs are generated by `src/lightweight-absorption.ts`, `src/lightweight-energy.ts` and `src/lightweight-sandwich.ts`. Their pure calculation functions feed the figures and scoped numerical tests. Independent integrations, energy balances, alternative section-area formulas and constrained comparisons check the underlying models. The coverage audit records the screenshot corrections and the distinction between Öchsner’s 2025 book and Klein’s 2013 reference.

This update changes the article, its metadata, figures, tests and operational documents. It does not modify the interactive tool, source robot models or homepage design.

Release validation on 2026-11-07 used a clean isolated checkout: production build; 721 internal-reference and MathML checks; all 172 tests; 59 browser assertions across English/Chinese and 1440/390 px widths. All seven new figures were inspected, with no SVG text collisions or viewBox overflow in either language. Figure viewer Close/Escape and the initially collapsed references passed. The release includes only this article, its calculation modules, tests and supporting documentation; RP1 project modules and local source meshes are excluded.
