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
