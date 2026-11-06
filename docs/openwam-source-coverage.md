# OpenWAM source coverage

## Source and scope

- Article: `content/OpenWAM.html`; reviewed chapters: `content/openwam/`.
- Paper: Yuran Wang et al., *OpenWAM: An Open, Modular Exploration Towards Systematic World–Action Model Pretraining*, arXiv:2609.07398v1, 2026-09-07, 43 pages.
- Primary source: <https://arxiv.org/abs/2609.07398v1>.
- Official implementation: <https://github.com/OpenWAM-Official/OpenWAM>. The similarly named `OpenWAM/OpenWAM` project accompanies a different paper and is not this article's implementation.
- PDF SHA-256: `09606aafdd27a377b669331c2d11ad87c11dbba31066689c8d48d9fd2f28151b`.
- Source archive SHA-256: `c4bbe95df68d297df63166eb90c89ab019517fb032fa25df20b09cea64aaf060`.
- The arXiv abstract page identifies the paper's license as CC BY 4.0. Excerpts, Chinese translations and reproduced figures are attributed in the article; code licensing is separate.
- The supplied Obsidian draft and shared conversation were read to identify conceptual difficulties. Their conversational headings, assistant commentary and editing instructions were excluded from public content. The original note is unchanged.

## Organization

The six numbered main sections and appendices A–D retain the paper's titles and order. Its original subheadings through level four are preserved. The composable-model discussion resolves encoder/representation/freeze/stream/backbone/mask questions together. Each controlled experiment keeps its setup, outcome, interpretation and carried-forward choice adjacent.

| Chapter | Source | Coverage |
| --- | --- | --- |
| Introduction | §1 | Data asymmetry, WAM prior, three connected research questions and three stack components |
| Related Work | §2 | WAMs, open ecosystems and controlled model-design studies |
| Infra | §3 | Composition, all architecture families, flow loss, checkpoints, serving versus denoising, 80-D action mapping |
| Study | §4 | Backbone and encoder controls, all architecture/mask results, schedule comparison, fixed 600-hour transfer study, matched visibility changes |
| OpenWAM-α | §5 | Final tensor widths, trainable/frozen modules, time warp, mixture/curation, simulation results and real-robot evaluations |
| Conclusions | §6 | Evidence chain and resulting research directions |
| Appendix A | Appendix A | Four original limitation/future-work categories |
| Appendix B | Appendix B | Full pretraining and downstream SFT configurations |
| Appendix C | Appendix C | All four appendix figures, trial criteria, progress versus final success, 18 bimanual task names |
| Appendix D | Appendix D | All eight original appendix simulation tables, with all numeric rows; collapsed separately |

## Figures

All **21 numbered figures**, including appendix Figures 18–21, are included. They are reproduced from the author's standalone figure files, rather than cropped screenshots. Entire canvases are retained. `content/images/openwam/asset-sources.json` records original paths, source hashes, rendered hashes, dimensions and license. Commented-out figures in the TeX source are excluded because they do not occur in the published PDF.

Reproduce the lossless assets from the extracted arXiv source using:

```sh
python scripts/figures/openwam-assets.py /path/to/extracted/source
```

## Evidence distinctions

- “From Scratch” in the embodied-pretraining study excludes the extra embodied stage; it retains upstream video initialization. The visual-encoder ablation separately reinitializes generator weights to isolate representation effects.
- RoboTwin Full includes randomized demonstrations during training. Clean2Random holds those scene conditions out. The 600-hour controlled study and full-scale α evaluation are separate experiments.
- Isolated attention still exposes the clean observed frame to action tokens; the controlled difference concerns future-world features.
- Runtime asynchronous buffering and within-generation asynchronous denoising are independent. Reported α benchmarks use synchronous serving and synchronized denoising.
- The LIBERO-Plus table in the main article selects relevant comparison models and is labeled as a selection. Appendix-D tables retain every original numeric row.
- New-embodiment dexterous results follow task-specific fine-tuning, not zero-shot deployment. Trial-level success and element-weighted progress are kept distinct.
- Figure 11 contains an internal arithmetic discrepancy: its last one-way marker says 25.70, its annotated gain says +0.72, while Figure 10 gives the joint-co-training OOD result as 26.62. The article preserves the original image and reports Figure 11's labeled differences without inventing a corrected absolute baseline or combining those numbers. This source issue is recorded here rather than inserted as an unresolved drafting question in the article.

## Validation

- `BASE_PATH=/Anncatto npm run build` and `npm run check` pass.
- Existing suite: 32 tests pass.
- Browser: all 21 images decode at their recorded dimensions; eleven bilingual excerpts display correctly; headings through H4 appear in the contents.
- Chinese and English layouts checked at 390, 768 and 1440 px, with all score tables expanded: no whole-page horizontal overflow.
- Image viewer checked on Figures 1, 8, 17 and 21 with Escape and close button; scrolling is restored after close.
- References start collapsed in the compact shared format. Homepage includes the article and the shared Home footer works through the existing navigation.
- Draft preparation and validation used `article/openwam`, separately from unpublished homepage work. Publication follows an explicit user request.

