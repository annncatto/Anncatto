# SmolVLA & 数值类型 — source coverage and release checks

Article route: `/notes/smolvla-numerical-types/`. Maintained as bilingual HTML
chapter includes in an article-only worktree. Keep the unpublished robot
workbench and D20 homepage separate from article maintenance releases.

## Structure

- H1 article title; H2 chapters; H3 subsections in the nested site-wide TOC.
- The first two chapters use initially closed native disclosures. TOC/deep links
  reveal their target; reading progress ignores hidden section headings.
- Model order follows the source note: architecture, action normalization,
  observation features, attention, flow training, sampling, π0.5 comparison,
  SmolVLM, asynchronous inference.
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
- Both stages update the full model, including VLM. This overrides the report's
  frozen-VLM description. It is separate from the algorithm preset's expert-only
  default and the published numerical paper's expert/projector experiment.
- π0.5 uses four views: forward, chest, left wrist, right wrist.
- The form's red-module task label was incorrect; its dataset corresponds to the
  toy task. Its alternate SmolVLA run settings are superseded by the report's
  two-stage settings; π0.5 loss 0.003 is retained from the form.
- Training uses the algorithm defaults in `~/Alohamini` except explicit recorded
  settings. Its default storage is preserve and compute is BF16 autocast.

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

Build, local-reference/MathML checks, 28 unit tests; browser review in both
languages at mobile/tablet/desktop widths. Check disclosures, nested TOC, hidden
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
- `smolvla-stopping.py` validates every channel against the report and calls the actual
  CPU Processor under BF16 autocast. FP32 stop round trip: 5.5879354e-9;
  pre-rounding the stop label to BF16: -3.6302954e-6; both restored outputs FP32.
  This isolates the inverse-operation residual; it does not evaluate reduced
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
  remain inside the 120-case section. Each case has one concise closing analysis.
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
- Current full-model trainable scope, BF16 autocast and preserve storage are
  listed directly after the modular-storage explanation. ULP and AdamW links
  sit at their first relevant explanation.
