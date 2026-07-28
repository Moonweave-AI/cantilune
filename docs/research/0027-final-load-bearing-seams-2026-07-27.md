---
title: Final load-bearing P1a, admission, and common-FMS seams
document_type: research-log
status: implemented / immutable-evidence-pending
risk: S2
quality_target: QA-L4
maturity: Pre-FCP/M1
owner: Joker-of-Gotham
dri: Joker-of-Gotham
date: 2026-07-27
related:
  - docs/rfc/0002-projection-consistency.md
  - docs/adr/0001-unified-formal-structure.md
  - docs/spec/formal-semantics.md
  - docs/research/0026-final-common-chain-candidate-2026-07-27.md
---

# 结论

第 0026 号日志列出的最后三类结构性空洞，已在当前可变 Lean 源码中形成
互相绑定的实现：

1. P1a 不再允许仅凭 “DAG/Petri” 名称和任意 projected step 通过；
2. dynamic admission 不再终止在无法连接业务行的 effect bottom，而是显式
   strong 两阶段协议；
3. selected probability row、product candidate、registry operation、
   canonical metadata、native/replay/raw π 以及 actual-Agent endpoint 由同一
   `CompleteProductCommonTrajectoryCertificate` 承载。

同时，Open-π 具名 operational realization 明确要求 singleton wire 的三个
名字 pairwise fresh，并保证 canonical tensor 两块全局不交。

这些变更集成后，一次实际的**增量**根 `lake build` 完成 9,208 jobs。该结果
只能说明当前可变树通过了本次编译；它不是 commit-bound clean CI，也没有
替代最终 source-integrity、axiom/placeholder audit、十八项 proved manifest
或后继 strict gate。因此本日志处置为
**implemented / immutable-evidence-pending**，不是 `proved`、`reviewed`、
FCP Passed 或 ADR Accepted。

# 研究问题

在不放宽以下已确认约束的前提下，最后的通用四投影总定理是否仍存在可检查的
反空洞路径：

- 每个规范事件使用 genuine strong late-π step；
- dynamic admission 不依赖 `τ*`；
- D1-A effect 保留一个 bottom 和 symmetric Fubini；
- native π、terminal 与 product 层继续区分 divergence/deadlock；
- 八个 production package 不由通用接口或包名虚构；
- 所有 product-relative 结论只对真正携带完整证书的包成立？

# 方法与可复现表面

本轮只检查仓库内的 Lean 声明、根 import/test 表面和实际构建反馈。承重模块为：

- `formal/Cantilune/Projection/P1aSemanticCertificate.lean`
- `formal/Cantilune/Theorems/P1aProjectionScopeClosure.lean`
- `formal/Cantilune/Theorems/CoreConformance.lean`
- `formal/Cantilune/Pi/P1cFullNativeRefinement.lean`
- `formal/Cantilune/Pi/FMSActualAgentNormativeOperationalBridge.lean`
- `formal/Cantilune/Feedback/ProductCommonFMSTrajectory.lean`
- `formal/Cantilune/Theorems/ProductCommonTrajectoryCertificate.lean`
- `formal/Cantilune/Theorems/SubstantiveCoreCommonFMSTrajectory.lean`
- `formal/Cantilune/Theorems/SubstantiveAdmissionReconnectFMSAlignment.lean`
- `formal/Cantilune/Theorems/TechnicalClosure.lean`
- `formal/Cantilune/Pi/OpenSMCCanonicalPositional.lean`
- `formal/Cantilune/Pi/OpenSMCPolarisedHomBridge.lean`
- `formal/Cantilune/Tests/AdmissionPhaseSeamNoGo.lean`

当前源码尚未冻结，因此本日志不记录 source commit 或 evidence hash；这些值
必须由最终证据步骤写入，不得预填。

# 发现一：P1a 原有名称空洞

## 失败模式

仅有 `ProjectionOccurrenceEvidence` 可以证明某个源 occurrence 有目标原生步、
反射和 replay，但它不保证名为 DAG 的目标真是源配置图，也不保证名为 Petri
的目标真有 declaration order 或 individual-token provenance。若
`CoreConformancePackage` 只接受该字段，调用方可以使用任意 identity
execution family，通过类型检查却没有 P1a 的声明语义。

## 修正

`P1aSemanticCertificate` 提供两个 candidate-indexed 结构：

- `DAGSemanticCertificate source dag projection candidate`
- `PetriSemanticCertificate source petri projection candidate`

