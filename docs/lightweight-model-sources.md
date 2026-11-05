# 轻量化工具的参考机器人模型

来源核对日期：2026-11-02；公开构建范围更新于 2026-11-05，见[交接](lightweight-tool-handoff.md)。本文记录来源、版本和接入条件；当前控制与测试口径见[运动载荷与闭环验证](lightweight-control.md)。

## 选择结果与当前状态

- 人形首选 **RoboParty RP1 24 自由度版**，28 自由度版留作后续扩展。官方名称为 RP1，用户提到的 PR1 对应此项目。
- 四足首选 **Unitree Go2 官方模型**，**DeepRobotics Lite3** 为备选。依据是模型数据、许可、控制配置和仿真／实机接口的可追溯程度，而非发布日期或外观。
- 已完成固定版本源文件、显示网格、完整关节树和惯量的本地接入；页面可选择 Go2／RP1，运动、载荷、物理碰撞与导出使用所选源模型。RP1 已验证浏览器物理回放的数据链，证据见下文；现有参数化模型的测试结果不能转移给源模型。没有下载运行策略权重、训练或部署到真机。
- RP1 模型仓库的具体许可尚未明确。本地资产置于 `public/models/rp1-24/` 供本地调试，附 `NOTICE` 与 `source.localOnly=true`；没有发布，不纳入线上维护或可分发版本。

## 本地资产导入

脚本 [`scripts/models/import-source-robots.py`](../scripts/models/import-source-robots.py) 使用现有 `alohamini` 环境的 NumPy，不安装新依赖。固定文件清单、字节数和 Git blob SHA 记录在 [`source-robots.lock.json`](../scripts/models/source-robots.lock.json)，只获取原 URDF 及实际引用资源，不下载整个仓库。GitHub API 返回固定提交原字节，每个文件校验后才写入；已有文件哈希不符时拒绝覆盖。

```sh
/home/anncatto/miniconda3/envs/alohamini/bin/python scripts/models/import-source-robots.py
# 已取得源文件后，无网络复现：
/home/anncatto/miniconda3/envs/alohamini/bin/python scripts/models/import-source-robots.py --offline
```

每个 `public/models/{go2,rp1-24}/` 包含：原目录结构的 `source/`、原字节 `source.urdf`、`robot.glb`、`description.json`、`provenance.json`、`NOTICE`；Go2 另保留上游 `LICENSE`。生成的 [`src/source-robot-data.ts`](../src/source-robot-data.ts) 导出 `go2Description`、`rp1Description`。

- `links` 保留原刚体、质量、质心、惯性坐标与完整张量；`joints` 保留 parent/child、原点旋转、轴、限位和源 dynamics。物理 Link 不合并，视觉子组件不伪装成额外关节或附加质量。
- `visuals`、`collisions` 保留原局部位姿和 mesh／box／cylinder／sphere。每个 mesh 同时记录原 filename、完整本地 asset 和 VFS 路径；`source.collisionAssets` 给出 `{vfsPath,path}`。RP1 的 22 个网格碰撞文件为原 STL，另有 14 个圆柱；Go2 为 5 个 box、17 个 cylinder、5 个 sphere。
- GLB 顶层 Group 名称对应原 Link，内部已应用原 visual origin、scale 和 COLLADA 内部矩阵；整个 Group 仍处于该 Link 局部坐标，运行时只施加 FK。源 diffuse 颜色保留，STL 法线为显示重算；没有减面。各 Link 的 `visualBounds` 已包含全部内部变换。
- Go2 7 个 DAE 为 25,932,493 字节，196,836 个独立视觉三角形；重复腿部实例后为 398,632 个三角形，GLB **5,595,892 字节**。RP1 最小源网格集为 30 个 STL、44,369,220 字节，其中 29 个用于显示；819,199 个显示三角形全部保留，GLB **19,891,140 字节**。

导入验收：逐源核对全部质量／惯量、源三角形计数；索引重建位置与源 float32 坐标一致。独立使用 Three 官方 ColladaLoader／STLLoader 读取源资源，与 GLTFLoader 结果逐 Link 核对三角形数量、位姿变换后的包围盒及 `visualBounds`，全部通过，记录 `/tmp/lightweight-source-mesh-check.json`。离线重建所有 GLB／JSON／TS 与首次输出逐字节哈希一致，记录 `/tmp/lightweight-source-reproducibility.json`。这些是资产与坐标验证，不是接触动力学或真机验证。

