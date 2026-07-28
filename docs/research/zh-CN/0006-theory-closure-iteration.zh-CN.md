# 理论闭环迭代：内核构建所得与尚存边界

Status: implementation evidence; not QA-L4 approval  
Date: 2026-07-23  
Updated: 2026-07-25
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Owner / DRI: Joker-of-Gotham / project DRI  
Required independent reviewers: category/DPO/Petri, process semantics/FMS,
and Lean kernel assumptions (not yet assigned or signed)

## 范围

本次迭代处理先前脚手架交接后遗留的四个具体阻碍：

1. fixed-host/`InterfaceLocal` DPOI 与位置型 typed open hypergraphs、任意合法 monic 匹配以及范畴论并发的对比；
2. 非常值 support 函子与真正的 Fiore--Moggi--Sangiorgi (FMS) CPO powerdomain/domain/full-abstraction 模型之间的差异；
3. 仅状态随机一致性与事件标签、epoch 以及可重放的 `DPOEvent` 轨迹的对比；以及
4. P1c 中缺失的原生 mismatch、reconnect 与 quiescent-delete 见证。

 requester 授权了 finite-control π 修订。RFC-0002 和 ADR-0001 仍为 Proposed；实现不构成接受。

## 内核构建所得

### FreeSMC 商与任意对象解释

`formal/Cantilune/Core/FreeSMCUniversal.lean` 现在为实际的 hom 方向商赋予 mathlib 的 `Category`、`MonoidalCategory` 和 `SymmetricCategory` 实例。对于将原子源对象任意指派到一个局部小目标 SMC 对象的赋值，`InterpretationData` 构造一个合法的商代数和一个商函子。Lean 检查 tensor、associator、unitors、braiding、generator、explicit copy 和 explicit discard 的保持。`SemanticWord.realization` 另外地是一个真正的 strong monoidal braided 函子。

`formal/Cantilune/Core/FreeSMCStrongUniversal.lean` 将该商到 semantic-word 的函子封装为 mathlib 的 `Monoidal` 和 `Braided` 函子：其 unit 和 tensor 比较是恒等映射，因为空 word 和连接在定义层面被保持。因此与 `SemanticWord.realization` 复合后，为任意目标对象数据为 `interpretationFunctor D` 赋予真正的 strong symmetric-monoidal 结构。

`formal/Cantilune/Core/FreeSMCArbitraryUniversal.lean` 现在闭合了该泛性质边界。从原子对象同构以及在 generator、explicit copy 和 explicit discard 上的相容性出发，它递归构造 word 比较，推导 raw 和 quotient-arrow 的自然性，将该比较封装为 mathlib 自然同构，证明两个方向都是 monoidal，并在 singleton 分量固定后证明 hom 的唯一性。这是内核构建的实现证据，而非不可变或独立评审过的 QA-L4 证据。

### 位置型 typed DPOI

`formal/Cantilune/Core/PositionalDPOI.lean` 定义了内在的有限 typed open hypergraphs，带有依赖有限 node/edge 纤维以及有序的 source 和 target 位置。态射是其在 typed incidence-presheaf slice 中编码之间的所有态射。该编码是 full 且 faithful 的，并与它的范畴本质像建立一个等价。

`formal/Cantilune/Core/PresheafComplementDPO.lean` 处理 typed incidence-presheaf slice 中的任意 monic 匹配。retained-subpresheaf 构造证明：

- incidence gluing 条件蕴含一个规范的 pushout complement；
- 任意 pushout complement 蕴含该 gluing 条件；
- 因此 `LegalMatch ↔ Nonempty PushoutComplement`；以及
- 每个补都与规范补相容同构。

补的存在性是逐点构造的；它并非仅从 adhesivity 推得。

`formal/Cantilune/Core/DPOConcurrency.lean` 使用关于另一 context 作 factorisation 的标准 parallel independence 定义。它构造联合 context、两个 residual 匹配与推导，以及两个顺序结果之间的规范同构，同时保持两个原始 right-hand-side 像。

定向本地命令（非不可变评审证据）：

```text
lake build Cantilune.Core.PositionalDPOI
  Cantilune.Core.PresheafComplementDPO
  Cantilune.Core.DPOConcurrency
```

在固定的 Lean/mathlib 工作区中成功完成。

### 原生 P1c 参考矩阵

typed 与 raw finite-control 语法现在包含 proof-guarded 的 mismatch `[a≠b]P`；其规则传播一个真正的 body 迁移。Reconnect 是普通的 channel delegation，quiescent deletion 是一个 shutdown 通信，其两个 continuation 为零。它们是原生的单步推导，而非元数据、自反步骤或弱闭包。

`formal/Cantilune/Pi/P1cCompleteMatrix.lean` 给出全部 `15 events × 4 projections = 60` 个非自反参考推导：

- DAG：严格秩无环图重写；
- Petri：声明感知、含 identity 的 individual-token 触发；
- π：typed 原生 strong 推导；以及
- morphism：总 identity 视图。

`formal/Cantilune/Pi/P1cProjectionCertificates.lean` 为四个分别命名的目标关系赋予精确的操作证书。Soundness、reflection/exhaustiveness、terminal 分类和 signature 版本均已证明。π 目标保留每个真正的 typed 推导，且每个此类步骤映射到分别定义的 alpha/structural standard late 语义。这四个有限关系仍共享相同的 ready-event/completed-event 迁移形状；DAG 步骤不是从任意 DPO 匹配导出，Petri 步骤也不是从一般 enabling 方程导出。

这是有限参考演算的一个完整操作定理。它不会将任意未来 product 规则转化为 DAG、Petri、π 和 morphism 推导。

`formal/Cantilune/Pi/P1cAdmittedOperations.lean` 在该 fixture 之外进一步处理三个关键操作。一个 `Occurrence` 包含一个具体 `Config`、一个参数化请求以及 admission 证明；其目标是计算得到的。由此 Lean 推导出 enabled finite-support 的 node/edge DPO 更新、一个 enabled Petri transition（其触发等于目标 marking）、一个原生 standard late 步骤、确定性 morphism 步骤以及 endpoint-free replay。replay 解释器在重新计算目标之前检查所有有限 recipe 字段和具体匹配嵌入指纹。

`formal/Cantilune/Pi/P1cAdmittedTrajectory.lean` 将这些 occurrence 之一置于一个具体两状态 `ExecutionPackage` 中。唯一正质量 pending 迁移携带 admitted `DPOEvent`，而 completed 状态有一个显式 external hold。Lean 证明每个业务标签轨迹位置都有精确的端点、被重放的记录、两个端点 epoch，以及相同的 DAG/Petri/native-late-π/morphism `CommonDerivation`。规范路径与 almost-sure event/state/epoch/replay 定理为所有三种请求形式被实例化。`EventTrajectorySupport` 现在证明在实际 Ionescu--Tulcea 律下采样的每条边几乎必然具有严格正矩阵质量，并将其转移到可重放 event-path 律。`P1cAdmittedTrajectory.supported_complete_trajectory_almost_sure` 将该 support 事实与既有 replay、四视图推导和 hitting 结果结合；因此 null 对上的 totalization 标签几乎必然不被观测。

此桥接有意设计为 `Config` 的可执行普通 node/edge 片段，而非与一般 typed incidence-presheaf DPOI 语义的等价。其余十二个 P1c 事件族尚未被提升到同一非 fixture 公共推导。两状态包表示一个 admitted occurrence 后随 external holds，而非一般多事件 epoch 调度器。

### 事件标签随机轨迹

`formal/Cantilune/Feedback/EventTrajectoryMeasure.lean` 通过将既有 Ionescu--Tulcea 状态律推过具体确定性原生事件装饰，在可重放 event path 上放置一个真正的概率测度。它证明：

- 遗忘事件数据后精确返回原始状态轨迹律；
- 每个被选事件都是原生 observable package 步骤；
- 每个被选 `DPOEvent` 重放其记录的源和目标 configurations；
- 事件编号、稳定 signature 版本和公共 fair epoch 窗口一致；以及
- 在同一 event-path 概率空间上 almost-sure 稳定 hitting 成立。

`CompleteCommonTrajectory` 结合精确状态投影、事件身份、replay 和 epoch 对齐。Boolean 非平凡 execution package 构造它；调用方不提供 `TrajectoryAgreement` 假设。

`formal/Cantilune/Feedback/EventTrajectoryRandomized.lean` 添加第二个以 seed 为索引的耦合。原生事件可依赖于源、目标和随机 seed 流。联合律是真正状态律与 seed 流上任意概率律的乘积；Lean 证明其状态边缘恰为原始 Ionescu--Tulcea 律。每个联合样本仍携带原生标签、replay 证明、epoch 对齐和 almost-sure 稳定 hitting。这允许相同端点的不同事件身份。

该耦合本身不提供运行时联合迁移矩阵，也不将 `ExecutionPackage.eventEndpoints` 强化为一般 presheaf-DPO match/complement/freshness/policy 重执行的实现。这些是另行遗留的义务。对于三个 admitted P1c 操作，`P1cAdmittedTrajectory` 确实提供一个确定性运行时核，其业务记录委托给可执行请求 replay 核；这是通用定理的第一个非 fixture DPOEvent 级实例化。

### Replay 验证运行时执行 epoch

`formal/Cantilune/Core/ExecutionEpochTrace.lean` 引入一个有意区别于 fairness 层 `opportunityEpoch` 的运行时概念。一个 `ReplayEpoch` 在同一 `Config.signatureVersion` 下包含任意有限原生事件列表。Lean 证明每个记录都有原生端点和已验证 replay，整个事件列表从其源重放到其目标，且全内部 epoch 被源秩所界。

`SignatureAdmissionEvent` 边界是异构的，因为其源和目标 signature 不同。`AdmissionReplays` 重新计算被重索引的目标并证明严格版本前进。`EpochChain` 随后仅通过这些经过认证的边界连接固定 signature 的 replay epoch，而 `EpochChain.complete_replay_agreement` 构造所有 epoch 内和 epoch 间 replay 方程。

`formal/Cantilune/Pi/P1cExecutionEpoch.lean` 实例化一个两事件 epoch：一个 admitted 业务事件后随其 productive completed-state external hold。两个记录携带相同运行时 signature 版本并从 endpoint-free recipe 重放。它还为参考四视图 admission 实例化严格前进。

`formal/Cantilune/Feedback/ExecutionEpochTrajectory.lean` 现在将事件标签 Ionescu--Tulcea 样本的每个有限前缀封装为精确原生路径和运行时 `ReplayEpoch`，保留有序事件身份、endpoint-free 全列表 replay，以及每个记录的固定 signature 版本。`RandomizedExecutionEpochTrajectory.lean` 在真正的状态/seed 乘积测度上证明同样结果，`P1cAdmittedExecutionTrajectory.lean` 为具体 admitted 操作实例化两个完整定理。Observation opportunity 与运行时 epoch 仍是不同字段。仍然缺失的是一个跨越 admission 边界的随机异构 signature `EpochChain`。

### 机械化 CPO 片段

以下是真实构造，而非某个无人居住的外部包的字段：

- `FMSCpoWorld`：协变有限 injection world 范畴、successor shift、allocation 自然变换和连续 support hiding；
- `FMSCpoFinitePower`：基于等式序离散 CPO 子范畴的 finite-powerset monad、Fubini/coherence、逐点 world 提升和 shift 相容性；
- `FMSCpoFiniteAgent`：等式序有限递归 agent fold/unfold 同构和一个有限高度 cocone 泛性质；以及
- `FMSCpoContext`：一个非常值 CPO 取值的 supported-syntax 函子，带有自然 support 指称。

聚合 `mechanizedCpoFragment` 恰包含这些结果。在修复 shift 律中两处 parser 级应用后，四个模块和 `FMSExternalPackage` 的定向本地构建成功完成。

## 仍具约束力的边界

### DPOI

内在图范畴等价于其本质像，而非整个无限制 typed slice。`PositionalDPOIBridge` 提供一个无限 carrier 反例，因此整 slice 等价是一个虚假目标。`PositionalPushoutClosure` 现在超越先前六对象前提：对任意 ambient-monic 内在有限位置型合法匹配并显式固定边界保留，它构造规范补和第二 pushout，在内在、presheaf 和 typed slice 表述中证明泛性质，并证明补和结果都位于本质像。`PositionalConcurrencyClosure` 为两个 parallel-independent 规范推导构造有限联合 pullback，并证明两个 residual context、两个顺序结果和两个 residual DPO 见证都保持内在。

这是规范并发菱形所需的有限位置型闭环。它不是内在范畴对每个范畴构造都 M-adhesive/van-Kampen 的抽象证明，也不是 critical-pair 完备性、全局合流或复合产生定理。

### FMS

离散 CPO 有限 powerset 不是 Abramsky 在所有 `ωCPO` 上的 powerdomain。有限递归 agent 不是

```text
A ≅ P(H A)
```

在 `ωCPO^I` 中的 enriched 初始解。Support deletion 尚非具有全部 world、substitution、alpha、scope 和 action-shape 相干性的完整 FMS restriction 操作。`CompleteExternalFMSTheoremPackage` 现在记录精确接受边界：strong-commutative powerdomain 相干性、enriched agent-domain 解、model- 和 world-natural 精确 action shape、相干 name-abstraction restriction，以及锚定到期刊源的操作 strong-late full abstraction。`CompleteFMSAvailable` 是该结构的 `Nonempty`；Cantilune 不定义任何居民，也不重新证明 FMS full-abstraction 定理。

这些事实不是普通的缺失 Lean tactic：它们是实质性的 domain-theory 和 process-semantics 开发，或独立检查的外部定理导入。它们仍是声称完整 FMS 实例的停止条件。

### 全系统一致性

