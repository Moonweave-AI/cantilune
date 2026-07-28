# 支撑感知 FMS 与事件组合审计 — 2026-07-27

状态：可变工作树内核证据；不是不可变证明发布  
治理：S2 / QA-L4 / M1，RFC-0002 Pre-FCP，ADR-0001 Proposed  
DRI：Joker-of-Gotham

## 执行结论

本轮闭合了若干真实的支撑、名义分配和具名事件义务，但**没有**闭合完整
FMS、公开具名 Open-pi 或生产产品包义务。

终局阻塞分成三类，不能混在一起：

1. Cantilune 加强版 FMS 验收律包含一个与表示无关的不相容合取；
2. 非空具名边界上的总 Open-pi SMC 必须由 RFC/FCP 决定公开边界和 wire
   表示；
3. 两个生产 kernel 和八个产品包自有运行事实在仓库中不存在。

Lean 不能为不相容接口构造 inhabitant，不能替 FCP 选择公开架构，也不能从
产品包名字推出不存在的产品事实。

## 对交接陈述的校正

当前工作树中，以下“完全尚无构造”的陈述已经过时：

- `Global.carrier_solutionSetCondition` 已构造全源 solution-set；
- 普通自由/遗忘伴随、monad 和 `cpoEnrichedFreeForgetAdjunction` 已构造；
- 真实未分离 omega-Scott monad 已有 chosen-product 交换 Fubini、strength、
  multiplication 和 world-delta 协调；
- `concreteActualFixedPointWitness` 已给出该未分离函子的真实连续自然
  `A ≅ P(H A)`；
- `powerHiding` 及其 unit、multiplication、allocation、Fubini 图已经在同一
  未分离线路上闭合；
- 条件定理已经可对两个调用方提供的真实 Ionescu–Tulcea kernel 保留原生
  事件、replay、epoch 对齐和一个共同 exact FMS package。

这些事实不推出代数紧致性、分离 Abramsky powerdomain、FMS Table-2 agent
restriction、adequacy、definability 或 full abstraction。

## 本轮新增内核构造

| 范围 | 新构造 | 精确边界 |
|---|---|---|
| 支撑分离 SMC | `FMSCpoFiniteSupportMonoidal` 安装真实 mathlib monoidal/symmetric 实例，覆盖 pentagon、triangle、hexagon 和 involutive braiding | 对象是 `SupportedOmegaCpo Resource`，还不是 nominal `Cpo^I` 或 FMS agent category；若未来还需 cartesian instance，当前未 scoped 全局实例是 RFC 风险 |
| 名义分配 | `doubleSuccessorAlphaIso`、`doubleShiftAlphaIso` 和双向 allocation-exchange 方程实现最后两个 fresh name 的 permutation | 这是 `δ/up/swap` reindexing 协调，不是进程 alpha 商、`new`、restriction 或 agent hiding |
| 分离因子化 | `fubiniRaw_factors_through_separated_iff` 证明当且仅当每对左右结果支撑不交时，restriction 无损 | 它逐 computation 成立，不是总自然 separated Fubini |
| 固定有限资源支撑 | `powerObject` 及 return/map/choice/multiplication 的精确支持律提升 lower omega-Scott 构造 | 支撑并有限首先依赖 `[Fintype Resource]`；尚无跨 world injection 自然性和 supported monad |
| Fubini 支撑 | `powerSupport_fubiniRaw` 与 `powerSupport_fubiniRaw_exact_iff` 给出完整公式与精确性充要条件 | 空 lower/Hoare 分支会擦除另一分支的支撑，因此 unrestricted Fubini 不是当前 exact-support category 的态射 |
| 分配次序 | `allocation_alpha_exchange` 及逆式以有限世界 swap 识别双分配 | 不把字面 fresh name 判等 |
| 具名 residual | derivative 自由名受 source 自由名与 event support 控制；两个 source-freshness 前提推出两个 residual-freshness 前提及精确 marked diamond | 这是保守充分条件，不是独立性的充要刻画 |

residual 回归现在包含：

- 一个 `boundNames` 非空的 input 正例，真实检验 source freshness 向 residual
  freshness 的传递；
- event-support disjoint 不能替代 source freshness 的证明；
- 一个不同通道但共享 payload 的边界：两个原生强执行顺序都存在，但保守的
  support-disjoint certificate 不可用。

## 与表示无关的 FMS 阻碍

`no_distinguishedFubiniStrictness` 不使用有限 powerset 表示。对任意候选
`CpoPowerdomainPackage`，同时假设：

1. divergence 与 deadlock 不同；
2. Fubini 交换；
3. Fubini 在第一计算参数吸收 divergence；
4. Fubini 在第一计算参数吸收 deadlock。