## Integrated background supplements

The follow-up shared conversation was read in full. Its additional background was integrated under the existing paper headings; no FAQ headings or conversation excerpts were added.

- **Evaluation Protocol:** thin-client responsibilities, persistent WebSocket reuse, shared versus embodiment-specific action heads, linear velocity-field output, and active-slot supervision.
- **Visual Representation Priors:** representative instances versus the representation-encoder category; channels versus token count and hidden width; S-VAE feature reconstruction, cosine and KL losses; frame averaging versus learned causal temporal compression; separate channel/time effects; equal channel count versus latent-space compatibility.
- **Inference-Time Information Flow:** both schedule families, the backbone warp, and Euler increments. The relative-direction reversal is explained through the two factors varied together: feature conditioning and integration grids. The derived numerical example is explicitly illustrative, not a reproduction of Figure 9's success rates.

Additional primary sources:

- Peebles and Xie, *Scalable Diffusion Models with Transformers*: <https://arxiv.org/abs/2212.09748>.
- Zheng et al., *Diffusion Transformers with Representation Autoencoders*: <https://arxiv.org/html/2510.11690v1>, §4.
- Zhang et al., *Both Semantics and Reconstruction Matter*: <https://arxiv.org/html/2512.17909v1>, §3.3.
- Wan2.2 causal VAE implementation: <https://github.com/Wan-Video/Wan2.2/blob/main/wan/modules/vae2_2.py>.
- OpenWAM code checked at commit `3950b6d9ea848dc980a82a89b4554af2c082544a`: `denoise_schedule.py`, the S-VAE model/reducer/trainer, DINOv3/V-JEPA encoders, and benchmark client helpers. Article links pin the relevant code version.

`scripts/figures/openwam-schedules.py` records the analytical noise-to-data grids in `content/images/openwam/schedule-analysis.json`. The optional `--upstream` argument compares them with the inspected official scheduler on CPU, converting its decreasing sigma convention to the paper's increasing clean-time convention. At N=10, rho=5, alpha=32 the first action-leading step is 0.4155844, versus 0.0217391 for the base grid. An action offset of 0.8 leaves two nonzero action updates. The maximum absolute difference from the official float32 grid is `9.009951640326364e-08`. This audits formulas and implementation, not the learned model's control accuracy or the causal contribution of discretization to success rates.

The article's KaTeX spans now establish their own positioning context. This keeps clipped accessible MathML from enlarging the document's scrollable width on narrow screens, while retaining MathML for assistive technology and local scrolling for wide displayed equations.


## Architecture-focused presentation revision · 2026-10-31

The 15-page presentation now prioritizes the paper's architecture over benchmark coverage. The long-form article is unchanged. Main-source mechanisms were rechecked against the active TeX sections of arXiv:2609.07398v1, especially Composable Model, Training Runtime, Deployment Runtime and α Architecture/Training/Deployment.

- `C(E,S,M)` is parameter-free orchestration; stream/backbone identity and the prepare/layer/finalize interface are explicit.
- Tri-System uses frozen VLM features feeding a trainable understanding stream; α remains Dual-System. umT5 is text context, not a third understanding backbone.
- The bridge diagram preserves separate residual widths and stream-owned projections; concatenation and splitting occur on the token axis. Mask rows are readers and columns are sources.
- Conditioning separates text/state cross-attention, noise-time AdaLN and positional RoPE. Clean observation rows read only the observed prefix.
- Training uses independently sampled world/action noise levels and a masked, time-weighted joint flow objective. The linear-path derivative explains the velocity targets; world velocity is not physical robot velocity.
- Inference uses the audited synchronous noise-time grid, 10 coupled Euler steps, all 30 bridges per forward, and re-clamping of the observed prefix. The diagram routes the clean observation directly to the joint forward pass.
- Missing human action labels are masked, not zero targets. Shared semantic action slots and inverse native mapping complete the data/control interface.
- Figure 11's +0.72 is specifically the reported Clean2Random OOD difference, not an average across benchmarks. The reported Full difference is +0.16. Original source arithmetic discrepancy remains documented above.
- The 21 complete source images remain in the canonical figure archive and gallery. The α main architecture panel is displayed with an SVG viewport; the full original remains accessible and unchanged.

QA evidence is generated locally in `/tmp/openwam/mechanism-qa.json`. It checks leaf-content overlap against the callout boundary as well as viewport overflow, bilingual desktop and mobile layouts, source and SVG viewers, old aliases, joint-loop stepping, reduced motion, printing and no-JavaScript fallback.


## Paper-led presentation · 2026-10-31

This supersedes the previous architecture-first deck organization. The presentation now follows Introduction → OpenWAM-Infra → OpenWAM-Study → OpenWAM-α within 15 pages. The first page is a title page; the second compresses the Introduction's explicit data asymmetry, monolithic-design problem, three questions and three contributions. New public prose is condensed from the corresponding paper sections, with explanatory additions confined to genuinely difficult mechanisms.

Original Figures 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13 and 17 are displayed directly in the main deck; Figures 2 and 12 also have complete panel views. The gallery preserves all 21 complete originals and source attribution. Original image files are unchanged.

