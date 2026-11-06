# OpenWAM 动作表示实验来源

核对日期：2026-11-06。文章为《OpenWAM & 动作表示》，沿用用户指定的《SmolVLA & 数值类型》和《DiT Heads》以及[实验文章流程](experimental-article-workflow.md)。主文件在 `content/OpenWAM & 动作表示.html`，正文分为 `content/openwam-slots/` 下九个片段。

## 状态与工作空间

- 用户于 2026-11-06 明确要求修正“更新耗时”的分析结论并发布本文。文章与发布操作均在 `/home/anncatto/Anncatto` 主工作目录进行，沿用同一工作空间，不创建新 worktree。
- 本次发布范围为《OpenWAM & 动作表示》、配套图表/视频/交互及复现与写作流程文档。下文历次校验中“本地未发布稿”描述的是此次发布授权前的状态。
- 工作期间检测到其他会话在维护 OpenWAM 演示及来源记录；未修改、暂存或回退那些文件。
- 当前视频、误差与 517 帧实机记录都属于 recorded18，不属于 alpha80。
- 补充数据训练中为用户提供的状态；没有发布训练步数、数据规模或 GPU 型号的推测。alpha80 待训练。

## 证据与边界

| 正文内容 | 证据 | 采用方式 |
| --- | --- | --- |
| 18 维检查点与训练配置 | color_sort / 010000 的 manifest、训练配置与 safetensors 文件头 | 三个接口矩阵形状、BF16 存储、实际学习率 5e-5、500 warmup、4×8 批量、300 步恢复 |
| 数据集 | 115 episodes / 60,565 rows；训练 109 / 56,750，验证 6 / 3,815 | 不把四路录制相机写成四路训练输入 |
| 基座导入 | AlohaMini 软件 `ac9bab77ac97de0818f351074e85b3630c7cdc68`，OpenWAM adapter / modeling / semantic | recorded 丢弃三个完整投影，alpha80 严格全参数加载；VAE、T5 冻结 |
| 实机记录 | `openwam_eval_fixed_base_20261103_110439`，episode 0，517 rows | Host 时间 31.520 s，底盘零请求；无覆盖前原始底盘预测；反馈是轮速换算 |
| 离线验证 | 六个验证 episode，各 32 查询，seed 0，192 查询 | 5,891 个有效预测步含重叠窗口；逐坐标 MAE，不报告统计独立性或成功率 |
| 底盘常量机制 | 历史 recorded Processor min–max；全 115 条底盘标签严格为零；独立重采样 | span 退化保护使残差成为速度；x 均值负、正负并存，不认定持续前冲偏置 |
| alpha80 | semantic.py 与冻结 FK/IK、标定描述 | 有效槽 0–9、34–43、68–71；辅助区为本地扩展；位置和旋转参考系明确 |
| 两个视频 | 用户提供，逐段抽帧和浏览器播放核对 | 短片成功；长片包含人工补放及末段误投，用户确认该误投即所述失败 |

原始报告和训练审计保留在私人实验工作区。公开 JSON 由显式字段白名单生成，不复制原始审计、绝对路径、远端地址或凭据。

## 算法横向对照

核对同一 AlohaMini 软件提交下的 `src/alohamini/policies/`，并与各目录 SOURCE / vendor、官方固定版本对照。官方链接集中在正文参考资料。