60/60 P1c 结果是一个参考操作矩阵，而非每个 admitted 扩展的完整五层 `CompleteProjectionCertificate` 族。项目仍需：

- DAG、Petri、π 和 morphism 视图的实质性静态 SMC 函子；
- DAG 视图的显式无环/可排序源限制：`DAGScopeObstruction` 内核检查一个良类型自环并证明不存在任何严格 incidence rank 适用于每个 typed open hypergraph；
- 一个共享的一般源规则族和事件出处；
- 每个 admitted symbol 的 resource/admission/terminal/replay 相容性；
- 一般 product execution-package progress 前提；以及
- 独立 QA-L4 review、RFC FCP 通过和 ADR 接受。

任何构建、agent 摘要或 proof manifest 都不得捏造这些人类行动。

## 闭环审计附录 (2026-07-24)

### 全工作树构建证据

当前闭环运行完成了一次完整的固定 worktree `lake build`，**8801 build targets 全部成功**。仓库 CI 随后重检了 146 文件源聚合、18 项 proof manifest、placeholder 禁令和 **213 declarations** 的内核依赖 allowlist。这确立了所导入 Lean 模块和回归示例在此工作树中共同 elaborate 并通过内核检查。这只是本地实现证据：它不是不可变发布结果、独立 proof review、QA-L4 批准、RFC FCP 通过或 ADR 接受。

### 新闭合的有限桥接与内核检查的否定结果

`formal/Cantilune/Core/OpenHypergraphNormalization.lean` 从每个具体 `TypedOpenHypergraph` 构造一个内在位置型有限 hypergraph，方法是丢弃非活动 ambient 标识并仅将有限活动 node 和 edge support 重索引到依赖 type/label 纤维。有序 incidence 和 typed、injective 边界被保留。这是一个对象级 active-support 归一化到有限位置型子范畴；它不是与整个 typed-presheaf slice 的函子等价。

该限制现在是有限的，不仅是无限 carrier 的产物。`formal/Cantilune/Core/PositionalFiniteSliceObstruction.lean` 构造一个有限 typed slice 对象，包含一条 generator 边但省略其所需 source-incidence 位置。Lean 证明它位于位置型编码的本质像之外，因此该编码即便在无限制 slice 的所有有限对象上也不是本质满的。因此整 slice 等价是一个虚假证明义务；诚实正向目标仍是良构位置型本质像及其已证明的有限 DPO 闭环。

`formal/Cantilune/Pi/FMSCpoFinitePowerObstruction.lean` 记录离散 finite-power 构造的精确边界。在通常序 Boolean CPO 上，singleton 到等式序有限集不单调，因此不存在以该 carrier 函数为载体的连续映射。这**并不**反驳或构造 Abramsky powerdomain。它证明现有等式序 finite-powerset monad 不能简单地被逐对象提升到所有 omega-CPO 并称为 FMS powerdomain。

`formal/Cantilune/Pi/P1cLateExhaustiveness.lean` 将原生步骤 soundness 与 full-late-LTS reflection 分离。mismatch 进程恰有其指定的原生迁移，但当前无限制 reconnect 和 quiescent-delete 并行握手也向环境暴露普通可见输出迁移。Lean 构造这些额外迁移并证明不存在任何将源状态映射到这些实际 raw 参考进程的 `ProjectionCertificate` 能反射完整 `Late.NativeStep` 目标 LTS。事件索引包装器仍是一个 sound 原生单步见证，但它对整个 raw late LTS 不具穷尽性。修复需要关于 protocol restriction/hiding、observation scope 或 process 重设计的显式 RFC 决策；实现不得悄然以受限制或弱关系替换目标。

### 现从执行核导出的概率界

`formal/Cantilune/Feedback/KernelFiniteHeightProgress.lean` 从实际有限状态随机核及其 phase 和 stable-window 证书推导有限高度 `H / epsilon` 期望 opportunity 界，而非接受一个不相关的尾部序列。`formal/Cantilune/Pi/P1cAdmittedKernelExpectation.lean` 为具体 admitted mismatch/reconnect/quiescent-delete execution package 以 `H = 1` 和 `epsilon = 1` 实例化该桥接；Lean 证明期望合格 opportunity 至多为 `1`。范围是固定 signature 两状态包中的一个 admitted occurrence。它尚未为异构 signature `EpochChain`、任意多事件 epoch 调度器或每个未来 execution package 建立同样界。

### 函子化归一化、support 相干性、封闭 π 见证与片段 replay

`formal/Cantilune/Core/OpenHypergraphNormalizationFunctor.lean` 将先前对象级 active-support 归一化扩展到具体保持结构的态射，包括源和目标使用不同 ambient 标识类型的态射。Lean 证明 incidence 自然性、identity 和 composition 保持，以及一个全局单射具体匹配归一化为内在范畴和 ambient typed-presheaf slice 中的 monomorphism。`normalizedMatch` 将该映射封装为真正的一般 `AdhesiveDPOI.Match`，`normalized_monic_gluing_has_derivation` 证明普通 presheaf gluing 条件随后产生一个完整 DPO 推导。因此该 transport 边界不再需要 `InterfaceLocal`。这仍不是与无限制 slice 的 full/faithful 等价，也不是内在范畴 M-adhesive 的无条件证明；将任意 parallel-independence 见证 transport 回一个单独打包的具体 active-support 范畴仍未解决。

`formal/Cantilune/Pi/FMSCpoSupportHidingCoherence.lean` 证明实际 support-object allocation/hiding retraction 方程，包括逐点和作为已实现 omega-CPO 函子范畴中连续自然变换的等式。这些是关于非常值 support 模型的真正相干性事实。它们不是 FMS agent-domain、restriction/hiding、adequacy 或 full-abstraction 包的居民。

`formal/Cantilune/Pi/P1cClosedNativeCertificate.lean` 为四个内部事件族提供构造性封闭协议方向：communication、open/close、reconnect 和 quiescent delete 各有一个真正的 strong native $\tau$ 迁移，无弱闭包或事件生成的目标关系。Lean 现在还在所有四个源上证明穷尽性：每个原生导数恰有指定的 $\tau$ 标签和端点。这仍未修复完整 event-isolated reflection 义务。封闭 open/close 端点有一个真正的后续 payload $\tau$ 迁移，`ClosedFullNativeTarget.no_event_isolated_projection_certificate` 证明当前每事件两状态源 LTS 不能反射它。一个经评审的多状态源协议或不同单步 terminal 端点，后随十五事件和 structural-congruence reflection，仍是必要的。

`formal/Cantilune/Feedback/ExecutionEpochTrajectory.lean` 现在记录每个轨迹事件的精确存储源和目标，并为每个有限子片段证明 endpoint-free `DPOEvent` replay 加固定运行时 signature 对齐。因此固定 signature 概率桥接覆盖事件身份、原生路径、存储端点、epoch 对齐和任意有限区间上的 replay。它仍不把经过认证的异构 signature admission 放入一个依赖概率空间，其 replay 解释器也不是一般 presheaf-DPO match/complement/policy 执行器。

### 尚存的决策、外部包与人类评审关卡

以下边界仍开放，且不得被转化为完成声明：

- **RFC-0002 决策：**采纳有限良构位置型本质像作为 DPOI 范畴范围；声明无环/可排序源限制（或改变 DAG 目标）；并在无未声明弱步回退的情况下解决 full-late P1c 协议/观察阻碍。
- **外部 FMS 包或等价机械化：**提供在目标 CPO 范畴上的真正 strong-commutative powerdomain、FMS agent domain 方程的 enriched 解、连续自然 fold/unfold 同构、相干 restriction/hiding、adequacy 以及锚定的 strong-late full-abstraction 结果。`CompleteFMSAvailable` 仍无居民，因此不声称真正 FMS/full-abstraction 实例。
- **一般投影闭环：**为共享一般源规则族提供实质性静态 SMC 和操作证书，而非从有限 P1c 参考矩阵和三个 admitted 操作包外推。
- **人类治理：**category/DPO/Petri、process-semantics/FMS 和 Lean-assumption 评审仍未签署。QA-L4 是目标，RFC-0002 未通过 FCP，ADR-0001 仍为 Proposed 而非 Accepted。

这些现在是显式定理范围或治理关卡。8801-target 构建和 213-declaration axiom 审计不解除它们。

## 审计后闭环修正 (2026-07-24)

本节记录后来的内核构建结果，并在冲突处取代本日志中先前的"仍缺失"描述。它不提升 RFC-0002 或 ADR-0001，也不将本地工作树证据转为 QA-L4 review 证据。

### 一般有限 typed-open-hypergraph DPOI

`formal/Cantilune/Core/GeneralFiniteOpenDPOI.lean` 现在在经受住有限 slice 反例的精确范围上收集正向范畴结果。其主要导出结果为：

- `finite_open_hypergraph_equivalence`：具有指定有序边界、incidence-complete 的有限 typed open hypergraphs 范畴，等价于位置型编码在 adhesive typed-presheaf slice 中的 full、replete 本质像；
- `arbitrary_legal_monic_match_has_intrinsic_dpoi`：任意范畴 occurrence，其 rule legs 和 match 在编码后是 monic，并满足普通 gluing 和 fixed-boundary-retention 条件，具有一个完整内在 two-pushout DPO 见证；
- `arbitrary_parallel_independent_matches_have_intrinsic_residuals`：任意两个 parallel-independent 匹配的两个 residual 推导都 transport 回内在有限范畴；以及
- `arbitrary_parallel_independent_matches_commute`：标准 adhesive 并发菱形有一个保持两个 right-hand-side 像的规范结果同构；以及
- `arbitrary_legal_monic_match_complement_vanKampen`、`arbitrary_legal_monic_match_result_vanKampen` 及其打包定理：两个规范 DPO 方在 ambient adhesive slice 中都是 Van Kampen。

这些陈述对良构有限范畴移除 fixed-host、thin-inclusion 和 `InterfaceLocal` 限制。它们不断言与无限制 slice 的每个对象等价，因为有限 incidence-incomplete 对象和无限对象使该声明为假。它们也不声称 critical-pair 完备性或全局合流。

### 完整原生 P1c 参考精化

`formal/Cantilune/Pi/P1cFullNativeRefinement.lean` 以一个有显式中间状态的内核检查证明形状替换失败的每事件两状态 reflection 尝试。所有 15 个参考事件族以一个真正的 `Late.NativeStep` 开始；open/close 和 restriction 使用其真正两阶段 payload 迁移。目标关系包含每个族标签 raw 进程的每个原生导数，且不施加任何观察过滤。Lean 证明精确 ready-state 迁移分类、`native_sound`、`native_reflect`、每个完成像的原生规范性、terminal 等价、signature-version 保持以及所得 `ProjectionCertificate`。

这闭合了有限 15 族、多状态参考协议的完整原生 soundness/reflection，包括 mismatch 决策、reconnect 和 quiescent delete 作为原生步骤。它取代先前"多状态协议仅为未来修复"的陈述。它仍不制造共享的 product-wide admitted `Config` 规则族、实质性静态 SMC/resource/admission 层或四投影总定理。

### 修正后的 FMS 接受边界

`formal/Cantilune/Pi/FMSExternalPackageObstruction.lean` 证明先前分裂的接受 API 不一致：其泛性质不要求 divergence 保持，而一个后来的相干记录却要求。在空 CPO 上这使所谓自由提升坍缩，并使合并的遗留记录无居民。旧记录仅以 `Legacy*` 名字保留，以便该回归定理仍可检查。

修正后的 `CpoPowerdomainPackage` 将 divergence、deadlock/empty 和幂等选择放入一个结构。它要求 `divergence_ne_empty`、functorial action 和 multiplication 的严格性、strong-commutative Fubini 相干性，以及一个自由泛性质，其候选保持 unit、divergence、deadlock 和 choice。完整 FMS 接受记录进一步要求局部连续 action、精确 world/action 和 parallel-composition 相干性、规范 abstraction/restriction 指称、组合式 hiding，以及操作和 world-indexed 的 strong-late full-abstraction 桥接。

这是一个内部修正的规范，说明一个导入或机械化的 FMS 模型必须证明什么。Cantilune 仍不定义 `CompleteFMSAvailable` 的任何居民：未提供真正的 all-omega-CPO Abramsky powerdomain、连续递归 agent-domain 解或检查过的 full-abstraction 实例。因此不允许无条件 FMS/full-abstraction 完成声明。

binder 级 hiding 桥接现在是精确的，而非仅一侧的。`FMSBinderInstantiation` 证明 last-name abstraction/substitution 往返，包括嵌套 binder 下所需的自由名重命名，并证明新扩展 body 的规范 restriction 是普通语法 restriction。`FMSExternalPackage` 将该方程提升到其条件指称相干性接口。

`FMSExactAcceptance` 也更紧地锚定缺失的语义构造。其 stage transition 由 domain 展开和 powerdomain 观察定义；restriction 是一个四分支 action fold；left merge 使用 powerdomain map；synchronization 使用 Fubini、map 和 multiplication；而 parallel 恰是两个 left merge 和两个 synchronization 的四路选择。所有非握手 action 对被要求指称为 deadlock。这仍是一个接受结构，而非构造：精确 Table-2 restriction 案例映射仍是提供的数据，且不存在 `ExactFMSAvailable` 或 `CompleteFMSAvailable` 居民。

### 任意有限异构事件轨迹

`formal/Cantilune/Feedback/FiniteHeterogeneousTrajectory.lean` 现在为每个有限 `EpochChain` 构造 `ChainTraceAgreement`。依赖有序事件列表同时包含固定 signature 原生 `DPOEvent` 和经过认证的 signature-admission 边界。每个事件位于精确链路径上，按其自身事件种类 replay，并与运行时执行 epoch 对齐；调用方不提供 trajectory-agreement 前提。