The cup/tray illustration has been removed. Training is explicitly the common OpenWAM-Infra interface from §3.2: future targets are noised, current conditions remain clean, and a forward pass predicts vector-field velocities, not completed action chunks. α's particular 80-D state, backbone dimensions and ten-step sampler appear only in its own section.

Further source discrepancy: Figure 9's linear-offset action-leading o=0.6 annotation reads 93.3%, while its synchronized baseline reads 93.0% and the main prose states that synchronized denoising performs best. The revised deck retains the image, describes the selected synchronized recipe, and does not amplify the prose claim into an unqualified numeric maximum.

Current browser audit: `/tmp/openwam/paper-led-qa.mjs` checks all pages in both languages at three desktop sizes and three narrow widths, decodes every displayed original/cropped source image, and checks leaf content against the source-footer boundary. It also checks old anchors, source and SVG viewers, no-JavaScript and print behavior. There are no per-slide summary bars or decorative step animations.


## Question excerpt and related architecture sources · 2026-10-31

The original user-provided PNG of the three Introduction questions is displayed at the bottom of slide 2. Its original bytes are retained at `content/images/openwam/research-questions.png`; the display viewport trims only surrounding white margin. Credits and SHA-256 are recorded in `asset-sources.json`.

Supplemental figures are separate from the 21 OpenWAM originals and carry their own primary-source attribution:

- Peebles & Xie, DiT project page, conditioning-block architecture (Figure 3).
- Wan Team, arXiv:2503.20314v1, causal VAE Figure 5 and video DiT Figure 9; these are explicitly Wan2.1 figures.
- Wan2.2 official repository, VAE comparison table, paired with the official README's dense TI2V-5B versus MoE A14B distinction.
- Zhang et al., arXiv:2512.17909v1, Figure 5 PS-VAE compact latent-space pipeline. The caption distinguishes this reference framework from OpenWAM's 48-D representation-compression experiment.
- Hoque et al., arXiv:2505.11709v1, Figure 3 skeleton and manipulation panels. The added text distinguishes human skeletal annotations from executable robot coordinates.
- Lipman et al., arXiv:2210.02747v2, flow-matching path and ODE-sampling definitions, linked as text rather than inventing a new experimental architecture.

Source assets are copied unchanged. Supplemental image source URLs, dimensions, credits and hashes are recorded under `relatedFigures`. The repeated per-slide credit footer is replaced by a source-section link in the header; source attribution remains available in each original or related figure view.

## Core-content audit and integrated explanation · 2026-10-31

The audit compares the presentation against the main paper's actual section sequence and conclusions, not only its figure list. Previous omissions were substantive: the joint objective was described without its loss, self-contained experiments were understated, data cleaning and mixture shares were compressed away, and WAM/VLA and perturbation results were merely gallery links.

| Source | Main-deck location | Evidence or mechanism retained |
| --- | --- | --- |
| §1 Introduction | 1–2 | Data asymmetry, coupled implementation choices, three parallel contributions, three research questions and findings |
| §3.1 Composable model | 3, 8 | C(E,S,M), parameter-free orchestration, architecture families and dedicated action capacity |
| §3.2 Training | 3–4 | Self-contained checkpoint, normalization/restore contract, independent noise times, complete two-stream weighted/masked flow-matching loss |
| §3.3 Deployment | 5, 10, 14 | Serving versus denoising, buffer and executed horizon, coupled Euler update, acceleration; α's reported synchronous mode |
| §3.4 Evaluation protocol | 11, 15 | Clean-only fine-tuning with Clean ID/Random OOD, downstream fine-tuning and benchmark/embodiment scope |
| §4.1 Inherited priors | 6–7 | Backbone results and 5B choice; randomized-weight representation control; S-VAE bottleneck versus raw features |
| §4.2 Synergy | 8–10 | Capacity comparisons, forward versus gradient paths, four masks with fixed measured scores, inference schedule evidence |
| §4.3 Embodied consolidation | 11 | Fixed 600-hour budget, robot-only/sequential/co-training, ID/OOD and changed preferred visibility |
| §5.1 Architecture/training/deployment | 12–14 | 5B+1B, frozen modules, causal anchor, token dimensions/RoPE/context, all 30 QKV bridges, AdaLN, unified 80-D space, loss/time sampling, ten-step synchronous generation |
| §5.2 Data | 14 | 1,333.9M raw → 518.5M curated/sampled frames, 6,369 hours; human/real/synthetic shares, vision/signal cleaning, valid-coordinate masks |
| §5.3 Simulation and WAM/VLA | 15 | Original Figure 16 visible; ID fitting versus OOD transfer, LIBERO-Plus perturbation scores and limited single-arm coverage |
| §5.4 Real robots | 15 | Franka 99/120, three bimanual embodiments/18 tasks, new dexterous platform after task fine-tuning and OOD bottle 16/20 versus 6/20 |
| Conclusions | 15 | Compact/robust/informative visual representation, diverse action-labeled data, complementary WAM/VLA strengths |