| 算法 | 关键本地文件与检查位置 | 结论 |
| --- | --- | --- |
| OpenWAM | adapter.py initialize；modeling_openwam.py；semantic.py | recorded18 无 80D 中间数组；重建三投影共 115,730 参数；内部 FFN/attention 继承 |
| π0.5 | processor_pi05、tokenizer、modeling、finetuning | 状态先量化文本，动作补 32；机器人基座投影与时间 MLP 继承 |
| SmolVLA | modeling_smolvla；smolvlm_expert | 32D pad，state 960，expert 720；完整基座严格加载；无效动作维损失屏蔽 |
| GR00T | adapter；configuration；action_head；embodiment_conditioned_mlp | 132D；默认新 ID 31 的类别专属投影重置，共享主干保留 |
| Hy-VLA 0.5 | adapter；modeling_hy_vla；dual_tower | 最大 32；state/action 投影 1024；完整基座加载 |
| Spirit 1.5 | modeling；adapter；preset | 最大 32，1536 hidden；TCP 增量，旋转向量；保留投影，归一化缓冲另建 |
| FastWAM | configuration；adapter；wan modular | 接口按实际维度；仅丢弃形状冲突张量，同形状 bias 可保留 |
| LeWM | modeling；vendor module；adapter | 五步展平动作，Conv + MLP 条件视觉预测，CEM；默认非机器人基座 |
| ACT / AMACT / Diffusion / DiTPolicy | adapters 与 configuration | 数据集宽度；默认视觉预训练与动作基座预训练分开表述 |

算法事实描述的是本次本地适配和对应基座，不能推广为所有版本和所有下游项目的默认行为。预训练收益的因果量化尚缺同预算随机初始化对照。

## 公开资产与复现

`scripts/figures/openwam-slots-analysis.py REPORT_DIRECTORY` 读取私人报告，生成：

- `content/images/openwam-slots/validation-mae.svg`：12 个臂关节，Host range_m100_100 单位。
- `fixed-base-feedback.svg`：517 帧 Host 时间，x/y/yaw 分别保留单位。
- `experiment-summary.json`：训练配置、逐坐标指标、固定回合统计与输入 SHA-256。

视频转为 H.264 / yuv420p + AAC，保持原帧率、原速和画面尺寸，启用 faststart。原始与输出哈希、时长见同目录 `media.json`。短片默认展示，长片 native details 默认收起，未复制私人原始文件名。

旋转交互仅计算绕 Z 轴转动的两列矩阵，展示 180° 附近主值角度换支；没有将其宣称为模型预测或真实机器人 FK。

## 校验

- 7 篇文章构建成功，648 个内部引用、公式与 MathML 检查通过。
- 桌面 1440 px 中英文单一 H1、折叠长视频与参考资料、181° 旋转计算通过；390 px 各主要章节无整页横溢出。
- 短片可实际播放。长片时长 285.567 s；本地服务器增加 MP4 MIME 与单段 Range 响应，验证首段、尾段、任意字节段、416 越界及 HEAD；浏览器跳转至 252 s 后可播放。图表放大与 Escape 退出通过。
- 公开成功片段不是成功率调查，长片不是全程正确分类；未来实验占位不使用现有指标填充。


## 结构与分析修订（2026-11-05）

- 标题改为《OpenWAM & 动作表示》，覆盖关节／末端表示、预训练接口与控制分析；URL 保持不变。
- 用户明确要求沿用已有实验报告的外层结构：没有开场总结，理论默认收起。理论主线为关节／末端 → 旋转编码 → 归一化与槽位 → 特征投影，再展开预训练范围 → 接口适配 → 两类微调。
- 正文删除私人运行目录、内部检查点名称和审计叙事；以示教规模、训练步数和评估条件标识实验。
- 删除未验证的位置捷径归因。失败分析依据 4:08–4:21 实际片段：抓取、抬起、释放完成，落点篮子错误；后续颜色／位置交叉测试用于分别测量操作与任务正确性。
- 新增逐预测位置 MAE：12 关节首步 1.984 / 3.192，末步 5.953 / 15.079（模型 / 保持状态）。各位置根据 coordinate_valid 统计，不把重叠窗口当独立样本。
- 新增双臂肩肘／夹爪轨迹与 Host holding 区间。左 7.54–9.86、19.90–22.28 s；右 5.06–7.94、13.82–16.96 s。反馈开口平台结合 holding 解释，不计算未对齐的同帧跟踪误差。
- 新增执行时序：18 次超过 100 ms 的调用占总调用耗时 77.8%；保留 32 步窗口与后续计算／队列标记的对照要求，不将 5.51 ms 写成完整模型推理延迟。
- 脚本接受第二个参数 DATASET_DIRECTORY，读取本地评估 Parquet 与 safety JSONL，按 frame_index 对齐 517 帧并校验 Host 时间。输出新的轨迹、时序、预测时域 SVG 与白名单统计，原始私有文件不复制到公开目录。
- 原始审计仍对应 `openwam_eval_fixed_base_20261103_110439`、`color_sort / 010000`；这些身份只用于维护追溯，不显示在文章正文。


