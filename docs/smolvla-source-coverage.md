# SmolVLA & 数值类型 — source coverage and release checks

Article route: `/notes/smolvla-numerical-types/`. Maintained as bilingual HTML
chapter includes in `/home/ann/Anncatto`, directly on `main`.
The November 23 editorial revision is maintained on main for Pages release.
Keep the unpublished robot workbench and D20 homepage separate from article releases.

## Structure

- H1 article title; H2 chapters; H3 subsections in the nested site-wide TOC.
- The first two chapters use initially closed native disclosures. TOC/deep links
  reveal their target; reading progress ignores hidden section headings.
- Model order follows the source note: architecture,
  observation features, attention, flow training, sampling, π0.5 comparison,
  SmolVLM, asynchronous inference.
- The experiment chapter follows a results-first order matching the site
  experimental-article workflow: task/question, full-width numbered findings
  (`ol.sv-points` + `.sv-inline-bars`, no multi-column KPI cards), real-robot
  cases and FP32 300 s live execution (with the interactive 25-step chunk-handoff
  diagram), historical 120-demo arm/base trajectories, precision updates and
  fast-weight mechanisms, unified live input-substitution and white-box routing
  attribution, implications with a consolidated evidence-boundaries block, next
  tests, and experimental conditions. Full setup is the last H3; references
  remain collapsed.
- Dataset-specific normalization is Data preprocessing under Experimental
  conditions, after the dataset/camera description and before training settings.
  The dataflow disclosure is colocated there; changing120/150-demo statistics
  belongs to the continued-training experiment.
- Trajectory introductions define action as a postprocessed policy-side control
  request and observation.state as measured state before the policy call/send.
  Queued predictions may have been generated earlier. Raster plots retain their
  Target / Pre-request feedback labels with explicit prose aliases; the local
  wrist SVG uses green feedback and its caption specifies that colour.
- Stopping analysis compares the actual command-P95 scales after dividing by
  sigma:.015298,.020222,.017485. These are inverse-mapped equivalents, not
  recorded raw network predictions. The independent CPU arithmetic check is a
  disclosure under this quantitative comparison.
- Numerical types proceed through representation, use in the policy pipeline,
  training precision and controlled results, rounding mechanisms, implementation.
  The fp32-master paper's findings are integrated into training precision.
- Experiments preserve configurations, four synchronized views, 13 videos,
  long-record curves, the 120/150 continuation, π0.5 timing, and two-toy extension.
- Body prose excludes prompts, editing history, source-note narration and pending
  verification. Source qualifications and audit details stay in this document.

## Confirmed experiment settings

The user confirmed on 2026-10-29:

- Use the experimental report's two SmolVLA stages: 120 demonstrations / 100k
  steps, then 150 demonstrations / another 100k steps.
- The October description said both stages updated the VLM. The archived
  parameter inventories and checkpoints inspected in November establish a
  different scope for the 150-demonstration precision runs: 99,880,992 trainable
  elements (98,245,840 expert + 1,635,152 external projections), with 350,165,184
  frozen elements. Current prose uses this measured scope for A/B/C. The
  earlier 120-demonstration run's exact update scope is not inferred from it.
- π0.5 uses four views: forward, chest, left wrist, right wrist.
- The form's red-module task label was incorrect; its dataset corresponds to the
  toy task. Its alternate SmolVLA run settings are superseded by the report's
  two-stage settings; π0.5 loss 0.003 is retained from the form.
- Training uses the algorithm defaults in `~/Alohamini` except explicit recorded
  settings. Its default storage is preserve and compute is BF16 autocast.

The user corrected the 150-demonstration retreat clip on 2026-10-30: the failure
is an inability to retreat. The video label and bilingual case analysis follow
that correction; the earlier excessive-retreat interpretation is superseded.

## Numerical evidence

- Raw `x.vel` has two values: 0 (102,656 frames) and 0.15000000596046448
  (19,819 frames), total 122,475. Mean/std: 0.02427307959 / 0.05524300088.
  Stop/forward normalized values: -0.439387 / 2.275888.
