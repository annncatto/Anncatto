# DiT Heads — sources and evidence

Route: `/notes/dit-heads/`. Source draft:
`~/obsidian_me/blog/DiT Heads.md`. Follow `experimental-article-workflow.md`.
Keep unpublished workbench/D20 work on its existing branches.

## Scope and organization

- Shared conversation supplied the questions and algorithm list, not factual
  authority. Public claims use original papers, released configs, and code.
- Three initially folded theory chapters: generative networks, action generation
  methods, and mobile manipulation. Experiments remain directly accessible.
- Multi-Task DiT details are H4 subsections under its H3 algorithm entry. The
  article's contents include H4 entries; other articles retain their current depth.
- References follow ACT's compact native details/summary pattern, initially
  collapsed, with the references anchor retained. The same format applies to
  SmolVLA and is recorded in AGENTS.md and the experimental-article workflow.
- Shared reading estimates use currently visible, language-specific content
  budgets. Hidden details bodies are excluded; toggles recalculate cost and
  positions. Progress and remaining time use the same weighted content blocks.
- Generative networks now explains module roles, diffusion origins, DDPM training
  and sampling, DDIM, flow matching, three timing quantities, tensor widths,
  attention, conditioning, and parameter scale. The generic continuous/discrete
  output subsection has been removed; experiment-specific normalization remains.
- Nine compared methods: LeRobot Multi-Task DiT, DiT-Block Policy, MDT, MoDE,
  LightDP, CogACT, GR00T N1.7, Spirit v1.5, AC-DiT.
- MTD is the LeRobot community implementation inspired by TRI LBM work;
  MDT is Reuss et al.'s Multimodal Diffusion Transformer. The original image DiT
  paper and DiT-Block Policy are separately identified.
- MTD details follow encoding, tensor shapes, modulation, execution windows, and
  phase conditioning. Experiments proceed through configuration, training,
  NAS25 failure, NAS30 success, trajectories, base velocity, normalization.

## Confirmed experiments

The user confirmed on 2026-10-30: historical `dp_dit_150ep_200k` is MTD, and
4/10 success corresponds to n_action_steps=30. NAS25 release failure and NAS30
success clips match the two draft attachments.

Read-only source inspection on the supplied training host found the 200k
checkpoint in `multi_task_dit_1019_bf16_b8`. Config and training metrics agree:
150 demonstrations / 155,727 frames / 30 Hz, four cameras, state/action 18,
2 observations, horizon32, DDPM epsilon objective / 100 timesteps, default inference
steps unset (uses all100), 6 layers / width512 / 8 heads, MIN_MAX numeric fields,
batch8 with accumulation4, Adam2e-5, cosine200k, no warmup, EMA enabled, BF16
mixed precision. Saved execution window24 is distinguished from eval overrides25/30.

All 305,933,074 saved tensor elements are F32: 156,705,042 noise_predictor and
149,228,032 observation_encoder. This is checkpoint storage evidence; mixed
precision is read from the training configuration. No training or robot motion
was launched.

`scripts/figures/dit-heads-training.py` accepts a training run and emits path-free
metadata, tensor counts and SHA256s. Training curve uses one mean per1k optimizer
updates, deduplicated by step; exactly200 bins ×1000 updates. Final loss is
.00127289545; final1k mean .00242798674. The figure shows mean bins rather than
plotting the final individual value as the final bin mean.

## Evaluation scope

Archived evaluation `20261023_101851`, episode0, has1825 rows over60.8s. All plots
use recorded targets and observations sampled before the request. Units remain
recorded units. The report lacks raw normalized predictions and chunk IDs.

The21 selected largest right-arm target-change events align to25-frame multiples.
This is an event-selection result, not a full all-edge comparison, a recovered
chunk setting, or a measured inference rate. No raw stopping-window statistics or
physical displacement is inferred from plot pixels. The original full Parquet
supplied for SmolVLA has2936 rows and belongs to a different evaluation.

Forward target min -.00053745077, median .00025832633, max .15000000596. Reverse
peak magnitude is .3583% of .15. The150-demo dataset contains870 reverse,
130919 stop,23938 forward labels. Actual min/max are symmetric ±float32(.15),
so MIN_MAX maps stop to0. Mean/std are .02221962056/.05559354208; MEAN_STD
labels are -3.09783445,-.399679814,2.298474817. These are mapped labels, not
recorded normalized network outputs. The public experiment now retains only the
actual MIN_MAX mapping in Data preprocessing before training/results, referring
to its preserved zero point briefly within base-velocity analysis;
the hypothetical MEAN_STD comparison and separate normalization heading were
removed. AlohaMini’s shared Processor reproduces the MIN_MAX stop round trip
exactly at zero.

Trajectory prose identifies recorded action as the postprocessed policy command
and observation.state as measured feedback sampled before the policy call and
send. It does not treat same-row differences as contemporaneous tracking error
or assume every queued action is a fresh network inference. Success/trial counts
and the rate are reported only beside the NAS30 result, once per language.

