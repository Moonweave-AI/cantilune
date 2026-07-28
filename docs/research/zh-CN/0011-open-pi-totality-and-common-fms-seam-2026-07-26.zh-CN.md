# 开放 pi 全性态与公共 FMS 接缝审计 — 2026-07-26

## 结论

两个此前被混为一谈的义务现在有了各自独立的机械结果。

1. 当前的具体名 `NamedInterface` 表示无法在非空边界上支持一个保持出现次数的总张量。即使某个候选张量可以对端口做置换，将一个非空边界与自身做张量化仍会复制一个具体名，从而与所要求的 `Nodup` 不变式相矛盾。当前的确切名 `PlugCertificate` 也无法在非空单位边界上做到全性态。
2. 给定两个已经通过认证的相邻乘积行、一个显式共享的 `ExactFMSAcceptancePackage`、一个操作态接缝以及一个指称态端点接缝，Cantilune 现在能够构造一条非擦除的两行跨纪元链。它包含四条确切的原生 FMS 边——两次接纳与两条固定签名规则——并将同一条操作链耦合到带事件标号的随机轨迹上。

第一项结果是一个表示层面的不可行结论，而非针对所有可能 Open-pi 范畴的不可行定理。第二项是一个有条件的复合定理，而非对缺失的确切 FMS 包或任何生产规则的构造。

处置方式：**iterate**。仅凭这些结果不得推进 CENTRAL-12 或 CENTRAL-18、不得进入 FCP、也不得接受 ADR-0001。

## 治理

- 工作对象：承重的形式语义研究与实现。
- 风险：S2。
- 质量目标：QA-L4。
- 成熟度：Pre-FCP/M1。
- DRI：Joker-of-Gotham。
- 决策产物：RFC-0002 与 ADR-0001 仍处于 pending 状态。

仓库与源文本被作为不可信证据处理。未伪造任何批准、审查、产品事实或外部定理。

## 内核构建的 Open-pi 边界结果

模块
`Cantilune.Pi.OpenSMCTotalNamedBoundary` 证明：

- `no_totalOccurrenceTensor_of_nonempty`：当存在非空边界时，不存在某个总张量能够既在置换意义下保持所有具体端口出现次数、又返回一个有效的 `NamedInterface`；
- `no_totalExactNamePlug_of_nonempty`：现有的确切名插头证书无法在非空单位上做到全性态；
- `no_sortChanging_selfBoundaryRenaming`：边界改名记录在每一个源名上逐点强制保持 sort，而非仅因聚合 sort 列表未变就接受一个改变 sort 的置换；
- `no_sortedFreshBoundarySupply_singletonChannel`：仅凭 `TypeEnv` 无法蕴含一个无限的保 sort 鲜名供给；
- `SortedFreshBoundarySupply.tensorObject_sorts`：在显式提供鲜化供给之后，一个总的对象层张量存在，并具有预期的拼接 sort 形状；
- `hideMany_native` 与 `hideMany_native_tau`：在标准动作新鲜性前提下一道真正的单步原生 late-pi 迁移可经有限次限制保持，而 tau 无需额外前提；
- `plugHide_syncLeft_native`、`plugHide_syncRight_native`、`plugHide_closeLeft_native` 与 `plugHide_closeRight_native`：普通通信与有界输出收尾后接任意有限隐藏，都是确切的一步 `Late.NativeStep` 推导。

这些结果并未在态射上定义张量、单位线、公共改名迁移、交换律、结合子、单位子、辫子，也未给出验证这些法则的结构性/互模拟商。

### 有界输出动作 alpha 状态

此前关于一个一般的有界输出动作标号 alpha 商仍然缺失的说法，对于本工作树已不再准确。
`Cantilune.Pi.OpenSMCActionAlpha` 将输入与有界输出标号以及动作/导数对按鲜性安全的改名子做商，为两种情形都构造了真正的一步原生迁移，并拒绝了其有界输出绑定子等于其自由通道的非法标号。
`Cantilune.Pi.OpenSMCAlphaTransitionQuotient` 额外提供了有界输出的鲜代表及相应的 alpha 原生迁移类。这些声明被根导入，并纳入了内核依赖审计。

这闭合了标号/导数的 alpha 转换。它并未构造出缺失的总命名边界 SMC：公共边界鲜化、进程迁移、单位接线、代表独立性、完整的范畴一致性，以及操作式插头/隐藏充分性仍是各自独立的义务。