`formal/Cantilune/Feedback/FiniteHeterogeneousProbability.lean` 随后以一个真正确定性 Ionescu--Tulcea 核采样规范 type-zero 相空间 `Fin (length(traceEvents chain) + 1)`。几乎所有路径遵循精确有限调度，因此携带完整有序原生事件、DPO/admission replay 和 execution-epoch 一致。一旦所有记录事件运行完毕，核在最终 phase 永久 stutter。该自环明确是行政性的：它不被装饰或计为 `DPOEvent` 或 signature admission。

这闭合了有限异构 execution-epoch 概率桥接。它不把运行时执行 epoch 等同于反馈 `opportunityEpoch`。将 observation opportunity、fairness window 和 accepted-progress opportunity 与此事件调度对齐，仍需要为每个 execution package 提供一个具体调度器证书。

`FiniteHeterogeneousRandomKernel` 将确定性 phase 核推广到调用方提供的 Markov 核。若每个非终 phase 以概率 1 前进且终 phase 是吸收的，Lean 推导与规范 phase 调度几乎必然相等，因此得到同样完整的事件标签、可重放、execution-epoch 对齐轨迹。该前提强制 phase 律为 Dirac；此定理尚未对竞争业务事件间的随机选择建模。

### 静态/操作相干性现为显式关卡

先前 complete-certificate 记录打包了静态 SMC 函子和操作投影证书，而未关联其状态像。`Core/CoherentProjection` 现在添加 Arrow-category 状态表示、源和目标重写 cell、状态像同构以及每个映射重写步骤的精确 commuting-square 方程。`Theorems/CoherentFourProjection` 要求四个此类跨层相干证书后才产生相应总定理。

realization 接口现在也是商感知的。其选择的状态 setoid 恰是表示 arrow 上的范畴同构；所择同构满足自反、对称和传递相干性；更换步骤代表共轭同一重写 cell。这对 α/structural π 是必需的，而非假设字面代表相等。

这些添加闭合了定理接口中的一个反空洞缺陷；它们不提供该 product 定理。仓库仍无共享源 execution package 连同实质性 DAG、Petri、π 和 morphism 的相干证书记录居民。

### 仓库与治理状态

`formal/` 的顶层 ignore 规则已移除；仅生成的 Lean build/cache 目录仍被忽略。在本记录时，`.gitignore` 已修改且 `formal/` 在工作树中仍 untracked。因此新证明既无不可变 commit 绑定出处，也无独立评审。QA-L4 仍是目标，RFC-0002 仍为 pre-FCP/Draft，ADR-0001 仍为 Proposed。

## 最终接口与随机修正 (2026-07-24)

这些后续结果在不改变治理状态的情况下精化前述范围。

### 内在 DPO transport 与独立本质像谓词

`GeneralFiniteOpenDPOI` 现在通过有限 image/preimage 同构 transport 每个任意编码 monic 合法匹配，并为原始 rule legs 和 occurrence 暴露交换方程。两个 residual 匹配和并发结果都 transport 回内在见证。

范畴范围不再仅以"由编码器产生的对象"刻画。`PositionalImageCharacterization` 定义独立 ambient 谓词 `ExactPositionalObject`：有限 carrier、每个 edge/port 描述恰有一个 typed incidence、指定有序边界类型、且无重复边界附着。它重构一个内在图并证明 `essImage X ↔ ExactPositionalObject X`，包括在 ambient 同构下的 repleteness。`PositionalBoundaryDuplicateObstruction` 给出一个有限、incidence-complete、固定边界但有重复边界附着的对象，并证明它在此像之外。因此无限制有限 slice 被机械地排除，而精确良构子范畴有所需等价和 DPO/并发 transport。

### 结构 late-π 边界

`P1cStructuralLateBridge` 证明 15 族精化协议的每一步，包括两个 payload 后续，都是未过滤 α/structural strong-late LTS 的真正步骤。它还证明纯 raw 进程投影的两个精确限制：

- delegation 和 reconnect 有相同 raw source/action/target 三元，因此源事件身份不能仅从该三元恢复；以及
- 规范 pure-process 状态映射不能居住当前 `ProjectionCertificate`，因为动态 admission 将运行时 signature 版本从 0 变为 1，而纯 π LTS 对每个进程指派版本 0。

族标签原生证书在其声明的有限范围仍完整。结构结果是真正单步 soundness，而非弱归约，但一个 product 证书现在需要 RFC 级选择：将运行时 signature 元数据从纯 π 投影分离，或使用一个显式 version-enriched 目标。该不匹配不通过更改目标关系来隐藏。

### 采样依赖标签与真正有限分支

`FiniteHeterogeneousMarkedKernel` 强化规范异构调度：一个正业务边携带一个真正依赖 `ChainStepMark`、其原生 `ChainStep`、精确事件端点、replay 和运行时 execution-epoch 对齐。吸收终边是一个不同的行政构造符，不能被误认为 `DPOEvent`。

`FiniteBranchingReplayKernel` 为有限核移除同端点事件坍缩问题。概率被指派给显式业务选择。采样后继存储该精确选择，因此两个有相同无标记源和目标的正事件仍是不同的随机状态。几乎所有 Ionescu--Tulcea 路径携带有序采样选择及其依赖 `ReplayEvent` 见证。见证类型可打包原生推导、可执行 DPO/admission replay 和 epoch 对齐。

这是一个真正的分支事件级构造，但尚非在无界运行时调度器上的产品实例化。每个具体 execution package 仍须提供其有限选择族和权重，将反馈 opportunity epoch 关联到 execution epoch，并推导其 fairness、stable-window 和 positive-epsilon 假设。

### FMS 现为不可绕过的产品关卡

FMS 审计发现 `ExactFMSAvailable` 和 `CompleteFMSAvailable` 无居民，更重要的是，先前四投影复合定理不要求它们。一个零 axiom 构建因此能复合四个通用证书而不授权指称 FMS 声明。

`FMSGatedFourProjection` 闭合该接口缺陷。其输入包含一个具体 `ExactFMSAcceptancePackage` 连同四个跨层相干证书。它还要求 `OperationalFMSPiCoherence`：被映射源状态由封闭 raw π 进程表示、目标状态有 FMS 指称、目标事件有 raw action、setoid 等价状态指称相等、且从映射源出发的目标原生步等价于相应提供的 FMS transition。最强结论同时保留精确包和该 π/FMS 桥接。有限/离散 support 片段不能应用此定理。本仓库未构造任何包或桥接，因此该关卡暴露而非解除剩余阻碍。

外部数学工作仍相当可观：一个 all-ωCPO powerdomain、递归 agent domain 方程的连续解、源标识的 Table-2 restriction 条款、完整 action/parallel 相干性、一个 all-world 操作桥接，以及 strong-late full-abstraction 证明。当前 mathlib 提供 ωCPO 和连续性基础设施，但不提供所需 algebraic-compactness/domain-equation 或 Abramsky powerdomain 开发。

## 扩展族、support 与反馈延续 (2026-07-25)

本延续记录本地内核构建结果。这仅是实现证据：以下声明均无不可变 commit 出处或独立 QA-L4 评审。

### Signature 索引投影族

`Core/ProjectionFamily` 现在使 signature 扩展是操作的而非 proof-valued 的。`ReindexableExecutionFamily` 在每个有限 signature 处包含一个 `ExecutionPackage` 以及满足 identity 和 composition 方程的实际状态/事件映射。`ExecutionPackage.Reindexing` 额外通过相等性固定被重索引 configuration 和完整 `DPOEvent.Verified` 记录。因此其 replay 定理陈述目标核执行相同被重索引源和目标 configuration，而非仅某事件存在。

`Theorems/FourProjectionFamily` 强制 DAG、Petri、π 和 morphism 目标族共享一个源族。在每个 signature 处它推导普通四投影路径、reflection、terminal 和 version 结果。跨两个可组合 admission 它证明所有四个状态自然性方块，且在任何扩展之后它证明所有四个投影事件记录重放其精确被重索引 configuration。该回归由一个真正的全 signature identity execution 族居住。

这闭合了扩展索引接口和 replay 复合缺陷。它不构造产品目标族，也不将跨 signature admission 误分类为固定 signature `DPOEvent`；`AdmissionReplays` 仍是异构边界。

### 一个 epoch 内的完整采样边

`Feedback/FourProjectionSampledTrajectory` 从一条采样依赖业务边推导所有证据：源事件和原生推导、已验证 DPO 记录和精确端点、运行时/opportunity epoch 相等、一个 singleton replay epoch 和 epoch 链，以及所有四个带端点版本的原生投影步骤。`PointwiseAgreement` 因此是一个非平凡命题，而 `completeSampledTrajectory_almostSure` 从实际分支 Ionescu--Tulcea 路径律得到它。

该定理对固定 signature 是精确的。一个后来的 admission 仍是 epoch 间的 `AdmissionReplays` 边。一个产品异构调度器必须组合这两种情形并推导其授权、fairness、stable window 和 positive-epsilon 前提。

### Standard late request/accept 边界

`Pi/LateAlphaSupport` 证明自由名和可执行前缀在 alpha 等价和 structural congruence 下不变。它结构化刻画结构同余于零的进程，并机械证明 choice 幂等不被当前 standard structural congruence 生成。因此 S4 律属于一个单独的等式或 bisimulation 层，不能在原生 late-transition 反演中悄然使用。

`Pi/P1bStructuralLateBridge` 证明两个有限 request/accept 源事件都映射到真正未过滤单步 structural strong-late 推导，连同 success、external-wait 和 signature-version 方程。其完整证书构造器仍显式以 `StandardLateReflection` 为条件：一个 residual/uniqueness 定理仍须从封闭握手的每个结构同余代表分类原生导数。未使用任何弱步闭包或观察过滤。

### 可排序 DAG 与授权反馈

`Projection/RankableDAG` 给出 self-loop 阻碍的正面对应。每个带显式严格 incidence rank 的 typed open hypergraph 映射到一个包含每个活动 source/target 对的有限严格 DAG。投影边反映为真实 hyperedge incidence、输入和输出边界 node 仍存在、同态保持依赖边、且每个投影有向环都不可能。DPO 规则仍须携带 target-rank 保持。

`Feedback/AuthorizedVoting` 使观察者授权成为存储 ballot 的不变量，证明 identity 去重记录幂等、不同观察者记录可交换，并在无隐藏 tie-break 的情况下分类批准、拒绝和同时 quorum 冲突。一个合格聚合成为一个单调 evidence 事件，但不能自主改变被观察方的接受位。

`Pi/P1cSupportedFeedbackBridge` 将每个 admitted occurrence 的正随机 support 连接到一个具体反馈 execution package。业务进展严格提升 evidence，且完成 external hold 保持稳定性。独立定理 `no_totalized_feedback_map` 证明仅用于 totalize 事件选择器的零质量行政 reset 不能属于任何逐路径单调 pending/completed 反馈映射。因此零概率不被用来为虚假迁移定理开脱。

### 离散 finite-power 模型不是 FMS powerdomain

`Pi/FMSCpoFinitePowerObstruction` 在实际 ωCPO 上构造等式序有限集自函子及其到 `World ⥤ ωCPO` 的逐点提升。它随后证明一个连续 singleton 分量会迫使源 CPO 的每个可比对相等，并推导 `no_naive_singleton_unit` 和 `no_naive_pointwise_singleton_unit`。

这是一个更强的类型正确否定边界：离散 `Finset` 片段不能逐点提升为 FMS powerdomain monad。它不构造所需 Abramsky powerdomain、不解递归 agent domain、也不证明 hiding/full abstraction。