把交换律作用于 `(divergence, deadlock)`。一侧由第 4 条化为 deadlock，交换后
的一侧由第 3 条化为 divergence，再由 divergence 的自然保持跨越 product
braiding，于是 self-product 上 deadlock 等于 divergence，与第 1 条矛盾。

该定理只否定这一加强合取，不否定未承诺该合取的 Abramsky 构造。

## 一手来源边界

Fiore–Moggi–Sangiorgi §2.1 假设非决定性对象
`(D, bottom, 0, union)` 及交换 monad；它没有陈述 `bottom ≠ 0`，也没有陈述
Cantilune 加强接口中的两条同时 first-input absorption。§2.2 给出有限注入
`up/swap/delta` 结构。§2.3 陈述 agent 方程 `A = μX.P(HX)`，§3 给出完整
FMS 模型上的 adequacy/full-abstraction 结果。

Abramsky–Jung 第 6 章给出一般域论 powerdomain 背景；其中 Plotkin 构造及其
泛性质不会自动把当前 lower closed-set `OmegaScottPower` 认定为完整 FMS
powerdomain。

因此合法的剩余 FMS 工作仍很重：

- 选择与来源相容的 powerdomain 律；
- 构造逐点/world-indexed 函子及具有所需泛性质的连续自然递归解；
- 构造 FMS agent restriction，而不是只构造 monadic support hiding；
- 定义语法指称并证明 adequacy、definability 及锁定来源范围的 full
  abstraction。

不相容的加强律必须先由 RFC/FCP 修订。

## 共同 FMS 链的边界

五视图 `endpointAppend` 正确去除重复的共享 epoch，并保持 dependent chain、
replay、signature 和 mark 证据；`ExactFMSNativePath.append` 也能在字面共同
指称端点上组合路径。

旧的 full-trace
`FiniteCommonFMSPathAgreement.endpointAppendWithPositions` 仅是条件接口。
两个输入 action list 都包含共享 epoch，而 appended chain 只保留一次。若共享
epoch 含事件，所需 `List.Forall₂` 位置见证长度不相容。
`no_full_concat_positions_of_shared_events` 现已在内核中证明这一不可能性。

`ExactFMSSegmentPath` 给出对应的最小表示修复：它存储非空精确原生 segment
列表，暴露终端 segment 入口处结束的 half-open prefix，并通过丢弃左侧终端
segment、保留右侧共享 segment 定义 `endpointAppend`。原生指称端点连续性、
完整/prefix action 方程以及三段 action 结合律均由内核构造。

该 segmented path 尚未按具体 `EpochChain` 作 dependent index。因此，把每个
异构 epoch/admission segment 与一个共同 FMS path 对齐的一般构造仍开放；旧
full-trace 定理不再被描述为该闭包。

## Open-pi 与生产事实

当前 exact-name 边界实验在非空边界上拒绝可重用 identity wire。总具名
Open-pi SMC 必须选择公开名字 occurrence、polarity/usage、freshening、wire
identity、plug/hide 语义以及证明所有协调图所使用的操作等价。这是公开语义
决策，不是 alpha conversion 的自动推论。

仓库审计仍具有决定性：

- 两个生产 Markov kernel 及其 coupling 都不存在；
- exact FMS 生产 package 没有 inhabitant；
- 八个计划产品包均没有自有规则清单、rank、pre-net、资源/会话策略、授权
  谓词、公平性、稳定窗口或正 epsilon 进展事实。

通用 certificate 与 trajectory 定理只消费这些输入，不能制造它们。

## 质量处置

- 新增目标构建和聚合 root build 已在可变工作树通过；
- 审计声明只依赖 `propext`、`Classical.choice`、`Quot.sound`；
- 项目源码不存在整词 `sorry`、`admit`、`axiom`、`unsafe`；
- 独立 Agent 对抗性复核未发现限定范围内的内核正确性缺陷，但这不是独立
  人类 QA-L4 签字；
- proof manifest 保持 11 个 `implemented_unverified`、7 个
  `partial_scaffold`、0 个 `proved`、0 个 `reviewed`；
- RFC-0002 保持 Pre-FCP，ADR-0001 保持 Proposed。

处置：**继续迭代一致且限定范围的构造；不得晋级终极总定理。**

精确的可变工作树哈希与命令结果记录于
`formal/build-evidence/2026-07-27-support-separated-nominal-segmented-root.md`。

一手来源：

- [Fiore–Moggi–Sangiorgi，《A fully abstract model for the pi-calculus》](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Abramsky–Jung，《Domain Theory》](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)