- `smolvla-normalization.py` extracts episode 0, 1.5–10 s, with transitions at
  71/30 and 249/30 s. Genuine reference traces use separate raw/normalized axes.
  No network predictions are fabricated. Float64 round-trip error under the
  inspected forward `(a-mean)/(std+eps)` and inverse `z*std+mean` is 2.2759e-8.
- The 150-episode dataset's action mean/std at x.vel are 0.02221962056 /
  0.05559354208. Stop/forward targets are -0.399680 / 2.298475. Restoring the
  old normalized stop/forward with new statistics gives -0.002207 and 0.148744.
  The article uses rounded values recomputed directly from both stats.json files.
- Numerical paper: 454 LIBERO-Object demonstrations, batch 16, 10k steps,
  expert/projector training. Default stored weights: 96.6M BF16 + 3.3M FP32.
  Success (default storage / FP32): lr1e-4 50-action open loop 59.3/69.5;
  lr1e-4 replan10 88.4/92.6; lr1e-5 open loop 4.3/49.3. These are within-paper
  storage comparisons, not measured success for the toy task.
- AlohaMini code inspected at e029e1f: BF16 VLM loading, inherited expert dtype,
  FP32 external projections, preserve storage by default, PyTorch AdamW;
  `trainable_dtype=float32` promotes trainable storage before optimization.
  Existing CPU tests for small updates and BF16 checkpoint/FP32 restoration
  passed (2 selected tests). No robot motion or full training run was launched.
- The 100-step plotting calculator uses constant decrements with nearest-even
  format rounding and FP32 master accumulation. It illustrates rounding, not a
  measured optimizer trajectory from the robot experiment.
- Historical evaluation contains 2,936 rows over 97.833 s, postprocessed targets
  and pre-request feedback. Raw network predictions, chunk IDs, effective policy
  config and inference times are absent. The four-stream diagram distinguishes
  reference and prediction branches and states the intended logging alignment.
- Release weights checked through Safetensors headers and Hub metadata on
  2026-10-29: SmolVLA 450,046,176 tensor elements; LeRobot π0.5 3,616,757,520.
  Pinned revisions are in `content/images/smolvla/model-counts.json`.

## Figures and media

- Attention comparison uses explicit action-query/key visibility matrices: SA
  reads prefix and causal action keys; CA reads prefix; π0.5 reads prefix and
  the full continuous action block. Input versus layerwise time conditioning
  appears beneath the matrices. FAST visibility remains in the cited paper fig.
- Timing diagram plots old/new chunks, inference and queue waiting on one clock.
  It marks the remaining-queue buffer and elapsed actions skipped in the new
  chunk. Both sliders change timing, stale-action count, and queue wait.
- Removed batch/sampling highlight-only widgets and the duration histogram.
  Retained the weight-rounding calculator and latency calculator.
- SVGs share the site's blue/green/grey theme and have no outer figure frame.
  Paper figures retain original artwork and attribution.
- Thirteen original-speed silent MP4s retain native playback controls and lazy
  playback; no repeated playback hints. Success labels: left / center / right.
- `smolvla-assets.py` uses explicit source directories, ffmpeg and the existing
  analysis environment. Public assets omit private filesystem paths. Source
  screenshot prompts and form screenshots are excluded from the article.

## Validation

Earlier release checks included build, local-reference/MathML checks, 28 unit
tests, and browser review in both languages at mobile/tablet/desktop widths.
For maintenance, check disclosures, nested TOC, hidden
headings, numerical controls, video/poster loading, viewer dismissal, no viewport
or SVG text overflow, and the empty homepage tools section. Verify the published
article after a successful Pages deployment.

## Stopping follow-up

- Removed the normalized-zero hypothetical row and its numerical examples from
  the normalization section. Stopping is defined in raw coordinates (zero), with
  its corresponding normalized target -0.439387.
- The user supplied the original `file-000.parquet` through WeChat. SHA256:
  `93ea0e1d7bb3e0875774ba1b8dd10c7c0919a23f18de197056c6b5f40b5f775b`.
  All 18 action channels' min/median/P95/max match the archived report to 1e-12;
  2,936 rows, episode 0, contiguous frame indices, 0–97.833 s at nominal 30 Hz.
  Public artifacts contain aggregates and plots, not the private raw recording.