### 本轮验收

7 篇文章构建成功，654 个内部引用及公式检查通过。浏览器确认正文首元素为 details，三个理论章节默认收起，无开场导语；中英文各一个 H1，390 px 无整页横溢出。13 s 失败摘录实际播放通过，新增轨迹图能放大并以 Escape 退出；未出现页面或资源错误。本文仍为本地未发布稿。


## 末端编码与轮速波动复核（2026-11-06）

末端表示的直接依据为 `Alohamini/src/alohamini/datasets/rotations.py`、`field_transforms.py`、`action_transforms.py`、`policies/spirit/preset.py`、`policies/hyvla05/preset.py` 与 `policies/openwam/adapter.py`。共享转换器提供 rotvec、前两行 rotation_6d、前两列 rotation_6d_columns 三种输出。欧拉角与四元数作为一般表示方法介绍，不写成已实现的训练输出选项。Spirit 默认 TCP state / 基座参考系 TCP delta action；Hy-VLA 默认 recorded，TCP 为显式选项；GR00T 文档提供工具参考系、行式 6D 的 TCP 增量配置；OpenWAM alpha80 明确使用绝对 TCP 与列式 6D。

底盘分析按 frame_index 对齐 safety JSONL、Parquet 与 recorded_base.csv，全部 517 帧已提交 x/y/yaw 请求为零。直接读取三轮已解码的 velocity_raw 与 position_raw，按 `hardware/feetech.py`、`runtime/base_control.py`、`kinematics/base.py` 和 `models/alohamini2pro/model.json` 复算：

- 1551 个轮速读数：0 为 1350 个，−50 为 99 个，+50 为 95 个，−100 为 4 个，+100 为 1 个，+150 为 2 个；单位 tick/s。非零读数共 201 个，194 个的绝对值为 50，分布于 170 帧。
- 三轮顺序为 left/back/right。位置初值和末值均为 `[3343, 1310, 2779]`；分别有 513、516、515 帧位于初值 ±1 tick。位置范围依次为 3340–3345、1307–1311、2778–2783。
- 换算采用 4096 tick/转、轮半径 0.063 m、底盘半径 0.195 m、轮轴角 150°/−90°/30°；50 tick/s 对应轮缘速度 4.832039482 mm/s。仅左轮为 +50 时，底盘为 +2.789779296 mm/s、−1.610679827 mm/s、+0.473257212 deg/s。
- 7.840044477 s 的轮速为 `[−50, +50, +150]`，对应 x = −11.159117334 mm/s、yaw = +1.419771671 deg/s；y 接近浮点零。
- 重算最大绝对差：x = 1.513e−10 m/s，y = 1.054e−10 m/s，yaw = 3.668e−8 deg/s。正文解释的是离散反馈和运动学混合造成的曲线形态，不把未测量的机械振动、控制器震荡或编码器噪声写成已确认的物理成因，也不从固定底盘回合推断未固定回合的持续前冲。

复现脚本新增 `wheel_feedback_analysis`，保留频数、位置范围、几何系数、峰值、对齐误差和源文件哈希。新增 `wheel-feedback-detail.svg` 展示 7.30–8.30 s 的原始轮速与相对初始轮位置；全程底盘图用淡灰区标出这一时间窗。轮速 tick/s 是当前 Host 的解码约定；50 tick/s 是此记录实测的最小非零步长，不据此推断固件内部采样周期。

## 下一轮在线采集协议

此协议是后续实验执行要求，未表示采集器已改造或新回合已执行。沿用颜色与位置交叉测试、底盘固定、相同控制频率与释放判定，比较补充数据后的 18 维模型与待训练的 alpha80 模型。完整链路数据写入原始实验产物，不把采集安排列入公开正文。

