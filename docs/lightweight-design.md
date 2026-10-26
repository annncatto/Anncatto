# Lightweight structural design

The bilingual article is assembled from nine files in `content/lightweight/`. `content/轻量化结构设计.html` defines their order. `scripts/content.mjs` expands includes with replacement callbacks to preserve LaTeX dollar delimiters.

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
| 09 | SIMP, computed simply supported beam evolution and component validation |

[Source coverage](lightweight-source-coverage.md) maps 47 embedded figures from 13 Obsidian notes to article anchors. The JSON companion records source hashes. Obsidian files are read-only inputs.

`src/lightweight-frameworks.ts` renders the relationship diagrams. `src/lightweight-course.ts` assembles bilingual figures; `src/lightweight-diagrams.ts` evaluates selectable scientific plots. Original image credits appear beside the figures. Ansys Granta charts retain their copyright notices and property definitions.

Regenerate the SIMP PNG stages, animated GIF, convergence history and interactive fields with Python, NumPy, SciPy, Matplotlib and Pillow:

```sh
python scripts/figures/lightweight-topology.py
```

The model uses 120 × 36 Q4 plane-stress elements, a central top load, lower-left pin, lower-right vertical roller, material fraction 0.4, penalty 3 and sensitivity-filter radius 2.2. `topology-evolution.json` stores all 81 solved states, including filtered sensitivity, compliance, volume, equilibrium residual and maximum density update. Fields are quantized to unsigned bytes for display; numerical metrics retain their solve precision. `src/topology-figures.ts` renders density/sensitivity and convergence plots, and `src/lightweight-topology.ts` connects them to playback and iteration selection. Playback starts only on request. Tests check every frame's field size, volume and free-DOF equilibrium residual.

The qualitative cost diagram uses the cost function and its analytical derivative in `src/lightweight-cost.ts`. The same function determines the curve, its minimum A and the tangent at B. B minimizes cost plus a linear operating-mass value; its tangent is not positioned independently.

## Shared article navigation

`scripts/build.mjs` adds the Home footer to every article. `src/article-navigation.ts`, mounted by the shared `src/app.ts`, provides its short departure animation and the in-page figure viewer. Reduced-motion settings bypass the delay. Figure captions receive an enlarge button; raster pictures and static course diagrams also open on click. Interactive plots retain their own click behavior.

The viewer uses a native dialog with an independently scrolling body and persistent Close button. Escape and backdrop clicks dismiss it, restore page overflow and return focus without moving the reading position. Its title follows the selected language. Styles are shared in `public/style.css`; the article source contains no navigation markup.

## Independent concept-design application

`/labs/lightweight-robot/` is linked from the homepage's bilingual Interactive tools section. The workbench prioritizes design variables and comparable calculations over individual joint posing. Its first section has an outcome strip, structure/material inputs, a central motion view and drive/load inputs. Equations, substitutions, screening judgments and a member/transmission schematic follow below. The interface is scrollable; it no longer compresses every control and drawing into one viewport.

- `concept-model.ts`: canonical joint tree, explicit member and joint spacing, actuator envelopes, physical mass/COM/full inertia tensors, FK/IK and URDF/MJCF/JSON.
- `design-analysis.ts`: full driven-subtree joint inertia, reflected rotor inertia, actual section bending axis, member and transmission compliance, Rayleigh frequency estimate, torque sizing and friction-based backdrive threshold.
- `design-motion.ts`: slow reference gait and manipulator path; analytical leg IK, planted-foot constraints, flat humanoid soles, COM transfer and signed support-polygon margins.
- `design-packing.ts`: conservative OBB envelope intersections. Adjacent structural attachment interfaces are excluded; separate actuator packages are always checked.
- `concept-scene.ts`: Three.js assembly, ground motion, COM/support overlay and GLB/PNG export.
- `lightweight-lab.ts`: design input, shared-load comparisons, numerical interpretation and model interchange.

The workbench compares a saved structural/drive reference under the current payload, verification force, acceleration, error limit and target bandwidth. Reference pose calculations remain fixed while the motion preview plays. Arm labels use Manipulator / 机械臂; gripper travel is separate from the displayed number of rotary axes. Lengths can be set globally or for individual members; additional non-member joint spacings are editable. Foot or tool mass has its own input and a warm role colour. Motor package dimensions and mass are independent stated inputs, with joint-size class factors retained in the model.

The modal screen uses the physical bending axis, rigid end fixtures, a flexible member and an output-side rotational spring. The normalized static deflection shape is used in a Rayleigh estimate; downstream components are lumped at the end. The bandwidth result is the ratio of estimated resonance to the user's target, with an editable screening interval. It is not an identified closed-loop bandwidth. Torque sizing adds magnitudes of the specified inertia, gravity, transverse load and friction terms; it omits Coriolis coupling and contact-force distribution. The reverse-drive threshold assumes compensated gravity and entered friction/efficiency. It is not a safety rating.

Motion shown in the workbench is a kinematic reference, not a trained locomotion policy or a dynamic-stability result. Default motion tests sample full cycles, confirm planted-foot invariance in ground coordinates, verify flat soles and non-negative foot heights, and check COM projection margins. The interface samples 32 frames when checking a changed design's conservative envelopes and reach. The tests sweep 96 frames in both motor placements for all three defaults. Parameter choices that lose reach, support margin or envelope clearance produce warnings.

MJCF uses joint reference values and matching body transforms so its default state reproduces the reference pose. JSON exports carry the same analysis and conditions as the interface. The previous engineering-drawing pane and CAD-style SVG/DXF actions are absent from the new interface; model exchange remains available as JSON, URDF, MJCF and GLB, with PNG capture.

The existing MuJoCo worker and PPO modules remain available in source for physics experiments and the standing/FK validation tests. They are not invoked by the current kinematic preview. Previous walking controllers and short trained policies did not pass sustained-walking evaluation. An intermediate-model probe replacing the old gait with the new reference also fell within 0.7 s under the unchanged PD controller; it is not presented as successful dynamics.

Draft was reviewed at `3b03e144735098ef94b938e85756806f45628f83`: https://github.com/davidhnguyen2000/draft. The model organization follows its explicit tree, end-clearance and actuator-packing approach. Its generator, empirical trend data and meshes are not runtime dependencies.

## Build and verification

```sh
BASE_PATH=/Anncatto npm run build
npm test
BASE_PATH=/Anncatto npm run check
BASE_PATH=/Anncatto PORT=5181 npm run preview
```

Preview paths are `/Anncatto/notes/lightweight-structural-design/` and `/Anncatto/labs/lightweight-robot/`. The article tests check assembly order, source anchors, metadata exclusion, scientific plots and the SIMP solve. Concept tests compare canonical mass/FK against MuJoCo, verify default export poses, standing, IK, sizing and PPO serialization/updates. Workbench tests verify tensor rotation, parallel-axis terms, gear scaling, section axes, the uniform-beam Rayleigh limit, mass relocation, custom lengths, motion constraints and envelope sweeps. Browser checks cover both languages, responsive layout, linked calculations, references, custom dimensions, motion playback and exports.

Three.js MIT and MuJoCo Apache 2.0 notices are distributed under `assets/licenses/`. `main` publishes GitHub Pages; article draft work remains on `draft/lightweight-structure` and workbench revisions on `draft/lightweight-design-workbench`, and D20 work stays on `local/d20-homepage`.