All 21 original figures remain available unchanged. Figure 16 replaces the previous small general benchmark overview in the visible evaluation layout. Full benchmark tables, individual real-task photographs and appendix implementation detail remain in the full article and original-figure gallery. This is main-argument coverage, not a claim that every appendix experiment fits on 15 pages.

The fixed bottom supplemental blocks have been removed. DiT interfaces, PS-VAE compression, causal tokenization and AdaLN are explained where used. Supplemental primary-source diagrams are differentiated from OpenWAM's own implementations. The second-page question excerpt is smaller and immediately follows the finding row.

The new visibility inspector changes only the permitted source sets of a selected query under the four audited masks. O reads O; future V/A always read O and themselves; the respective directional mode enables the opposite future stream. A one-shot packet animation follows allowed edges after selection; measured success rates stay fixed. It never fabricates attention weights, model predictions or counterfactual scores. Reduced-motion mode keeps state changes without animation. Unit and browser tests cover the actual visibility rules.

Current QA: `/tmp/openwam/qa-enriched.mjs` and `/tmp/openwam/qa-openwam-interaction.mjs`. Both languages are checked at 1440×900, 1280×800 and 1920×1080, with 320/390/768-pixel layouts checked for horizontal overflow. Figure viewers, keyboard closure, original-image counts, mask interaction and reduced motion are checked separately.

## Infra → Study → α narrative repair · 2026-10-31

The second-page overview is now a two-column composition: three peer contribution cards and a workflow on the left, three findings with scoped evidence on the right, and the original question excerpt at the bottom. English wording was independently shortened and card/row containment added to browser QA; a page can pass viewport checks while still containing internal overlaps.

Pages 3–5 explicitly identify OpenWAM-Infra and highlight composition → training runtime → serving/evaluation. Page 4's common objective is framed as the trainer/architecture interface from §3.2, alongside the paper's Accelerate/ZeRO, BF16, checkpointing/offload and pretrain/fine-tune/resume utilities. Page 5 covers policy-buffer serving and acceleration from §3.3, with the Full/Clean2Random contract from §3.4. Complete panels 3a and 3b are displayed side by side using explicit SVG clip paths; the full unchanged figure is accessible from both.

Pages 6–11 visibly identify OpenWAM-Study and the active source question: inherited priors, world–action interaction, or cross-domain transfer. The prose was rechecked against the corresponding source paragraphs and rewritten as a connected experiment sequence:

- §4.1: pretrained generator weights are one inheritance channel; encoder-defined latents are another. The representation control explicitly randomizes generator weights to isolate the second channel.
- §4.2.1: action-specific capacity is compared before the interaction direction; Dual is retained to balance complexity and isolate the VLM's contribution.
- §4.2.2: joint attention is an interface; masks specify the direction. All variants retain clean observation access, while cross-stream future-token access changes.
- §4.2.3: training-time world access motivates inference-order comparisons. The selected synchronized schedule and the authors' representation-learning interpretation are distinguished from the plot's numerical details. The existing Figure 9 source discrepancy remains documented above.
- §4.3: retain the preceding dual/synchronous choices, compare robot-only and mixed pretraining at 600 hours, then revisit one-way versus mutual visibility after pretraining.
- §5.1: page 12 opens by assembling the choices into α, before showing its full architecture.

All new wording is condensed source-based paraphrase, not purported verbatim quotation. Explanatory diagrams and stage indicators are editorial presentation aids. No new experimental runs or newly measured results are implied. QA scripts: `/tmp/openwam/qa-reconnected.mjs` (both viewport and internal containment), `/tmp/openwam/qa-openwam-interaction.mjs` (visibility behavior, viewers, print and no-JavaScript fallback).

The small supplemental PS-VAE preview on page 7 is replaced by an explicitly scoped dimensional-contraction diagram (DINOv3 768-D / V-JEPA 1024-D → S-VAE → 48-D), with the complete credited PS-VAE source still accessible by link. This explains the adapter actually compared in OpenWAM without presenting the reference paper's full pipeline as OpenWAM's own implementation. The final browser run passes all bilingual desktop/narrow layouts, internal overview containment, visibility interactions and figure viewers.

## Compact navigation and complete visibility display · 2026-10-31

Pages 3–15 retain their existing titles while moving chapter identity and stage links into the heading bar. α adds four stages for architecture, bridges, data/training and evaluation. The selected architecture on page 8 and the source's representation-learning interpretation on page 10 now occupy selective colored finding blocks; interpretation remains attributed to the authors.

The page 9 inspector now visualizes both future-world/action directions simultaneously. Its state comes from the same visibility rules checked against §4.2.2: Isolated has no cross-stream connection, Video Sees Action allows A→V, Action Sees Video allows V→A, and Mutual allows both. Arrows represent feature-source → query/reader. O remains a shared clean condition; the graph does not imply that O reads noisy future states. The fixed measured success rates are unchanged. The inspector does not animate inferred attention weights or generated actions.


## Introduction, Infra figures and common training contract · 2026-11-05

