# 网页幻灯片文章

## 入口与文件

`content/posts.json` 可选的 `presentation` 字段指向 `content/` 内的 HTML 源文件。存在此字段时，首页标题进入 `/notes/<slug>/slides/`，旁边保留全文链接。原有 `/notes/<slug>/` 及其章节锚点继续有效，文章头部提供幻灯片入口。

OpenWAM 的幻灯片入口为 `content/openwam/presentation.html`，15 页正文分别保存在 `content/openwam/slides/`，全文仍由原章节文件组成。幻灯片是单独编排的视觉叙事，不从全文段落机械分页。

## 页面约定

- 一页为 `<section class="slide" data-slide id="s-...">`，标题由 `aria-labelledby` 关联；第一页 H1，其余页 H2。
- `.slide-kicker` 记录原论文章节；`.slide-source` 放原论文页码与全文对应锚点。
- 沿用网站的 `[lang="en"]` / `[lang="zh-CN"]` 双语文本与本地 KaTeX。所有独立公式放在 `.formula` 容器内。
- `.slide-grid`、`.slide-panels`、`.slide-figure-stack` 分别支持图文对照、平行结论、上下原图。窄屏按自然顺序滚动，整页不横向溢出。
- 原论文图片保留完整画布、高分辨率源、原图编号、作者及许可证。解释图使用原生 SVG，不把新画的推理关系冒充原图。
- OpenWAM 当前按原论文结构组织，15 页以内。标题页独立，第二页交代原文问题与贡献；原图优先占满主体，解释放在最右侧分点或图下一两行。架构按整页或完整局部拆解展示，不强制每页添加总结栏。
- 超链接保持标准 HTML 行为。图片和 SVG 使用现有放大对话框，关闭按钮与 Escape 持续可用。

## 交互与动画

`src/slides.ts` 管理翻页、构建步骤、目录、全屏与 URL；`src/slides-state.ts` 提供可测试的纯导航和去噪时钟计算。OpenWAM 的补充拆解图由 `src/openwam-slide-diagrams.ts` 构建。当前演示移除了去噪进度点播放和逐条连线强调；原图放大、超链接与目录保留。

- 方向键 / 空格按构建步骤前进；PageUp / PageDown 直接翻页；Home / End 到首尾。
- 直接打开页锚点呈现该页全部步骤；目录跳转同样呈现完整页。分享链接不会将解释的一半隐藏。
- 动画必须揭示实际计算关系或实验差异。不能用移动圆点、重复描线或闪烁代替解释；没有明确解释作用时使用静态图。
- `prefers-reduced-motion` 关闭过渡，仍保留逐步查看。禁用 JavaScript 时按顺序显示全部内容；打印时显示所有页和所有步骤。
- 可计算的交互必须记录正确的数值规则。OpenWAM 的模态调度先应用路径，再应用骨干时间变换；不能把中间路径值当作最终去噪时间。

## 检查

运行常规构建、内部链接检查和测试。浏览器逐页检查中英文、1440×900 桌面与窄屏：图文是否清楚、标题/公式/原图是否溢出、关键结论是否在预期区域。另检查步骤正反向遍历、目录焦点、深链接、图像放大退出、交互计算、减弱动态效果与打印。

首页摘要只描述文章主题和核心内容，不包含图片数量清单、制作要求、提示词或编辑过程。

## OpenWAM 来源

内容依据 Wang et al., arXiv:2609.07398v1。动画参考视频为 BV19hJ26TEMN；其技术内容属于另一篇同名 Stanford OpenWAM，未混入本文。视频只在临时目录用于观察呈现方式，未复制进站点资产。

## 历史版本记录

以下记录早期版本，当前版式以文末“原论文主线版”为准。

## 2026-10-30 验证记录

- 构建、495 个内部引用检查及 35 项测试通过。
- 30 页在中英文 1440×900 桌面视口内完整呈现，无页内纵向溢出和 SVG 文字越界。
- 390、768 像素宽度逐页检查两种语言，整页没有横向溢出。
- 原图均可解码；放大后的按钮关闭与 Escape、目录跳转、步骤往返、键盘导航、深链接、调度参数与播放已检查。
- 减弱动态效果、无 JavaScript 的连续阅读和打印全部页面已检查。

## 2026-10-31：15 页研究报告版式