外部源更精确地固定剩余接受声明。FMS Proposition 2.2 说，若提供，则一个合适的 Abramsky powerdomain 在 base Cpo 范畴上逐点提升到 `Cpo^I`。agent 构造随后使用

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X),
```

而 Theorem 3.2 和 3.3 陈述有限和完整 closed strong-late full-abstraction 结果（[作者托管 PDF](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)）。这些是外部论文定理，不是由本 Lean 核检查的声明。记录它们不制造一个无 axiom 的本地 powerdomain、domain-equation 解或接受包居民。

### 精确位置型范畴，而非无限制 slice

`Core/ExactPositionalDPOI` 将来自 `PositionalImageCharacterization` 的独立对象谓词提升为一个显式范畴等价。到完整 exact-positional 子范畴的直接编码是 faithful、full 且本质满的；其重构同构是显式的。它还保持和反映 monomorphism，并暴露 DPO 开发所用的同一底层编码 arrow。

因此 fixed host、thin inclusion 和 `InterfaceLocal` 匹配不再是 exact-positional 范畴桥接的一部分。目标仍是由有限 carrier、完整 typed incidence、精确有序边界和 injective 边界附着所选的 full 子范畴。它有意不是无限制 typed-presheaf slice。

### 异构四投影采样轨迹

`Feedback/FiniteHeterogeneousFourProjection` 为依赖 `EpochChain` 的每个固定 signature epoch 指派一个 `FourProjectionCertificate`。从规范 marked-kernel 路径律它证明几乎每个非终 phase 携带一个采样依赖 mark、其 replay、execution-epoch 对齐和投影证据。业务边保留 `DPOOccurrence` 和四个原生目标推导；signature 边界保留 `AdmissionOccurrence`/`AdmissionReplays` 且永不被重铸为同 signature DPO 事件。

族级定理要求 `SourceFamilyAlignment`。这不是证明便利：`SomeReplayEpoch.package` 是任意存在数据，不能在定义上等同于共享源族。同样，四个目标 admission replay 不能从纯重索引获得。`pure_reindex_ne_admission_target` 及其 replay 特化推论证明 `Config.reindex` 保持 `signatureVersion`，而 admission 目标严格前进它。因此产品接口需要单独的异构 target-admission 迁移和 replay 证据，而非对 `Reindexing.mapState` 的隐藏相等。

## 原生规则与生成轨迹延续 (2026-07-25)

本延续是工作树实现证据。定向 Lean 构建已在本地执行，但这些声明仍缺不可变 commit 出处和独立 QA-L4 评审。

### 规范 typed standard-late 关系

`Pi/OperationalBridge` 现在区分历史可执行 typed 核与合法 standard 关系。`Step.StandardNativeStep` 包含一个 typed 推导连同每个递归所需的 freshness 和 capture-avoidance 前提。定理 `Step.standard_typed_pi_erasure_operational` 将每个此类合法迁移映射到一个独立定义的 `Late.NativeStep`；它不使用 structural 闭包、观察过滤或弱迁移。

`Pi/P1cLateBridge` 为十五个 P1c 事件族的每一个证明 `piAdequate_standard_typed`，包括 mismatch 决策、reconnect 和 quiescent delete。因此全部六十个矩阵单元现在都有其独立声明的目标推导和合法 typed standard-late 见证。遗留 typed `Step` 仍可执行且仍擦除到 `Raw.Step`，但当旧构造符缺少 standard freshness 前提时，它不被悄然重分类为 standard。

`LateAlphaSupport` 另外证明 capture-avoiding substitution 保持前缀计数、每个原生或结构封闭 standard-late 步严格减少该计数、无前缀源不能步进、且从封闭源出发的每个迁移 action 为 `tau`。这些是反演不变量，而非正面示例。

### P1c 事件记录与实际 admitted 操作

`Pi/P1cBusinessReplayMatrix` 将除动态 admission 外的每个固定 signature P1c 族打包为一个确定性 `Config` occurrence。其 endpoint-free recipe 重计算 policy/audit 端点；公共记录携带已验证 `DPOEvent`、全部四个原生矩阵推导和一个真正 standard-late 迁移。一个非空 `ExecutionPackage` 包含全部十四个事件。该包有意设计为审计/参考演算，不假装其 policy 游标递增就是最终产品图语义。

对于 mismatch、reconnect 和 quiescent delete，`P1cAdmittedOperations` 仍是更强构造：图、资源、名、enabling、匹配指纹和精确 replay 都从同一 admitted occurrence 计算。动态 partner admission 仍是异构 `AdmissionReplays` 边，因为其源和目标 signature 不同。

因此族标签 `P1cFullNativeRefinement.certificate` 是完整操作 P1c 参考证书。遗忘族/版本出处对 reflection 不是语义保持的：delegation 和 reconnect 可有相同 raw 迁移三元，且 raw 进程语法不携带运行时 signature 版本。

### 具体事件/epoch/replay 一致

`P1cAdmittedExecutionTrajectory.concreteTrajectoryAgreement` 将通用确定性装饰特化到每个实际 admitted-operation `ExecutionPackage`。其状态投影是采样 Boolean 路径，其索引 `n` 处事件恰为从相邻状态选择的标签，每个被选 `DPOEvent.Verified` 独立重放于两个精确相邻 `Config` 值之间，且同一对象与 stable/fair opportunity 窗口和运行时 signature epoch 对齐。相应 almost-sure 定理额外排除零质量 totalizer 并保持 hitting 结果。

`Feedback/FiniteExecutableHeterogeneousRuntime` 移除有限跨 signature 参考运行的剩余非空洞担忧。其调度器本身发出旧业务、signature-admission 和新业务依赖事件；其随机核由该迁移函数生成。几乎所有路径在每个边上保留业务 `DPOOccurrence`、精确 `AdmissionOccurrence`、replay/epoch 证据和四个独立 typed 原生目标推导。事件 mark 对固定依赖边是唯一的，且每个目标 admission 严格改变目标 epoch。这是一个具体有限参考调度器，而非 product 授权、quorum policy、fairness、stable-window 或 positive-epsilon 前提的推导。

### 真正有限严格 CPO 幂片段

`Pi/FMSCpoFiniteStrictPower` 构造

```text
P_s α = (Set α)⊥
```

对有限 `α` 作为一个真正的非离散 omega-CPO。所加 bottom 是 divergence，嵌入的 empty 是不同的 deadlock，而严格 union 是一个连续的、结合的、交换的、幂等的、以 deadlock 为单位的 choice。直接像在有限源上连续且保持 identity 和 composition；singleton 从等式序有限基是自然的。特别地，`P_s PUnit` 包含严格链 `divergence < deadlock < return unit`。这给出本地 `NondeterministicComputation` 接口的一个真正居民。

它仍不能居住 `CpoPowerdomainPackage`。有序 Boolean no-go 证明所需 singleton 不能由朴素构造连续扩展。一个真正的 all-omega-CPO Abramsky/omega-ideal 完备、其自由泛性质、strong-commutative 和 Kleisli 相干性、一个局部连续递归 agent-domain 解、相干 hiding/action 映射，以及论文的 full-abstraction 定理仍是未形式化的外部数学。

### 精确剩余 P1b 反演义务

完整 request/accept 现被证明不能采取任何 structural strong-late 步：`newZero` 和 `parZero` 不能创造前缀。对 requesting 或 established 状态未找到强反例。剩余定理是精确的：将一个原生通信 residual transport 通过任意 `Struct.trans/symm/alpha/ACU/scopeExtrude` 链，并证明输入 binder alpha 重命名加 capture-avoiding substitution 产生一个结构同余的规范 residual，包括 `res(com)` 对 `open+close` 表述。在该 residual 相干定理被内核证明之前，`StandardLateReflection` 和未过滤结构 P1b 证书仍开放。

### 共享 P1a 业务证书与具体 terminal 分类

`P1aBusinessProjectionCertificates` 现在用 `P1cBusinessReplayMatrix.ReferenceExecution.package` 的十四个固定 signature 事件作为一个共享源。其 DAG、Petri 和 morphism 目标保留事件族索引，并要求每个目标步骤有一个独立定义的原生矩阵推导。每个投影有单步 soundness、精确 reflection、路径覆盖、terminal 保持和源包的 endpoint-free 已验证 `DPOEvent` replay。这强于先前不相关的单事件 fixture。

carrier 有意为空图和资源纤维。因此它不证明任意 admitted DPO 规则保持 DAG rank、重建声明序 individual-token pre-net，或提供 product 静态 SMC、资源和异构 admission 解释。这些义务保持显式，而非隐藏在共享包装器之后。

`P1cTerminalExecutionClassification` 将 terminal 谓词连接到每个具体 admitted mismatch/reconnect/quiescent-delete occurrence。在一个共享可重放业务事件之后，外部 policy 恰选择成功终止、open external wait、真正 deadlock 或显式 productive 无限 external-hold 轨迹之一。四类两两不相交。每个分类端点重放同一已验证业务记录、等于 occurrence 计算的目标 `Config`、并保留四视图公共推导和基于 ownership 的 resource/session 证明。policy 分支分类重写后处置；它不发明四个图重写或冻结产品 policy。

### 2026-07-25 全工作树验证

这些更改后完整本地证据关卡通过：234 个 Lean 源文件、8889 个 build job、零整词 proof placeholder，以及 487 个已解析内核依赖报告。每个被审计声明仅依赖于 allowlisted 的 `propext`、`Classical.choice` 和 `Quot.sound`。源聚合为 `282869e3bae154431bd49e612fd34183350f81978f70d042af8a981b3f3574a2`。精确命令和边界记录于 `formal/build-evidence/2026-07-25-local.md`。

此证据是本地且未提交的。它不是不可变出处、独立 QA-L4 评审、FCP 批准或 ADR 接受。

## 2026-07-25 P1b reflection-分解辅助与构建恢复

本迭代添加朝向开放 P1b `StandardLateReflection` 义务的内核检查脚手架，并恢复 untracked `formal/` 工作树的干净完整构建。它不提升任何中心义务。

- `P1bStructuralLateBridge.step_decompose` 已内核检查：每个 `Late.structuralLateLTS.ObservableStep (mapState state) action target` 分解为 `Struct (mapState state) source'`、一个 `Late.NativeStep source' action target'` 和 `Struct target' target`。这是已完成 `StandardLateReflection` 证明必须驱动的已验证子结构；它恰是 `Step.congr` 的形状，其中 `Step.native` identity 情形被折入。
- `P1bStructuralLateBridge.complete_reflect` 已内核检查：没有 `Late.Step` 通过任何结构同余代表离开完整 request/accept 状态，因为结构同余保持 `prefixCount`（`Late.Struct.prefixCount_eq`）且一个原生 strong-late 步需要正 `prefixCount`（`Late.NativeStep.source_prefixCount_pos`）。这解除 `StandardLateReflection` 的 `complete` 情形。
- `requesting` 和 `established` 情形仍开放。所需 `requesting_structural_native_residual` 须从 `Struct (mapState requesting) source'` 和 `NativeStep source' action target'` 推导 `action = .tau` 和 `Struct target' (mapState established)`（对 `established` 类似），覆盖 `res(com)` 对 scope-extruded `open+close`、alpha 重命名的输入/restriction binder、capture-avoiding substitution、ACU、`newComm`、`trans` 和 `symm`。freshness 阻塞的 `scopeExtrude` 观察（session 名在 request 分量中自由且 public 名在 accept 分量中自由，故两个 restriction 都不能跨其并行 partner 外延）将相关 congruence 缩窄到 ACU/α/`newComm`，这是下一归纳 pass 的目标。本记录记录该缩窄；归纳尚未内核检查。
- 两个工作树缺陷曾阻止干净完整构建，现已修正：`P1cAdmittedP1aCertificates.lean` 现导入 `Cantilune.Core.Package`（否则其 `ExecutionPackage` 引用无法解析），且其回归测试现使用全限定 `Cantilune.Pi.P1cAdmittedOperations.DAG.Step`（及 `Petri`/`Morphism`）标识符。
- 两处证据关卡修复：一个使用英文动词 "admit" 的文档注释被改写，使其不再触发禁用 placeholder 整词关卡（`sorry`/`admit`/`axiom`/`unsafe` 安全意图不变）；且 `scripts/ci.ps1` 现以 UTF-8 解码 `lake env lean` axiom-审计输出再进行正则解析，使非 ASCII 声明名如 `finite_chain_reaches_ωSup` 能往返并对照同一 `propext`/`Classical.choice`/`Quot.sound` allowlist 审计。
- 完整证据关卡现通过：241 个 Lean 文件，聚合 `8f36587fdbd23db27f251cd33c0a1e8d699a56ee48f97b4fad904e42817b5bef`，8894 个 build job，零禁用 placeholder，记录 allowlist 上 487 个被审计声明。见 `formal/build-evidence/2026-07-25-worktree-2.md`。

这是未提交的本地证据。未提升任何义务。重申 FMS 实现边界：不存在 `CompleteFMSAvailable` 居民，故工作树定理仅覆盖已证子语言。这不是采纳的规范回退；在当前 RFC 草案下，完整 FMS 居民仍是强制的，除非 FCP 接受拟议的 finite-control 边界。剩余承重工作在种类上不变：`requesting`/`established` 结构 residual transport、真正完整 FMS 居民、产品规则族/静态/资源居民、调度器前提、不可变 commit 证据，以及独立 QA-L4/FCP/ADR 评审。

## 承重收敛延续 (2026-07-25)

### Established P1b residual 现已精确

`LateAlphaSupport` 将可执行通信前缀与一元 `tau`/guard 前缀分离，并单独记录用作前缀主语的自由名。后者区分是必要的，因为 established request/accept 进程有自由 payload 值但无自由 channel 主语。alpha 转换、capture-avoiding substitution 和所选 structural congruence 保持相关计数和自由主语接口。从双前缀纯通信源出发的原生静默迁移消耗两个前缀。

使用这些不变量，`P1bStructuralLateBridge.established_structural_residual` 证明，对从映射 established 状态出发的每个 structural strong-late 步，action 恰为 `tau` 且目标结构同余于映射 complete 状态。该定理既不使用弱闭包也不使用观察过滤。其定向 Lean 构建通过。连同先前已检查的 complete-state no-step 定理，在 `StandardLateReflection` 可被居住之前，仅剩 requesting-state residual。

requesting residual 不能仅由前缀计数解除。其证明仍须将 public-channel 通信 transport 通过任意 alpha/ACU/restriction/scope-extrusion 表述，并证明 capture-avoiding substitution 产生规范 established 状态模 `Late.Struct`。在 alpha 重命名下，bound input 标签的一般精确相等为假；正确的 residual 陈述须考虑 bound 标签同时保留精确顶层 `tau` 迁移。

一个更强的尝试捷径现被机械反驳。令 `L = send 0 1 (send 2 1 zero)`、`P = par L (recv 0 2 zero)` 和 `Q = par L (recv 0 3 zero)`。输入 binder alpha 转换给出 `Struct P Q`。进程 `Q` 有原生 `tau` 同步，因为 binder `3` 对 sender continuation 是新鲜的，但 `P` 没有原生 `tau`，因为 binder `2` 在该 continuation 中自由出现。因此被检查声明 `residualCounterexample_struct`、`residualCounterexample_alpha_native` 和 `residualCounterexample_no_original_native` 排除了一个跨 `Struct` transport 每个原生 `tau` 步的全局定理。剩余证明须是源特定的 requesting-orbit 分类；它不能诉诸一个虚假的一般原生 residual 引理。

### 授权反馈与正事件轨迹

`Feedback/AuthorizedFeedbackExecution` 现将批准、拒绝、冲突、被观察方接受/拒绝和显式 external hold 放入一个有限 `ExecutionPackage`。其事件记录是 endpoint-free replay recipe；授权 ballot 更新被去重且与排列无关；冲突聚合保持被观察方自主性；决策后 hold 是显式 productive 无限轨迹。

`Feedback/PositiveEventTrajectory` 仅标记正质量核边。因此它避免给零概率对指派一个捏造的行政事件。`Feedback/AuthorizedFeedbackProbability` 在同一 execution package 上构造一个确定性原生核，以 `epsilon = 1` 提供一个 stable/fair 窗口，推导两 phase 期望 hitting 界，并将每条正路径耦合到原生事件身份、精确 `DPOEvent` replay 和 epoch 对齐。当前增补源在最后一次全工作树证据快照之后添加，需要新的固定构建后其 manifest 状态才能改变。

### Complete FMS 仍是基础依赖，而非本地接口缺口

主要 Fiore--Moggi--Sangiorgi 源使用协变函子范畴 `Cpo^I`，逐点提升一个 Abramsky powerdomain，并通过

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X).
```

