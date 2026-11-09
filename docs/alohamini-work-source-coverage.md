# AlohaMini 工作介绍：来源与交付

网页路径：`/notes/alohamini-work/slides/`。主文件为 `content/alohamini-work/presentation.html`，8 个页面片段位于 `content/alohamini-work/slides/`。材料核对与制作日期：2026-11-09。

本地分支为 `article/alohamini-work`，工作目录 `/home/anncatto/Anncatto-work-presentation`。本轮为本地预览，制作和构建未混入主目录的 RP1 与交互工具改动。

## 页面与论述链

| 页 | 页面任务 | 核心材料 |
| --- | --- | --- |
| 1 | 平台总览与已完成任务 | AlohaMini2 Pro 模型、观测—策略—执行闭环、18 个混合控制字段 |
| 2 | 控制分层 | PC、树莓派 Host、5555/5556 通道、双 TTL 总线、命令准入与本地保护 |
| 3 | 软件与实验链路 | episode 录制、v3 数据、算法适配、训练、检查点、离线检查、实机诊断 |
| 4 | 与 LeRobot 的关系 | 通用生态与本机集成；数据、动作语义、训练、部署、ROS/仿真与维护分工 |
| 5 | 玩偶任务的 VLA 训练与执行 | SmolVLA/π0.5 论文架构、120/150 示教配置、成功视频与腕部振荡曲线 |
| 6 | MTD 的训练与动作窗口 | TRI LBM 论文图9、实际适配参数、loss、25/30 步视频与4/10结果 |
| 7 | 精细操作的实验对照 | 数据时序、七巧板模型对照、18维分拣适配、参数更新成本四种证据视图 |
| 8 | 擦板的诊断与修正 | 升降曲线、受控状态替换、处理器常量维行为、部署约束及两轮5229条记录 |

页面采用博客浅蓝、浅绿底色。图内分别使用蓝、青绿、紫、橙、粉色表达观测、控制、策略、目标和条件；原生 SVG 保留可检查的节点、token、真实时间轴和细线连接。框图与公式没有虚构测量延迟或新模型实验。

## 平台资料

- `/home/anncatto/Alohamini/README.md` 与 `docs/host-protocol.md`、`docs/training.md`、`docs/lerobot.md`、`docs/ros2.md`、`docs/simulation.md`。核对时 Git HEAD 为 `efff12f`。
- `src/alohamini/learning/processor.py` 的 MIN_MAX 正反变换：跨度小于 `1e-4` 时中心取 min，span 回退2；反变换为 `tensor*(span/2)+center`。擦板底盘常量维的解释来自这一实际路径。
- 用户提供的《AlohaMini_系统设计与实验验证_预览.pdf》及对应 PPTX。只复用整机渲染图，平台框图重新组织；没有将 CAD 源网格带入网页。
- LeRobot 当前官方仓库与 main 文档：<https://github.com/huggingface/lerobot>、<https://huggingface.co/docs/lerobot/main/en/async>。多算法、分布式训练、远程推理、RTC 和动作处理器没有被列作 AlohaMini 独有能力。
- 提供的公开讨论用于恢复 LeRobot 比较重点，事实由上述代码与官方材料核对：<https://chatgpt.com/share/6af16838-fc18-83e8-921f-799ca1a3e6c5>。

## 实验来源

仓库三篇报告为《SmolVLA & 数值类型》《DiT Heads》《OpenWAM & 动作表示》，分别读取各正文片段与已有来源审计。原有媒体直接复用其资产路径。

飞书报告通过用户授权的登录会话只读获取：

