# Lightweight article and robot studio

The article is assembled from reviewed bilingual chapters in `content/lightweight/` through `scripts/content.mjs`. `content/轻量化结构设计.html` is the chapter index. The studio is a static browser application at `/labs/lightweight-robot/`; Three.js is bundled locally, and all analytical calculations use SI units in `src/lightweight-mechanics.ts`.

## Source coverage

User-selected outline: `/home/anncatto/obsidian_me/blog/轻量化结构设计.md`. Course sources: `/home/anncatto/obsidian_me/选修/轻量化结构设计技术/`. The 46 local attachments referenced by the course notes were inspected, including the added cantilever, material-index, section-shape, structural-efficiency and upper-arm selection figures. The added materials, manufacturing/fatigue/thermal, geometry, structural-efficiency and material-selection notes are incorporated; the topology note’s SIMP formulation is covered in Chapter 10. Source notes remain in Obsidian.

| Chapter | Scope |
| --- | --- |
| 01 | Constrained design; component and system mass; mass spiral |
| 02 | Kinetic energy, inertia tensor, parallel axes, mass matrix, 2R limb, effective contact mass |
| 03 | Elasticity/compliance, beams, plates, torsion, buckling, flexible modes and control |
| 04 | Axial/beam/plate and fixed-diameter/fixed-wall tube indices; strength indices; Ashby charts; composites |
| 05 | Section shape, equal-strength members, sandwich/lattice, size/shape/topology |
| 06 | Rotor/stator, reduction/reflected inertia, QDD, belts, linkages, screws and proximal drive |
| 07 | Thin-wall machining, alloy tempers, joints/inserts, tolerances, fatigue, fracture, impact energy, thermal paths, DFMA |
| 08 | Passive/active integration, structural batteries, vibration/noise, morphing, SHM/knockdowns |
| 09 | Source-checked robot cases: MIT/DLR/LOLA, Figure/TianGong, Galaxea/OpenArm and cable SCARA |
| 10 | Load cases, multibody/FE models, SIMP, numerical optimization, uncertainty and tests |
| 11 | Studio model, planar IK, gait/reach demonstrations, interpretation, exports and reading links |

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

Preview `/Anncatto/notes/lightweight-structural-design/` and `/Anncatto/labs/lightweight-robot/`. The article has 11 bilingual modules and six interactive scientific figures. Language changes propagate to the embedded studio. Keep `$$` delimiters intact during chapter expansion: replacement strings interpret dollar sequences, so the assembler uses a replacement callback.

The mechanics tests cover exact tube sections, cantilever response, positive-definite limb inertia, motor-placement effects, reduction scaling, URDF mass/inertia consistency, both inverse-kinematic branches, unreachable targets, gait continuity and chapter assembly. Browser verification covers leg motion/pause, arm dragging, controls, all four exports, diagram choices, both languages, iframe resizing, desktop/mobile overflow and network/runtime errors.

Three.js is bundled only for the studio. Its MIT notice is distributed at `assets/licenses/three-LICENSE.txt`. The article’s scientific diagrams remain vector graphics; the robot viewport uses WebGL meshes, environment lighting and shadow maps.