二者都包含同一 source occurrence 与同一 projected occurrence，并把 target
before/after `configOf` 精确绑定到 source candidate 的两端。

DAG graph 定义为 replayed `DPOEvent` 配置的 `configDependencyGraph`，而非
certificate 字段。由该图派生：

- before/after canonical SCC condensation；
- condensation acyclicity；
- 每条 condensation edge 的严格 rank；
- 每条原始 edge 的 internal-or-condensed coverage。

Petri 侧由同一事件构造 `declarationOfEvent` 和 singleton `OrderedPreNet`。
该 declaration key 保留 signature version 与 rule id。配置的每个有限 runtime
component 生成 canonical `ProvenanceToken` marking；selected transition 是
before/after marking 的 `endpointDelta`。内核声明给出 enabling、精确 firing
以及每个 retained token 的 identity。

这两个结构现为 `CoreConformancePackage` 必需字段，并由
`TechnicalClosure.generic_dag_projection` /
`generic_petri_projection` 作为所选 occurrence 的语义 sidecar 公开；它们
不冒充整个目标 LTS 的投影证书。产品提供的完整 DAG、Petri 与 morphism
`ProjectionCertificate` 由
`TechnicalClosure.generic_p1a_projection_scope` 聚合，并同时给出路径
提升/反射和 success/wait/deadlock 保持。

独立的 `fixed_business_reference_nonempty` 进一步给出固定签名十四事件参考。
它的 DAG、Petri 与 morphism 目标具有分别声明的状态/转移类型，并对每个源
事件保留精确 `DPOEvent` replay。该参考只证明接口非空，不与 reconnect
candidate 或任意产品包强行等同。实质 reconnect reference 另行提供
candidate-indexed `dagSemantic` 与 `petriSemantic` 居民。

# 发现二：terminal admission shortcut 的精确 no-go

旧的单阶段设想若让 admission 立即到达 inactive terminal，则其 actual-Agent
endpoint 是 effect bottom。任意后续 normative business source 都是 non-bottom
principal action。仓库以
`terminal_admission_shortcut_ne_normative_source` 证明二者不相等，特别得到
`terminal_admission_shortcut_ne_reconnect_source`。

该 no-go 不否证 dynamic admission；它只否证 “terminal admission target
字面等于非空业务 source” 的捷径。直接把二者粘合会制造不存在的 FMS seam。

# 发现三：显式 strong admission/reconnect phase

最大相容修正保留十五个原始 `SourceEvent` family，同时把 protocol state/event
扩展为：

```text
State.admissionEstablished
Event.admissionReconnect
```

规范强路径为：

```text
ready dynamicPartnerAdmission
  -- visible input -->
admissionEstablished
  -- genuine tau -->
completed dynamicPartnerAdmission
```

第一步 derivative 是 `closedReconnectSource.erase`；第二步 derivative 是
`closedReconnectTarget.erase`。`P1cFullNativeRefinement` 的 target relation
仍包含 carried raw process 的全部真实 `Late.NativeStep`，而不是由源关系生成的
过滤关系。Reflection/exhaustiveness 把 unique native follow-up 精确映回
`admissionReconnect`。

FMS compiler 也使用相同两阶段树。
`dynamic_admission_target_eq_reconnect_source` 给出 admission first target 与
`.instanceReconnect` normative source 的 actual-Agent 字面等式。
`SubstantiveAdmissionReconnectFMSAlignment.Reference.alignment` 同时保留：

- admission registry operation `refinesTo`；
- admission 与 next-business 的两个 commutation cell；
- target/source endpoint exactness；
- literal endpoint seam；
- target epoch version；
- rule、session、correlation 与 occurrence metadata。

因此修正没有使用 weak step、bisimulation quotient 或 `τ*`。

# 发现四：CENTRAL-18 的同一记录闭包

`CompleteProductCommonTrajectoryCertificate` 的输入包括完整
`CoreConformancePackage`、positive labelling、FMS labelling、path、
`TrajectoryAgreement` 与 selected index。其字段强制：

- trajectory selected event 就是 `candidate.event`；
- selected source/target 就是 `candidate.before/after`；
- mark 是具体 `NormativeRegistryRow`；
- operation 就是 package π operational semantics 对 projected candidate
  event 解码出的 operation；
- metadata 就是 package `piFMSAlignment.metadata`；
- denotational endpoints 就是同一 selected family 的
  `normativeSourceAgent` / `normativeTargetAgent`。