- Phase windows remain 6–10 s after forward motion, 24–30 s after turning,
  and 76–80 s while the raised right arm transfers the toy, now calculated from
  raw rows using half-open intervals. The contact sheet supports the last phase.
  The windows contain 120, 180 and 120 frames. No forward or angular target is
  exactly zero; 97.5%, 90.0% and 95.8% of forward targets have magnitude <= .001.
  Tables report signed target medians and absolute-value P95 for both signals;
  pre-request feedback is not treated as same-step tracking error.
- Lateral targets are zero in all 2,936 frames, while lateral-feedback absolute
  P95 in the three windows is .003221, .004832, .004832 in recorded units.
  This establishes feedback residuals under zero lateral commands, without
  interpreting them as a measured displacement or recovering network outputs.
- `smolvla-stopping.py` validates every channel against the report and imports
  alohamini.learning.processor.Processor, not LeRobot’s processor classes. The
  current source and revision2a1d488 both match the archived processor SHA256
  676d7dc3d42dea5f9f05f01ba93d53d5f4ea7d79e6d4fe41507b4cca1e09cac9.
  SmolVLAProcessor delegates normalization and action restoration to that shared
  AlohaMini implementation. CPU BF16 autocast applies only to this isolated
  arithmetic check; FP32 statistics promote both restored outputs to FP32. FP32 stop round trip: 5.5879354e-9;
  pre-rounding the stop label to BF16: -3.6302954e-6; both restored outputs FP32.
  Both residuals were reproduced with the same AlohaMini processor. The prose
  and formula attribution now name this implementation. This isolates the inverse-operation residual; it does not evaluate reduced
  precision throughout the network or determine a training cause.
- Standalone scientific plots show six zoomed stopping-target windows and
  wrist-roll target/feedback traces with periodograms. Blue/green/grey palette
  follows `src/theme.ts`. Per-window metrics, grid statistics, spectral peaks,
  and source hashes are reproduced in `stopping-summary.json`.
- Paper motivations added: CA/SA complementary conditioning/action dependencies,
  qualitative smoothness observation (§3.1), frozen-VLM expert training protocol
  (§4.7), synchronous lags and environmental responsiveness (§3.3/§4.6).
- Flow training and action sampling have explicit definitions. The intuitive
  training/inference comparison was answered only in chat as requested.
- Flow-node text centered, disclosure hint text removed; explanatory hyperlinks
  attached to the relevant terms instead of standalone paragraph-end labels.

## Experiment organization and command jitter

- Four adjacent H3 case sections: SmolVLA 120, continued 150, π0.5 120,
  two-toy extension. Record labels precede every video group; initial-pose cases
  remain inside the 120-case section. Each failure group has a short observation, followed by unlabelled closing
  analytical paragraphs for each case. The trajectory section identifies the
  120-demo / 100k checkpoint and the 2026-10-23 10:32:19 episode-0 record.
- Trajectory analysis and base velocity follow the case sections. Continued-stage
  normalization statistics are grouped with base-velocity analysis.
- The archived events CSV selects the top three adjacent target changes per
  right-arm channel. All 21 selected events align to multiples of 25 frames;
  this is an observed grid, not an asserted historical n_action_steps setting.
  Seven-channel event indices and maximum changes are reproduced in
  `stopping-summary.json` with the CSV source hash.
- Full-record confirmation: 117 of 2,935 adjacent changes lie on the 25-frame
  grid. Their per-channel mean magnitudes are 5.2–18.1 times those elsewhere;
  they account for 42.9% of wrist-roll total variation. These are all-row
  comparisons, independent of selecting only the largest archived events.
- Periodograms use nominal 30 Hz, linear detrending, and the largest non-DC
  power bin. Target/feedback share peaks of .600 Hz (wrist roll, 16–26 s),
  .583 Hz (wrist roll, 38–50 s), and .608 Hz (wrist yaw, 88–97.833 s).
  Approximately 50 frames span a full oscillation; 25 frames describe the
  switching grid. Neither is presented as a recovered chunk configuration or
  a physical resonance frequency.