定义 agent domain。论文对解调用标准 domain-equation 技术，且不提供可直接转译到当前 Lean 库的构造。剩余本地依赖链仍是：

```text
all-omega-CPO powerdomain monad
  → locally continuous H
  → embedding/projection omega-chain bilimits
  → algebraic compactness and A ≅ P(H A)
  → coherent hiding/action maps
  → adequacy and definability
  → source-pinned full abstraction.
```

当前 mathlib 提供 omega-CPO 和连续映射，但不提供该组合 powerdomain/algebraic-compactness 开发。有限严格 `WithBot (Set α)` 片段不能填补该角色。因此 RFC-0002 §16 记录一个拟议 finite-control P1 边界，但该提案尚未生效：在当前草案边界下，完整 FMS 居民仍是强制的，除非 FCP 接受该范围变更。

### 证据与治理边界

独立完整性助手先前将 `formal/scripts/` 视为形式源根。它现使用与 `scripts/ci.ps1` 相同的父目录边界。这修复未来聚合计算但不回溯验证已变更源。最后完整证据记录仍是历史快照；所有后续 Lean 变更需要新的固定构建、内核依赖审计、不可变 commit 和独立 QA-L4 评审。RFC-0002 仍为 Draft/pre-FCP，ADR-0001 仍为 Proposed。

## Requesting 范式与 product/反馈 admission 检查点
   (2026-07-25)

### 内核检查检查点

在后来引入指纹草案之前，`Cantilune.Pi.P1bRequestingNormalForm` 和 `Cantilune.Pi.P1bStructuralLateBridge` 均通过定向 Lake 构建。范式定理 `Late.NativeStep.two_communication_prefix_tau_pair_form` 将从恰有双通信前缀且目标无前缀的源出发的原生静默迁移分类为有限 restriction 列表下的结构同余 output/input 对。其 close 情形保留 bound-output restriction，故该定理在双前缀边界覆盖自由 `com` 和 `open`/`close` 表述。

该定理闭合 established-to-complete 范式。它**不**分类 requesting 状态的四前缀源。特别地，raw 前缀/support 计数不决定两个被 guard continuation 是否有 request/accept binder-incidence 模式。因此 requesting residual、`StandardLateReflection` 和所得未过滤 standard-late P1b 证书仍开放。

### 未验证增量源

三个后来添加被有意记录为源级工作而非内核证据：

- `P1bRequestingFingerprint` 开发候选极性、guarded-thread、choice 和 binder-incidence 不变量。它与已构建范式模块隔离，且无当前定向构建证据。
- `ProductRuleAdmission` 定义一个参数化 product-rule 证书，要求一个共享四投影源 occurrence、admission、rank/resource/session/deletion 证据、授权，以及或内部 rank 递减或正精确外部核边。它不构造 product 居民。一个后来的类型审计发现该第一版本事实上无居民；见下文否定结果。
- `AuthorizedFeedbackClosure` 尝试将已构造授权 execution package 和生成核打包为一个非空参考见证，携带硬稳定性、自主性、精确事件 replay、epoch 对齐、期望 hitting 界和 productive accept/reject 轨迹。

这些模块在最后一次完整证据快照之后添加。其定向构建无法在当前沙箱中运行：Elan 可执行但无法再访问已安装的 4.32.0 工具链，尝试 GitHub 下载，并在 Lean 编译之前因网络访问禁用而失败。这是验证环境失败，不是声明真假的证据。因此不在此基础上提升任何中心义务。

在整理源文件后，`scripts/ci.ps1` 的确定性预构建部分对 249 个 Lean 源通过：聚合为 `b47ad145a774b6f6063d2558269df255ed1111289c7f3a4304d84ecfd9f3a94a`，固定输入哈希与 `source-integrity.json` 一致，且整词 placeholder 计数为零。命令随后在 `lake --version` 之前停止，因为 `lake` 在沙箱中不可见。不对该聚合声称任何完整构建或 axiom 报告。

### 否定结果：七值 requesting 指纹不足

一个源级反例反驳了将七个聚合指纹值作为完整 requesting 范式的尝试。以 `0` 为 public 名、`1` 为 session 名、`2` 为输入 binder，令

```text
B =
  new 0 (new 1
    (par
      (send 0 1 (send 1 0 zero))
      (recv 0 2 (recv 2 2 zero))))
```

`B` 有 `headPrefixCount = 2`、`topThreadSquareMass = 8`、`choicePotential = 0`、两个 send 前缀、两个 receive 前缀、一个 output link 和一个 input link。公共 output/input 对有一个合法原生 strong `tau` 同步，由两个 restriction 保留，到

```text
B' =
  new 0 (new 1
    (par (send 1 0 zero) (recv 1 2 zero))).
```

然而，规范 established 端点形如

```text
new 0 (new 1
  (par (send 1 3 zero) (recv 1 4 zero))),
```

其自由名集为 `{3}`，而 `B'` 无自由名。由于 `Late.Struct` 保持自由名，两端点不能结构同余。这是源定义层的数学反例；专用 Lean 回归仍需不可用工具链才能称为内核检查。

因此 requesting 证明须保留一个位置型、binder 感知的 continuation 签名：至少 guarded output 中的自由 payload 身份/出现、sent-name/next-subject 边、input-binder 边和 restriction incidence。数值极性和 link 计数仍是有用必要不变量，但对 4-to-2 residual 不足。

隔离源现将这七个数字连同精确自由名集 `{payload}` 和空自由主语集打包。新 `badRequesting_not_augmented` 回归仅显示这两个名义字段排除已知七值反例。该九字段 `AugmentedRequestingFingerprint` 仍是必要候选，而非已证完整范式：没有穷尽 structural/native 反演定理从其推导 requesting residual。同一未构建模块现还推导精确算术范式——两个长度二的 enabled 线程、四个总前缀、全部四个通信前缀、零个一元前缀。这移除数值上界子目标，但仍不识别两个 guarded continuation、其 binder 或原生 residual。本模块所有新声明仍待定向构建。

### 否定结果：首个 product-admission 接口无居民

首个 `ProductRuleAdmission.Certificate` 对其参数任何选择都不能有值。其字段 `coherent : FourCoherentProjectionCertificates ...` 包含一个 `CompleteProjectionCertificate.admissionCompatible`，其源步骤位于 `source.lts`。但 `source` 是一个固定 signature 的 `ExecutionPackage`。内核检查定理 `ExecutionEpochTrace.observable_step_lts_version_preserved` 说每个此类 package 步保持其运行时 signature 版本，因为它重放一个同 signature `DPOEvent`。

admission 相容性字段同时将源步骤的端点版本等同于 `signatureAdmission.fromVersion` 和 `signatureAdmission.toVersion`，而 `SignatureAdmissionEvent.advancesEpoch` 要求前者严格小于后者。因此该接口同时推导同一对版本的相等和严格不等。源证明 `certificate_uninhabited_fixed_signature_admission` 记录该矛盾；其新声明仍需定向构建才能称为内核检查。

这不通过删除重复 admission 端点字段来修复。不相容的同 LTS admission 已在 `FourCoherentProjectionCertificates` 内。替换须分离：

1. 固定 signature 业务 occurrence 投影、replay、rank、resource、terminal、授权和调度证据；
2. 作为旧新 execution package 之间异构 `AdmissionReplays` 的源 admission；以及
3. DAG、Petri、π 和 morphism 目标中独立 typed 异构原生 admission 迁移，全部绑定到同一 `SignatureAdmissionEvent`。

既有 `AdjacentAdmission`、`AdmissionOccurrence` 和 `FiniteExecutableHeterogeneousRuntime` 中的四个原生目标推导提供正确形状。新未构建源 `Core/EpochSeparatedProjection.lean` 实现修正接口边界：`CoherentFixedProjectionCertificate`、`HeterogeneousPackageAdmission`、`HeterogeneousAdmissionProjection` 和 `FourTargetAdmissionBundle`，加上核心级固定 package no-go 定理。它有意保持遗留记录不变。没有具体 product 居民将该草案 bundle 连接到实质性静态/范畴、rank、Petri-token、授权、资源或调度证据，且新模块尚未被根导入或内核构建。因此遗留 product-rule 接口仍是否定回归，而替换是未验证接口草案而非完成见证。

### FMS 依赖侦察不是完成证明

当前官方 [mathlib omega-CPO API](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/OmegaCompletePartialOrder.html) 提供 omega-complete 偏序、连续态射和不动点基础，但不提供所需 Abramsky powerdomain 或一般 algebraic-compactness 包。[FMS 源](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf) 仍要求 `Cpo^I` 上的自由 powerdomain 层和递归解 `A = μX. P(HX)`，之后 hiding、adequacy、definability 和 full abstraction 结果才能在本地实例化。

