# Lightweight article and independent robot studio

The bilingual article is assembled from `content/lightweight/` through `scripts/content.mjs`; `content/轻量化结构设计.html` lists its ten modules. It follows the course's general teaching sequence. Extensions and robot research appear at the end. The Three.js studio remains a separate static application at `/labs/lightweight-robot/`; it is not embedded in the article.

## Source coverage

User outline: `/home/anncatto/obsidian_me/blog/轻量化结构设计.md`. Course sources: `/home/anncatto/obsidian_me/选修/轻量化结构设计技术/`. [The source coverage inventory](lightweight-source-coverage.md) maps all 47 embedded screenshots from 13 notes to article anchors, records corrections, and documents the original figures and faithful redraws. The JSON companion records hashes for later note updates. Source notes remain in Obsidian and are not edited.

| Module | Scope |
| --- | --- |
| 01 | Overview; material/structure/process routes; cost A/B tradeoff; checking framework; requirements-to-delivery and virtual–physical feedback |
| 02 | Material families; basic/engineering/process properties; composition and processing; alloy tempers; fibre, matrix and laminate |
| 03 | Modulus versus stiffness/compliance; stress/strain; strength; bending; stability and vibration; fatigue, fracture, impact and thermal performance |
| 04 | Requirement-based tie/beam/plate/tube indices; official Ashby charts; typical material ranges; complete introductory index/cost tables |
| 05 | Shape factors; equal-area sections; load paths; utilization; ribs; sandwiches; thin plies; DSS and double-double; fibre–metal laminates |
| 06 | Machining/casting/forming; composite processes; RTM chain; infusion; ultrasonic impregnation; connections; tolerances and inspection |
| 07 | Passive and active integration; vibration/noise; morphing; structural energy storage/Ragone; knockdowns; CAI; fatigue tests and guided-wave monitoring |
| 08 | Concept/scheme/detail; numerical modeling; multibody loads and structural checks; course SIMP formulation; computed iterations; validation |
| 09 | Explicit extensions: fixed-diameter/fixed-wall tube exercise; belts/linkages/screws; composite joint research; all course case comparisons |
| 10 | Robot-specific dynamics, mass distribution, actuators, reduction, contact; condition-aware payload ratios; legs, arms, humanoids and teleoperation cases |

## Figures and mathematical scope

`src/lightweight-course.ts` renders compact bilingual conceptual diagrams. `src/lightweight-diagrams.ts` renders six button-controlled equation plots. Official-source figures are credited directly below each image; original labels, copyright notices and mathematical fonts are preserved. Formula scope follows the notes and their necessary derivations; the former full 2R/FE/fracture/thermal/IK expansion is removed from the article.

The SIMP images are actual independently computed Q4 plane-stress solutions, not an interpolated illustration. To regenerate, use Python with NumPy, SciPy and Matplotlib:

```sh
python scripts/figures/lightweight-topology.py
```

It writes four PNG stages and a JSON convergence history. The model fixes the supports, centre load, 0.4 volume fraction, p=3 and filter radius; automated checks cover volume, equilibrium residual and final compliance. The article distinguishes these results from the course screenshot's separate model.

## Reference project

Draft was inspected at commit `3b03e144735098ef94b938e85756806f45628f83` from https://github.com/davidhnguyen2000/draft. Its editor uses a Python websocket server, Viser and MuJoCo. The studio borrows the visual organization, not the generator or fitted motor laws. It uses an independently written two-link educational model; it does not claim Draft's packing/feasibility checks or simulated locomotion.

## Model contract

- Total mass sums the stated body/accessory budget and all identical limbs.
- Each limb contains two ideal uniform hollow/solid members, two motor packages and an end piece. Proximal drive adds 0.16 kg per limb as a distributed transmission allowance.
- The distal motor housing belongs to the first member when at the joint, and to the body when proximal.
- The 2R mass matrix includes these masses and a diagonal idealized `N² Jm` allowance; rotor inertia is fixed at `2.5e-5 kg m²`.
- Bending, stress and frequency are individual-member screening calculations, separate from the rigid-body robot motion. The frequency uses a tip-mass approximation, not a whole-robot eigenanalysis.
- Material values are rounded teaching values. CFRP represents an effective laminate, not fibre-direction strength certification.
- Animation is kinematic. The stationary-body treadmill cycle uses continuous position/velocity at stance/swing transitions and 2R inverse kinematics. The arm target is draggable in a plane, with radial projection for unreachable targets and a reach envelope. There is no contact solver, balance controller or online FEA.
- URDF masses sum to the analytical model. Links use member-plus-point-mass inertias; the body uses a uniform-box budget approximation. Continuous joints omit unknown motor ratings and travel; negative Y axes preserve the planar angle sign in Z-up coordinates.
- The local D20 branch remains separate. This new article/studio is developed on `draft/lightweight-structure`.

## Development and verification

```sh
BASE_PATH=/Anncatto npm run build
npm test
BASE_PATH=/Anncatto npm run check
BASE_PATH=/Anncatto PORT=5180 npm run preview
```

Preview `/Anncatto/notes/lightweight-structural-design/` and `/Anncatto/labs/lightweight-robot/`. The article has ten bilingual modules, six interactive equation plots and a selectable four-stage topology example. The studio runs independently. Keep `$$` delimiters intact during chapter expansion: replacement strings interpret dollar sequences, so the assembler uses a replacement callback.

The mechanics tests cover exact tube sections, cantilever response, positive-definite limb inertia, motor-placement effects, reduction scaling, URDF mass/inertia consistency, both inverse-kinematic branches, unreachable targets, gait continuity and chapter assembly. Browser verification covers leg motion/pause, arm dragging, controls, all four exports, equation-plot choices, topology stages, original image loading, both languages, desktop/mobile overflow, SVG label collisions and network/runtime errors.

Three.js is bundled only for the studio. Its MIT notice is distributed at `assets/licenses/three-LICENSE.txt`. The article’s scientific diagrams remain vector graphics; the robot viewport uses WebGL meshes, environment lighting and shadow maps.
