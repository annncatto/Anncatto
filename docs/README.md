# 工作流与交接

工作流和交接文档统一从 `/home/ann/Anncatto/docs/` 读取和提供链接。开发用的独立 Git 工作树可以保留各自的版本副本，但不作为面向用户的文档入口。修改工作流后，同步主目录中的对应文件。

| 文档 | 用途 |
| --- | --- |
| [仓库与分支](repository-workflow.md) | 本机检出、GitHub 主线、文章与工具分支、迁移恢复 |
| [课程笔记整理工作流](course-note-workflow.md) | 将课程笔记、PPT 截图、例题和调研材料组织为长篇博客 |
| [正式报告写作规范](report-writing-workflow.md) | 正式论述、公式与科学图表；Infra 基准、Study 分阶段比较和 Alpha 结论 |
| [RP1 项目推进规则](rp1-study-workflow.md) | 右腿整轮比较、Infra评分依据、计算复用、并行职责与最后选择Alpha |
| [实验文章写作流程](experimental-article-workflow.md) | 理论、配置、视频、轨迹和实验分析的组织与核对 |
| [论文网页 PPT 工作流](presentation-workflow.md) | 论文主线、逐页编排、统一版式、架构图、动画与验收 |
| [轻量化交互工具交接](lightweight-tool-handoff.md) | 工具维护、公开构建与本地模型范围 |

实现与来源记录：

- [AlohaMini 工作介绍来源与验收](alohamini-work-source-coverage.md)：平台架构、三篇仓库报告、飞书实验、图与视频来源，以及网页PPT检查。

- [OpenWAM 动作表示实验来源](openwam-slots-source-coverage.md)：实验数据、检查点、训练耗时、接口对照、视频及复现。

- [SmolVLA 数值类型实验来源](smolvla-source-coverage.md)：精度训练、模块交换、动作边界、真机轨迹与图表复现。

- [轻量化设计实现记录](lightweight-design.md)、[材料选型与机构示意](lightweight-materials.md)、[渲染与运动学校核](lightweight-rendering.md)、[运动载荷与闭环验证](lightweight-control.md)、[开源模型来源核对](lightweight-model-sources.md)与[素材覆盖表](lightweight-source-coverage.md)。
- 工具配色参考：[提取色板](lightweight-ui-palette.svg)。
- RP1 课程项目：[开发与计算依赖](rp1-leg-project.md)、[CAD 与求解器记录](rp1-leg-compute.md)、[六维弹性内核](rp1-elastic-kernel.md)。评审主稿为 Obsidian 大作业目录中的 `RP1腿部轻量化.docx`（《机械工程学报》版式，附 PDF 预览），按开篇、Infra、Study、Alpha 组织；Infra 提供必要基准与验收条件，Study 按设计类别逐轮优选，Alpha 待实际候选计算后撰写。计算工程位于`/home/ann/rp1-leg-work/`，源稿、CAD和求解输出均留在该目录；Obsidian评审目录只保留当前报告与引用图片、图纸。本轮工具改动仅本地。
- 结构数据与计算：[CAD 截面与结构校核](lightweight-structural-checks.md)、[原机器人承力件资料](source-structure-sources.md)、[结构验证快照](lightweight-structure-validation.json)。
- 参数化源模板：[尺寸、材料、质量分区与验证](lightweight-parametric-models.md)。
- 仿真证据：[九组闭环验证](lightweight-validation.json)、[九组源模板尺寸与材料验证](lightweight-derived-validation.json)、[五组新偏置与圆半径验证](lightweight-offset-validation.json)、[RP1 六组动作参数测试](lightweight-source-sweep.json)。结果只覆盖记录的模型、参数和控制器。
- 异常力矩复现与修复：[88 mm 圆轨迹、逆解收敛和差分检查](lightweight-control.md#2026-11-0488-mm-圆轨迹异常力矩核查)；最新发布检查与浏览器核对见交接。
- [网页幻灯片实现与迭代记录](presentation-articles.md)。当前排版与验收规则以 PPT 工作流为准。

2026-11-05：用户授权发布轻量化工具；公开构建与本地 RP1 资源的具体范围见[工具交接](lightweight-tool-handoff.md)。工具与实验文章继续在主目录维护。

2026-11-07：《轻量化结构设计》的语句修订及 `1107.md` 续写已发布（`40f5906`，GitHub Pages 部署通过）。生产构建、172项测试、721项内部引用及59项浏览器检查通过；线上HTML与隔离发布构建一致。语句规则见[课程笔记工作流](course-note-workflow.md)，新增章节见[素材覆盖表](lightweight-source-coverage.md#november-7-continuation)。RP1课程项目和本轮工具改动继续保留本地。