| 阶段 | 保存内容 | 对齐标识 |
| --- | --- | --- |
| 模型采样 | 观察状态与图像引用、归一化空间的完整预测 chunk、动作字段/单位及掩码、模型与处理器版本 | episode_id、observation_id、chunk_id、生成开始/结束时间 |
| 单步执行 | chunk 内原始预测、反归一化结果、alpha80 的 IK 输出、固定覆盖/限幅后的最终请求；各数组独立复制，不能被后续原地覆盖 | chunk_id、chunk_step、command_sequence、请求发送时间 |
| Host 接受 | 实际接受的臂/夹爪/升降目标、底盘三维速度和最终轮速目标；拒绝原因单独记事件 | command_sequence、Host 接收/接受时间 |
| 随后反馈 | 轮速与轮位置原始读数、换算后的底盘速度、关节/夹爪反馈、holding 状态与有效性 | 最近接受的 command_sequence、Host 采样起止时间 |
| 独立运动观测 | 若区分底盘的实际位移与轮反馈波动，增加固定机位对底盘标记的观测；保留时间同步与测量精度 | 同步事件或已估计的时钟偏移与误差 |

计算端与 Host 分别保存单调时钟和时钟来源，跨机器延迟只有经过同步或时钟偏移估计后才计算。按 command_sequence 将目标与接受后的反馈对应，按 chunk_id 区分重新推理和队列取值；分别统计完整采样耗时、队列等待与发送周期。

采集验收：抽查至少一次新 chunk 和一次队列取值，能够从原始预测逐阶段重建最终请求；固定底盘后的请求严格为零且覆盖前预测仍可读；Host 接受记录含底盘和轮速目标；反馈时刻晚于用于比较的目标接受时刻。原始回合保持底盘固定即可验证模型残差和记录完整性，不需要为收集诊断数据解除底盘约束。


### 本次校验

新增轮速统计和反馈重算断言通过，公开汇总与两张底盘图已重新生成。7 篇文章构建成功，674 个内部引用及公式检查通过。浏览器检查中英文五种位姿表示、替换后的投影说明、轮速图放大与 Escape 退出均通过；390 px 下五个相关章节均无整页横向溢出，页面与资源无错误。原“完整诊断应同时记录……”段落及“物理语义在投影之前由数据契约规定……”句已删除。改动保留在主工作目录的本地草稿，未提交、未推送、未发布。


## 状态与文本条件的数据流

训练配置的 state 选择为 joint_position,base_velocity,lift_height；评估 meta/info.json 的 observation.state 为 18 维：双臂各 6 关节与 1 夹爪、底盘三速度、升降高度。modeling_openwam.py::_encode 仅将 task 送入 tokenizer/T5；forward 与 predict_action_chunk 将 observation.state 作为 proprio 传入网络。architectures/base.py::_init_proprio_context 创建 Linear(state_dim,4096)，_append_proprio_context_token 经 unsqueeze(1) 后沿 dim=1 追加到 context，并同步扩展掩码。官方固定版本 3dfc9a7 的相同文件已对照。

joint_self_attn.py 将合并序列同时交给视频 prepare 与动作 prepare_state；两条分支各自通过 text_embedding 条件投影和交叉注意力读取。正文采用 L×4096 加 1×4096 得 (L+1)×4096 的公式，明确 18 维是当前反馈、80 维为 alpha80 的 FK 后状态接口；状态投影输出仍为一个 token。文本序列可能含 padding，掩码仍按真实有效位置生效。

本节更新已通过构建与 690 个内部引用检查。中英文桌面与 390 px 手机页面均无整页横向溢出，新增矩阵公式无渲染错误；仍为未提交的本地稿。

## 训练开销与右臂姿态（2026-11-06）

### 原始材料

只读采集 GPU 服务器的配置、逐步 JSONL、日志和 safetensors 头部，没有加载完整模型、启动训练或占用额外 GPU。原件存放于 `/home/anncatto/Alohamini_workspace/reports/openwam_training_comparison_20261106/sources/`；服务器连接凭据不写入文件。四组完整全参训练按以下原始目录识别，正文仅使用相机数、示教规模和计算配置：