由此派生的审计定理包括：

- `familyExact`
- `selectedNative`
- `selectedReplay`
- `selectedProjectedNative`
- `metadataFromSelectedReplay`
- `selectedRawNative`
- `selectedRegistryRealizes`
- `selectedRawSource`
- `selectedRawDerivative`
- `selectedActualFMS`

这些结论没有再选择第二个 occurrence、第二个 registry row 或第二组 Agent
endpoint。

`SubstantiveCoreCommonFMSTrajectory.Reference.completeCertificate` 以同一个
`SubstantiveReconnectConformance.core/candidate`、canonical probability-one
path 和 first selected row 居留该结构。随后
`TechnicalClosure.generic_technical_closure_with_common_trajectory` 给出通用
composition，`reference_technical_closure` 给出无参数反空洞参考。后续 hold
row 的 adjacent denotational endpoint 同样由 common trajectory 保持。

# 发现五：Open-π 名字新鲜性接缝

`WireNamesFresh sourceName targetName binder` 明确要求：

```text
sourceName ≠ targetName
sourceName ≠ binder
targetName ≠ binder
```

每个 singleton presented identity 的 operational realization 都必须携带该
证明。多端口 identity 的 canonical name allocation 保持不同 wire block
不交。Canonical total named tensor 则把右 occurrence freshen 到完整左
support 之外，证明 `totalNamedTensor_rightOccurrence_fresh`。

这排除了 endpoint collapse 与 binder capture，但不会把 raw relay 说成
SMC structural identity。Presented algebraic wiring 与 proof-relevant native
realization 仍是两个由 adequacy/commutation 连接的层。

# D1-A 与 no-go 范围

本轮不改变既有 D1-A 决策：

- effect 层 divergence = deadlock = bottom，以保留 chosen symmetric Fubini；
- native late-π、terminal classification 与 product semantics 独立保留二者
  的操作区分；
- separated source branch 的 all-source solution set/enriched adjunction 与
  D1-A 的 symmetric Fubini 属于不同模型，不能拼接；
- constructor-sensitive strong-bisimulation full abstraction 与
  all-omega-CPO-elements definability 仍由既有 kernel no-go 排除；
- 正面范围仍为明确 observation 下的 finite/guarded Hoare/contextual theorem，
  以及 deterministic typed tau/free-output prefix trie 的 actual-Agent
  native-path theorem。

Admission no-go 是同一原则的局部实例：effect terminal bottom 不能被静默
冒充非空 principal-action source。显式 phase 把业务接缝放在 first target，
而不是错误的 terminal endpoint。

# 产品边界

本轮没有构造八个 production package。通用闭包仍要求每个真实包自行提供：

- rule inventory 与逐规则四投影 certificate；
- cross-signature admission/replay；
- P1a semantic certificate；
- rank、resource/session、qualification、authorization；
- fairness、stable window、positive epsilon；
- production Markov kernel、labelling、path 与 `TrajectoryAgreement`；
- package-specific actual-FMS alignment。

通用结构只能组合这些居民，不能从包名生成它们。

# 验证结果与剩余门

已观察到的结果：

- 集成当前承重接缝后，增量根构建实际完成 9,208 jobs。

尚未完成、且本日志不得代替的结果：

1. 冻结精确 proof-sensitive source commit；
2. 在该 commit 上运行 clean root build；
3. 重算 `formal/source-integrity.json`；
4. 执行零 `sorry`/`admit`/`axiom`/`unsafe` 扫描和 axiom allowlist audit；
5. 将十八项 manifest 行绑定到同一 source commit 与 build evidence；
6. 创建只含证据/manifest 的后继 commit；
7. 运行 `formal/scripts/ci.ps1 -RequireProved`；
8. 获得 category/DPO/Petri、π/domain、Lean/provenance 独立人类评审；
9. 完成真实 RFC-0002 FCP，并在其后决定 ADR-0001 状态。

# 处置

**Promote to immutable-evidence binding.**

当前最大诚实状态是：

> 通用 Core Theory 与实质 reference 的最后承重接缝已实现并通过一次可变树
> 增量根构建；不可变 commit-bound proof evidence 与独立 QA-L4 review
> 仍待完成。

RFC-0002 保持 **Draft / Pre-FCP**，ADR-0001 保持 **Proposed**。在人类签名
前，即使严格技术门全部通过，聚合状态最多也只能是
`proved / review-pending`。