- Blue target reversals and orange feedback co-vary in the archived plot;
  analysis identifies command-side periodic revisions and grasp retries.
  Chunk-handoff discontinuity is the architectural interpretation of this rhythm,
  not a measured physical resonance or a recovered chunk-ID log.
- Two-toy A/B videos use width ratio 1:1.775 to align their square/landscape
  formats at equal height on desktop and mobile.
- The audited expert/projector scope and the precision recipes are linked
  directly after the modular-storage explanation. ULP and AdamW links
  sit at their first relevant explanation.

## November 20 precision and execution revision

### Source records

- The SmolVLA chapters and coverage file in the remote Anncatto repository on
  `buck` matched the local baseline byte for byte before editing. Remote files
  were read without modifying that repository.
- Latest archived source copied locally:
  `/home/ann/Alohamini_workspace/reports/smolvla-review-20261120/source/smolvla_result_20261119`.
  It contains the November 19 120k replay, endpoint-weight comparisons, source
  boundary audit and previous precision/execution findings. Staged inputs for
  reproducible figures are under the sibling `evidence/` directory.
- Original Obsidian reports are preserved in
  `具身智能算法/Alohamin/实验报告keyfinding/SmolVLA精度对照附件/详细精度分析.md`
  and `详细评估分析.md`. The two primary notes now summarize grouped findings
  and retain linked evidence and figures.

### Comparison and denominators

- A = mixed precision 100k; B = FP32 100k; C = B continued to 120k with another
  20k updates at constant 5e-7. All use the same 150-episode stage, initialized
  from the earlier 120-episode task checkpoint. Counts refer to this stage.
  The 150 episodes contain 155,727 frames; validation episodes = 0.
- A/B change parameter storage, optimizer-moment storage and compute recipe
  together. Native A has 96,607,440 BF16 trainable matrix elements and
  3,273,552 FP32 trainable elements. B/C trainable parameters and Adam moments
  are FP32; no autocast/TF32 in the audited FP32 protocol.
- Endpoint-change fractions use the same 129 matrix names / 96,607,440
  elements: A 95k→100k 0.0826675%, B 95k→100k 99.99785%,
  C 115k→120k 99.99773%. They count unequal elements, not update amplitudes.
- The paired loss comparison converts all models to FP32 and fixes 16 training
  windows, 32 noise/time draws and 18 supervised real dimensions. Loss:
  A 0.026730026, B 0.012758, C 0.012838256. This measures training-window fit;
  C has a larger update budget and is separate from equal-budget A/B.
- Expert/projection swaps yield two unique hybrid combinations (four swap
  directions): B expert + A projections 0.073255248; A expert + B projections
  0.060578466. The 16 expert layers are swapped in both directions. A receiving
  B layer 6 reduces paired loss by 7.43%; retain the complete 32-case plot.
- The 90-window A/C prediction comparison uses uniform FP32, 50 steps/window,
  and 4,500 shoulder positions/model. Below −100: A 390, C 153, all in start
  windows. Offline clipping of C's shoulder reduces MAE by 0.64%.
- Frozen runtime source confirms linear output, 32-dimensional Euler sampling,
  18-dimensional training loss, real-dimension cropping and affine restoration.
  The 14 padded dimensions are a proposed controlled intervention, with no
  new inference ablation performed in this revision.

### Execution and input interventions

- B's November 9 robot record: 5,832 frames, 299.87979 s, effective 19.444 Hz;
  nominal exported video rate is 30 fps. It predicts 50 actions and executes 25.
  This is separate from the October 23 2,936-frame / 120-demo record.
- Requested, Host-accepted and pre-request-feedback values remain distinct.
  Shoulder request below −100: 320/5832; requests span −119.6287…84.2500,
  accepted targets −100…84.1689. The fitted 0.95 s shift is estimated on the
  same trajectory, not an independent actuator-latency measurement.