The NAS interpretation follows the pinned MTD temporal contract: obs[-1,0],
actions[-1,30], execution starts at index1. NAS25 executes current..+24 and leaves
6 future positions; NAS30 executes current..+29 and leaves1. Longer retained
predictions can change release timing. The clip comparison does not recover
where release sat in discarded historical chunks.

## Primary-source checks

- Original diffusion: Sohl-Dickstein et al. (2015), DDPM (2020), DDIM (2020 /
  ICLR2021). DDPM covers forward corruption, training, and reverse sampling.
  DDIM is a generative model family sharing the training objective; in deployment
  it commonly names its sampling procedure. The overview now separates objectives
  from sampling processes, lists DDPM in both relevant contexts, and places DDPM
  and DDIM sampling at H4 under diffusion models. Euler is described as an ODE
  integrator in the flow-matching section. MTD objectives and samplers are listed
  separately. DDIM can reuse an epsilon predictor; the displayed skipped-level
  equations use eta=0. Random initialization is retained.
- Flow Matching (Lipman et al.) supports Gaussian paths including diffusion
  paths; its straight-line conditional-path example is distinguished from DDPM
  noise regression and DDIM sampling. Generation time is distinct from action time.
- Diffusion Policy Section3 already separates visual encoding from action
  denoising. Octo SectionIII uses readouts and a diffusion action head; CogACT
  uses VLM conditioning and a dedicated DiT. These support modular action
  generation, not a universal historical transition from an entire policy
  backbone to a head. Standalone diffusion policies remain a parallel route.
- Algorithm-chapter introduction contains two paragraphs: applications (Diffuser,
  Diffusion Policy, VLA heads), then coexistence with flow matching. CogACT
  AppendixB reports10-step DDIM; LightDP supports continued acceleration of
  diffusion. No claim of task-independent superiority of either objective.
- All nine algorithm entries link their paper or technical source. MTD's author
  write-up is separated from TRI's paper; GR00T N1.7 release documentation is
  separated from the original N1 white paper; Spirit links technical blog/code.

- DiT: Peebles/Xie Figure3; diffusion backbone and three conditioning variants.
- DiT-Block: Dasari et al. Figure2; multimodal dropout and encoder/decoder policy.
- MDT: RSS2024 paper and official project architecture (multimodal goals, MGF/CLA).
- MoDE: ICLR2025 paper Figure1; sparse, noise-conditioned routing. Total and active
  parameters are distinguished. Original project URL returned404; paper used.
- LightDP: ICCV2025 Figure2, Table1. 90.6→2.72ms refers specifically to DP-T denoising
  under the tested iPhone13 setup, not the full preprocessing/encoder pipeline.
- CogACT: Figure2 and Table7. Head counts13M/89M/308M exclude the large VLM.
  The MLP-vs-DiT numbers preserve the paper's own evaluation columns.
- GR00T N1.7: current code default16 layers, released config32. Internal width is
  32 heads×48=1536, output1024. No claim that the released checkpoint halved depth.
- Spirit v1.5: code default18/1024/8 versus released16/1536/32, Qwen3-VL-4B,
  60-action horizon, max action32,10 integration steps. Release figure uses the
  released settings, not Python class defaults. Official implementation/model
  config supply these facts; the official blog served an empty SPA shell.
- AC-DiT: Table4 means37.5,44.8,47.0,49.0. Increments are independently calculated
  as7.3,2.2,2.0 points; the PDF's inconsistent Gain column is not reproduced.
  MBC uses pre-MLP features from five denoising steps; full-body output includes
  both base and arms. PMA code maps cosine similarity s to 1+s/2 in [.5,1.5]; no softmax is invented.

## Figures, interaction and editorial review

`asset-sources.json` records public source URLs, hashes and rollout timing.
Original architecture assets retain their source colours and citations; custom
SVGs/plots use the site palette. PDF figure crops exclude prose captions.
Public media strip audio and retain original timing. Two clips use native controls.
The rollout preparation script copies the original H.264 picture streams without
re-encoding:568x320, approximately30fps,3359/1719 frames. Packet hashes verify
that picture data matches the supplied sources. This replaces the previous
20fps/CRF28 exports. Posters now retain568x320 instead of284x160; the article's
single-video layout is capped at568 CSS pixels to avoid enlargement on desktop.
One NAS slider changes executed positions, retained tail length and duration;
static output is present before JavaScript. Theory diagrams have centered labels.

Check actual formula symbols against code, source/default versus release settings,
method naming, units, failure labels, and duplicated/meta prose. Build and internal
reference checks, then browser review of all folds/TOC, both languages, NAS slider,
figures/media, viewer dismissal and mobile widths. Publish separately from SmolVLA
maintenance and verify deployed HTML/assets and the empty homepage tools section.