- OpenWAM 从 30 页合并为 15 页。按研究问题组织页标题，不必沿用论文小节的完整英文标题。
- 以 1440×900 为基准，标题统一 44px，正文、表格、要点和结论统一 20px；窄屏按同一组响应式规则调整。仅来源、图片编号和工具栏使用辅助字号。关键术语、比较对象与结果用加粗表达层次。
- 每页使用相同的标题区、内容框和底部结论栏。信息密度优先通过完整的机制解释、必要的同页对照与可读结构图提高；不能用无关分数表代替架构说明。
- 同一比较的对象必须同页并列：原始/紧凑表征、单向/双向可见性、ID/OOD、单臂/双臂。保留统一量纲、相同坐标含义和各自协议。
- 底部强调具体发现或机制结论，例如动作通过桥接注意力在生成过程中持续读取世界特征。实验操作、阅读提示和分析注意事项留在正文，不能冒充结论。
- 模块组合与 α 结构使用整行大图；其重复卡片改为紧凑说明，给节点和连线更多空间。
- 所有论文原图仍保留在演示文档内，工具栏“原图”提供索引；原图编号链接通过 `data-open-figure` 打开现有放大对话框。正文优先呈现关键原图与可读的拆解图，不缩小完整结构图来充当装饰缩略图。
- `data-filled="true"` 保持所有文字、节点和证据可见。分步演示仅强调当前连线与模块，不因动画步骤留下半页空白。
- 被合并页面的旧锚点保存在 `data-slide-aliases`，并解析到新页面。空哈希继续从首页第一步开始。

### 版式参考

