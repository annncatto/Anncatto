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
- Browser: all 21 images decode at their recorded dimensions; ten bilingual excerpts display correctly; headings through H4 appear in the contents.
- Chinese and English layouts checked at 390, 768 and 1440 px, with all score tables expanded: no whole-page horizontal overflow.
- Image viewer checked on Figures 1, 8, 17 and 21 with Escape and close button; scrolling is restored after close.
- References start collapsed in the compact shared format. Homepage includes the article and the shared Home footer works through the existing navigation.
- Changes remain on `article/openwam`; no publication push is part of this work.