### 页面与物理模型

[`src/source-robot.ts`](../src/source-robot.ts) 将源关节树映射到工具坐标；原 Link 质量和惯量逐项保留，固定附件与视觉子组件分开。显示使用完整 GLB Link Group，保留内部变换和材质。选择关节不改变源模型的几何或质量。

[`src/source-physics.ts`](../src/source-physics.ts) 将 RP1 的 22 个原碰撞 STL 加载至 MuJoCo VFS，源圆柱碰撞同时保留。MuJoCo 使用这些网格的凸包；这不等于任意凹网格的精确接触。Go2 直接使用源碰撞基本体。源模型的质量／惯量、URDF effort／velocity 与本工具的轨迹和控制器分别记录；没有接入 RoboLab 或 Unitree 的训练策略。RP1 已声明的逐关节 armature、阻尼和摩擦均已导入；Go2 源 URDF 没有这些声明。未接入的执行器曲线与未确定的弹性截面，应按下文逐字段追踪，不能统一称为“无法取得”。

### 运行验证

2026-11-02 的[闭环证据](lightweight-validation.json)记录完整模型、源提交、解析后的动作参数、代码哈希与判据结果。误差按同一积分时刻的参考和实际状态计算。采用 MuJoCo 3.17.0、100 Hz 限转矩全身控制和 500 Hz 物理积分，各工况运行 10.01 s，地面摩擦系数 0.7。

| 模型 | 周期／每周期前进／抬足 | 躯干位置 RMS | 最大速度利用率 | 接触切向速度峰值 | 名义工况 |
| --- | --- | ---: | ---: | ---: | --- |
| Go2 | 3.2 s／102.24 mm／27.69 mm | 7.080 mm | 7.542% | 48.525 mm/s | 通过 |
| RP1 24 | 2.4 s／60 mm／25 mm | 0.927 mm | 21.231% | 12.791 mm/s | 通过 |

这些结果只覆盖表中的模型和名义工况。Go2 的接触切向速度已接近当前 50 mm/s 判据。RP1 固定抬足 25 mm、摩擦系数 0.7，扫描周期 2.0／2.4／2.8 s 与前进 60／90 mm 的六种组合，仅上表这一点通过；尚未确定可稳定工作的参数范围。参数扫描的复现脚本为 [`scripts/evaluate-lightweight-source-sweep.mjs`](../scripts/evaluate-lightweight-source-sweep.mjs)，结果见[RP1 六组动作扫描](lightweight-source-sweep.json)。源码更改后应重新编译并重跑，不复用旧报告。

RP1 浏览器独立检查包含：原 URDF 固定提交链接；22 个碰撞 STL 的实际 worker 网络请求全部成功；物理回放 24 行关节角、速度和转矩与积分样本逐项相符；导出 GLB 保留 29 个源视觉 Mesh，全部 25 个物理 Link 的完整姿态矩阵与选中积分样本相符；普通模型 JSON 和仿真报告均记录解析后的 `motion` 及源提交。浏览器结果与命令行名义工况一致，未出现页面异常。回放报告为 `/tmp/lightweight-rp1-browser-report.json`，对应显示导出为 `/tmp/lightweight-rp1-browser-replay.glb`；临时文件不是长期源资产。

浏览器另核对了参数修改和未通过工况：修改动作后立即移除旧回放与仿真报告入口；2.4 s／90 mm／25 mm 工况结束后，worker 只发送 `type` 和 `token`，不向页面返回未通过报告。页面只保留当前状态提示，没有失败详情、回放或报告导出；普通 JSON 和浏览器存储均未含失败报告或样本。此路径记录为 `/tmp/lightweight-rp1-unverified-ui.json`。内部回归证据仍用于维护，不能从工程记录中删掉未通过工况来扩大有效范围。

尚未执行带传感器噪声、状态估计、延迟、参数误差及外扰的系统性验证，也没有实机测试；所有报告保持 `hardwareValidated=false`。源 CAD 缺少弹性截面时保持 `elasticSectionDefined=false`，不将刚体运动测试称为结构强度验证。

## 人形：RoboParty RP1