- Input intervention results use three saved observations, 39 combinations and
  three matched seeds = 117 predictions. Average absolute shoulder change is
  measured over the first 25 actions against a freshly regenerated matched
  baseline; the historical executed request can belong to a cached chunk.
- Donor selection uses nearest demonstrated arm state with a standard-deviation
  floor of 1 for matching. Actual inference retains checkpoint normalization.
  Responses describe each specific donor substitution, not a normalized ranking
  of modality importance. Brightness-only 0.7/1/1.3 tests preserve geometry/state.

### Reproduction and deliverables

- `scripts/figures/smolvla-experiment-analysis.py EVIDENCE_DIR --note-output IMAGE_DIR`
  exports five standard scientific SVGs, five Chinese note PNGs and
  `precision-summary.json`. The JSON contains aggregate results, checkpoint
  hashes and source hashes, with private paths removed.
- `scripts/figures/smolvla-intervention-diagram.py` produces the bilingual inline
  network diagram plus standalone Chinese/English SVGs. The diagram separates
  frozen/trained modules, 32-dimensional sampling and 18-dimensional loss, and
  shows exactly which parameter groups are swapped. No model training, robot
  execution or new GPU inference was launched for this article revision.
- Validation records and browser screenshots live in
  `/home/ann/Anncatto_workspace/smolvla-review-20261120/`.
- November 20 checks: production build passed; 872 internal references and
  MathML checks passed; all original chapter anchors, media sources/posters and
  non-chapter figure macros remain present. Three Obsidian notes have 12
  resolved and decoded image embeds, with their Markdown file links resolved.
- Browser checks: 44/44 passed, Chinese/English at 1440 px and 390 px,
  including initially closed theory/references, findings first and conditions
  last, viewport width, SVG text containment, network enlargement/Escape,
  all image decoding, five new figure viewers, retained numerical controls and
  original video playback. The same run checked OpenWAM's updated definitions
  and mobile formula layout. No browser script errors were recorded.

## November 23 precision clarification

- The 129-name / 96,607,440-element group is A's BF16 trainable weight group,
  including normalization vectors; use “weight elements” rather than “matrix
  endpoints”. B/C comparisons retain the same names and element positions.
- The metric counts unequal saved values at 95k/100k (A/B) or 115k/120k (C).
  It measures endpoint differences, not per-step update frequency or amplitude.
- A's FP32 subgroup spans external projections and 16 expert K/V projection
  tensors. Its last-5k fraction is 3,249,893 / 3,273,552 = 99.27727%; A's BF16
  subgroup is 79,863 / 96,607,440 = 0.0826675%. Group by storage dtype.
- Matching frozen-parameter dtypes describes the post-training comparison.
  Optimizer writeback occurs in memory at each step; checkpoint serialization
  records already-rounded values. The BF16 1.0 + 0.001 example was checked on
  CPU: four direct writes retain 1.0, while an FP32 master reaches approximately
  1.004 and its BF16 copy becomes 1.0078125.
- Figure labels and checkpoint intervals now name the measured comparison;
  original aggregate data, source hashes and subsequent replay results remain.
- November 23 validation: build and 1,090 internal references/MathML pass;
  43 targeted bilingual browser checks cover 1440/390/320px, the theory link,
  rounding controls and enlarged plot. At 320px, the pre-existing 346px document
  width matches the published baseline; edited text introduces no overflow.


## November 23 English-first editorial revision

- Wrote and reviewed a complete English draft before translating 175 copy units
  into Chinese. Both language branches use the same experiment scope and data.
- The precision section introduces A/B/C in a comparison table, then presents
  checkpoint differences and matched replay. Parameter-scope details are folded;
  arithmetic examples remain in numerical theory. Action MAE and planned tests
  use compact tables instead of dense enumerations.
- Behavioral cases are followed by the historical 120-demo arm/base analysis,
  then the 150-demo precision comparison and the separate FP32 robot record.
  C is explicitly continued from B; paired flow replay uses two draws for each
  of 16 windows (32 evaluations). Input-state shifts retain Host units.
