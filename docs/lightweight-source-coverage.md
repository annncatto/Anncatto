# Course source coverage

Checked on 2026-10-24 against the 13 course notes and their 47 embedded screenshots. This inventory maps source content to article locations; screenshots with course watermarks are not copied into the website. Duplicate slides are consolidated. Original Obsidian notes remain unchanged.

The article follows general lightweight-design teaching: overview, materials, mechanical performance, selection, structure, manufacturing, integration and optimization. Worked extensions and robot cases follow. The independent robot studio is not embedded in or presented as a chapter of the article.

| Source note / screenshot | Content retained | Article anchor | Figure treatment |
| --- | --- | --- | --- |
| 材料 / `材料-1792835643907.webp` | Ashby logarithmic axes, guide-line slopes and material families | `#material-selection` | Official Ansys chart; interactive minimum-mass comparison |
| 材料 / `材料-1792836605170.webp` | Axial and bending stress, cantilever load and neutral axis | `#bending` | Derived equations; redrawn beam with selectable load distribution |
| 材料 / `材料-1792838704580.webp` | Strength–density material chart | `#ashby-charts` | Official Ansys strength chart |
| 系统轻量化设计 / `系统轻量化设计-1792816303302.webp` | FML, GLARE, galvanic isolation, EPDM and foil-specific results | `#sandwich-laminates` | DLR original FML photo; case quantities in extended questions |
| 系统轻量化设计 / `系统轻量化设计-1792816377153.webp` | Boehmite toughening, thermal/flame fillers, fatigue and thin plies | `#sandwich-laminates` | NTPT original thin-ply comparison; case quantities retained |
| 系统轻量化设计 / `系统轻量化设计-1792816398594.webp` | KDF product, CAI impact location and resonance fatigue test | `#uncertainty-monitoring` | Symbolic course formula and explanation; test quantities retained |
| 系统轻量化设计 / `系统轻量化设计-1792816451411.webp` | Guided waves, intact/debonded stiffener, monitoring mass benefit | `#uncertainty-monitoring` | Wave-path principle redraw; UCSD primary research link; ≥5% example |
| 拓扑优化 / `拓扑优化-1792841287924.webp` | SIMP variables, compliance, equilibrium and volume constraint | `#topology` | Course formulation; interactive interpolation curve |
| 拓扑优化 / `拓扑优化-1792841466208.webp` | Simply supported beam, centre load, 40% volume, iteration example | `#topology` | Independently solved 120×36 SIMP stages; course 44/244.1 distinguished |
| 轻量化机器人结构调研 / `轻量化机器人结构调研-1792837666843.webp` | Galaxea teleoperation leader/follower context | `#teleoperation-arms` | Source-checked A1X/LEMO, OpenArm, Unitree and ALOHA comparison |
| 惯量 / `惯量-1792827696102.webp` | Inertia, mass spiral, reflection, stiffness/control and contact learning objectives | `#robot-survey` | Covered by final robot mechanics and case sections |
| 惯量 / `惯量-1792828313270.webp` | Rigid-body dynamics and mass distribution | `#robot-inertia` | Course dynamics equation, terms and wrench sign convention |
| 惯量 / `惯量-1792828394089.webp` | Mass spiral and upstream resizing | `#robot-inertia` | Redrawn feedback sequence |
| 惯量 / `惯量-1792828914954.webp` | Parallel axes and proximal knee motor example | `#robot-inertia` | Course formula; placement redraw; offset contribution and stated totals |
| 惯量 / `惯量-1792829628590.webp` | Reflected rotor inertia and ratio comparison | `#robot-joints` | Course formula and interactive 6/10/30/50/100 ratio plot |
| 惯量 / `惯量-1792831187271.webp` | Proprioceptive actuator, QDD and backdrivability | `#robot-joints` | Actuator concepts, current-based torque estimation, source-checked Mini Cheetah |
| 惯量 / `惯量-1792831436337.webp` | Frequency scaling, stiffness and control | `#stability-dynamics` | Course frequency formula and mechanical/control explanation |
| 惯量 / `惯量-1792831691950.webp` | F=kx, stress–strain and axial extension | `#elasticity` | Contextual axial derivation and qualitative tensile curve |
| 惯量 / `Pasted image 20261024175931.png` | Effective mass and quadratic kinetic energy | `#robot-contact` | Course formula; interactive 2/5/10 kg energy curves |
| 惯量 / `惯量-1792832706447.webp` | ISO/TS 15066 power/force limiting and body-region criteria | `#robot-contact` | Brief explanation linked to official ISO source, without numerical limits |
| 惯量 / `惯量-1792833582535.webp` | Derivation of the axial-stiffness material index | `#stiffness-indices` | Requirement/free-variable/mass/material-term flow and derivation |
| 惯量 / `惯量-1792834190357.webp` | Tie, beam, plate and thin-tube stiffness/strength indices | `#strength-indices` | Rebuilt table with geometric freedoms and corresponding derivations |
| 惯量 / `惯量-1792834665240.webp` | Steel, Al, Mg, Ti, quasi-isotropic/UD CFRP and nylon data | `#typical-material-values` | Rebuilt eight-row property and index table |
| 惯量 / `惯量-1792837965280.webp` | Metal specific-modulus similarity; beam ranking; QI/UD contrast | `#ashby-charts` | Interactive six-material minimum-mass comparison; parameter table |
| 导论 / `导论-1791522170248.webp` | Introductory material index and relative cost table | `#course-material-table` | All eight rows and original index/cost values rebuilt as two tables |
| 导论 / `导论-1791522326766.webp` | Cost–mass curve, A/B, cost per kilogram and cost categories | `#cost-performance` | Curve redrawn with A/B and marginal tradeoff; life-cycle prose |
| 导论 / `导论-1791522543518.webp` | Basic, engineering and process properties; materials relationships | `#processing-properties` | Full three-group explanation; composition/process/property/service map |
| 导论 / `导论-1791522548955.webp` | Duplicate materials-foundation slide | `#processing-properties` | Consolidated with previous screenshot; no duplicated prose |
| 导论 / `导论-1791522565341.webp` | Capacity, stiffness, residual strength, life, crack growth and reliability | `#design-verification` | Rebuilt verification diagram with all four input groups |
| 导论 / `导论-1791522586749.webp` | Requirements, concept, design, production, prototype, test and delivery | `#design-verification` | Design workflow redraw, full sequence and feedback in prose |
| 导论 / `导论-1791522618279.webp` | Real problem, mathematical model, algorithm and interpretation loop | `#optimization` | Dedicated modeling diagram and optimization explanation |
| 导论 / `导论-1791522795672.webp` | FE model, test scheme, sensors/strain gauges and model calibration | `#design-verification` | Virtual–physical loop and verification workflow |
| 形状 / `形状-1792839582565.webp` | Equal-mass square/circle/tubes, section and mass-inertia distinction | `#section-efficiency` | Interactive equal-area section comparison; exact tube factors |
| 形状 / `形状-1792841143256.webp` | Three routes through materials, structure and manufacturing | `#structural-design` | Intro framework and structural/manufacturing sequence |
| 概念设计 / `新概念设计-1792816533711.webp` | Composite-oriented concept, frame/beam/wing, DSS and double-double | `#sandwich-laminates` | Core concepts and primary links; all numerical examples retained at end |
| 概念设计 / `新概念设计-1792816608513.webp` | Six course modules and their common design method | `#introduction` | All thematic modules retained; robot topics moved to final chapter |
| 概念设计 / `新概念设计-1792816629928.webp` | Definition, objectives, traditional versus integrated methods | `#introduction` | Concept definition and two-route framework |
| 概念设计 / `新概念设计-1792816738002.webp` | Six-arm payload/self-mass chart | `#payload-comparison` | Redrawn with official model-specific values and explicit load conditions |
| 概念设计 / `新概念设计-1792817119590.webp` | RTM chain, isothermal process, vacuum channels, ultrasound and 65% fibre fraction | `#manufacturing` | Full process description and RTM chain; cost/cycle examples retained |
| 概念设计 / `新概念设计-1792817498754.webp` | Ragone chart, LATP/CNT storage, 11.59 mF/cm³ and system savings | `#structural-energy` | CC BY original Ragone figure; material concept and all case numbers |
| 结构效率 / `结构效率-1792839977340.webp` | Efficient thin sections, direct load paths and utilization | `#structural-design` | Three-principle diagram with sections, load paths and full-stress explanation |
| 选材 / `选材-1792840873549.webp` | Upper-arm material exercise: 0.35 m tube, fixed diameter/wall | `#tube-selection-example` | Worked two-case table and conditions in extended questions |
| 优化目标 / `优化目标-1792820006181.webp` | Minimum mass constrained by stiffness, strength, dynamics, contact and cost | `#introduction` | Introduction objective and verification; robot contact in final chapter |
| 优化目标 / `优化目标-1792821563838.webp` | Traditional versus passive/active integration technical framework | `#design-routes` | Rebuilt framework and functional integration chapter |
| 优化目标 / `优化目标-1792830799356.webp` | Concept, scheme, detail and validation decisions | `#design-levels` | Design-stage diagram; no early robot-only framing |
| 优化目标 / `优化目标-1792830762221.webp` | Mini Cheetah, Cassie, LWR III mechanism examples | `#robot-survey` | Primary-source case comparison; corrected Cassie all-pelvis-motor claim |
| 优化目标 / `优化目标-1792827004785.webp` | Mass cost, distal inertia, constrained design, two routes and early decisions | `#introduction` | Intro general principles; robot-specific consequences at end |