官方[平台入口](https://github.com/Roboparty/RP1/blob/main/README.md)链接到 `Roboparty/rp1_description`。本次固定 `master` 提交 **`8c12d13ae05143bc1f67f51f1046ddb14cc9d112`**，提交于 2026-10-28。

| 源文件 | Link 数 | 动力关节数 | 源质量求和 | 含惯量的 Link | 含碰撞几何的 Link |
| --- | ---: | ---: | ---: | ---: | ---: |
| [`urdf/rp1_24dof.urdf`](https://github.com/Roboparty/rp1_description/blob/8c12d13ae05143bc1f67f51f1046ddb14cc9d112/urdf/rp1_24dof.urdf) | 25 | 24 | 39.10931784 kg | 25 | 24 |
| [`urdf/rp1.urdf`](https://github.com/Roboparty/rp1_description/blob/8c12d13ae05143bc1f67f51f1046ddb14cc9d112/urdf/rp1.urdf) | 29 | 28 | 40.72637536 kg | 29 | 28 |

两个版本的 `base_link` 均没有碰撞几何；不能仅凭其他 Link 带有 collision 就宣称全身碰撞已覆盖。24 自由度版为双腿各 6、腰部 2、双臂各 5；28 自由度版每侧增加两个腕部自由度。质量为 XML 求和，不是整机称重或辨识结果。

按源 `origin xyz/rpy` 完整旋转递推，在所有关节为零时，左右 `ankle_roll_link` 原点的 Y 坐标为约 +0.124243 m、−0.130267 m，横向轴距 **254.510 mm**。这是该模型零位的踝轴距离，不是推荐步宽、足内缘净距或动态行走轨迹；不能直接拿它替换现有不同尺寸人形的足间距。

本次早期只读文本副本为 `/tmp/rp1_24dof.urdf`、`/tmp/rp1.urdf`；临时文件不作为长期资产入口。其 SHA-256 分别为：

```text
rp1_24dof.urdf  1aa280de152eff1fb394f756c8f43bcf71cc6d8778c0c73fb7511cfb2cadb36a
rp1.urdf        c5874f0f324d4780a3d666d5924b3cd2d7bb83e02eb0437828f705af81e9616e
```

`rp1_24dof.urdf` 的上述文本副本比固定提交原件多一个末尾换行。实际导入资产 `public/models/rp1-24/source.urdf` 保留上游原字节，SHA-256 为 **`d0c86d45773974d91445b728d148ecec965267746ec73e71afc6a7ffbce708d5`**，与 `provenance.json` 一致。后续结构配准和数值配置绑定此原字节哈希。

许可核对：固定提交的模型仓库未发现 `LICENSE` 或 `README`；GitHub 仓库许可字段为空。RP1 平台主仓库虽标 GPL-3.0，但其 README 明确要求按各子仓库许可处理，**不能将主仓库 GPL 自动套给模型和网格**。

### 对应控制配置

官方 `Roboparty/robolab` 本次固定 **`3f45783c76723236c2b2299a2a99f12fd84bca4b`**。其 `data/robots/roboparty/rp1` 子模块恰好固定到上述模型提交，提供了明确的版本配对。

[`robolab/assets/robots/roboparty.py`](https://github.com/Roboparty/robolab/blob/3f45783c76723236c2b2299a2a99f12fd84bca4b/robolab/assets/robots/roboparty.py) 中的 `RP1_24DOF_CFG` 实际读取 **`mjcf/robot_24dof.xml`**。它定义关节／刚体顺序、左右轴符号不同的初始姿态、自碰撞、PD 增益、按关节组设置的转矩—转速参数、armature、摩擦和 0–2 控制步延迟。不能把当前 URDF 与任意旧版本控制配置拼接，也不能统一镜像左右关节角。

四组执行器参数如下，转矩均在关节输出侧，角速度单位为 rad/s，armature 单位为 kg·m²：

| 关节组 | 峰值／额定转矩 N·m | 最高／恒峰值区终点速度 | 额定工作点速度 | armature | 官方 PD 的 Kp／Kd |
| --- | ---: | ---: | ---: | ---: | ---: |
| 腰、髋俯仰／侧摆、膝 | 140／44 | 13.61357／8.37758 | 8.37758 | 0.02908560 | 120／7.5 |
| 髋偏航、肩俯仰 | 55／14 | 16.23156／6.28319 | 6.28319 | 0.00884000 | 35／2.5 |
| 踝俯仰／侧摆 | 64／20 | 15.70796／14.66077 | 6.28319 | 0.006266268 | 25／1.5 |
| 肩侧摆／偏航、肘、腕 | 32／10 | 15.70796／14.66077 | 6.28319 | 0.00313313 | 12.5／0.75 |

当前 24 轴 URDF 的四组 armature 与上表一致，每个活动关节还声明 `damping=0.01`、`friction=0.1`，已经由 `source-robot.ts` 导入。表中 PD 的 Kd 是反馈增益，不能拿来替换被动黏性阻尼。源干摩擦在实际约束积分中生效；关闭约束的参考逆动力学没有包含该项，详见[控制口径](lightweight-control.md)。

[`roboparty_actuators.py`](https://github.com/Roboparty/robolab/blob/3f45783c76723236c2b2299a2a99f12fd84bca4b/robolab/assets/robots/roboparty_actuators.py) 实现正反向四象限力矩—转速裁剪，并将上述曲线称为测量参数；这两份文件没有附原始台架记录、测试电压／温度或不确定度。本工具尚未采用该包络、额定工作点及延迟模型。`rated_effort`／`rated_velocity` 在该类中是可查询属性，裁剪采用峰值、平台终点和最高速度，**不是持续时间或热衰减模型**。0–2 步延迟必须按所用控制周期换算；RoboLab 的其他摩擦字段也需按具体后端核对语义。

这是可以优先接入的同源官方执行器配置：保留上述两个提交、按原关节名映射，单列执行器配置版本，再比较 MJCF／URDF 的关节假设并重跑验证。本轮只盘点与修正来源说明，没有更改控制模型或挪用旧测试结果。

[`tasks/direct/base/__init__.py`](https://github.com/Roboparty/robolab/blob/3f45783c76723236c2b2299a2a99f12fd84bca4b/robolab/tasks/direct/base/__init__.py) 注册了 `RP1-Flat`、`RP1-Rough`；仓库另有 AMP、BeyondMimic 和 Parkour 任务。任务存在不代表当前网页已运行这些控制器或获得匹配的可部署策略。

## 四足：Unitree Go2

官方 `unitreerobotics/unitree_ros` 固定 **`3ae893d905d11795ddf1075825ee5010364a1109`**，提交于 2026-10-30；[URDF](https://github.com/unitreerobotics/unitree_ros/blob/3ae893d905d11795ddf1075825ee5010364a1109/robots/go2_description/urdf/go2_description.urdf) 与[BSD-3-Clause 许可](https://github.com/unitreerobotics/unitree_ros/blob/3ae893d905d11795ddf1075825ee5010364a1109/LICENSE)均已读取。

- 42 个 Link、41 个关节，其中 12 个动力关节、29 个固定关节；源质量求和 **16.087 kg**。保留无质量传感器帧和固定附件，不能用宣传中的整机近似质量覆盖源数据。
- 具有质量、完整惯量、关节位置／速度／转矩限值和简化碰撞几何。视觉资源使用 `package://go2_description/dae/*.dae`，必须连同资源目录及许可保留。
- +X 为前方；前、后髋 X 分别为 ±0.1934 m，四腿 thigh/calf 轴均为 +Y。官方控制初始化 thigh=+0.9、calf=−1.8 rad，对应膝位于髋后方，可用于核对概念模型的膝向和前向。
- URDF 声明 hip/thigh 上限 23.7 N·m、30.1 rad/s，calf 为 45.43 N·m、15.70 rad/s。effort 不是连续／10 s／2 s 热额定证明。固定转子 Link 也不能直接等同于正确实现了转子随减速比耦合的动力学，更不能重复叠加未经核对的 `N²Jm`。

### 仿真与控制版本

| 来源 | 已读取的内容 | 接入要求 |
| --- | --- | --- |
| [官方 unitree_rl_mjlab](https://github.com/unitreerobotics/unitree_rl_mjlab/tree/1425b15f73bd4095f0df53709d7c389c3eb9e790) | 固定提交 `1425b15f73bd4095f0df53709d7c389c3eb9e790`；Go2 速度跟踪，FR/FL/RR/RL 相位 `[0,.5,.5,0]`，对角小跑；有接触与足滑动任务 | 使用匹配模型、动作尺度、观测和关节映射；本次未在该源码树发现 Go2 ONNX 权重 |
| [Go2 驱动配置](https://github.com/unitreerobotics/unitree_rl_mjlab/blob/1425b15f73bd4095f0df53709d7c389c3eb9e790/src/assets/robots/unitree_go2/go2_constants.py) | 23.5／45 N·m，armature .01／.02，PD20/1与40/2；原设置排除自碰撞 | 与 URDF 23.7／45.43 上限略有差别，必须注明所采用的配置；不能据此声称已检验自碰撞 |
| [Go2 部署 YAML](https://github.com/unitreerobotics/unitree_rl_mjlab/blob/1425b15f73bd4095f0df53709d7c389c3eb9e790/deploy/robots/go2/config/policy/velocity/v0/params/deploy.yaml) | 50 Hz、关节顺序映射、默认角、观测量及动作缩放 | 模型、策略、配置共同固定；URDF 自身不包含稳定步态 |
| [官方 unitree_mujoco](https://github.com/unitreerobotics/unitree_mujoco/tree/1eb6642e3f3fdfb7fb13a9794fd6a2dd93ea0e7d) | 固定提交 `1eb6642e3f3fdfb7fb13a9794fd6a2dd93ea0e7d`；`unitree_robots/go2/go2.xml`、SDK2 低层控制接口、仿真部署 | 用于匹配接口的 sim-to-sim；不能当作机器狗内置运动服务的完整复制 |
| [DeepMind Menagerie Go2](https://github.com/google-deepmind/mujoco_menagerie/blob/main/unitree_go2/README.md) | BSD-3-Clause；从官方 URDF 派生 MJCF，明确记录软足接触、摩擦、自由基座等修改；MJX 版碰撞另有简化 | 可作独立交叉核对。后续接入必须再固定提交，不与其他模型参数无记录混搭 |

上述 mjlab 的 [Go2 XML](https://github.com/unitreerobotics/unitree_rl_mjlab/blob/1425b15f73bd4095f0df53709d7c389c3eb9e790/src/assets/robots/unitree_go2/xmls/go2.xml) 有 13 个显式惯性体，质量求和 **15.206408 kg**，与当前 ROS URDF 的 **16.087 kg** 不同。其髋／大腿 armature 为 0.01、小腿为 0.02 kg·m²，是可复现的官方仿真输入；文件没有给出独立电机辨识过程。可以增加完整的 mjlab 模型／执行器配置，或明确记录跨模型转用假设，不能把数值直接填入当前 URDF 后仍称其为原模型声明。该配置使用位置执行器，没有提供 Go2 的电流、热容量或完整力矩—转速曲线。

## 缺失字段的具体盘点

“当前计算未知”只说明本工具尚无足够输入。应继续查同版本描述包、控制配置、厂家规格、装配 CAD 和 BOM，并区分资料声明、几何推导与实物辨识。

| 字段 | 已导入 | 可从现有资料补充 | 仍需的证据或处理 |
| --- | --- | --- | --- |
| 关节轴、原点、限位、碰撞 | Go2／RP1 原关节树、限位和源碰撞；Aloha 原关节变换与限位 | CAD 装配约束、官方初始位、标定配置可交叉核对 | 模型轴／零位不等于实际编码器已标定；足底接触仍受碰撞近似影响 |
| 质量、COM、完整惯性张量 | 三类原描述数据；Aloha 当前含工程估计分配 | CAD 质量属性、BOM 密度／部件质量，可重新汇总并保留版本 | 必须确定每个零件属于哪个运动刚体，应用坐标变换和平行轴定理，防止总成／舵盘重复计量 |
| 附加惯量、阻尼、摩擦 | RP1 的源声明已导入；Go2 未声明；Aloha 未建立完整执行器模型 | RP1 同源控制配置；Go2 另一官方仿真配置；Aloha CAD 可给部分外部转动件惯量 | 整机或舵机外壳惯量不等于内部转子反射惯量；摩擦与反驱实际值需台架辨识 |
| 力矩—转速、额定点、增益、延迟 | 目前主要按源 effort／velocity 限制；没有官方策略 | RP1 同源四象限包络与额定点；Go2 官方仿真增益；Aloha 电机型号与厂家规格 | 区分峰值、堵转、连续额定、空载转速；增益不是机械刚度，延迟步数不是固定毫秒数 |
| 承力件与电机质量拆分 | Go2／RP1 未拆；参数化构型有显式部件 | 装配 CAD 与逐件 BOM 可以拆分；本地 Aloha 已有部件绑定结果 | 视觉 STL 不含可靠的材料、内部电机分件和驱动归属；拆分质量和惯量须与总成闭合 |
| 截面、材料、刚度、强度、模态 | 源腿模型未建立弹性结构；参数化构型可计算 | 有壁厚和零件边界的实体 CAD 可算 A、I、扭转截面量；材料牌号、工艺和手册可供 E、ρ、强度 | 打印填充／方向、层合板铺层、螺栓与轴承连接、输出柔顺需另建模；任意复杂壳体不能直接等同单根梁 |
| 热、电流、能效、真实稳定范围 | 没有完整热模型或硬件验证 | 厂家额定点、保护阈值、电机／驱动器规格可给名义边界 | 温升与冷却、效率随工况变化、接触摩擦、通信延迟、噪声与扰动需对应工况试验；已有名义仿真不覆盖这些问题 |

现在可以不改动力学就补齐逐字段来源／状态、RP1 已有 armature 显示和 Aloha 电机型号。下一步加入 RP1 官方曲线时保持配对版本并重新验证；Go2 使用独立完整配置；Aloha CAD 惯量作为有哈希的新配置导入。任何“由资料推导”的数值都保留原件、单位、公式和假设，不能改标为实测。

### AlohaMini：本地资料能补到什么程度

2026-11-03 核对本地 `/home/anncatto/Alohamini` 的 `feat/libero-dynamics`，HEAD **`7d9b4b64efa4a160e415c81292d138632f69410b`**。保留该仓库未提交工作，没有切分支或修改源仓库。其 [`models/alohamini2pro/provenance.json`](/home/anncatto/Alohamini/models/alohamini2pro/provenance.json) 记录描述源为 `alohamini_ros2` **`8bd733cef109156ad5e2efe3890d154afdf94b39`**、Apache-2.0；当前完整 URDF SHA-256 为 `8459353ebc6af5800d809b96566b5073a7fcff880c67171ab07a0bd2f98ffee6`。工具使用 `left_Base` 子树。

| 本地证据 | 已核对内容 | 工具状态／接入条件 |
| --- | --- | --- |
| [`model.json`](/home/anncatto/Alohamini/models/alohamini2pro/model.json)，asset_revision 4，SHA-256 `7de62801e6b21eeb611778fd10ac83a7710871d75e7c886c0c6c37c4d8471df6` | 每臂肩转、三腕轴、夹爪为 5 个 STS3250；肩抬与肘为 2 个 STS3095 | 型号映射可补，文件未指定 STS3095 的电压／C001、C002 后缀；不能套用标准版 AlohaMini2 的电机 BOM |
| [`physical_parameters.yaml`](/home/anncatto/Alohamini/models/alohamini2pro/config/kinematics/physical_parameters.yaml) | 当前单臂 2.0 kg 含暂估摄像头 0.2 kg；其余 CAD 相对质量缩放到 1.8 kg，惯量随质量比例缩放 | 保留为 `armInertia: 'urdf'` 旧选项；默认已采用下行CAD包。文件明确 `calibrated: false` |
| [`20261102 活动链惯量包`](/home/anncatto/Alohamini_workspace/simulation/cad/alohamini2pro_active_inertias_20261102/inertia.json)，SHA-256 `b22a27a4981a026c4891fbe9b79014cf9376c5a1f54c85b27b22ffc89cd7f23e` | 绑定上述同一 URDF／SRDF；18 组刚体，含部件归属、质量、COM、完整张量和源坐标变换；左臂含摄像头共 **1.84962 kg** | 已作为默认物性导入。数据来自 SolidWorks 属性、用户质量覆盖及局部名义密度；摄像头已并入夹爪，原camera Link质量置0避免重复 |

新惯量包说明了可以从 CAD 进一步求解的范围，也保留限制：内部转子／齿轮、摩擦、柔顺与延迟仍未标定；肩转的 `0.000387405609146 kg·m²` 是整只轴承给出的转动惯量上界，敏感性范围为 0 至该值，**不是电机转子测量值**。舵盘采用封闭网格及名义铝密度 2700 kg/m³；全机底座还缺固定 Pi 塔质量、升降安装面有待独立复核，因此全机包要求锁定底座与轮子。固定单臂接入应只采用核对过坐标的左臂分组，不把全机限制或未验证坐标掩去。

Feetech 原厂编制的 [STS3250 规格书 A/0，2024-01-16（分销商保存副本）](https://www.gotronic.fr/pj2-38757-3355.pdf)给出 12 V 下额定 16 kgf·cm（**1.569064 N·m**）、堵转 50 kgf·cm（**4.903325 N·m**）、空载 75 rpm（**7.85398 rad/s**）、减速比 345、质量 74.5±1 g，另有电流和保护参数。这些可作为对应型号的厂家名义输入，不能把堵转转矩当连续转矩、空载转速覆盖源关节速度限制，或把减速比与整只舵机质量当作内部转子惯量。STS3095 必须先确认实际电压／子型号；已找到的原厂 6–9 V 文档不能证明 12 V 版本参数。

上游 [AlohaMini 硬件入口](https://github.com/liyiteng/AlohaMini)与 [AM-ARM](https://github.com/liyiteng/AM-ARM) 可用于继续追查 CAD／BOM，但主分支资料仍须固定具体文件和提交后才能进入数值配置。本节采用的本地 Pro 型号映射和 CAD 包有独立哈希，不从标准版宣传或外观推断实际装配。

## 四足备选与排除理由

| 项目 | 固定版本与路径 | 评价与边界 |
| --- | --- | --- |
| **DeepRobotics Lite3** | `deep_robotics_model` 提交 `52352f5bbf2a30b5d02ece91900415188e7abc74`，[`Lite3/urdf/Lite3.urdf`](https://github.com/DeepRoboticsLab/deep_robotics_model/blob/52352f5bbf2a30b5d02ece91900415188e7abc74/Lite3/urdf/Lite3.urdf)，[BSD-3-Clause](https://github.com/DeepRoboticsLab/deep_robotics_model/blob/52352f5bbf2a30b5d02ece91900415188e7abc74/LICENSE.txt) | 12 动力关节，11.9376 kg；惯量、限位和碰撞齐全，2026-10-27 修正传感器挂载；官方有 [rl_training](https://github.com/DeepRoboticsLab/rl_training) 和 [Lite3_rl_deploy](https://github.com/DeepRoboticsLab/Lite3_rl_deploy)。当前 URDF 与 MJCF 大腿 COM 不一致，优先级低于 Go2 |
| **Pupper v3** | `Nate711/pupperv3-monorepo` 提交 `6f96c5e79faa05492992c19918f8cd90b9243281`，`ros2_ws/src/pupper_v3_description/description/urdf/pupper_v3.edited.urdf` | [描述包 MIT](https://github.com/Nate711/pupperv3-monorepo/blob/6f96c5e79faa05492992c19918f8cd90b9243281/ros2_ws/src/pupper_v3_description/LICENSE)，仓库顶层 GPL-3.0。作者有 [URDF/MJCF 生成步骤](https://github.com/Nate711/pupperv3-monorepo/blob/6f96c5e79faa05492992c19918f8cd90b9243281/ros2_ws/src/pupper_v3_description/README.md)、MJX 训练和 ROS2 实机路径；适合小型可制造方案。原始 URDF 与 edited 版的轴、限位和质量不同，不能直接采用未修正的 CAD 导出 |
| **MIT Mini Cheetah** | `mit-biomimetics/Cheetah-Software` 提交 `c71c5a138d3e418cc833e94e25357ceea8955daa`，[`common/include/Dynamics/MiniCheetah.h`](https://github.com/mit-biomimetics/Cheetah-Software/blob/c71c5a138d3e418cc833e94e25357ceea8955daa/common/include/Dynamics/MiniCheetah.h) | MIT 许可；官方树本次未见 URDF，通过 C++ 建模，惯量注明来自 CAD；包含减速比、转子惯量和电机参数。最后提交为2019-11-21，适合作控制与动力学参考，不称为最新官方 URDF |

Lite3 的具体差异：FL 大腿 URDF COM 为 `[-0.0039245,-0.014632,-0.025146] m`，对应 MJCF 为 `[-0.0052817,-0.014632,-0.042672] m`。这是实际读取源文件发现的差异，可能影响重力和动态载荷；不能在未解释差异时声称两种格式同源计算结果必然一致。

## 接入步骤与验收

1. **冻结资产。** 固定模型、控制代码及其子模块提交，记录源路径、文件哈希、许可证、转换操作、单位与质量合计。RP1 模型许可明确后再纳入可分发资产；完整保留源 URDF/MJCF，转换显示网格时不改变关节树或物理参数。
2. **核对几何与坐标。** 保留每个关节原点旋转、轴、左右符号、上下限和固定附件。用零位、官方初始位及多个非对称姿态，对照独立引擎检查所有 Link／足端 FK；核对前向、地面、足底法向、足内缘净距和运动碰撞。零位踝轴距不等于步宽。
3. **核对载荷输入。** 校验惯量物理一致性，记录视觉／碰撞差别、缺失碰撞体、关节耦合、转子惯量和驱动曲线的来源。源 CAD 没有弹性截面时保持结构强度／变形未知，不从外观捏造梁截面，也不因选择材料而覆盖源总成质量。
4. **适配实际控制。** 根据匹配模型和任务选择模型控制或训练策略；保留源关节顺序、动作缩放、观测、更新周期、初始化和驱动规律。修改腿长、质量或执行器后必须重新验证，不能继续沿用原策略通过标记。
5. **分层验证。** 先做 FK／IK 和约束参考，再做实际 `mj_step` 闭环与独立 sim-to-sim；记录跌倒、接触滑移、碰撞、跟踪误差、转矩—转速边界。补充负载／惯量／摩擦误差、延迟、噪声和外扰测试。最终真机结论需要对应硬件测量，已有模型视频不能替代。
6. **界面保持证据一致。** 模型选择显示确切型号和版本；参考运动、物理回放、实机状态分别标明。所有质量、惯量、关节载荷、杆件分析和导出必须来自所选模型，参数变化使旧结果失效。接入完毕后更新本节状态及[交接](lightweight-tool-handoff.md)，不把调研候选显示成已验证模型。

当前已完成源文件、显示坐标、物理接入和上表名义工况验证；RP1 浏览器回放与导出也已核对。官方策略接入、独立 sim-to-sim、鲁棒性测试和真机验证仍未完成。

## CAD 截段接入补充（2026-11-02）

Alohamini 上臂／前臂各 43 个原生 CAD 截面与 RP1 M447 的 82 个有效截面已接入独立局部结构校核。用户确认 Aloha 打印件材料族为 ABS；牌号、填充、方向与有效本构仍需标定。RP1 工程图指定 6061-T6，部件配准、原件版本和材料表见[承力件来源](source-structure-sources.md)。界面、公式和可交互输入见[结构校核记录](lightweight-structural-checks.md)。原 `elasticSectionDefined` 表示整链等效梁是否显式定义；新 `cadStructure` 单独记录局部截段工况，二者不可混同。刚体 URDF 总成质量与惯量没有被局部零件数据替换。


## LIBERO 物性接入记录（2026-11-03）

`import-alohamini-physics.py` 将绑定同一URDF/SRDF的CAD包逐分项变换、按唯一owner合并，核对已生成LIBERO MJCF。完整来源、实际生成MJCF路径与SHA、分支HEAD及相关代码工作区状态记录在[导入清单](../public/models/alohamini-left/physics-provenance.json)，冻结源包见[原始物性包](../public/models/alohamini-left/physics-source.json)。这些是CAD名义/用户质量覆盖假设，不是实机动力学辨识。

| 左臂刚体 | 质量 kg |
| --- | ---: |
| Base | 0.557515312 |
| Rotation Pitch | 0.271306687 |
| Upper Arm | 0.335340000 |
| Lower Arm | 0.237253313 |
| Wrist Pitch Roll | 0.032229376 |
| Wrist Yaw | 0.225620624 |
| Fixed Jaw（含45 g摄像头） | 0.169370000 |
| Moving Jaw | 0.020984688 |
| 合计 | 1.849620000 |

肩转附加armature使用包中的轴承惯量上界，并保留其分类，不把其他未声明转子项补成已知0。原关节几何、限位、URDF effort/velocity不变。摩擦/阻尼为当前仿真假设，尚无标定值；LIBERO的2 Hz、阻尼比1的PD增益是控制参数，不是关节机械连接刚度。工具当前仍使用自身的限矩逆动力学＋PD控制器，自己的碰撞口径，未宣称与LIBERO任务环境完全相同。