- All original section IDs, source links, image/video sources, media groups,
  core formulas and aggregate experiment files are retained. The 129-tensor scope
  includes normalization vectors and remains described as weight elements.
- Drafts, translations and preservation manifests are private working artifacts
  under `/home/ann/Anncatto_workspace/smolvla-editorial-20261123/`.
- Final validation: production build and 1,094 local-reference/MathML checks pass.
  All 70 browser checks pass in English/Chinese at 1440/768/390px, covering the
  early five-column recipe table, evidence order, native disclosures, figures,
  image decoding, original video playback, viewers and numerical controls.


## November 23 terminology clarification

- Joint suffixes retain their English names. `shoulder_lift` identifies upper-arm
  elevation; `wrist_roll` identifies rotation about the forearm/tool axis. Values
  in the archived plots remain Host-calibrated coordinates.
- The 25-frame group uses the later index of each adjacent pair: 25, 50, 75, …,
  totaling 117 pairs. TV is the sum of absolute policy-command differences;
  42.9% is the selected pairs’ share of right-wrist TV, not statistical variance.
- Images and proprioceptive state are observation inputs. Input-replacement
  descriptions distinguish original/replacement inputs, fixed weights/prompt/seed
  and regenerated actions; each saved time uses its own selected training donor.
- Zero lateral requests mean `y.vel=0`. Nonzero feedback is reported as a measured
  reading; actual displacement and velocity-estimation error require an independent
  reference to separate. No physical-motion cause is assigned from that reading.
- The stopping comparison uses absolute forward-command P95 and normalized-label
  BF16-rounding/restoration error in the same original x.vel units. Its roughly
  230–310× ratio compares recorded commands with an isolated processor conversion,
  separately from the A/B training-recipe comparison.
- Validation: production build and 1,094 local-reference/MathML checks pass.
  All 70 full-page and 19 targeted browser checks pass in English/Chinese at
  1440/768/390px. Original anchors, source/media links and aggregate data remain;
  no experiment data or figures were changed.


## November 25 mechanistic depth and bilingual figure redesign

- **Network-level mechanisms added from existing archived evidence (`parameter_inventory.csv`, `replay.json`, `layer-swaps.json`, `continuation/errors.npz`, `deployment/evaluation-series.npz`, `deployment/input-interventions.json`)**:
  - Audited A's 3.27M FP32 trainable subgroup into its exact two structural sets: 10 external projection tensors (1,635,152 elements) and 16 odd-layer cross-attention `k_proj`/`v_proj` tensors (1,638,400 elements across L01–L15). The remaining 96,607,440 BF16 elements split into the 96,584,400-element expert body (4.46% relative L2 weight change from initialization vs B's 13.71%) and 32 RMSNorm tensors (23,040 elements, 0.00% changed in A vs 0.49% in B).
  - Documented the late-stage plateau and relative L2 weight-change differences: as A's BF16 body plateaus during cosine decay (50k–100k: 0.02753 → 0.02702, −1.8%, while B drops 0.02104 → 0.01276, −39.4%), A's 26 FP32 tensors change 1.64× (external projections: 7.88% vs 4.81%) and 2.46× (odd CA K/V: 17.31% vs 7.03%, reaching 24.63% in L15 `v_proj`) more than B, corresponding to higher loss under whole-module swaps (0.073255 / 0.060578) and first/final CA layer swaps (L01 1.97×, L15 1.81×).
  - Documented different active dimensions across projections: `state_proj.weight` and `action_out_proj.weight` change on exactly 56.25% (= 18/32) of elements, while `action_in_proj.weight` changes on 100% because Gaussian noise and 10-step Euler integration cover all 32 dimensions.
  - Documented the ~195-second sawtooth oscillation (95–290 s) in B's November 9 live record (165 of 182 jumps >20 in 120 ms, ~0.9 s chunk-handoff drops from −10 to −79…−98 while right gripper stays closed near 2), linked all three observation-substitution timestamps (0.36 s start underflow, 10.76 s moving base, 251.12 s oscillation phase where `wrist_right` alone produces 53.746 vs all four cameras 53.151), and explained the 49.27σ initial left-gripper offset (13.26 vs training mean 2.41, std 0.220).
