# 工作流与交接

工作流和交接文档统一从 `/home/anncatto/Anncatto/docs/` 读取和提供链接。开发用的独立 Git 工作树可以保留各自的版本副本，但不作为面向用户的文档入口。修改工作流后，同步主目录中的对应文件。

| 文档 | 用途 |
| --- | --- |
| [课程笔记整理工作流](course-note-workflow.md) | 将课程笔记、PPT 截图、例题和调研材料组织为长篇博客 |
| [实验文章写作流程](experimental-article-workflow.md) | 理论、配置、视频、轨迹和实验分析的组织与核对 |
| [论文网页 PPT 工作流](presentation-workflow.md) | 论文主线、逐页编排、统一版式、架构图、动画与验收 |
| [轻量化交互工具交接](lightweight-tool-handoff.md) | 在新对话继续本地工具开发时读取的状态与边界 |

实现与来源记录：

- [轻量化设计实现记录](lightweight-design.md)、[材料选型与机构示意](lightweight-materials.md)、[渲染与运动学校核](lightweight-rendering.md)、[运动载荷与闭环验证](lightweight-control.md)、[开源模型来源核对](lightweight-model-sources.md)与[素材覆盖表](lightweight-source-coverage.md)。
- 工具配色参考：[提取色板](lightweight-ui-palette.svg)。
- 结构数据与计算：[CAD 截面与结构校核](lightweight-structural-checks.md)、[原机器人承力件资料](source-structure-sources.md)、[结构验证快照](lightweight-structure-validation.json)。
- 参数化源模板：[尺寸、材料、质量分区与验证](lightweight-parametric-models.md)。
- 仿真证据：[九组闭环验证](lightweight-validation.json)、[九组源模板尺寸与材料验证](lightweight-derived-validation.json)、[五组新偏置与圆半径验证](lightweight-offset-validation.json)、[RP1 六组动作参数测试](lightweight-source-sweep.json)。结果只覆盖记录的模型、参数和控制器。
- 异常力矩复现与修复：[88 mm 圆轨迹、逆解收敛和差分检查](lightweight-control.md#2026-11-0488-mm-圆轨迹异常力矩核查)；最新143项测试和浏览器核对见交接。
- [网页幻灯片实现与迭代记录](presentation-articles.md)。当前排版与验收规则以 PPT 工作流为准。

轻量化工具继续在 `draft/lightweight-design-workbench` 本地开发，公开首页的“交互工具”栏目保持无入口。统一文档路径不改变工具的发布范围。

2026-11-05：用户授权发布轻量化工具；公开构建与本地 RP1 资源的具体范围见[工具交接](lightweight-tool-handoff.md)。工具与实验文章继续在主目录维护。