- `openwam_color_sort_4gpu_20261028_b8`：取初始 metrics 的 1–300 步，加 `metrics-from-300-1793180460080378383.jsonl` 的 301–10000；舍弃回退覆盖的 301–340 和失败恢复记录。
- `pi05_full_flow_230_4gpu_b32_20261028`：原始目录位于 xyc，下有完整 1–10000 步指标。
- `pi05_module_to_shape_12_flow_full_3cam_90train6val_b32_span035_20261101`：完整 1–10000 步。此前无 span floor 的 366 步启动段不并入该组。
- `pi05_whiteboard50_full_fsdp2_4gpu_10k_01`：初始 1–6000 步，加 `metrics-from-6000-1793093834902573065.jsonl`；舍弃原分支 6001–6052。

四组均为四卡 FSDP2、有效 batch 32，硬件服务器为 RTX 4090 D。图表取 500–10000 步（每组 9501 次），计时字段为 update_s，不以进度条瞬时速度代替。中位数依次 15.735659、32.123607、24.430253、13.136952 s；10k 次更新累计 45.085121、90.598174、68.800996、36.750571 h。未将验证/保存/启动混入更新耗时。WAM 成功恢复段的 update_s 合计 43.715013 h；最后训练循环进度条 54:33:26。其后 End of training 时间为 2026-10-31 07:21:47，还包含循环外评估/收尾，不将该时间当成完成优化器更新的时刻。

### 参数与计算路径

WAM 日志计数：total 12,406,373,102，trainable 6,020,774,098；与 safetensors 元素数一致。视频 DiT 4,999,787,712；动作 DiT 1,020,908,562；状态投影 77,824；冻结 T5 5,680,910,336，冻结 VAE 704,688,668。全部存储 BF16。π0.5：total 3,616,757,520，trainable 3,353,433,872；视觉及投影 414,803,696，语言 2,508,531,712，动作/投影/时间条件 430,098,464；冻结未使用 expert lm_head 263,323,648。BF16 3,497,036,912，FP32 119,720,608。不能把 mixed_precision=none 写成纯 FP32。

训练版本 d3f5262 的 gemma_pytorch.py、sharding.py、OpenWAM mot_driver.py 已与本地对应实现核对：π0.5 联合注意力使用 eager_attention_forward；WAM 使用 SDPA；FSDP2 按模块 reshard_after_forward，梯度归约 FP32。没有 profiler 记录，因此不宣称某个 FlashAttention 内核已生效，也不对单个因素分配加速百分比。两模型更新速度之比是不同任务与配置下的观测值，不是同任务架构消融。

token 计数由实际配置推导：OpenWAM 9 帧 384×320 画布，VAE 时间因子 4、空间因子 16，latent patch 1×2×2，得到 3×12×10=360 个视频位置与 32 动作位置；文本 512 与状态 token 走条件交叉注意力。π0.5 网络预处理为 224×224、patch 14，每相机 256 个位置，文本/离散状态固定 200，动作 50，四相机共 1274、三相机共 1018；这些长度包含有 mask 的补齐位置。WAM 更新视频/动作分支，VAE/T5 仅前向；π0.5 全参更新视觉、语言、动作分支。层宽与层数不同，位置数不直接等于 FLOPs。

### 腕部统计

来源 `/home/anncatto/Alohamini_workspace/diagnostics/openwam-live-20261102/grasp/`：findings.json、closing-events.json、replay-transition-results.npz、tracking-pose-summary.json。使用的是 11 月 2 日 4938 帧固定底盘回合，与正文原有 11 月 3 日 517 帧轨迹不同，已在新节明确标识。

10 个示教状态各 3 种子；图选 episode 0/frame 50 的完整 32 步预测。坐标 10 为 arm_right_wrist_flex.pos，示教端点 42.7751→15.0239；三种子均值 41.5682→17.3239。阴影为 3 个种子的逐步 min/max，不是置信区间。