- **Redesigned figures & bilingual support**:
  - Rebuilt `scripts/figures/smolvla-intervention-diagram.py` (`09-intervention-diagram.html`, `precision-network*.svg`, Obsidian `SmolVLA-网络交换.png`) to display the 16-layer alternating SA/CA mixed-storage layout, relative L2 weight change, 18D/32D path, and whole-module swap topology (`P_in → E → P_out`).
  - Standardized wording across prose, SVGs, and Obsidian notes to plain, literal technical phrasing (defining relative L2 weight change `||θ - θ₀||₂ / ||θ₀||₂`, removing coined terms, anthropomorphism, rhetorical questions, and abstract slogans).
  - Rebuilt `scripts/figures/smolvla-experiment-analysis.py` with a unified palette (slate A, blue B, green C, coral alerts/bounds) exporting paired English/Chinese SVGs (`<name>.svg` and `<name>-zh.svg`) plus Obsidian PNGs: 5k–100k trajectory + 4-group relative L2 change (`precision-fit`), layerwise L2 change + SA/CA-shaded 16-layer swaps (`module-swaps`), start-window distribution near −100 + 50-step horizon bins (`boundary-replay`), 300 s live trace + 150–160 s zoomed sawtooth (`deployment-traces`), and 9-row per-camera/state heatmap with phase labels (`input-responses`).
  - Updated `src/article-navigation.ts` so figure enlargement selects the active-language `<img>` when a figure carries bilingual SVGs.
  - Fixed duplicated `</summary><ol class="sources">` markup in `content/smolvla/06-references.html` and rewrote the experimental chapters English-first with plain problem-driven prose, consistent naming, and updated Obsidian notes (`SmolVLA精度对照.md`, `SmolVLA评估分析.md`).
- Validation (2026-11-26): production build (`npm run build`), 1,100 internal-reference/MathML checks (`npm run check`), 175/175 unit tests (`npm test`), and 81/81 bilingual browser checks across 1440/768/390 px (including prose and SVG floating tooltips, viewport clamping, active-language SVG enlargement, diagram text containment, Escape restoration, 12-item reference structure, rounding/latency widgets, video playback, and zero mobile overflow) all pass.
- **November 26 readability, palette, and interactive-tooltip upgrade**:
  - Aligned all new CSS components and Matplotlib/SVG figures to the native Anncatto palette (`#273b43` ink, `#556b73` Mixed 100k, `#237ab2` FP32 100k, `#4b9c80` FP32 120k, `#b55d4c` muted alert, `#dce9e9` grid/lines, `GnBu` heatmap).
  - Replaced cryptic `A / B / C` aliases with self-explanatory run names (`混合 100k` / `FP32 100k` / `FP32 120k`) and plotted the full 5k → 120k matched loss curves in `precision-fit` to show directly that FP32 leads by 20k and converges by 100k.
  - Rebuilt `09-intervention-diagram.html` (`precision-network*.svg`) into three bar-quantified visual panels (shared 0–20% L2-change bars, 18:14 proportional 32D/18D strips, and horizontal whole-module swap loss bars) with interactive hover/focus tooltips (`src/smolvla.ts`, `public/style.css`).
  - Shortened the experimental chapters with a 4-card quantitative KPI strip, inline visual bars, phase timeline strip, folded detailed tables, and rounded 1–2 decimal figures with exact multi-decimal values on hover.
