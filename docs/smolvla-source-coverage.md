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
- The experiment chapter follows task/question, grouped findings, case evidence,
  historical arm/base trajectories, precision and internal mechanisms, FP32
  execution, implications, next tests, and
  experimental conditions. Full setup is the last H3; references remain collapsed.
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