- [Kaiming He, CVPR 2016 ResNet oral](https://people.csail.mit.edu/kaiming/cvpr16resnet/cvpr2016_deep_residual_learning_kaiminghe.pdf)：大号主题、结构与结果同页、加粗具体发现；参考结构和实验页。
- [Georgia Chalvatzaki, CoRL 2024 Early Career Keynote](https://pearl-lab.com/wp-content/uploads/2024/11/CoRL_EarlyCareerKeynote.pdf)：大幅机器人图像、流程示意和重点词。原 PDF 存在动画层叠平面化现象，不沿用重叠文本。

参考资料只用于版式研究，OpenWAM 的技术依据仍为原论文与官方实现。

### 15 页版验证

- 518 个内部引用与 36 项测试通过；旧页面锚点继续有效。
- 中英文逐页检查：1440×900、1280×800、1920×1080 无页面或 SVG 文字越界。320、390、768 像素窄屏无整页横向溢出。
- 默认正文和全部节点持续可见；连线分步强调、注意力矩阵、10 步去噪播放、原图索引及关闭返回均已检查。
- 原图共 21 幅保持完整；正文沿用长篇文章来源，补齐了数据小时与配比、Franka 分任务对照、灵巧手 Score / SR 及试次数。

- 原图 21 的完整文件含大面积外白边；幻灯片使用 SVG 视口放大其完整内容区域，图像文件保持不变，“原图”索引仍显示完整画布。


## 2026-10-31：以架构解释为主线

上一版虽然补足了数据表，却把架构解释挤成了术语和箭头。平衡密度不等于铺满基准分数：读者必须能从输入沿着连线说明一次计算如何发生。

- 先确定论文的核心机制，再分配页数。OpenWAM 的 15 页围绕组合接口、表征、骨干、注意力桥接、可见性、条件注入、训练、联合生成与闭环执行展开；实验证据集中支持设计选择。
- 图下给出连贯的解释：输入是什么，模块如何计算，输出送到哪里，以及为何这样安排。先解释中间机制，再呈现完整 α 原图，减少只读懂框名却无法追踪计算的情况。
- 公式与图使用同一套符号，并在本页定义。特别区分潜变量通道 C、token 数 N、隐藏宽度 D，以及样本空间向量场速度和物理运动速度。
- 联合训练与联合采样分开解释：前者学习局部向量场，后者重复前向与积分。固定观测、噪声时间、序列位置和物理控制时间分别说明。
- 对比页保持同页并列；分数只用于回答架构选择。解释“共享注意力”时明确流分别持有 Q/K/V、输出投影与残差网络，避免读者误认为两条骨干完全共享权重。
- 增加正文后，不能只检查 scrollHeight。还需比较正文末端与结论栏的实际边界，防止 flex 容器收缩后文字与底部强调栏重叠。

本次验证：15 页中英文在 1440×900、1280×800、1920×1080 无文字遮挡、SVG 标签越界或整页溢出；320、390、768 像素窄屏无整页横向溢出。21 幅原图保留完整来源，α 架构主面板单独放大。10 步联合去噪使用已核对的真实时间网格；旧锚点、图像放大关闭、减弱动画、打印与无 JavaScript 阅读通过。


## 原论文主线版 · 2026-10-31

- 以论文自己的问题、实验设置和发现为叙事骨架。压缩原文并忠实翻译，只有需要解释难懂概念时补充自己的话。删去自行添加的杯子任务示例与通用背景讲义。
- 第 1 页为标题与论文概览原图；第 2 页直接给出 Introduction 的数据不对称、设计因素耦合问题，并列 Infra / Study / α，列出三个问题及对应发现。
- 后续严格沿 Infra → Study → α 展开：组合架构、联合训练、部署；先验继承、容量、训练可见性、推理调度、跨域预训练；完整 α 结构、桥接局部、训练数据与验证。
- 原图主体采用大图加右侧要点，或大图加底下一两行说明；需要对比的原图同页并列。当前主体展示 12 幅不同论文原图（部分使用多个完整面板）；全部 21 幅完整原图仍可通过索引访问。
- 所有逐页总结栏移除。与推理机制无关的进度点播放、自动描线和逐块强调移除；补充 SVG 只用于三项贡献、联合训练接口和 α 桥接细节。
- 联合训练页明确对象为 OpenWAM-Infra，区分样本、条件、未来标签与网络预测的两个向量场；最终动作样本由部署页的积分过程产生。
- 图 9 正文“同步最佳”与一条 93.3% 标注存在差异。演示保留原图并报告作者采用同步配置，不扩大为无例外的最高分结论。
- 正文、表格与要点沿用统一字号。标题页的完整论文标题属于标题层级；图注与来源继续使用辅助字号。禁止为了贴合整页缩小正文。


## 横排标题与关联架构图 · 2026-10-31

- 页标题在左、可点击的论文节号引用在右，采用同一横排标题区。移除各页底部重复的作者、页码、全文和许可行；全文入口仍在顶栏，许可与来源保留在标题页、原图索引和补充图图注。
- 独立公式放大到 26px（大屏 30px、矮屏 24px），正文与行内公式保持原字号。
- 第二页底部直接使用用户提供的论文三问题截图。PNG 字节保留不变，仅以 SVG 视口去除外白边；上方发现压缩为三个并列要点，避免重复列出三个问题。
- 关联内容围绕该页已经涉及的机制展开，不为每页强行增加同样的背景段落。DiT、Wan 因果 VAE／生成架构、PS-VAE 与 EgoDex 图从作者论文或官方页面取得，保留原图并单独注明来源。
- 先区分版本与功能再引用：Wan2.1 架构图不能直接标成 Wan2.2-TI2V-5B；Wan2.2 的 5B 为稠密模型，A14B 的噪声阶段 MoE 属于另一模型配置。PS-VAE 原文的完整图也不能冒充 OpenWAM 48 维 S-VAE 实验本身。
- 关联架构图在有足够空间的侧栏展示；其余以本页图入口打开现有放大对话框。补充内容不能挤掉论文主图，也不新增无意义动画。

本版验证：538 个内部引用与 36 项测试通过。中英文在 1440×900、1280×800、1920×1080 的页标题均保持一行，无内容遮挡或溢出；320、390、768 像素窄屏无整页横向溢出。第二页问题截图与新增架构图的放大、关闭按钮及 Escape 均通过浏览器检查。

### Integrated explanation and content coverage

- OpenWAM's main-paper coverage is mapped explicitly in `docs/openwam-source-coverage.md`. A figure link alone does not count as explaining an important experimental finding; the result and its interpretation must be visible in the main narrative.
- Supplemental concepts belong beside the equation, mechanism or result they clarify. Avoid a repeated expansion block at the bottom of each page. Use an outlined group for a distinct concept and a dashed divider for equally important parallel arguments.
- `src/openwam-attention.ts` implements the visibility inspector through the pure rules in `src/slides-state.ts`. Selection changes which source streams the chosen Query can read. The source paper's measured scores remain fixed; there is no simulated model prediction or arbitrary animated emphasis.
- Long English and Chinese versions need independent layout checks. Preserve body type size; shorten redundant language or rebalance modules before shrinking text.

- A named framework and its subtopics must stay visibly connected: OpenWAM pages 3–5 now name Infra on a composition/training/serving path, and pages 6–11 name Study on the paper's three-question path. α's opening explicitly assembles the preceding choices.
- Treat the source's experimental sequence as a sequence of accumulated conditions. State what stays fixed, what changes, the observed result and the retained default; distinguish the authors' interpretation from the numerical result. Avoid generic formulas obscuring the actual framework contribution.
- Check internal card/row collisions as well as viewport overflow. SVG source-panel views need explicit clipping when aspect-ratio letterboxing could otherwise reveal adjacent panels.