外部 [`scott1972` Lean 仓库](https://github.com/catskillsresearch/scott1972) 是一个可能的未来 domain-equation 依赖：它形式化一个连续格函数空间塔和 `D∞` 的逆极限构造。它不提供 FMS powerdomain、FMS 函子 `H` 的 algebraic compactness、操作 adequacy 或 full abstraction，因此不能按原样居住 `CompleteFMSAvailable`。采纳它还须 RFC 决策、Lean 版本相容工作、源/出处评审和 QA-L4 评审。该侦察不改变任何 manifest 状态。

下一个有效证据检查点须使用固定工具链而无网络抓取，构建每个新模块和回归，重算 `source-integrity.json`，运行全工作树 placeholder 和 axiom 审计，并将结果绑定到不可变 commit。人类 QA-L4、FCP 和 ADR 接受仍是另行后续关卡。

### epoch 分离与算术范式后的静态检查点

在添加未构建 epoch 分离接口和 requesting 算术引理后，确定性源检查点为：

- 250 个 Lean 源文件；
- 聚合 SHA-256 `810a2e19274f42544f3db42c22671c2d88695c807d9b4fbeb95790fe1716fc88`；
- 每个本地 `Cantilune.*` 导入解析到现有源文件；
- 零整词 `sorry`/`admit`/`axiom`/`unsafe` 匹配；
- 18 个 manifest 义务，仍分为 10 个 `implemented_unverified` 和 8 个 `partial_scaffold`；
- 520 个已配置 axiom-审计目标，无重复声明名。

普通证据关卡验证了固定输入、250 文件聚合和 placeholder 扫描，随后在任意 Lean 调用之前停止，因为 `lake` 在沙箱 `PATH` 上不可用。完成变体更早停止，如设计，因为 18 个义务无一为 `reviewed`。两条命令都不是内核构建。特别地，`P1bRequestingFingerprint.lean` 和 `Core/EpochSeparatedProjection.lean` 在其定向构建成功之前仍处于根导入之外；聚合哈希和 placeholder 扫描覆盖其文本但不 elaborate 它。

## 精确量化 P1b residual 与有居民 epoch 边界
   (2026-07-25, 未验证增量)

隔离的 requesting-指纹模块现已在源级证明：一个零一元前缀计数和零活 choice 潜能的原生静默步恰消耗两个前缀：

```text
Late.NativeStep.target_prefixCount_add_two_eq_of_tau_noUnary_noChoice
```

将其应用于九字段 requesting 候选给出 `AugmentedRequestingFingerprint.native_tau_target_prefixCount_eq`：每个原生静默导数恰有两个 residual 前缀。这闭合量化 `4 -> 2` 子目标，以定向内核构建为条件。它仍不识别 residual 的两个 channel、binder 出现或自由 payload 位置，因此不蕴含 `Late.Struct target closedHandshakeResult.erase`。剩余 P1b 论证需要两个 enabled 线程的 alpha/ACU 不变量位置剖面和一个覆盖 `res(com)`、`open`/`close`、restriction 交换、scope extrusion、capture-avoiding substitution 和传递/对称结构链的原生推导反演。

epoch 分离投影接口现额外通过 `CoherentProjectionFamilyAdmission` 将一个 `ProjectionFamily` 连接到原生异构 admission。其旧新操作投影在定义上是相应族成员，且每个端点保留静态 SMC、resource、terminal 和范畴跨层证据。目标原生 admission 被独立要求；事件和端点方程仅使其与源对齐。

`Feedback/EpochSeparatedProjectionReference.lean` 使用已具体的旧/admission/新运行时提供 `FourTargetAdmissionBundle` 的非空参考居民。其四个槽有意使用 identity 视图。这证明修正的异构接口不矛盾，且严格版本前进、原生 derivability 和 `AdmissionReplays` 共存。它不是实质性 DAG/Petri/pi/morphism product 证书，也不解除任何 product rule 义务。

在 Lean Web 中尝试的隔离算术检查未产生内核证据：编辑器接受文本但在获取目标时报告 `No connection to Lean`。浏览器标签已关闭，不计任何在线结果。本地固定 `lake` 可执行文件仍对沙箱不可用，故本增量中每个声明仍未构建，不提升任何 manifest 状态。

### Complete-FMS 居民审计

全树声明审计未发现 `CpoPowerdomainPackage`、`AgentDomainSolution`、`CompleteExternalFMSTheoremPackage` 或 `ExactFMSAcceptancePackage` 的本地值。所有匹配都是结构声明、参数、字段或条件消费者定理。构造矩阵为：

| 层 | 可复用本地工作 | 缺失构造输入 |
|---|---|---|
| Abramsky powerdomain | 有限 `Finset`、等式 CPO 和严格有限 `WithBot (Set α)` 片段；所供 monad 的逐点提升；naive-unit no-go 定理 | 一个在每个 omega-CPO 上局部连续的 strong commutative powerdomain，带分离 divergence/deadlock、自由泛性质、strength/Fubini/Kleisli/enrichment 律和观察 |
| Domain equation | 有限 agent 层、有界近似、fold/unfold 同构和高度 cocone；条件 `EndofunctorLocallyContinuous` 和 `AgentDomainSolution` 接口 | `World ⥤ ωCPO` 的 algebraic compactness 或已检查 bilimit 构造、精确 `P ∘ H` 的局部连续性，以及带初始性的连续自然解 `P(H A) ≅ A` |
| Hiding | binder 往返、support 级 allocation/hiding 和条件 hiding/相干性接口 | 从实际 domain 解构造的 restriction、源审计 case 方程、world 自然性、delta/strength/substitution/scope 相干性和组合式指称 |
| Adequacy | 条件 stage-transition 和操作相干性接口 | 从 powerdomain 观察和 `roll.inv` 推导语义迁移，然后在不把目标迁移定义为源步像的情况下证明原生 strong-late 步对应 |
| Definability/full abstraction | late bisimilarity/congruence 定义和条件 full-abstraction 消费者 | 紧致 domain 近似、有限项 definability/separation、adequacy，以及从中推出 open 定理的源锚定 world-indexed closed 定理 |

特别地，`StrongLateFullAbstraction.native_step_complete` 是关于迁移完备性的输入字段；它不是每个紧致语义 agent 可由有限 pi 项定义的定理。同样，`FMSGatedFourProjection` 仅组合所供精确包，不能从有限/support 片段构造一个。因此 FMS 阻碍是构造性和基础性的，而非缺失的最终包装器。

### 当前确定性检查点

在精确量化和极性 residual、linked-core 源定理、相干族/admission 桥、异构 product-interface 替换、identity 视图参考和 FMS 真相边界编辑之后：

- 254 个 Lean 源文件；
- 聚合 SHA-256 `66d6e8c39220146b94fd8fed6ca63495613e1f5cff9486b89cae97de9c80ae1d`；
- 所有本地 `Cantilune.*` 导入解析；
- 零整词 `sorry`/`admit`/`axiom`/`unsafe` 匹配；
- `proof-obligations.json` 解析为 18 个义务：10 `implemented_unverified`、8 `partial_scaffold`、0 `proved`、0 `reviewed`。

普通 CI 命令接受固定输入、源聚合和 placeholder 扫描，随后在 elaborate 之前失败，因为 `lake` 不在沙箱路径上。完成命令按设计拒绝全部 18 个非 reviewed 义务。两结果都不是 Lean 构建或 axiom 审计。

### 有界 requesting-residual 反例搜索

一个单独的有限搜索测试九字段 `AugmentedRequestingFingerprint` 是否仍允许一个原生首次握手，其双前缀端点不是规范同主语 send/receive 核心。该搜索有意独立于 Lean 声明，仅作为反例证据记录，而非证明：

- 五个名上 156,250 个裸双线程/全局 restriction 参数骨架，其中 3,600 个满足全部九字段，2,400 个还满足原生 head-synchronization freshness 条件；
- 50,112 个带可选 sender/receiver 外 restriction 和可选 continuation-local restriction 的九字段原生候选；以及
- 5,120,000 个 continuation-local restriction 深度至多为二的有序 scope 案例含 208,800 个九字段原生候选；以及
- 9,469,952 个 side-outer restriction 深度至多为二的有序 scope 案例含 181,440 个九字段原生候选。

在这些有界族中未找到非规范端点核心。枚举检查了 head send/receive 极性、standard late freshness、精确自由名集 `{payload}`、空自由主语集、两个主语 link 计数和 capture-avoiding 重命名 incidence。它未覆盖无限多名、任意 restriction 深度、任意 parallel/choice 嵌套、所有重复 binder 模式，也未构造实际 `Late.Struct` 推导。

该有限结果缩窄下一个数学义务而非闭合它。在严格双长度双线程骨架中，既有字段在 head 和 tail 都强制一个 send 和一个 receive；两个 link 计数识别 sent-name/input-binder continuation 边；原生 late substitution 对齐 tail 主语；名义 support 字段隔离 payload 出现。剩余的是从任意 no-unary/no-live-choice 语法到该骨架的一般抽取定理，随后是通过 `sync`、`close`、restriction、alpha 转换、ACU、scope extrusion 和 structural 传递性的源特定端点证明。因此有界搜索为候选不变量提供回归信心，但不能提升 `CENTRAL-13`。

### 精确极性 residual 与 linked-core 边界

隔离的 requesting-指纹源现证明两个额外构造符计数不变量。Capture-avoiding substitution 保持 `sendPrefixCount` 和 `recvPrefixCount`，包括其 alpha-freshening 分支。一个来自无一元、零活 choice 潜能源的原生 `tau` 步因此恰消耗一个 send 和一个 receive 前缀。对增广 requesting 候选，每个原生导数因此恰有一个 send 和一个 receive，外加已推导的总前缀计数二。这些声明覆盖 `sync`、`close`、restriction、parallel、choice 和 open 构造符，但仍未构建。

`Pi/P1bLinkedCoreResidual.lean` 单独为两条链接长度二线程的直接（`syncLeft`）和交叉（`syncRight`）表述证明精确原生 strong-late 导数。它显式声明 late binder-freshness 和 capture-safety 前提，通过任意有限外 restriction 列表传播步骤，仅在步骤之后由 `Late.Struct` 移除新未用的公共 restriction，并实例化固定封闭 request/accept 进程。这是抽取核心的正向 residual 定理，而非缺失抽取定理：它既不接受任意 `Late.Struct` 代表，也不接受满足九字段的任意进程。

剩余 P1b 链现更精确定位：

1. 将任意 no-unary/no-live-choice `[2,2]` 语法抽取为两个通信线程加结构零 context；
2. 将两个 link 计数和名义 support 局部化到 head/tail binder、主语和 payload 位置；
3. 在该骨架上反演原生 `sync`/`close` 推导；以及
4. 通过 alpha 转换、ACU、`newComm`、scope extrusion、capture-avoiding substitution、对称和传递性归一化其端点。

在这四步内核构建之前，`StandardLateReflection` 和 `CENTRAL-13` 仍开放。

### 异构 product-证书替换

隔离的 `Theorems/HeterogeneousProductRuleAdmission.lean` 草案现组装修正的通用接口而非矛盾遗留记录。它固定一个共享源 `ReindexableExecutionFamily`，在 epoch 边界要求四个实际 `CoherentProjectionFamilyAdmission` 值，并在 admitted epoch 单独要求一个普通固定 signature occurrence。Rank、具体 resource/session/deletion policy、qualification、授权、stable/fair window、`ProgressBridge`、正 `epsilon` 和调度都是显式字段。不合成任何目标迁移、replay、policy、概率或实质性 DAG/Petri/pi/morphism 见证。

伴随的类型级回归文件不捏造任何居民。该接口和回归现被根导入并内核构建。因此新记录移除一个接口矛盾并使 product-owner 义务精确，但不实例化任何 product rule，也不能提升 `CENTRAL-18`。

## 固定内核闭环检查点 (2026-07-26)

本节取代前述环境状态陈述。固定 Lean 工具链已在本地找到且可执行：

- Lean `4.32.0`，commit `8c9756b28d64dab099da31a4c09229a9e6a2ef35`；
- Lake `5.0.0-src+8c9756b`；
- 工具链目录 `C:\Users\NJHL\.elan\toolchains\leanprover--lean4---v4.32.0\bin`。

最终普通证据关卡在脏工作树上成功完成。它检查了 283 个 Lean 文件，聚合 `f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`，发现零整词 `sorry`/`admit`/`axiom`/`unsafe`，在 8938 个 job 中完成根 `lake build`，并解析 667 个内核依赖报告。每个被审计声明仅依赖 `propext`、`Classical.choice` 和 `Quot.sound`。既有 linter 警告保留，但无构建错误。精确本地记录为 `formal/build-evidence/2026-07-26-p1b-p1c-feedback-root.md`。

首次审计运行发现一个真实生成依赖：`AuthorizedFeedbackClosure.referenceClosure` 通过配置反馈系统保留了一个 `native_decide` 证明。该证明被替换为普通 reducible `decide`；根构建和完整审计重跑并通过。未移除任何审计目标。

### P1b residual 进度现已内核检查

先前隔离的 P1b 模块已被根导入并构建：

1. `P1bRequestingFingerprint` 证明 `[2,2]`、精确原生 `4 -> 2` 前缀消耗、residual `send = 1` 和 `recv = 1`，以及两个极性计数在 capture-avoiding substitution 下的不变性。
2. `P1bTwoThreadExtraction` 将这些度量转为实际 `OneCommThread`、`TwoCommThread` 和 `TwoThreadContext` 语法证据，随后给出结构外范式 `wrapNews binders (.par left right)`。
3. `P1bLinkedCoreResidual` 证明规范直接/交叉原生握手和 restriction 传播。
4. `P1bLinkedEndpointNormalization` 覆盖 `syncLeft`、`syncRight`、`closeLeft` 和 `closeRight`；alpha payload、restriction 排列、scope extrusion 和新鲜 restriction 都归一到 `closedHandshakeResult.erase`。

精确剩余 P1b 定理不是数值的。它须将名义 link/support incidence 局部化到两个抽取线程内，并反演任意源侧 `Late.Struct`/native 代表到已证 `LinkedEndpointForm` 情形之一。该桥接须在 alpha 重命名、capture-avoiding substitution、ACU、`newComm`、scope extrusion、对称和传递性下稳定。在该代表无关定理居住 `StandardLateReflection` 之前，`pi_ra_certificate` 仍为 `partial_scaffold`。

## 2026-07-26 有限 Monad、名义 atom 与非 identity product 检查点

`FMSCpoFiniteHoareMonad` 将有限 Hoare 片段从一组连续操作强化为有限 omega-CPO 和连续映射 full 子范畴上的一个实际 `CategoryTheory.Monad`。其内核检查律包括连续 Kleisli bind、bind 作为 flatten-after-map、两个 unit、Kleisli 结合性、输入和逐点 choice 分配性、multiplication 自然性和结合性，以及一个精确范畴 Kleisli-extension 计算定理。该构造仍无 empty-deadlock 元素，也无单独 divergence，且不扩展到所有 omega-CPO。因此它不居住 `CpoPowerdomainPackage`，也不解任何 FMS domain 方程。

`OpenSMCNominalAtomBoundary` 修复仅排序 open-process 表述的一个精确 admission 缺陷。一个命名接口现在携带不同 typed port，且一个 atom 证书要求其擦除自由名集恰为其输入和输出 support 的不相交并。先前公共输出反例在其真实命名 support 处被接纳，并在两个空命名边界处被内核拒绝。这是一个原子 support 关卡，尚非组合式命名接口范畴或 plug/hide 和 restriction 保持原生 late-pi 行为的证明。

`P1cProductRuleProofBundle` 提供固定 epoch product 关卡的第一个实质性非 identity 居民。其参考 reconnect occurrence 将图从无边变为 `{(0, 1)}`。四个不同目标包装器携带独立 DAG、individual-token Petri、原生 standard-late-pi 和 morphism 业务推导。事件映射是双射，四个源事件每个都有原生目标步骤，且每个目标步骤反映到源步骤；未使用观察过滤。同一 bundle 携带真实 endpoint-free `DPOEvent` replay、rank、授权、quiescence、stable/fair window、外部调度和概率 1 业务进展。一个单独 no-go 定理证明单次完成包本身不能支持正事件标签，故轨迹包装器中的显式 productive hold 是必要的。这是一个参考 reconnect 规则，不是八个产品包的实例化。

一次对抗性实现评审从四个 `SplitCommunication` 构造符回溯 P1b 链到 `pi_ra_certificate`。它未发现被 transport 或捏造的迁移、循环端点前提、弱闭包或观察过滤。它额外内核检查了行使慢速 alpha-freshening 路径的普通 sync 和 open/close 代表。八个被评审声明仅依赖 `propext`、`Classical.choice` 和 `Quot.sound`。这是内部实现证据，不是所需非作者 QA-L4 签名之一。一般 bound-output action 标签也仍在此 closed-tau P1b 结果之外：其 binder 尚未有 action 级 alpha 商。

完整脏工作树证据关卡在这些添加后重跑：283 个 Lean 文件，聚合 `f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`，根构建在 8938 个 job 中成功，零禁用 proof placeholder，667 个内核依赖报告限于 `propext`、`Classical.choice` 和 `Quot.sound`。manifest 仍为 11 `implemented_unverified` 和 7 `partial_scaffold`；无条目为 `proved` 或 `reviewed`。

### product 与概率进度现已内核检查

`ProductRuleAdmission.certificate_uninhabited_fixed_signature_admission` 已构建并确认遗留同包 signature-admission 接口矛盾。`HeterogeneousProductRuleAdmission` 被根导入并构建为固定 epoch occurrence 与真正异构四目标 admission 的修正分离。

`P1cAdmittedFourOccurrence.fixedOccurrence` 现为每个具体 admitted mismatch/reconnect/quiescent-delete occurrence 给出一个实质性固定 epoch 记录，包含：

- 一个 DAG 目标步骤；
- 一个 enabled/fired individual-token Petri 目标步骤；
- 一个真正原生 strong-late pi 目标步骤；
- 一个 morphism 目标步骤；
- 精确源 replay 记录；以及
- 四个显式目标 replay 记录。

这闭合一个非空固定 epoch 参考 occurrence，而非跨 epoch signature admission。后者仍需四个投影族和四个原生异构 admission 关系。

授权反馈参考现在有一个构建好的五状态 execution package 和 Markov 核。其正标签在同一公共轨迹中保留事件身份、精确 replay、状态投影和 epoch 对齐，且其两个严格 evidence phase 从该核推导概率 1 progress 界。这是一个具体参考 `TrajectoryAgreement`；任意 product package 仍须提供授权、冲突 policy、stable-signature fairness、accepted 严格 progress 和正 epsilon。

### Complete FMS 仍是基础阻碍

`docs/research/0007-fms-lean-dependency-audit-2026-07-26.md` 中的依赖审计未发现提供所需完整栈的公开索引 Lean 包。固定 mathlib 提供 omega-CPO 和连续性基础。`scott1972` 形式化一个真正的逆极限 `D∞ ≅ [D∞ → D∞]` 构造，但不是 `A ≅ P(H A)`。`iris-lean` 提供一个具有不同语义的 COFE solver；使用它需要 RFC/ADR 变更而非透明导入。

因此 `CompleteExternalFMSTheoremPackage` 不存在本地居民。剩余构造仍包括局部连续 strong commutative Abramsky powerdomain、algebraic compactness/bilimit、连续自然递归 domain 同构、完整 hiding/相干性、操作 adequacy、domain-element definability 和 full abstraction。

### 状态与治理后果

manifest 有意保持不变，10 `implemented_unverified`、8 `partial_scaffold`、0 `proved`、0 `reviewed`。普通证据关卡通过；`ci.ps1 -RequireComplete` 拒绝全部 18 条目，因为无一具有不可变 commit 绑定独立评审证据。这是正确结果。

因此下一完成边界为：

1. 完成名义 P1b 代表桥接；
2. 构造完整 FMS 包或获得显式 RFC-0002 finite-control scope 裁定；
3. 为每个产品规则包实例化异构 admission 和概率义务；
4. 创建不可变候选 commit 并重跑关卡；
5. 获得三个独立 QA-L4 评审；
6. 完成 RFC-0002 FCP 并记录 ADR-0001 的接受或拒绝决定。

无本地实现能自授最后三个治理结果。

## 名义 orbit 与跨 epoch admission 检查点 (2026-07-26)

### P1b 源 orbit 强化而无弱迁移

`P1bRequestingNominalOrbit` 现被根导入并内核构建。它添加 `Raw.Proc.freeOutputValues`，通过每个 `Late.Alpha` 和 `Late.Struct` 构造符证明该接口不变量，并将其与既有双线程抽取结合。对规范 requesting 进程的每个结构代表，`orbit_normal_form` 产生：

- 两个实际 `TwoCommThread` 见证；
- 一个有限外 restriction context；
- 唯一自由 payload 不被该 context 捕获的证明；以及
- payload 在两个线程之一的活动 output-value 位置出现的证明。

对该 orbit 中选出的每个真正 `Late.NativeStep`，`native_step_orbit_constraints` 证明 action 为 `tau` 且精确 residual 含两个前缀、一个 send 和一个 receive。未使用 `tau*`、观察过滤或调用方提供的目标分类。

`P1bTwoThreadNativeInversion` 随后对抽取语法执行实际原生构造符反演。它证明一个顺序 `TwoCommThread` 不能产生原生 `tau`，通过 restriction、非活动 parallel/choice 兄弟和 substitution 在唯一双线程分裂处定位 `tau`，并抽取两个 residual `OneCommThread` 值模结构同余。其 substitution 引理覆盖当 residual 输入 binder 与替换冲突时的慢速 freshening 分支；它不假设先前 `captureRisk = false` 捷径。

`P1bResidualTargetBoundary` 还修复了剩余定理的精确强度。形如 `canonicalRequesting | 0` 的代表有一个真正原生首次握手，其精确目标为 `canonicalEstablished | 0`。该目标是结构规范的，但其本身不能居住任何 `LinkedEndpointForm`，因为每个精确链接端点都以一个 restriction 开始。因此待证定理须存在性地产生一个链接端点并通过 `Late.Struct` 将实际目标与它关联；精确目标语法将是虚假声明。

因此剩余 P1b 证明更窄但仍实质：分类两个抽取线程内的公共/session/input-binder incidence，通过允许 context 反演任意原生同步或 close 规则，以 alpha 重命名的 bound 名参数化链接端点，并通过 alpha、ACU、`newComm`、scope extrusion、对称和传递性归一化所得端点。

### 非空四目标异构 admission 参考

`FiniteExecutableEpochProjectionReference` 现将先前分离的固定 epoch 投影和异构运行时参考合并。它构造一个非空 `FourTargetAdmissionBundle`，对 DAG、Petri、pi 和 morphism 各包含：

- 不同的依赖目标状态、事件和 native-step 类型；
- 分离的旧 signature 和新 signature `ExecutionPackage`；
- 旧 epoch 和新 epoch `ProjectionCertificate`；
- 一个严格跨 epoch 目标 admission；
- 精确 `AdmissionReplays` 证据；以及
- 在映射端点处的原生运行时边。

pi 构造符额外存储来自 `AdmissionCertificate` 的真实未过滤可见注册输入。其他三个视图仍是有限可执行参考语义，而非产品图、pre-net 或范畴模型。因此该构造为参考 bundle 闭合非空洞性和精确跨 epoch replay，而将相干静态投影族和 product rule/policy/概率证据留给实际产品包。

独立只读评审确认每个固定 epoch 目标边是 observable 且 reflected 的，且原生 admission 证据独立于 replay 证据。它还识别精确非产品边界：`runtime_native` 遗忘静态/pi 证据且仅是前向映射；抽象 pi 目标状态未通过反向相干定理回连到具体进程端点；所有四个 replay 值使用同一有限参考 configuration；且目标事件标签不恢复完整 admission 元数据。这些事实阻止将参考提升为产品四投影 admission 证书。

## 标签分裂、restriction 包络与证书反空洞

P1b residual 链现在有一个保持推导的分裂定理，而非仅聚合语法度量。

- `P1bLabelledThreadInversion` 递归反演实际原生 `syncLeft`、`syncRight`、`closeLeft` 和 `closeRight` 构造符。所得标签 core 保留主语、输出值、输入 binder、精确目标和慢速 capture-avoiding freshening 见证。
- `P1bRequestingPolarityOrbit` 证明 guard send/send 和 receive/receive 对计数在 substitution、每个 alpha 构造符和每个 structural-congruence 构造符下不变。其被检查的交叉极性示例不能属于规范 requesting orbit。
- `P1bRequestingThreadPolarityClassifier` 将这些全局不变量推入抽取的两个线程。`P1bNativeSplitContext` 随后结合实际原生推导与双线程范式：源和目标共享一个 restriction 列表，分裂是四个具体原生推导之一，且其两个线程有相反的 send/send 对 receive/receive 极性。
- `P1bRestrictionEnvelope` 证明对本质和单本质 binder 分解，产生新鲜垃圾列表，并将该垃圾到 `Late.Struct` 为止移除。其 close-left 反例证明在 scope extrusion 之后到 `[public, session]` 的字面外列表排列为假；需要单本质 close 形式。
- `P1bRequestingReflectionClosure` 证明 `StandardLateReflection <-> RequestingNativeResidual <-> RequestingUpToLinkedEndpointResidual` 并从最后分类器构造最终操作证书。被检查反例显示精确链接端点语法和部分双前缀/一 send/一 receive 形状分别过强或过弱。

因此规则选择、共享 context、极性、慢速 freshening、restriction 垃圾和端点归一化不再是 P1b 缺口。剩余引理须从极化分裂恢复公共/session 主语、payload 值和输入 binder，并选择相应参数化链接端点。

`P1bNominalIncidenceBoundary` 将该最后步骤做成一个以真正 `SplitCommunication` 索引的单一非循环接口。它仅要求一个携带固定自由 payload 的未知受限 residual channel；它不提及规范 established 状态或 `LinkedEndpointForm`。内核检查闭包定理归一化该未知 channel 和输入 binder，然后推导完整 up-to-structure residual 和投影证书。该接口本身尚未被居住，故这是 P1b 的一个精确边界归约而非完成。

`P1bNominalIncidenceProof` 现解除该边界背后的目标侧机制。它证明 capture-avoiding substitution 保持单线程自由主语见证，为 input、output 和 bound-output 原生步骤推导精确目标 receive/send 计数，transport link 计数和固定自由输出值，并在结构上归一化 residual 单前缀线程。所得 `SplitSupportTransfer` 包对名义 incidence 足够，`requestingPolarizedNominalIncidence_of_splitSupportTransfer` 在不提及 established 状态或链接端点的情况下证明该蕴含。

`P1bNominalIncidenceClosure` 现通过反演每个真正 `syncLeft`、`syncRight`、`closeLeft` 和 `closeRight` `SplitCommunication` 闭合该源到目标步骤。其内核构建的 `requestingSplitSupportTransfer` 居住先前开放的接口。模块随后推导 `requestingPolarizedNominalIncidence`、精确 `requestingNativeResidual`、完整 `standardLateReflection` 和未过滤 α/structural strong-late LTS 的无条件 `pi_ra_certificate`。不引入任何弱迁移或观察过滤。

这在工作树中闭合 P1b 操作证明，并将 CENTRAL-13 仅提升到 `implemented_unverified`。一次新的完整本地 CI 和 axiom 审计通过；在 `proved` 或 `reviewed` 被允许之前，不可变 commit 绑定证据和独立 QA-L4 评审仍为必需。Complete FMS、product 特定四视图证书、FCP 和 ADR 接受仍是总理论闭环的单独阻碍。

`HeterogeneousProductRuleAdmissionReference` 现提供修正通用 product 证书的一个完整值。它有严格异构 admission、四个扩展索引 identity 投影族、faithful arrow realization 和交换 step cell、一个不同的有 rank 原生业务重写、policy 和授权证据，以及一个有限随机桥接。独立评审后，第一个全稳定对角核被认为太弱并被替换：ready 不稳定，done 稳定，而实际 ready-to-done 业务重写有概率 1。意外匹配仓库禁词扫描器的构造符名也在完整关卡之前被重命名。

该值仅证明接口居住性和非循环性。一个后来的强化使 execution 族 signature 敏感：业务关系在旧 signature 不可能，在新 signature 可用。其 replay 核验证记录 recipe 和源 configuration，对错误规则和错误源进行内核检查拒绝。然而四个视图族仍是同一 identity 参考语义。因此该见证仍既不证明实质性 DAG/pre-net/pi/morphism 语义、一般 DPO replay、product 授权，也不证明产品轨迹一致。那些仍是 product 提供的义务。

`ProductRuleProofBundle` 现使该 product 提供的边界对任意固定 epoch 可执行。候选仅含端点和事件；分离的 proof bundle 须提供源原生步骤和 replay、rank、resource/session quiescence、所有四视图的 native/reflection/replay 证据、qualification、授权，以及 stable-window/fairness/positive-epsilon 调度包。参考 bundle 被接纳，而一个否则匹配但显式缺失 rank 的提交被内核拒绝。这闭合通用关卡，而非八个产品包实例。

FMS 有限片段审计现在也有一个真正的非空 Hoare omega-CPO：有限偏序上的非空下集，带连续主嵌入、union、下直接像和 flattening，加上有限函子和 unit 律。这移除一个本地 finitepowerdomain 脚手架缺口，但不提供空 deadlock、分离 divergence、all-omega-CPO Abramsky monad、algebraic compactness、递归 agent domain 或 full abstraction；因此 CENTRAL-12 仍为 `partial_scaffold`。

## 最终综合检查点 (2026-07-26)

后来的综合状态取代上文中间的"剩余 P1b 引理"措辞。`P1bNominalIncidenceClosure` 对全部四个真正分裂构造符居住该接口，故有限 request/accept 操作 residual 定理已实现。完整本地关卡和对抗性实现评审通过；不可变出处和独立 QA-L4 评审未通过。

存在三个进一步内核构建增量：

- `FMSCpoFiniteHoareMonad` 是在有限 omega-CPO 上带连续 Kleisli 律的真正 Monad，但不是 all-omega-CPO Abramsky/FMS 包；
- `P1cProductRuleProofBundle` 是一个实质性非 identity reconnect bundle，带四原生视图、完整事件 reflection、replay 和 epsilon-one 调度证据，但不是产品包族；以及
- `OpenSMCNominalAtomBoundary` 为 atom 强制精确命名自由 support，但不是组合式 plug/hide adequacy。

最终脏工作树关卡覆盖 283 个 Lean 文件，聚合 `f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`，8938 个 build job 和 667 个 allowlisted 依赖报告。完成关卡仍拒绝 11 `implemented_unverified` 和 7 `partial_scaffold` 义务。Complete FMS（或被接受的范围变更）、所有 product-rule 实例、不可变出处、三个独立评审、FCP 和 ADR 接受仍待完成。

## 承重缺口收敛检查点 (2026-07-26, 后工作树)

本检查点取代上文记录的 finite-powerdomain 和仅排序 Open-pi 边界，但不将任何义务变为 `proved` 或 `reviewed`。

现存在四个额外内核构建增量：

- `FMSCpoOmegaScottPower` 为每个 mathlib omega-CPO 配备由 omega-chain range 生成的拓扑。它证明每个 `ContinuousHom` 对这些拓扑连续，并构造闭下集自函子、自然 unit、multiplication 和全 omega-CPO 范畴上的所有 Monad 律。这是一个非分离 Hoare/lower monad：其空闭集同时是序 bottom 和 choice 零。它不是 Abramsky 自由 pointed-semilattice powerdomain，也不居住 FMS 包。
- `FMSCpoOmegaScottStrength` 在任意 omega-CPO 对上添加连续 cartesian Fubini 分量和连续左/右候选 strength 分量。对象级自然性、pure/principal 相容性、swap 对称性、cartesian 结合性，以及一个显式右向 swap/Fubini/swap 相等已被内核构建。打包的范畴 strength、multiplication/Fubini 相干性、完整 unitor/associator 图、choice/deadlock 分配性和自由 semilattice 泛性质仍缺失。
- `FMSCpoSeparatedLowerPower` 和 `FMSCpoScottClosedPower` 隔离分离阻碍而非隐藏它。添加外 bottom 可区分 divergence 与嵌入 empty deadlock，但一个坍缩每个含 divergence 族的 multiplication 已在返回 deadlock 处与 monad unit 矛盾。因此上述 all-omega-CPO Monad 不能仅通过 adjoining `WithBot` 提升为 FMS。
- `FMSCpoOmegaScottSeparatedNoGo` 为精确朴素变换器 `T X = WithBot (OmegaScottPower X)` 强化该警告：嵌入 empty 族位于嵌入主 divergence 族之下。单调性加嵌入 deadlock 处的右 unit 实例和外 divergence 处的左 unit 实例将迫使 deadlock 位于 divergence 之下，与新鲜 bottom 分离矛盾。这排除该 map/unit 选择，而非每个分离或 Abramsky powerdomain 构造。
- `OpenSMCActionAlpha` 为 input 和一般 bound-output 标签及其导数提供 freshness-safe 商。新鲜重命名保持真正单步 standard late-pi 推导；一个 binder 等于其 channel 的非法 bound output 不与合法 open 标签等同。
- `CrossEpochProductFamily` 将一个实际四视图 signature admission 与一个实际新 epoch `ProductRuleProofBundle` 复合。它产生四个原生 admission 边、四条原生业务路径、精确 admission 和 `DPOEvent` replay，以及带严格版本边界的依赖 epoch 链。一旦 package 拥有前提被提供，这是一般组合定理；它不合成这些前提。

第二个内核构建 FMS 增量在不改变其接受状态的情况下强化非分离边界：

- `FMSCpoOmegaScottStrongCoherence` 证明精确 multiplication/Fubini 交换，包括逐元素和作为连续态射复合的相等。它还将 Fubini 和两个候选 strength transport 到 mathlib 所选二元积上的真正分量。完整 chosen-product 自然变换、unitors 和所有 strength 图尚未打包。
- `FMSCpoOmegaScottWorldMonad` 在真正非常值 `World ⥤ ωCPO` support 模型上实例化实际 Monad。Unit 和 multiplication 与每个有限 world 注入交换，从 world 0 到 1 的 support 映射被证明非满射，且对象级 Fubini 分量形成跨 world 注入的自然变换。这是一个真正的非常值函子范畴实例，不是 FMS agent-domain 解。

`OpenSMCNamedComposition` 中的精确名层还使剩余 Open-pi 设计选择显式。精确外部 support 加直接 plug/hide 在任何非空中间边界处拒绝两个 unit 复合，且当前呈现的 identity 擦除为 raw 零，这既不实现该 support 也不采取原生 late-pi 步。因此一个真正命名操作范畴需要 RFC 选择的 alpha-fresh wiring 语义、线性 one-shot forwarder 或 guard replication/recursion。最后一个选项超出当前 finite-control 演算，且是一个既有 RFC 停止条件。

`OpenSMCFiniteControlIdentityBoundary` 锐化该选择。从固定 finite-control `Raw.Proc` 出发的每个长度索引 structural strong-late 或 native trace 长度至多为其初始 `prefixCount`；因此没有此类进程有任意长或相干无限 native run。这在每次使用至少消耗一个迁移时排除一个任意可复用 identity。一个具体两步 receive/send relay 仍有真正 native trace，故该定理有意留出线性 one-shot 范畴路线。

`0008-product-package-certificate-audit-2026-07-26.md` 中的 product 审计未发现八个计划分发中任何一个的 package 源树、manifest、规则清单或 package 拥有的 proof 输入。因此不可能在不发明仓库有意未冻结的产品语义的情况下，实例化其 DAG、pre-net、morphism、admission、resource/session、授权、fairness/stable-window、rank 和 positive-epsilon 证据。

最后，`0009-fms-source-theorem-scope-audit-2026-07-26.md` 将源声明与 Cantilune 增充分离。FMS 要求 powerdomain、逐点提升、初始递归解、restriction/action 相干性、进程指称和进程对 full abstraction。一般 algebraic compactness 是一个可能的更强本地构造路线，而所有 domain-element definability 不是已检查 FMS 源陈述的定理。Divergence/deadlock 不等、精确每标签单步 soundness/completeness 和强观察逆像律是额外 Cantilune 接受条件。

整理工作树通过新的完整普通关卡：305 个 Lean 文件，聚合 `5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`，8960 个 build job，零禁用 proof placeholder，804 个限于 `propext`、`Classical.choice` 和 `Quot.sound` 的依赖报告。`ci.ps1 -RequireComplete` 单独以 1 退出，正确列出 11 `implemented_unverified` 和 7 `partial_scaffold` 义务。精确记录为 `formal/build-evidence/2026-07-26-fms-openpi-crossepoch-root.md`。

此脏树关卡不能提供不可变出处、独立 QA-L4 签名、FCP 决定或 ADR 接受。

## FMS 名字抽象检查点 (2026-07-26, 独立评审)

`FMSCpoInputTransport` 和 `FMSCpoNameAbstractionFunctor` 闭合了一个先前仅隐式的精确 world-indexed FMS 构造。对每个协变模型 `X : World ⥤ ωCPO`，它们在完整函子范畴上构造真正自函子

`B X(n) = (Fin n → X(n)) × X(n + 1)`

一个有限 world 注入通过在目标名位于旧像中时选择其旧分支、否则以将目标名作为指定新鲜名扩展旧 world 的唯一注入来 transport 一个输入 continuation。扩展方程、唯一性、identity、composition、对 `X` 的自然性、每个分量的连续性，以及 world- 和 model-level 函子律均被内核检查。

独立评审确认了协变注入方向和两个 composition residual：一个中间新鲜名通过 `extendByName left middle ≫ right` 复合，而一个即便在中间 world 也新鲜的名通过 `successorWorld.map left ≫ extendByName right name` 复合。四个定向模块构建，十二个被审计声明仅依赖 `propext`、`Classical.choice` 和 `Quot.sound`。

此检查点仅闭合名字抽象 summand `B`。它不构造完整 action 函子 `H`、分离 Abramsky powerdomain、递归连续自然 domain 解 `A ≅ P(H A)`、allocation/hiding 相干性、adequacy、definability 或 full abstraction。因此 CENTRAL-12 仍为 `partial_scaffold`；不可变出处和独立治理评审仍待完成。

## 精确 action、有限链与递归边界检查点 (2026-07-26)

本检查点取代前述完整 action 函子 `H` 缺失的陈述。它不声称完整 FMS 模型现已存在。

以下额外结果已内核构建：

- `FMSCpoActionFunctor` 在 `World ⥤ ωCPO` 上构造精确非常值 FMS action 形状 `N × B X + (N × N) × X + N × X(n+1) + X`，带其 world 和 model 映射。`FMSCpoActionLocallyContinuous` 证明该实际自函子局部连续。
- `FMSCpoOmegaScottChosenCoherence` 将已构造非分离 lower/Hoare monad 与 chosen-product Fubini 和 strength 打包，并证明自然性、两个 unitor、结合性、对称性和 multiplication 相干性。`FMSCpoOmegaScottLocallyContinuous` 证明 power 自函子和具体复合 `P ∘ H` 的局部连续性。
- `FMSCpoOmegaScottFreeCompleteJoin` 证明一个到其态射保持任意 suprema 的完备格目标的真正泛扩张定理。每个闭下计算是其主族的任意上确界，故该扩张唯一。任意 `sSup` 保持前提是承重的：该定理不是 Abramsky powerdomain 所需的自由 pointed continuous-semilattice 性质，且构造仍将序 bottom 等同于空 deadlock。
- `FMSCpoFiniteApproximationTower` 构造有限初始链 `0 → F 0 → F² 0 → ...`。其种子无收缩且其前两阶段不同构。因此当前链不悄然是 embedding-projection bilimit 或递归 domain 解。
- `FMSCpoActualDomainEquationBoundary` 将递归函子固定为该实际 `P ∘ H`。一个 proof-carrying 输入可提供连续自然同构 `A ≅ P(H A)`、一个初始代数和一个终余代数；模块随后推导 fold/unfold 自然性、Lambek 同构证据和到 `AgentDomainSolution` 的条件 transport。不构造该输入、`CpoPowerdomainPackage` 或完整 FMS 接受包的任何居民。

命名操作层也更锐利：

- `OpenSMCAlphaTransitionQuotient` 保留实际 standard late-pi 步骤，同时通过 freshness-safe alpha 重命名对一般 bound-output 标签和导数取商。
- `OpenSMCContextualBoundaryCategory` 为上下文命名边界程序提供一个实际范畴，`OpenSMCContextualPartialTensor` 提供一个带预期纯互换方程的 proof-carrying 不相交偏 tensor。
- 内核 no-go 定理表明仅 bound 名的 alpha 重命名不能修复非空 plug identity、非单射名 fusion 破坏 mismatch 行为，且无限制上下文 tensor 互换失败。因此一个完全操作对称 monoidal 范畴仍需一个新的极化自由名 wire/alias 原语或一个 RFC 批准的 finite-control 语法扩展。

对一般 product，`FiniteCrossEpochProductChain` 复合任意有限序列的所供认证行。它保持所有五条 replay 链、固定规则标签、typed admission 标签、严格 signature 边界和 execution epoch。`FiniteCrossEpochProductTrajectory` 在源概率空间上耦合五条规范路径，同时保留每个依赖源事件、四个原生投影推导和精确 replay。直接 `FMSGatedFiniteCrossEpochProductChain` 适配器对一行实际行保留规则和 admission FMS 迁移。对抗评审发现它不得被描述为直接多行定理：一个适配器的 after epoch 含一个业务事件，而每个下一个直接 before epoch 为空，故依赖中间记录不能一致。此外逐行记录不固定一个公共 FMS 包，也不存储一个指称端点缝合方程。一个内核定理现在显式记录该事件计数阻碍。

任意有限操作五视图定理对已供精确边界仍有效；直接 FMS 关卡仅一行。两者都不是产品居民。仓库仍不含八个计划分发的 package 拥有规则清单，故其 DAG/Petri/morphism admission、rank、resource/session、授权、fairness、stable-window 和 positive-epsilon 证据不能在不发明产品语义的情况下构造。完整分离 powerdomain、递归 domain 居民、hiding/相干性、adequacy、进程对 full abstraction、不可变出处、独立 QA-L4 签名、FCP 和 ADR 接受仍开放。因此 CENTRAL-12 和 CENTRAL-18 仍为 `partial_scaffold`。

## 2026-07-27：无条件 bilimit 与 alpha 闭包

本检查点取代本日志中先前关于具体 bilimit 和递归替换记录无居民的历史陈述。当前内核检查边界为：

- `FMSCpoConcreteBilimitExhaustivity` 构造规范有限阶段映射、其 projection/diagonal/successor 方程、单调 limit 和 unfold approximant，以及逐点 omega-exhaustion。它无条件居住 `ConcreteBilimitExhaustivity` 并构造 `concreteActualFixedPointWitness`，一个针对实际**非分离 omega-Scott** 函子的连续自然同构 `A ≅ P(H A)`。这只是一个不动点：它既不提供初始代数/终余代数证据，也不提供 algebraic compactness，且它不是原始 FMS 接受目标所需的分离 Abramsky powerdomain。
- `LateGuardedReplicationAlphaSubstitutionCongruence` 及其闭包模块构造公共新鲜 normalizer 和组合深度/alpha 归纳。它们无条件居住 `RecursiveAlpha.SubstitutionCongruent` 并对每个递归原生迁移构造符（包括 sync 和 close）证明真正单步排列闭包，无 tau-star 或观察过滤。
- 实际非分离 omega-Scott world monad 有 `powerHiding`。Allocation、unit、multiplication 和 chosen Fubini 与 hiding 交换，且具体 support 指称有一个 effectful allocate/denote/hide retraction。这是 monadic support 相干性，不是 agent-domain restriction 或 adequacy/full-abstraction 定理。
- `FMSCpoPowerdomainPackageCoherenceNoGo.no_distinguishedFubiniStrictness` 是表示无关的：分离 divergence/deadlock、交换 Fubini 和两个区分常量处的 first-input 严格性联合不一致。它不依赖有限 powerset 表示，且**不**反驳一个不施加该强化组合的真正 Abramsky 构造。

聚合回归导入在可变树中构建，且新声明仅使用记录的内核原则。CENTRAL-12 仍为 `partial_scaffold`：仍缺失一个源相容分离 Abramsky 包、algebraic compactness、完整 agent restriction、adequacy、definability 和 full abstraction。完成仍被 RFC 选择的命名边界/FMS 语义和缺失的产品拥有规则与随机核事实所阻塞。