闭合候选按 closing-events 中 z<0.51 筛选，位姿采用已标定 FK 与 upright_forward。所选示教事件均不属于六个验证回合；候选总数左179/右215、实机左19/右33。候选倾角统计复算与原摘要一致：示教左80.49°/右67.34°，实机左80.42°/右72.64°；右臂 P10–P90 分别47.918–76.940°、58.038–82.738°。角度定义为工具前向相对水平面朝下的倾角，不将右腕 Host 数值当成度数。指令/反馈角度采用 tracking_summary 中相同候选窗口，分别72.99°/72.07°；仅据此说明向下姿态已出现在目标端，不用同帧差构造跟踪误差。

### 复现与后续对照

运行：

```sh
/home/anncatto/miniconda3/envs/alohamini/bin/python scripts/figures/openwam-training-analysis.py /home/anncatto/Alohamini_workspace/reports/openwam_training_comparison_20261106 /home/anncatto/Alohamini_workspace/diagnostics/openwam-live-20261102/grasp
```

输出 training-cost.svg、wrist-pose-analysis.svg 和白名单 training-pose-summary.json。摘要保留统计口径、有效范围、参数分组与匿名来源标签的 SHA-256，不复制训练配置的私人路径、模型权重或连接凭据。

效率对照先固定任务、三相机、软件、有效 batch 32；同一算法分别测试每卡 batch/累积与重计算，记录更新/数据等待/通信和评估保存时间及峰值显存。注意力替换先检查数值与掩码等价，再计时。当前没有启动这些对照。

姿态对照固定积木/篮子布局与复位状态，分别改变曝光设置、初始关节姿态和控制节奏；沿用闭合候选倾角统计，同时人工标注抓取完成和篮子正确性。每回合记录条件和全过程，不把自动候选数当成独立成功试验数。alpha80 对照应保持相同数据与底盘约束，单独测量朝向误差及 IK 可行率，不能预设改为末端接口就会固定抓取方向。

本次验收：两张新图与统计摘要成功生成，恢复谱系的 1–10000 步连续性、参数数量、回放端点和倾角统计断言通过。7 篇文章构建成功，701 个内部引用及 MathML 检查通过；中英文新增章节在 390 px 无整页横溢出，两张图均可放大并用 Escape 退出，页面与资源无错误。保留原来的三个默认折叠理论章节与单一 H1。文章仍在主工作目录 main 的未提交草稿中，未推送或发布。


## 发布结论修订（2026-11-06）

“更新耗时”明确报告中位步时降低 51.0% / 35.6%，结论限定为当前输入与执行配置的更新成本。补充每次更新均处理 32 样本，示教总数不会直接改变计算批量；把 VAE 压缩、更新模块、微批累积与序列长度连接到后续计算分析，同时保留没有分离单因素贡献的边界。13.14 s 的 π0.5 参照保留，避免宣称 WAM 架构必然更快；更新耗时与达到相同成功率的训练预算分开。用户已明确授权提交、推送并发布。

发布前校验：7 篇文章构建、701 个内部引用及公式检查通过，158 项测试全部通过。中英文 390 px 无整页横向溢出；成功片段、失败摘录和完整连续记录均可播放，长片跳转至 252 s 正常；旋转交互在 181° 显示主值 −179°。发布目标为 GitHub Pages 的 `/Anncatto/notes/openwam-action-slots/`，发布日期为 2026-11-06。

## 训练开销措辞修订（2026-11-06）

按用户要求，中英文训练开销章节改为正面陈述实测结果、模块作用与执行配置。删除“已有记录没有单独测出贡献”等反复边界声明；用具体比较条件、13.14 s 参照与更新/完整循环计时定义保留结论范围。各因素同时变化，历史运行支持整组配置的比较；单因素贡献的控制变量方案保留于前述实验协议。所有测量数据与图表保持一致。同步将这一语言要求写入实验文章工作流。

本轮校验：7 篇文章构建及 701 个内部引用检查通过；中英文在 1440 px 与 390 px 下正文和计时数字正确，整页无横向溢出，公式与资源无错误。
