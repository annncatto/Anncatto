# 轻量化工具：开源方案调研与运动学校核

后续修正见[运动载荷与闭环验证](lightweight-control.md)：早期质心追逐支撑中心的步态和相机跟随已替换；新增真实闭环测试与原 URDF 圆轨迹。下文保留早期渲染核对依据，涉及旧运动／验证能力时以新文档为准。

2026-11-02。工作位置为 `/home/anncatto/Anncatto`，分支为 `draft/lightweight-design-workbench`。继续本地调试，不发布工具。材料与计算口径见 [材料选型文档](lightweight-materials.md)。

## 开源方案

本轮读取项目原仓库的说明、API 或源码。没有根据截图推断其求解能力，也没有直接移植项目中的机器人网格。

| 方案与原始来源 | 已核对的内容 | 对本工具的作用 |
| --- | --- | --- |
| [URDF Loader](https://github.com/gkjohnson/urdf-loaders/blob/master/javascript/README.md)、[URDFClasses.js](https://github.com/gkjohnson/urdf-loaders/blob/master/javascript/src/URDFClasses.js) | 关节原点、局部轴、旋转／移动关节、限位与 mimic 关节的变换更新 | 分开关节变换与显示几何；检查固定关节及夹爪从动关系；采用有深度遮挡的原生三维显示 |
| [Closed Chain IK](https://github.com/gkjohnson/closed-chain-ik-js)、[核心 API](https://github.com/gkjohnson/closed-chain-ik-js/blob/main/src/core/API.md) | 阻尼最小二乘、关节上下限、位移／旋转残差，以及收敛、停滞、发散和超时状态 | 预览必须报告实际残差；目标不可达或足底姿态不满足时停止播放。它还适用于后续闭链研究，本轮未新增闭链构型或引入该库 |
| [Draft 编辑器](https://github.com/davidhnguyen2000/draft/blob/main/src/draft/editor/README.md)、[viewer.py](https://github.com/davidhnguyen2000/draft/blob/main/src/draft/editor/viewer.py) | 同一模型／计算源驱动参数、可行性结果和可视化；显示使用 Viser 与 MuJoCo 场景，并区分保持姿态与物理仿真 | 保持计算与显示同源，区分设计姿态、运动学预览及动力学。Draft 的 Python 服务并非当前静态页面的直接替换组件 |
| [Pinocchio IK 示例](https://github.com/stack-of-tasks/pinocchio/blob/devel/examples/inverse-kinematics.py) | 局部坐标系中的 SE(3) 误差、匹配坐标系的 Jacobian、阻尼迭代和收敛判据 | 明确任务究竟要求末端位置还是完整姿态；机械臂当前轨迹只要求位置，人形接触另检验足底法向 |
| [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie)、[MuJoCo](https://github.com/google-deepmind/mujoco) | 模型几何、关节与惯性的一致性，以及独立引擎中的模型检查 | 复用已安装的 MuJoCo WASM 对生成的 MJCF 进行独立 FK 核对；没有用 Menagerie 的特定机器人资产替代概念模型 |

实现继续使用仓库已有 Three.js 和 MuJoCo 依赖，不新增 Python 服务，也不增加外部运行时资源。

## 复现结果与修正

| 问题 | 复现与处理 |
| --- | --- |
| 视口随姿态改变 | 旧 SVG 每帧从当前点集重新计算平移与缩放。新视口使用正交相机，在设计改变时按设计姿态与运动包络的实际几何投影极值适配，播放期间保持投影尺度 |
| 空间遮挡错误 | 旧 SVG 将机身、连杆和符号分组绘制，缺少实际深度遮挡。新结构视图使用有深度测试的杆件截面与部件包络；驱动轴作为标注显示 |
| 地面与运动坐标不明确 | 显式以 `groundFrame()` 将移动坐标中的姿态、接触点、质心和支撑域转换到地面坐标；相机仅跟随整体前进量，网格保持在固定的世界坐标格点上 |
| 播放首帧跳变 | 默认四足和人形从设计姿态到旧预览首帧的最大节点位移约为 0.231 m、0.271 m。新增 1 s 姿态准备过程，足端水平位置保持固定，机身高度及质心目标平滑调整，再开始迈步 |
| 悬空足端计入支撑 | 将左前大腿改为 0.45 m 时，其余足端约高于地面 0.134 m，旧参考状态仍把四足全部算作接触。现在根据真实足底点／角点与地面距离判定接触，容差为 2 mm；该示例只返回一个接触足 |
| 足底方向被忽略 | 矩形足底中心和角点使用完整旋转变换，初始高度按旋转后最低角点放置；人形另计算足底法向误差。没有形成面积的接触不显示为完整支撑区域 |
| 锁定关节仍可改变 | FK 对未激活关节固定使用 home 值；腿部 IK 不再覆写未激活的髋、膝或踝。夹爪从动关系同时遵守开合关节的激活状态 |
| 周期边界 | 以总周期数减去其整数部分求相位，避免加一再取模在浮点边界处提前归零；测试覆盖迈步、落足及多个周期交界 |

脚步目标直接在地面坐标中规划：支撑期间足端水平位置固定，摆动期间用五次平滑函数前移、用连续高度曲线抬足。计算后再转换回随动坐标做 IK。身体前进量与脚步的地面位置分开计算；不以移动网格代替足端约束。

播放默认从设计姿态开始，单次运行姿态准备及一个运动周期，然后停止。机械臂运行一个参考轨迹周期。参数更新停止旧动画；拖动进度可检查中间姿态。足端位置误差超过 1 mm，或人形足底法向误差超过约 2° 时，预览报告不满足约束并停止播放。这些阈值用于预览检查，不是制造或控制精度保证。

当前腿部解析 IK 对应工具提供的构型，机械臂为位置 IK。任意轴向、任意关节锁定和闭链设计仍需相应求解器；失败时保留实际误差，不把限位截断后的结果标成已求解。运动仍是运动学参考，没有据此声称动力学稳定行走。

## 界面与文字

按 [课程笔记工作流](course-note-workflow.md)、[论文 PPT 工作流](presentation-workflow.md)和[实验文章工作流](experimental-article-workflow.md)采用直接的技术标题：装配质量与质心、随动链惯量、减速比与反射惯量、结构柔度与固有频率、强度与驱动力矩、反向驱动力矩与动能。中英文同步修改，删除问答式标题、过程叙述和没有新增信息的建议语句。

参数和材料表正文为 14 px，公式说明 15 px、公式区标题 16 px；来源与单位保持次级字号。收紧顶部与模块间距，清除公式折叠项继承的多余内外边距；中央视口高度限制为 330–400 px，画布脱离普通文档流，避免窗口缩放后因固有尺寸反馈而不断增高。视口显示实际结构和地面，移除不随动工况下无用途的传动图例。移动端保留纵向阅读和表格内部滚动。

## 代码入口

- `src/design-viewer.ts`：正交相机、真实深度遮挡、地面、接触与支撑域、驱动轴、视角与导出。
- `src/design-motion.ts`：足底几何、真实接触、姿态准备、地面坐标脚步、运动阶段及误差。
- `src/concept-model.ts`：锁定关节与夹爪从动关系。
- `src/lightweight-lab.ts`：有界播放、错误反馈、显示与计算同步；`design-diagram.ts` 保留为 WebGL 不可用时的二维回退。
- `tests/design-motion-regression.test.mjs`：首帧、接触、多个周期、锁定关节及独立 MuJoCo FK。

## 验证

完整测试共 44 项通过。新增检查包括：默认三种构型首帧与设计姿态一致、悬空足端排除、多个周期中支撑足在地面坐标中不滑移、足底不穿地、锁定关节不改变、不可行足底约束有残差。

独立 MuJoCo 验算覆盖四足、人形和机械臂，以及近端驱动、锁定踝关节、4 轴机械臂，共 6 种模型、每种 8 个采样时刻。比较所有节点的地面坐标位置和旋转，位置容差为 `2e-7 m`，四元数内积误差容差为 `1e-7`。只调用正运动学，没有进行动力学步进或训练。

构建与内部引用检查通过。浏览器检查记录为 `/tmp/lightweight-view-final.json`，测试、构建与链接日志为 `/tmp/lightweight-motion-tests.log`、`/tmp/lightweight-view-build.log`、`/tmp/lightweight-view-check.log`。截图使用 `/tmp/lightweight-final-*.png`。
