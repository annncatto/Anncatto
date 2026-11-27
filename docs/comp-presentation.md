# CoMP 网页 PPT · 来源与编排

## 版本与范围

- 正式标题：*Coherent Moment Propagation: Epistemic Uncertainty for Pre-trained Robot Policies*。
- 作者：Miguel Saavedra-Ruiz（NVIDIA / Université de Montréal / Mila）、Anqi Li、Claudia D'Arpino、Alperen Degirmenci、Tucker Hermans（NVIDIA / University of Utah）、Fabio Ramos（NVIDIA / University of Sydney）。
- 版本与日期：`arXiv:2611.26855v1`，2026 年 11 月 19 日提交（Preprint, under review），PDF 共 33 页。
- 主来源：[arXiv 页面](https://arxiv.org/abs/2611.26855)、[arXiv PDF](https://arxiv.org/pdf/2611.26855)、[官方项目页](https://comp-uq.github.io/comp-uq/)。
- 许可证：arXiv 非排他分发许可（[arXiv non-exclusive license 1.0](http://arxiv.org/licenses/nonexclusive-distrib/1.0/)），所有原图保留作者与论文归属，不套用其他论文的 CC BY 4.0 许可。

## 中心论述

> 预训练流匹配机器人策略无需重训即可通过末层 Laplace 矩传播估计认知不确定性——前提是递推显式携带**状态—权重互协方差 $C_i$**（消除 BayesDiff 的 $O(1/T)$ 方差坍缩），并用策略已算好的**观测嵌入 $c(o)$ 拓宽末层后验**（缓解特征坍缩）。

## 逐页提纲与内容覆盖表（14 页）

| 页 | 锚点 | 页面任务 | 主来源 | 主图 / 交互 | 比较关系与承接 |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | `c-title` | 标题、作者与核心结果概览 | 标题页、§1、图 1 | 原图 1（`figure-01.webp`） | 直接展示 BayesDiff 随步数 $O(1/T)$ 坍缩与 CoMP $O(1)$ 还原的对比 |
| 2 | `c-problem` | 研究问题、已有方法限制与原文三项贡献 | §1、图 1 | 原图 1(a–d) + 原文并列三贡献 | 引出单模型后验估计动机，自然过渡到 §2 符号与公式 |
| 3 | `c-setup` | 流匹配策略、末层 Laplace 与 BayesDiff 递推 | §2、Eq. (1)–(7) | 原生架构与符号流 SVG | 统一全篇符号（$D=Hd_a$、$\Delta t=1/T$、$\Sigma_\theta$），点破 BayesDiff 每步边缘化权重丢掉 $C_i$ |
| 4 | `c-collapse` | Theorem 1：BayesDiff 为何按 $O(1/T)$ 方差坍缩 | §3、Eq. (8)–(9)、Thm. 1、Cor. 1–2、App. A.1 | 原图 1(d) + 交互式步数 $T$ 衰减探索器 | 对比 $T\cdot\Delta t^2 = 1/T$ 标量递推，并指出满协方差（Cor. 1）与扩散 SDE（Cor. 2）无法避免认知项衰减 |
| 5 | `c-comp` | CoMP 核心推导与 Theorem 2（$O(1)$ 常数上界） | §3、Eq. (10)–(14)、Thm. 2、Prop. 2、App. A.2 | 块矩阵信息流对照 SVG（$C_i\equiv 0$ vs 携带 $C_i$） | 对比“先平方再求和（$1/T$）”与“先叠加振幅再平方（$O(1)$）”，引出如何计算 $A_i$ 与 $A_i P_i A_i^\top$ |
| 6 | `c-ekf-ukf` | 两种实现（CoMP-EKF vs CoMP-UKF）与不确定性指标 | §3、Alg. 1–2、App. A.4–A.5 | 交互式 EKF / UKF 步骤与路径切换图 | 同页对比一阶雅可比线性化与 $2D+1$ sigma 点无迹变换，并定义 $U_{\mathrm{chunk}}$ 与 $U_{\mathrm{endpoint}}$ |
| 7 | `c-aughead` | 零重训增强末层后验：复用观测嵌入 $c(o)$ | §2、§3、Eq. (5)、App. A.3、Eq. (23)–(25) | 原生特征拼接与方差下界 SVG + 显存占用表 | 对比朴素末层特征坍缩、LULA（需 OOD 集）与复用 $c(o)$（零重训、动作不变、方差不减） |
| 8 | `c-q1-calib` | Q1：传播协方差是否忠实还原后验（robomimic） | §4.1、图 2、图 6、图 11、App. A.7 | 原图 2（`figure-02.webp`） | 同页比较 BayesDiff / full-$\Sigma$ / CoMP-EKF / CoMP-UKF 的方差比、变差函数与 NLL，引出步数排序检验 |
| 9 | `c-q1-ranking` | Q1 延伸：步数不仅压缩尺度，还打乱 BayesDiff 排序 | §4.1、图 7、App. A.7 | 原图 7（`figure-07.webp`） | 回答“尺度不变阈值能否绕过坍缩”的反问，为后续 Q3/Q4 步数消融铺垫 |
| 10 | `c-q2-lang` | Q2：增强头能否识别语言指令模糊度（RoboLab） | §4.2、图 3、图 8–10、表 3、App. A.8 | 原图 3 + 原图 10 并列对照 | 左图看朴素头 vs 增强头随指令模糊度响应，右图看步数 $10\to 50$ 下 BayesDiff 趋平而 CoMP 保持稳定 |
| 11 | `c-q3-fiper` | Q3：运行期故障早期检测（robomimic & LIBERO-90） | §4.3、图 4、图 11–12、表 4–5、App. A.9 | 原图 4 + 表 4/表 5 核心对照 | 同页对照单模型各基线、训练集成参照及同算力 $M=2D+1$ 后验集成，解释 UKF 领先与 EKF 滞后 |
| 12 | `c-q4-save` | Q4：不确定性引导的微调数据筛选（LIBERO-10） | §4.4、图 5、图 13–15、表 6、App. A.10 | 原图 5 + 原图 14 + 表 6 步数消融 | 展示单策略 + 75 MB 后验超过双模型 VFD 集成，且在 $T=50$ 时 BayesDiff 跌至 −2.9 pp 而 CoMP-UKF 稳守 +3.7 pp |
| 13 | `c-cost` | 推理开销、三项局限与适用边界 | §6、表 1、表 5 | 表 1（$\pi_{0.5}$ vs SmolVLA 延迟与显存）+ 三项局限结构化拆解 | 坦诚交代 $D=Hd_a$ 扩展瓶颈与实时 UQ 仍开放，界定当前最适场景（离线选数与安全关键监控）与未来低秩方向 |
| 14 | `c-takeaways` | 总结与实践启发 | §1、§3–4、§6–7 | 问题—方法—证据闭环总表 + 实践选型建议 | 回到开篇中心论述，给出面向流匹配 VLA / WAM 的可执行启发 |

## 资产与引用

- 原论文全部 15 幅图（正文图 1–5 + 附录图 6–15）均从 arXiv 矢量 PDF 源码经 300 DPI 渲染为高质量 WebP 存入 `content/images/comp/`，完整指纹与页码记录于 `content/images/comp/sources.json`。
- 正文原图编号链接通过 `data-open-figure` 打开网站复用放大查看器；工具栏「原图 / Figures」提供全部 15 幅原图索引。
- 交互模块位于 `src/comp.ts`：
  1. 第 4 页步数探索器：用户切换欧拉步数 $T\in\{10,25,50,100,200,400\}$，严格按命题 2 与定理 1–2 实时计算单位常速度场下 BayesDiff（$T\cdot\Delta t^2 = 1/T$）与 CoMP（$(T\cdot\Delta t)^2 = 1$）的方差比例，并对照图 1(d) 实测参考值。
  2. 第 6 页 EKF / UKF 步骤对照器：用户切换 CoMP-EKF 与 CoMP-UKF，同步高亮对应的线性化 / sigma 点传播路径、状态转移更新式与实测 LIBERO-90 / SmolVLA 代价与表现。
- 配套演讲提示稿保存于 `docs/comp-speaker-notes.md`，同步作为网页正文 `content/CoMP.html` 发布在 `/notes/comp/`。

## 验收记录

- 构建与测试：`npm run build`（10 篇文章、TypeScript 模块与本地 KaTeX 零错误）、`npm test`（175/175 通过）、`npm run check`（1,306 处内部引用与全部图表/MathML 通过）。
- 浏览器全视口验收：在 `1440×900`、`1280×800`、`1366×768`、`1920×1080`、`768×1024`、`390×844`、`320×568` 共 7 种视口下对中英文 14 页、交互控件、目录/原图弹层、首页入口、伴随提示稿、`prefers-reduced-motion` 与打印视图执行 Playwright 自动化检查（935 passed, 0 failed；1920×1080 全 14 页 `bottomGap = 0`、`vOverflow = 0`），并逐页人工审阅桌面与移动端渲染截图。
