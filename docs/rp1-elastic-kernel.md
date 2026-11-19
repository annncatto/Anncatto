# 整腿弹性计算：现有计算审计与独立内核

## 当前计算的实际范围

`source-structure.ts::analyzeCADSegment` 保留 `Iuv=∫uv dA`，用两个横向曲率方向的完整矩阵处理耦合弯曲。已有主轴旋转、非均匀截面解析积分和单位载荷形函数的能量验证。这里的矩阵使用横向曲率坐标，与物理弯矩 `[My,Mz]` 的符号约定不同；不能只复制某个交叉项而忽略坐标定义。

它目前是明确夹持区间内的 Euler–Bernoulli 固支截段、横向端力计算，不含轴向伸缩、横向剪切、扭转或关节连接。二维 Ritz 结果属于该截段的近似弯曲模态，不是整腿模态。`rp1CADPart` 没有保留原文件 `centroidLinkM` 和 `referenceAxis` 到计算对象；因此这条路径不能直接承担原关节接口六维载荷与真实截面参考线的变换。

`design-member-loads.ts` 对概念承力杆保留各子节点的真实载荷作用点，并计入所声明质量分区的自重／惯性；它仍是局部梁筛选，返回横向挠度及一个驱动轴根弹簧的附加变形。没有完整足端 6×6 柔度或串并联装配。当前正应力由轴向和弯曲相加；剪力和扭矩有单独结果，但未并入剪切变形或组合等效应力，不能把这个 `strengthUse` 解释为任意六分量载荷下的全面强度校核。

`sectionProperties` 的圆管 `J=2I`、闭箱薄壁 Bredt 近似和实体矩形 Saint-Venant 近似分别有对应截面条件。M447 的开口半壳、两半壳拼接及局部连接不能直接套用这些公式。原 CAD 截面 A、Iu、Iv、Iuv 没有提供 Jt、有效剪切面积或机械接头刚度。GE8C 间隙亦不是刚度。M268/M269 的偏置弯折使真实柔度不能直接用直杆 EA/L；已有理想二力杆端力可作为后续结构载荷，但不会自动给出内部弯曲变形。

## 独立模块与接口

新增 `src/structural-compliance.ts`，目前没有连接到 RP1、项目 panel 或周期 metrics，也没有写入任何 RP1 刚度。

- `isotropicSectionRigidity`：输入 E、G、A、Iy、Iz、Iyz、Jt 及显式 2×2 有效剪切面积。轴向为 x，Iy=∫z²、Iz=∫y²、Iyz=∫yz；弯曲本构为 `E[[Iy,-Iyz],[-Iyz,Iz]]`。缺失 Jt／剪切数据直接拒绝完整 6 维计算。
- `integrateBeamCompliance`：输入直参考线全跨度的实际站位与完整 6×6 截面本构矩阵，按本构矩阵线性插值，自适应计算 `C=∫HᵀD⁻¹H dx`。H 将端部六维载荷移到截面。输入可以带耦合项；它不自动推断剪切中心、曲杆本构、体力或端部边界。
- `transformCompliance` / `spatialMotionMap`：同时改变参考点和轴系。位移映射 T 与载荷映射 Tᵀ 保持虚功，柔度按 `C'=T C Tᵀ` 变化。
- `flexibilityElement`：接受梁或 FE 的完整端口 6×6 柔度。柔度定义为 B 端相对 A 端刚体运动的位姿变化，必须附参考位置、方向和来源。
- `springElement`：显式给出连接刚度与严格刚性模式；未约束的输出弹性模式保留。零刚度表示已知自由模式，null 表示未知，两者不同。
- `assembleStructure(system)`：节点空间刚度装配；支承、理想刚性模式用精确 KKT 约束，不加大数罚刚度，不自动固定根节点。`solve(loads)` 给位移、构件应变能、支承反力、约束反力、平衡及能量残差。`compliance(port)` 以同一端口的六个单位载荷生成完整柔度矩阵。
- `condenseStiffness`：对已知弹性自由度进行 Schur 缩聚。`inspectStructure` 可保留含未知刚度的参数清单，未知项不会变成数值响应。

所有节点、载荷和测量位置用同一世界坐标；局部旋转矩阵列向量为局部轴在世界中的方向。位移顺序 `[ux,uy,uz,φx,φy,φz]`，载荷顺序 `[Fx,Fy,Fz,Mx,My,Mz]`；平移单位 m、转角 rad、力 N、力矩 N·m。模型限于固定参考姿态、固定接触状态下的小位移线性静力。构件矩阵必须保留整体刚体运动零能量；隐含的地面约束会被拒绝。矩阵、几何和来源被一起保存，端点改变后不能继续套用旧元素矩阵。

FE 接口特别要求：载荷分配与位姿读取采用同一功共轭 B，即 `Fnode=Bᵀw`、`δx=B unode`。不能均布单位力后读取任意最大节点位移来拼 6×6，否则互易性和功共轭可能失效。实际接入前需保留夹持面、载荷分配、测量点及六个单位工况的定义。

## 独立验证

`tests/structural-compliance.test.mjs` 共 10 项通过，隔离编译到 `/tmp/structural-compliance-build`，没有覆盖共享 `.build`。

1. 轴向、双向弯曲、剪切、扭转和力—矩耦合的完整悬臂解析柔度。
2. 非零惯性积、非对角剪切刚度及截面旋转不变性。
3. 偏心端口的位移／载荷变换与虚功一致性。
4. 串联分段梁、Schur 缩聚、合反力和能量分配。
5. 转折空间双构件的端口矩阵合成。
6. 并联路径按刚度分担载荷。
7. 保留输出端弹簧柔度，其他模式严格约束。
8. 线性变化惯性矩的对数解析积分与站位细化一致性。
9. 未知输入、缺失 Jt／剪切、过期几何、未约束机构及隐含地面刚度拒算。
10. 具有双支路、空间旋转、端口偏置与输出弹簧的合成网络，与独立 SciPy 零空间求解一致；此验证使用声明的解析测试值，不是 RP1 估算值。

独立生成器 `scripts/verify-elastic-kernel.py` 使用现有 `/home/ann/miniconda3/envs/alohamini/bin/python` 的 NumPy/SciPy，产生 `tests/fixtures/spatial-elastic-network.json`。Python 用 SVD 零空间消去约束，TS 用缩放／主元选取的 KKT 求解，两者算法不同。位移、六维柔度、支承反力及分件能量均交叉核对。

## 原始理论支持

力法根据静力平衡插值截面力，并积分截面柔度，与 [OpenSees 官方 forceBeamColumn 说明](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/elements/forceBeamColumn.html)一致；此模块采用小变形线弹性静力，不声称实现 OpenSees 的非线性算法。

剪切变形、弯曲与坐标变换的区分参考 [TU Delft Timoshenko beam](https://teachbooks.tudelft.nl/computational-modelling/structural_linear/timoshenko.html)及[空间框架教学资料](https://teachbooks.tudelft.nl/computational-modelling/structural_linear/space_frame.html)。直接由端力柔度积分生成本模块的梁刚度，避免采用会引入剪切锁死的等阶线性位移插值。实际厚壁壳、翘曲约束、孔边和接触仍按对应结构模型处理。