- Slide 2 condenses the Introduction’s three findings: capable generative backbone plus compact information-rich latents; sufficient action-specific capacity plus explicit world-to-action access plus joint test-time denoising; and embodied pretraining chiefly benefiting OOD generalization, with complementary human-video and robot-action supervision. Individual benchmark scores remain on the later experiment pages. The original three-question excerpt is retained.
- Slide 3 introduces the six coupled design dimensions named in §1. Dependency descriptions are explanatory synthesis. Its right column now follows §§3–3.1: four components with explicit interfaces, and the distinct matched-encoder versus randomly initialized representation-ablation settings. It does not repeat the earlier VAE/DINOv3 dependency and generic confounding paragraphs.
- Slide 4 restores complete Figure 2 at presentation scale, with the encoder/backbone/mask definitions and the parameter-free C(E,S,M) composition contract. A gallery link supplements the primary figure; it does not replace it. Architecture variants are compared again on slide 12.
- Slide 5 explicitly distinguishes a shared interface and common-form flow-matching objective from trainer responsibilities. Sample fields identify optional proprioception and the action-dimension validity mask. Both linear noise paths, their velocity targets, one-forward dual prediction, task-weighted loss, noise-time weights and valid-coordinate masking are shown together. Summing losses is explicitly distinguished from cross-stream feature exchange.
- Slide 6 illustrates a single dual-system joint-self-attention layer: stream-owned Q/K/V, token-axis concatenation, masked attention, splitting, and stream-specific block suffixes. The generic training diagram does not imply that all Infra architectures use this connection. The 30 paired layers are identified as the OpenWAM-α configuration. Model reconstruction, exact resume and memory/training utilities are retained in a separate panel.
- Rechecked the primary HTML’s Introduction and §§3–3.2/4.1.2. The official MoT driver was read at commit `0c9ed80d80af1d0c5f4148afe65cc7f462ec3995`: `openwam/model/architectures/dual_system/mot_driver.py`, especially `_step_impl`, `_mixed_attention` and `run_joint_loop`. It validates shared attention dimensions, preserves stream-owned projections, concatenates and splits along sequence dimension 1, and has no learned parameters. Its configurable visibility is not equated with universal mutual access.
- Original Obsidian notes and original images remain unchanged. The deck has 19 pages after separating the design-space table from the primary figure, the common objective from layer interaction/runtime, and adding encoder provenance and parameter-allocation definitions. Existing slide IDs and aliases are retained; source labels, overview, count and progress follow the new order.

Validation: build and internal-reference checks; bilingual desktop/narrow layout and figure-viewer/fullscreen/navigation QA in `/tmp/openwam-revision-20261105/flow-qa.json`. The 19-page count, table-to-figure order and first/last navigation are checked against the rendered deck.


## Backbone/encoder provenance, parameter allocation and denoising · 2026-11-05