- **November 26 fast-weight MLP derivation, zero-retraining probes (arXiv:2602.01219 / MiTA), and figure decluttering**:
  - Added worked derivation (`content/smolvla/07b-fast-weights.html`) and 4-step interactive animated diagram (`{{smolvla:fastweights}}` in `src/smolvla-figures.ts` & `src/smolvla.ts`) decomposing SmolVLA odd CA layers into a 305-wide observation fast-weight MLP (6 parallel source sub-MLPs reused across 10 Euler steps, remapped only by the 16 FP32 `k_proj`/`v_proj` tensors) vs even SA layers' $(305+t+1)$-wide composite MLP.
  - Ran zero-retraining inference probes on the archived 100k Mixed and FP32 checkpoints (uniform FP32 compute, 16 matched windows + 4 live robot moments + 153.4 s 40 ms chunk-drop pair; aggregates stored in `precision-summary.json` schema v3 with SHA-256 source hashes, zero private paths or credentials):
    - 4 reusable temporal landmarks (`mita_route m=4, k=16`: FP32 `0.01525`) match 50 private Top-16 sets (`0.01511`); temporal compression (`Agent m=4`: `0.01295`, MAE `0.0288`) strongly outperforms hard Top-16 truncation (`0.01511`, `+18%`); MiTA (`m=4, k=12`: `0.01265`; `m=8, k=56`: `0.01230`, MAE `0.0283`) matches or beats full 305-token CA.
    - Depth sparsity runs shallow-narrow to deep-wide (`FP32 effN`: L01 `2.6` → L15 `53.7`; `Mixed`: L01 `3.2` → L15 `45.1`), opposite to classification ViTs.
    - Live white-box routing: single `state` token holds `40–41%` of L01 mass on normal frames but collapses to `0.4%` at 0.4 s (`49σ` OOD left gripper); at 251 s, L11 hits `70%` Top-16 on `wrist_right` patch `(4,4)` (the toy) and swapping only `wrist_right` drops L13 routing mIoU to `0.35`; across the 40 ms sawtooth drop at 153.4 s, routing mIoU stays `0.84`, confirming chunk-handoff discontinuity rather than per-frame attention jitter.
  - Decluttered all 6 existing figures (removed redundant suptitles, shortened titles/legends/callouts) and exported 2 new bilingual SVG/PNG pairs (`fast-weight-probes`, `live-routing`).
- **November 26 results-first restructuring & state-switching diagrams**:
  - Reordered the experiment chapter to present real-robot outcomes first (`task-observations` → `fp32-live-record`) before tracing historical 120-demo trajectories (`long-record`), precision/coadaptation mechanisms (`precision-results`, split `module-coadaptation` and `layerwise-swaps` so two large figures do not stack back-to-back), fast-weight MLP analysis (`fast-weight-analysis`), and unified black-box/white-box live attribution (`08b-live-attribution.html`).
  - Removed duplicated summary bullets below the 4-card KPI strip in `03-intro.html` and added 5 restrained inline `.sv-contrast` lines separating easily confused concept pairs without uniform boxed cards (`offline fit vs closed-loop execution`, `storage vs compute precision`, `offline clipping vs model fit`, `slow vs fast weights`, `compression vs routing`).
  - Upgraded `{{smolvla:fastweights}}` to switch live across Full 305 / Route Top-16 / Compress `m=4` / MiTA `4+12` on one fixed 305-unit observation strip, and added `{{smolvla:handoff}}` toggling synchronous 25-step hard switching (`−11 → −79`) against overlap / RTC conditioning.
- **November 26 workflow alignment (full-width points, evidence boundaries, restrained blue-green palette)**:
  - Replaced the 2×2 `.sv-kpi-grid` cards in `03-intro.html` with full-width numbered `ol.sv-points` + `.sv-inline-bars` per `docs/experimental-article-workflow.md`; converted mechanism bullet lists to `.sv-points`; kept all section headings declarative with 3 restrained guiding transition questions in prose (`08-fp32-execution`, `07b-fast-weights`, `08b-live-attribution`), lifted inline equations with `=`/fractions/norms into display blocks, and consolidated measured facts, coupled-variable boundaries, and deferred hypotheses into a dedicated `.sv-finding` evidence-boundaries block in `05-analysis.html`.
  - Tightened all 7 Matplotlib figure pairs, the 3-panel network diagram, Obsidian PNG exports, and both interactive SVGs (`fastweights`, `handoff`) toward the restrained OpenWAM slate/blue/green palette (`#556b73`, `#237ab2`, `#4b9c80`), removing pink background spans and superfluous accent hues while reserving `#b55d4c` strictly for threshold/failure highlights.