1. [地面玩偶收集](https://bcnz96us0h7n.feishu.cn/wiki/PPUzwI6E7ifxsektUeHcrEQ6ngd)：SmolVLA120/150、π0.5及后续模型接入情况。
2. [SmolVLA 数据方案](https://bcnz96us0h7n.feishu.cn/wiki/SfdrwymJciFXkOkHm9UcVxp8nDv)：129回合混合帧率、多光照与39回合高帧率、单光照；150k检查点；50/10动作设置；相机设置和时序筛选。
3. [七巧板模型对照](https://bcnz96us0h7n.feishu.cn/wiki/MWshwDovgiUEcSklfG9cZDMEnse)：π0.5训练90回合、OpenWAM92回合，各10k更新；按来源保留约30%、约60%的现场完成率。
4. [50条擦白板](https://bcnz96us0h7n.feishu.cn/wiki/D80bwEyvAiSOKZkNHPpcyh8xn1e)：40,212帧、两模型10k更新、升降反向、状态替换、底盘常量维和固定维度部署验证。

飞书与仓库对玩偶 SmolVLA 的更新范围存在旧口径差异。本稿沿用已核实的仓库结论：两轮玩偶实验完整模型微调，含VLM；七巧板数据对照是另一实验，按其配置保留冻结VLM。七巧板百分数按本轮确认保留近似值，不补造测试分母。lingb FP16与GR00T运动求解的未完成排查未被包装成已完成修正。

## 关键数字的范围

- 腕部0.60Hz来自SmolVLA120条、100k模型在2026-10-23的episode0，图示16–26s；21次最大变化的统计覆盖全段97.8s的七个通道，每通道三次。
- MTD150条、200k；30步窗口4/10，25与30步差5步，在30Hz下约0.167s。
- 数据时序图使用50个点的49个间隔：`49/11.09≈4.42s`、`49/30≈1.63s`。不将名义30Hz作为历史低帧率回合的真实时间轴。
- OpenWAM分拣为115条，109训练/6验证，三路相机，18维动作/状态投影重建，10k更新。抓取、夹持和释放与目标篮选择分别描述。
- 训练成本比较标明四GPU、有效batch32及参考配置：15.74、32.12、24.43、13.14s/更新；可训练参数6.021B与3.353B。没有把不同训练配方的吞吐差异写成统一学习效率排名。
- 擦板的−19.375、0.168945、0.001465m/s是同图像、同随机种子的离线首步预测；源记录的实际运动反馈与提交目标分别处理。新绘图位置表示绝对值的对数尺度，数值标签保留符号。
- 擦板15次≥15mm目标跳变跨50动作边界；20–120s内按5mm阈值统计目标/观测反向100/72次。
- 修正后3162+2067=5229条记录验证最终底盘三维请求为零、左臂七维目标峰峰值为零。表述限定于保存的请求与目标。

## 图与媒体

- SmolVLA：arXiv2506.01844，主架构局部与完整原图入口；π0.5：arXiv2504.16054。
- MTD页面使用TRI LBM原论文 [Figure9](https://arxiv.org/html/2507.05331v1#S4.F9)，与本次6层/512维、32×18动作的适配设置分开说明。Jones开源实现用于接入背景，没有把其示意图冒充论文原图。
- OpenWAM：arXiv2609.07398图12(a)，保留完整图12入口。
- 飞书原视频、图像及来源文档URL、字节数、SHA256记录在 `content/images/alohamini-work/sources.json`。浏览器会话、凭据、临时HTML和原始飞书流地址未进入仓库。
- `state-ablation.json`保存新数值图的三项来源值；原始飞书图仍保留。
- 采集和核对暂存目录为 `/tmp/alohamini-work-20261109/`，不参与公开构建。

## 浏览与交互

沿用统一标题/章节/来源布局、全屏、目录、键盘翻页、原图查看器和贴底细进度猫。对照视图实际切换实验数据、论文图与视频。控制路径开关分别改变命令/状态线路。离开页面或隐藏视频所在面板会暂停播放。

## 验收（2026-11-09）

- `BASE_PATH=/Anncatto npm run build`、`BASE_PATH=/Anncatto npm run check`通过；835个内部引用、公式与图形检查通过。
- 8页中英文，1440×900、1280×800、1366×768、1920×1080及320/390/768px窄屏，共112个页面状态；无页面横向溢出、桌面纵向溢出、标题相撞或单元格溢出。
- 另检80个标签视图状态；图表卡片内部边界、媒体面板和嵌套七巧板视频切换通过。擦板两列共享网格，短桌面与普通桌面均无上下模块重叠。
- 15段嵌入视频全部成功读取元数据；未自动播放，切页暂停有效。SmolVLA、OpenWAM和擦板完整原图成功解码，Escape关闭后恢复页面。
- 控制通路的三个选择分别保留全部、突出命令、突出状态；路径透明度实际不同。键盘标签选择、8项目录、进入和退出真实全屏通过。
- 新绘四个框图检查中英文文字边界及连线穿越模块情况；未发现越界或穿框。使用截图复查原图大小、图文对齐与首尾页。
- 原有OpenWAM的18页入口与横向边界抽查正常；新样式和交互以`work-*`限定。
- 提示词、制作讨论与占位内容未进入正文或首页摘要。附属来源页保持原生折叠参考资料；无JavaScript时展开全部对照面板。
- 浏览器验收输出位于`/tmp/alohamini-work-20261109/qa.json`、`interactions.json`及`diagrams-final.json`。这些是本地检查产物，不参与公开构建。

## 本地预览

地址：<http://127.0.0.1:5197/Anncatto/notes/alohamini-work/slides/?lang=zh>。

若预览服务停止，在本分支目录运行：

```bash
BASE_PATH=/Anncatto npm run build
BASE_PATH=/Anncatto PORT=5197 node scripts/serve.mjs
```

本轮未推送远端、未更新GitHub Pages。