- The serving slide and full Figure-4 viewer state the controlled hardware/backbone (Wan2.2-TI2V-5B, RTX 5090), the compilation/velocity-cache ablations, and the common prompt cache/video-decode skip baseline from §3.3.
- Slide 8 lists only the four backbones actually compared in Figure 6, with upstream origin/purpose and WAM downstream task success. The TI2V-5B dense design is separated from Wan2.2 A14B MoE models. Scores are not video-quality metrics or a parameter-count-only intervention. The paper’s 1.40 pp gap and 5B cost/capability choice are retained.
- Slide 9 distinguishes encoder-defined prediction space from the network that predicts there, then gives four encoder origins/objectives/roles. Reconstruction-oriented versus representation-learning-oriented describes learning objectives rather than exclusive pixel/semantic content. The T/H/W compression factors, four-frame feature averaging, S-VAE channel contraction and per-grid-position meaning of 48-D are explicit. Slide 10 retains the original encoder result figure.
- Slide 11 compares four parameter allocations before the architecture ablation on slide 12. Vanilla shares backbone attention and FFNs; the local MoE definition is fixed modality routing with separate FFNs; Dual owns complete independent backbones; Tri uses frozen VLM features feeding a trainable understanding stream, readable by world/action and self-only on its own queries. Two prediction losses remain distinct from the number of streams. Ownership is separated from gradient routing; detachment is an independent control.
- Slide 14 expands inference-time progress, matched mutual visibility/training noise sampling, the two path families and their reversed relative rankings. The 93.0 synchronized baseline is retained as the selected recipe without claiming a strict numerical maximum over every Figure-9 label. The authors’ representation-learning interpretation is attributed; explanatory noise-time reasoning is not reported as a new ablation.
- Primary supplemental sources: VACE official README (<https://github.com/ali-vilab/VACE>); Wan2.2 README, dense TI2V and T/H/W compression (<https://github.com/Wan-Video/Wan2.2>); NVIDIA Cosmos-Predict2.5 model card (<https://huggingface.co/nvidia/Cosmos-Predict2.5-2B>) and technical report (<https://arxiv.org/abs/2511.00062>); Black Forest Labs FLUX.2 autoencoder README (<https://github.com/black-forest-labs/flux2>); DINOv3 (<https://arxiv.org/abs/2508.10104>); V-JEPA 2.1 (<https://arxiv.org/abs/2603.14482>). Model/encoder names link directly to their relevant primary source.
- The main complete Figure 2 and large architecture-variant panel retain their allotted display space. The numerical backbone plot occupies a smaller column beside the new table. QA artifacts: `/tmp/openwam-revision-20261105/enrich-qa.json` and bilingual screenshots.

Final QA for the expanded deck: 19 pages; no desktop slide overflow at 1280×800, 1366×768, 1440×900 or 1920×1080 in either language; no page-width overflow at 320, 390 or 768 px; full-image viewer Escape, fullscreen entry/exit and first/last keyboard navigation pass. Six existing slide-state tests pass. The Synergy stage now opens the parameter-allocation definitions before the architecture ablation.


## Prior WAM design combinations · 2026-11-06

At this revision: 19 pages. Slide 3 compares both predecessors on the same six design axes in one aligned table. The two separate predecessor pages have been merged into this table; complete figures remain available through attributed viewers. OpenWAM’s complete Figure 2 follows on slide 4 without reducing its display area.

| Work | Chronology and primary evidence | Supported design relationships |
| --- | --- | --- |
| Cosmos Policy | arXiv:2601.16163v1, 2026-01-22; ICLR 2026; §§4.1–4.3, Figs.1–2; official NVlabs/cosmos-policy implementation | Image VAE latents and directly injected normalized non-image modalities occupy one sequence; one unchanged Cosmos-Predict2-2B DiT and diffusion objective; clean/target modality selection expresses policy, world-model and value conditionals; layout supports parallel or autoregressive decoding. The analysis does not equate every planning configuration with one unchanged checkpoint: the paper additionally refines a planning checkpoint on rollout data. |
| Motus | arXiv:2512.13030v1, 2025-12-15; CVPR 2026 entry in the CVF proceedings and OpenWAM bibliography; §§4.1–4.3, Fig.1; official thu-ml/Motus README | Separate Transformer experts interact through tri-model joint attention; action depth matches Wan2.2-5B; a trainable understanding expert receives frozen Qwen3-VL-2B features. UniDiffuser-style video/action noise conditioning switches five model modes. Optical-flow-derived latent actions connect video data with staged action pretraining and later real-action fine-tuning. |

The word “coupling” maps concrete combinations onto OpenWAM’s design axes; the mapping is explanatory analysis, not a new causal ablation or a claim that these papers contain no ablations or no reusable software. The two works predate OpenWAM’s September 2026 release. No cross-paper benchmark ranking is added.

Source pages:
- <https://arxiv.org/html/2601.16163v1#S4.SS1>, <https://arxiv.org/html/2601.16163v1#S4.SS2>, <https://arxiv.org/html/2601.16163v1#S4.SS3>.
- <https://research.nvidia.com/labs/dir/cosmos-policy/> and <https://github.com/NVlabs/cosmos-policy> (official project and implementation).
- <https://arxiv.org/html/2512.13030v1#S4>, <https://github.com/thu-ml/Motus>, and <https://openaccess.thecvf.com/content/CVPR2026/papers/Bi_Motus_A_Unified_Latent_Action_World_Model_CVPR_2026_paper.pdf>.

Figure provenance, original-file hashes, converted hashes, dimensions and licenses are recorded in `content/images/openwam/related/prior-wam-sources.json`. Cosmos Policy Figs.1–2 and Motus Fig.1 retain the complete original canvases, losslessly converted to WebP; the Motus figure is not mislabeled with OpenWAM’s CC BY license. The original 21 OpenWAM figures and archive remain unchanged. Slide-3 table headers open the complete Cosmos overview, Cosmos latent-frame injection diagram and Motus architecture. Old predecessor slide hashes resolve to slide 3.

Validation artifacts for the preceding 21-page version: `/tmp/openwam-prior-wams-20261106/qa.json`. The merged 19-page version is checked separately below.


### Aligned comparison and Infra narrative · 2026-11-06

- “单体式系统（monolithic systems）” follows the Introduction and §2; §3 explains it as model, training, serving and evaluation organized around one model design. It does not mean a single backbone. The unsupported architectural-change-causes-data-change phrasing is removed; six computational-effect rows are explanatory mappings grounded in the cited predecessors, not an original-paper table or causal ablation.
- The Study contribution card now says human-video/robot-data joint pretraining. §4.3 fixes downstream protocols and examines its ID/OOD transfer; the shorthand is not presented as zero-shot cross-embodiment transfer.
- Composition → common-form flow objective → one concrete layer connection is explicit. The common diagram says configured WAM. Dual-system joint self-attention is one supported §3.1 variant and the setting retained in §4.2 and α, not a universal Infra wiring rule.
- The layer-interaction page removes the generic checkpoint/Accelerate/ZeRO/BF16/offload list. Its right panel explains independent attention/FFN parameters, masked feature access and cross-stream gradient paths. The original Figure 2 still contains the training-utilities overview.
- The serving page pairs Figure 3a with execution modes and Figure 3b with denoising schedules. §5.1.3 explicitly specifies synchronous execution for all reported α simulation/real-robot benchmarks and synchronized video/action denoising with 10 coupled Euler steps. These two independent choices are stated in their respective columns. RoboTwin evaluation definitions remain in the later Study protocol discussion rather than below the denoising figure.
- Source evidence for α: primary HTML §5.1.3, “Synchronized Denoising” and “Inference Mode”; noise warp ρ=5 and 10-step count are kept distinct from the illustrative five steps in Figure 3.

- Backbone source naming: the table identifies `Wan2.1-I2V-14B-480P` as the pretrained 480P video-generation checkpoint, not a downstream OpenWAM camera-resolution claim. The source link points to its official model card. The unrelated A14B family sentence is removed; the dense TI2V-5B property remains in its table row.

- The official `configs/model/video_backbone/wan21_i2v_14b_480p.yaml` explicitly names the 480P checkpoint and a fixed 480×832 first-frame-conditioned canvas. That canvas size now links to the config from the backbone table; it describes the model-side composed video, not every raw robot camera's resolution.

Merged-deck validation: 19 slides and six comparison rows; both languages pass desktop viewport containment at 1280×800, 1366×768, 1440×900 and 1920×1080. At 320/390/768 px the table scrolls within its own container with no document-width overflow. Full primary Figure 2 is decoded and visible at 1353×424 CSS pixels (1440×900 viewport). All three predecessor figure viewers load full originals and close via Escape/button; old case hashes, menu count, fullscreen, first/last navigation and no-JavaScript fallback pass. Six existing slide-state tests and build/internal-reference checks pass. QA: `/tmp/openwam-prior-wams-20261106/merged-qa.json`, `figure-qa.mjs`, and bilingual screenshots.


## Clarified terminology, training stages and evaluation · 2026-11-06

- The 19-page structure is retained. Case architectures open from the merged slide-3 comparison. The DiT source image remained in the archive but lacked a visible opener; the backbone page now restores its opener. S-VAE, pretraining protocol, Wan/umT5, Wan2.2-VAE and robustness analysis have distinct relevant figure openers.
- §§4.1.1–4.1.2 are named explicitly instead of “previous group.” The four-backbone experiment loads upstream pretrained generator weights; the representation experiment fixes the Wan2.2-TI2V-5B architecture and randomly initializes generator weights while freezing pretrained encoders. S-VAE channel dimensions are introduced once on the encoder page; the result page presents 76.42→90.18 versus WanVAE90.30 and the resulting compact/information-rich-latent design principle.
- Fourfold temporal compression matches the native Wan2.2-VAE temporal rate in the representation ablation, rather than a compression-ratio search. Reducing the time axis reduces tokens and attention work; external encoders use four-frame feature averaging, whereas the authors attribute part of WanVAE’s edge to learned temporal compression and native generator compatibility.
- S-VAE and PS-VAE are distinct stages/variants in Zhang et al., arXiv:2512.17909v1, §3.3/Fig.5. S-VAE reconstructs semantic features with KL regularization; PS-VAE further incorporates pixel reconstruction and encoder optimization. The retained PS-VAE original is labeled as the pixel-reconstruction extension. `svae-feature-adapter.svg` separately describes OpenWAM’s standalone feature autoencoder and frozen downstream mean-latent path, based on `openwam/model/video_backbone/encoder/svae/model.py`, `reducer.py` and its standalone train config. The manuscript’s 768/1024→48 feature widths are not conflated with the current repository’s default 1408-D V-JEPA variant; the figure uses generic semantic input h and the common 48-D bottleneck.
- §4.2.1’s action-specific capacity is defined as representational ability influenced by parameters/structure, then concretized by shared attention/FFNs, dedicated action FFNs and independent ActionDiT. IDM’s staged generation is placed with connection/order variants, not parameter allocation.
- Clean O denotes current-image latent tokens without flow-matching noise. Language/proprioception remain separate c conditions. Query rows versus source Key/Value columns are explicit; Q_O restrictions refer to joint self-attention, not the separate text/state cross-attention.
- Infra supplies the sampler/Euler interface and configurable schedules; Study evaluates which schedule to retain. The denoising page first motivates leading-video tests from the previous mask experiment, then defines noise-time roles and controlled schedules. The authors’ representation-learning hypothesis is distinguished from the measured schedule comparison.
- Generic training utilities are retained compactly alongside the joint training objective: default BF16, Accelerate/ZeRO-1/2, accumulation/clipping, activation checkpointing and optional CPU offload. They are supported runtime capabilities, not an asserted single experimental hyperparameter configuration.
- §4.3 uses robot-only600h, ego350h→robot250h, or a one-stage600h mixture, followed by matched downstream RoboTwin task fine-tuning. The new protocol figure includes the no-embodied-pretraining baseline and defines upstream video initialization, embodied pretraining and target-task adaptation. EgoDex and RoboCOIN have primary-source links; RoboCOIN is real multi-embodiment bimanual demonstration data. The Clean/Randomized compact protocol line is preserved. The one-way/mutual revisit names the earlier92.39/92.15 comparison explicitly.
- α’s1B action backbone is its §5.1.1 instance specification, not a separately reported size sweep. Wan2.2-VAE and frozen umT5 are named; the latter follows the Wan video-model pipeline. Figure12(a) explanations follow visual→world-token, action→action-token and text/state→context paths. Generic and α layer diagrams consistently label intermediate token features; “states” is not used for those hidden features. The duplicate AdaLN diagram footer is removed; noise-dependent scale/shift and observation t_v=1 are explained together in prose.
- Figure12(c)’s training/sampling paragraph separates independent u_v/u_a draws, synchronized ten-step inference and task/time loss weighting. Slot recovery/denormalization is beside Figure12(d); synchronous serving and170ms/chunk are beside deployment. The raw Figure12(c) axis symbols and the manuscript’s stated t convention remain preserved as source evidence rather than silently redrawing the paper.
- AppendixB.2 explicitly says LIBERO-Plus evaluates the LIBERO checkpoint without further fine-tuning. Benchmark perturbation evaluation is not the separately released LIBERO-Plus mixed-training set. Model pretraining data need not match merely because evaluation shares the benchmark. Table5 values and the §5.3.1 data/architecture interpretations are available in `generalization-analysis.svg`; the main page retains single-arm data coverage and concrete camera/noise weakness.
- Figure16 is a comparison of complete models, not an isolated video-loss ablation. The ID-fitting mechanism is attributed to the authors. Task-specific dexterous OOD bottle trials and camera/noise robustness are distinguished by their evaluation conditions. WAM/VLA combination is labeled as the authors’ proposed research direction, not an experimentally established merged design.

Primary supplementary sources: <https://arxiv.org/html/2512.17909v1#S3.SS3>, <https://github.com/OpenWAM-Official/OpenWAM/tree/main/openwam/model/video_backbone/encoder/svae>, <https://arxiv.org/abs/2511.17441>, <https://flagopen.github.io/RoboCOIN/>, <https://sylvestf.github.io/LIBERO-plus/>, <https://arxiv.org/html/2510.13626v1>. New drawings are technical explanations of the cited source mechanisms/protocols; they are not presented as original-paper figures or new measurements.

Final verification for this clarification pass: 19 slides remain; 702 internal references pass. All slides in both languages pass containment and header/table checks at 1280×800,1366×768,1440×900,1920×1080. Updated pages pass 320/390/768px document-width checks. Ten figure openers, old slide aliases, 19-item contents, fullscreen, first/last navigation and no-JavaScript fallback pass. New SVG text remains within each viewBox; rendered diagrams are inspected for module and arrow collisions. Artifacts: `/tmp/openwam-prior-wams-20261106/merged-qa.json`, `svg-qa.mjs`, and screenshots.


## Compact 17-slide layout and flow interpretation · 2026-11-06

- Current deck: 17 slides. The standalone generic layer-runtime page is folded into the later α bridge explanation; its old `s-layer-runtime` hash resolves to `s-bridge`. Parameter allocation and architecture ablation now share one page (`s-capacity`, alias `s-parameter-layout`), preserving the complete original architecture panel and the measured score table.
- The three-question source image follows the Introduction's core-hypothesis paragraph. One pale-green outlined arrow connects the contribution stack as a group to the three findings; it does not invent one-to-one correspondence between Infra/Study/α and the findings.
- The compositor is described as orchestration without additional neural weights. Stream backbones and projection layers carry learned parameters; architectural alternatives include shared weights, action-specific FFNs, an independent ActionDiT, and an optional understanding stream. This is not a claim that the study swept multiple VLM models or ActionDiT sizes.
- Joint training retains both interpolation paths, two predicted vector fields, the task-weighted objective and expanded velocity losses. The new explanatory sentence connects linear interpolation, path-derivative supervision and inference integration. Architecture/masks, rather than the arithmetic sum of losses, define cross-stream feature exchange.
- The acceleration caption sits beneath execution modes: shared text caching and skipped video decoding, controlled compile/field-cache comparisons in Figure 4, and α's approximately170ms/chunk are kept together. The backbone-to-representation transition is aligned at the bottom right of its page.
- Figure 6 is explicitly labeled as the four-pretrained-video-backbone comparison; Figure 7 as the visual-encoder/S-VAE comparison. The local and published assets were checked: these are distinct complete originals, not duplicate images (2796×2800 versus2800×1447). The representation page provides a Figure-6 opener alongside the controlled-initialization explanation.
- All four visibility-mode readouts now name the Query stream, source Key/Value stream and destination token updates. Actual mask connections remain isolated/AV/VA/AV+VA as appropriate.
- The final evaluation page uses a full-width unchanged Figure16b–c above three aligned explanation cards. At1920×1080 fullscreen the plotted image draws approximately1442px wide in both languages. No benchmark values or image content were changed for the layout.

Validation: build and697 internal-reference checks pass. All17 slides pass desktop containment, header and table checks in Chinese/English at1280×800,1366×768,1440×900 and1920×1080. Updated pages pass320/390/768px document-width checks. All four attention modes fit in both languages, ten related-figure viewers and the question-image viewer open/close correctly, old slide aliases resolve, menu/counter show17 pages, fullscreen and no-JavaScript fallback pass. QA artifacts: `/tmp/openwam-prior-wams-20261106/refined17-qa.json`, `refined17-details.json` and bilingual screenshots.