## Figure provenance

| Local asset | Original source | Attribution / handling |
| --- | --- | --- |
| `ashby-modulus-ansys.webp`, `ashby-strength-ansys.webp` | [Ansys Material Property Chart Collection](https://ansys.synopsys.com/academic/educators/education-resources/material-property-chart-collection); downloadable `property-charts-pstpccen24.zip` | Original 2024 PDF pages rendered at 2600 px; logos and © ANSYS retained. Facilitator guide permits teaching reproduction and prohibits commercial use. These are educational article illustrations. |
| `dlr-fibre-metal-laminate.webp` | [DLR original FML photograph](https://www.dlr.de/en/images/institutes-1/institute-of-composite-structures-and-adaptive-systems/fa-faser-metal-laminate) | © DLR credited immediately below. Official counterpart illustrating the course concept; not claimed to be the exact exploded diagram on the slide. |
| `thin-ply-ntpt.webp` | [T. Ricard / NTPT, SuCoHS final workshop, 2022](https://www.sucohs-project.eu/sites/sucohs/files/media/2022-03/SuCoHs_Final%20Public%20Workshop_Industrialisation%20of%20thin%20ply%20composites%20manufacturing_NTPT_20220223.pdf), PDF page 5 | Original workshop slide with brand/source intact. Official comparison of conventional and thin plies, replacing the watermarked course illustration. |
| `ragone-greenhalgh.webp` | [Greenhalgh et al., Characterization and reporting protocols for structural power composites: a perspective, 2025](https://doi.org/10.1002/aenm.202404702), Figure 2; [author repository PDF](https://research.chalmers.se/publication/547875/file/547875_Fulltext.pdf) | Figure image extracted from the publication; CC BY 4.0. Credit and DOI accompany the figure. A primary-source counterpart to the course Ragone plot, not the slide’s LATP/CNT dataset. |
| `topology-00/15/40/80.png` | `scripts/figures/lightweight-topology.py`; method reference [Sigmund / DTU TopOpt](https://www.topopt.mek.dtu.dk/apps-and-software/a-99-line-topology-optimization-code-written-in-matlab) | Independently computed 120×36 Q4 plane-stress example, volume 0.4, p=3, sensitivity filter, OC update. `topology-results.json` records the solve. No copied test or simulation image. |
| HTML/SVG course diagrams | User-provided course screenshots | Faithful conceptual redraws in `src/lightweight-course.ts`, with bilingual labels. Qualitative curves and wave paths are explicitly identified as schematics. They do not present invented experimental data. |
| Interactive equation plots | Course equations and stated example parameters | `src/lightweight-diagrams.ts`: member loading, material indices, equal-area sections, rotor reflection, kinetic energy and SIMP interpolation. Source-definition and geometry differences are explained next to the plots. |

## Corrections and interpretation

- Compliance is the inverse of scalar linear stiffness, not its derivative. Material modulus, structural stiffness, area second moment and mass inertia are distinguished.
- The material-index exponent follows free geometry. The introductory table’s bending column and similar-section beam derivation have different assumptions; both are retained with explanations.
- The local-metal FML slide reports bearing strength +30%, CAI +15%, and mass-specific energy absorption +50%. These are separate measures; +50% is not interlaminar shear strength.
- The course’s 0.126→0.072 kg·m² motor-placement totals are labeled schematic. The isolated 0.6×0.30² offset contribution is 0.054 kg·m²; a full mechanism also needs transmission and complete geometry.
- Robot catalog comparisons preserve mid-range/full-range, nominal/maximum and model-version distinctions. DLR’s official current value is 14 kg arm mass, rather than the slide’s 13.5 kg.
- Course case percentages remain labeled course-specific comparisons. Their original test baselines are not claimed to have been independently reproduced.
- No exact public original was confirmed for the cost/workflow/checking diagrams, RTM collage or intact/debonded wave-field screenshot. Their teaching relationships are redrawn and credited, rather than removing course watermarks or presenting another source as the exact original.
- Original image attributions and mathematical fonts are preserved. Body and interactive labels use the site typefaces; article language switching hides the other language.

## Source updates

The JSON inventory records source hashes. Future changes to the Obsidian notes or their referenced screenshots can be compared against it; this is a snapshot of the sources checked on the date above.