## 一个总 Open-pi SMC 所需的最小表示变更

未来的构造必须添加并证明以下各项，而非默然假定：

1. 为每一个被接纳的 sort 提供无限的鲜名供给；
2. 一致的保 sort 公共边界改名；
3. 用于非空单位的极化线性别名/连线进程；
4. 将原始进程、alpha 类、动作标号与原生迁移沿公共改名做迁移；
5. 一个独立于鲜代表的复合与张量定义；
6. 在所选等式或观测商下的范畴、交换律、五边形、三角形与六边形法则；以及
7. 插头、隐藏、限制、自由通信与有界输出收尾的操作充分性/反射。

这是一次规范性的语法/接口变更。依据 RFC-0002 中的停止条件，在实现可以声称完成了完成门所请求的总 Open-pi SMC 之前，需要一项明确的 RFC/ADR 决策。

## 内核构建的公共 FMS 两行结果

模块 `Cantilune.Theorems.FMSCommonTwoRowCrossEpochChain` 证明：

- `directAdapterMiddle_ne`：既单行适配器的事件性终纪元不是下一适配器的空初始纪元；
- `TwoRowOperationalSeam.carriedBoundary`：第二次接纳从第一行实际的事件性端点出发，而非重置历史；
- `TwoRowOperationalSeam.source_eventCount`：复合源链恰好有四个事件标号；
- `SharedFMSGatedCrossEpochEvidence`：FMS 包是一个公共类型索引，因此两行无法在一个值下携带互不相关的包；
- `TwoRowCommonFMSSeam.nativePath_of_denotational_seam`：确切的指称路径是
  `admission₁ ; rule₁ ; admission₂ ; rule₂`；
- `TwoRowCommonFMSSeam.complete_with_denotational_seam`：五种操作视图、确切重放、严格的接纳边界、两条行的结论以及公共指称路径被打包在一起；以及
- `TwoRowCommonFMSSeam.sampled_mark_action_at_position` 与
  `canonical_marked_replay_positioned_fms_actions_almost_sure`：在调用方提供的 `FourPositionFMSActionAgreement` 之下，规范四事件重放中的每一个相依源标记都被等同于同位置处的 FMS 动作。

`FiniteCommonFMSPathAgreement` 记录了任意有限供给链所对应的接口。`ProductionActionFaithfulness` 是一个可选的调用方义务，涵盖单射位置、非 `tau` 动作与负载保持；该模块刻意不制造任何此类生产事实。

该定理刻意要求：

- 一个具体的 `ExactFMSAcceptancePackage`；
- 两条完整的乘积行；
- 相邻操作源端点相等；以及
- 其指称端点相等；以及
- 对于事件/动作同一性，一个显式的位置动作解释。

这些输入无一来自包名，也无一来自证明无关性。特别地，该定理并不构造全 omega-CPO 幂域、递归 FMS 域或八张生产包证书。其概率为一的陈述仅针对规范确定性标记重放调度器。它不是针对两条所供给乘积核的 `TrajectoryAgreement`，也不耦合生产 Markov 核。

## 实际执行的验证

针对早先的一个可变工作树快照：

```text
lake build Cantilune

Build completed successfully (9005 jobs).
```

这一历史计数不构成后续丰富化与审计清单编辑的证据。本次增量在最终可变树上的权威结果另行记录于
`formal/build-evidence/2026-07-26-ndcpo-openpi-commonfms-root.md`。

对新的 NDωCPO 范畴/极限、命名边界与公共 FMS 声明所做的显式 `#print axioms` 审计，仅包含被允许的基础依赖 `propext`、`Classical.choice` 与 `Quot.sound`。

此证据是可变工作树证据。它不是一次不可变的、提交绑定的 QA-L4 审查。

## 剩余阻塞输入

- 总 Open-pi SMC 需要上文列出的表示决策与构造。
- 公共 FMS 定理需要一个实际 inhabited 的确切 FMS 包。
- 一般有限链需要每个边界上有一道真实的相邻接缝与一行认证行；两行定理不制造任意行。
- 八个计划中的生产分布仍没有包拥有的规则清单，也没有 rank、pre-net、resource、authorization、fairness、stable-window 或 positive-epsilon 事实。
