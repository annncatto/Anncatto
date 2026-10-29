# SmolVLA & 数值类型 — source coverage and release checks

Article date: 2026-10-29 (Asia/Tokyo). Article route: `/notes/smolvla-numerical-types/`.

The article is maintained as HTML chapter includes, with bilingual prose. It is
prepared in an isolated worktree based on `44cb43b`, not on the unpublished robot
workbench branch. Publishing it must not reintroduce that homepage tool entry or
any workbench changes.

## Coverage

| Note requirement | Implementation |
| --- | --- |
| Keep `SmolVLA: small, efficient and capable` | Exact h2 in the first native disclosure |
| First two major sections collapsible | Native details; initially closed; anchor navigation opens required ancestors |
| Architecture, figures, expert, attention ablation | `01-model.html`: paper Figure 1, release configuration, implementation details, Table 6 |
| Trace VLM features, training batch, sampling | Three separate native SVG flow diagrams; batch steps and sampling progress are interactive |
| SmolVLM data and performance | Paper Figure 2, source categories, representative published scores; no grasp-rate extrapolation |
| π0.5 architecture and comparison | Paper Figures 3 and 18, native structural diagram, openpi expert and time conditioning |
| Asynchronous execution | Queue budget interactive figure; SmolVLA time/score distinction; RTC and stale-action discussion |
| Formats and training implementation | Bit/range table, module-specific storage versus compute, optimizer sketch, actual-step reasoning |
| fp32-master paper | Controlled storage comparison, update probe, replanning sensitivity and scoring limitations |
| Experimental setup | Actual 120-episode metadata, synchronized four-camera frames, duration histogram, training-record table |
| All requested clips | 13 original-speed silent MP4 loops with native playback controls, posters, source checksums |
| Evaluation curves | Original right-arm figure plus expandable left-arm and base/lift plots; timing/units caveats preserved |
| Continued training and two-toy extension | Separate stages; no invented total, success denominator or causal attribution |
| Final analysis | Evidence/mechanism/test table and a controlled next-experiment sequence |

## Evidence reconciliation

- The user confirmed the form screenshot refers to the toy dataset; its red-module
  task/dataset text was an entry error. Do not treat it as an unrelated experiment.
- Its batch 8 / 200k / 1e-5 / loss 0.016 values are retained as an unlinked same-task
  form record. They do not silently replace the report's 120/150-stage settings.
- The π0.5 form's 0.003 loss is explicitly a form value, not a verified last log.
- π0.5 three-view form versus four-view report remains a mapping discrepancy;
  the four-view timing test does not resolve all training/rollout mappings.
- The evaluation summary contains null checkpoint, effective policy config,
  command rate, model rate, inference timing, and chunk metadata. None is inferred
  from a directory name or from its approximately 30 Hz recording cadence.
- Runtime trainable storage/master-copy behavior is unknown for the historical
  runs. An exported BF16 checkpoint would not establish that by itself.
- The two-toy extension adds 120 records; neither its total mixture size nor its
  checkpoint association is invented.

## Numerical and source details

- One consistent noise-at-one convention: `x_t=(1-t)A+t*epsilon`, target
  `epsilon-A`, integration from 1 to 0. Training is one supervised forward;
  inference repeats the expert, not the visual prefix.
- SmolVLA SA layers can read fixed prefix KV as well as causally masked actions.
  CA layers read prefix KV only. Layers alternate, starting at SA at index 0.
- Format simulator rounds nearest with ties to even, handles subnormals/overflow,
  and accumulates the master path with FP32 rounding. It is a constant-update
  demonstration, not an AdamW or robot simulator.
- Histogram counts are `[1, 0, 14, 91, 14]` for durations `[0,10),…,[40,50)` seconds.
  Summary totals: 120 episodes, 122,475 frames, 4,082.5 seconds; duration median
  33.8167 seconds, minimum 5.4667, maximum 46.3333.
- Release file element counts were checked through Safetensors headers and Hub
  metadata on 2026-10-29; see `content/images/smolvla/model-counts.json` for pinned
  revisions. SmolVLA: 450,046,176; LeRobot π0.5: 3,616,757,520. These are stored
  tensor elements, not a claim about a deduplicated runtime trainable count.
  Literature/runtime counts from different implementations are not reconciled by
  inventing an architectural explanation.

## Assets and reproduction

`scripts/figures/smolvla-assets.py` accepts explicit attachment, dataset and
evaluation directories. It uses the existing LeRobot Python environment and
ffmpeg. It encodes only the video stream at original playback speed, removes
audio, samples posters, prepares dataset statistics and camera frames, and
downloads attributed paper figures. Source machine paths are not embedded in
public JSON/HTML. Total encoded video size is about 16.2 MB.

The note's explanatory screenshot diagrams and phone-form screenshots are not
published. The three two-toy layout photos are used. All paper figures link to
the exact paper; the SmolVLM figure credits its CC BY 4.0 license.

## Validation

- Build and internal-reference/MathML checks.
- Unit checks for floating-point examples, even ties, subnormals, overflow, FP32
  accumulation, queue budgets, and synchronous timing.
- Browser checks in both languages at 390 / 768 / 1280 / 1440 px; no viewport or
  SVG text overflow, runtime errors, failed media requests, or missing math.
- Disclosure navigation and deep links, all interactive controls, image viewer
  Escape, native video playback/pause, original speed and reduced-motion behavior.
- Homepage article entry is present; Interactive tools remains empty.

Run build/check/test after final edits, then inspect deployment success and the
actual public article. Keep the separate robot workbench preview untouched.
