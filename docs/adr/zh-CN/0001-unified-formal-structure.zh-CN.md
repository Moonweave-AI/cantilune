# ADR-0001：Cantilune 的统一形式结构

| 字段            | 值                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | **Accepted**（Owner COI 2026-08-16；不是 Lean `reviewed`；不是 RFC FCP-closed）                                                                                                                                                                      |
| Date            | 2026-07-23                                                                                                                                                                                                                                           |
| Last reconciled | 2026-08-16（FCP 窗口内 Owner COI Accept；Lean 为 `proved / Owner-accepted`；promotion 未走）                                                                                                                                                                    |
| Decision Owner  | Joker-of-Gotham (DRI)                                                                                                                                                                                                                                |
| Reviewers       | Joker-of-Gotham（Owner；Formal + Architecture；COI 已披露，2026-08-16）                                                                                                                                                                              |
| Related         | RFC-0001、RFC-0002、`docs/spec/formal-semantics.md`、`docs/research/0001-p1b-pi-bridge-audit.md`、`docs/research/0018-theory-product-boundary-clarification-2026-07-27.md`、`docs/research/0021-fms-primary-source-boundary-2026-07-27.md` 至 `0027` |
| Risk            | S2                                                                                                                                                                                                                                                   |

> **现行范围与状态校正（2026-07-28）：**后续内核结果取代了历史附录中
> 更宽泛的“完整 FMS”措辞。中央命题是
> `MaximumCompatibleD1AFMSClosure`，由
> `maximum_compatible_d1a_fms_closure` 构造。它有意记录两个不同分支：
> separated 的全源/enriched-adjunction 账本，以及非分离 D1-A Monad、
> 递归域和 hiding 账本；它不是一个统一的源论文 FMS 模型，也不得在没有
> 比较定理时把一个分支的泛性质移植到另一个分支。直接位于 actual-Agent
> 中的全抽象仅覆盖确定性的 typed tau/free-output prefix trie；更宽的
> guarded 结果是 native-trace/contextual-Hoare，而不是 unrestricted
> actual-Agent strong-bisimulation 全抽象或反向 compact definability。
> 八个生产包仍属于独立且尚未实例化的 Product Conformance 阶段。
> 产品通用 P1a 必须接收完整投影证书；所选 SCC-DAG/Petri 语义记录与
> 独立的固定签名十四事件参考不会被静默等同。
>
> 历史（2026-07-28）：当时本 ADR 仍为 **Proposed**。**2026-08-16：**
> Owner 在 RFC FCP 窗口内以披露的 COI 将其 Accepted。这**不**把 Lean
> 义务改写成 `reviewed`，**不**关闭 FCP，也**不**实例化八个产品包。

## 背景

RFC-0001 将 `cantilune` 确立为一个 agent-orchestration 框架，其核心是一个 **unified formal structure**，把四种形式体系作为不同侧面加以统摄，而不是在它们之间择一。该结构性决策是第一个不可逆的架构选择：下游每个阶段（executor、comms、observability、eval）都依赖于它。

2026-07-23 的分诊决策明确选择了这种统一而非单形式体系方案，理由是每种形式体系各掌握编排的一个独立侧面，而每个侧面各自对应一种基线失败模式：

| Formalism                   | Facet               | 所针对的基线失败模式                                     |
| --------------------------- | ------------------- | -------------------------------------------------------- |
| DAG                         | 表示 / 数据流清晰性 | Cursor（固定形状 $\Rightarrow$ 表达能力受限）            |
| Petri net                   | 并发 / 资源本质     | Codex（缺少显式终止与资源有界证据 $\Rightarrow$ 不可控） |
| π-calculus                  | 通信本质            | Codex/A2A（非形式化的通信 $\Rightarrow$ 流程不可预测）   |
| Morphisms (category theory) | 组合 / 映射本质     | OpenClaw（无精简核心 $\Rightarrow$ 膨胀）                |

## 决策

`cantilune` 采用一个 **unified formal object**，工作名称为 **`CantiluneGraph`**，其规范性设计目标是以四种形式体系为基础的四个投影。这些投影 **被要求成为同一个对象的一致视图**，通过保事件的函子映射加以实现；这是一条接受标准，而非当前的证明状态。

### 投影

1. **DAG projection**——类型化数据依赖图。边承载 **data contracts**（schema + 前/后置条件）。负责表达能力以及"什么依赖什么"的表示。
2. **Petri projection**——并发/控制层。库所建模 **resources**（context window、工具速率限制、人工注意力时槽）；变迁在 token 就绪时触发。负责资源与并发不变量，以及显式终止/活性证明义务；有界性本身不等于终止。
3. **π-calculus projection**——通信层。agent 间通道作为有名进程；为动态拓扑和通道移动提供形式语义。负责 A2A 通信本质。
4. **Morphism projection**——组合层。agent/操作作为某范畴中的态射；编排 $=$ 组合。负责最小而精确的组合/重构语义。

### 一致性要求（规范性）

框架 **必须** 定义各投影之间的函子映射，使得在一个投影中的某个事实在其他投影中有良定义的解释——例如，一条 DAG 边对应一条 Petri token-流路径，对应一条 π-calculus 通道消息，对应一次态射组合。**否则，四个投影就是四个互不相连的模型，"unified structure"之声称便不成立。** 此一致性证明是 P1 交付物，也是 ADR-0001 接受的门槛。

**Status qualification：** 本段是规范性目标。下文早期审计附录是历史快照；当前实现候选与精确排除项由末尾的 2026-07-27 DRI/最大相容边界更新、RFC-0002 §25–§27 和 proof manifest 控制。

## 考虑过的备选方案

| Alternative                          | 被否决的原因                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| 仅 DAG                               | 无形式化的并发/终止（对 Codex 偏弱）；无通信本质；重现"just DAG"（等价于 LangGraph） |
| 单一形式体系（Petri / π / morphism） | 丢失其他侧面；每个侧面各对应一种 DRI 希望针对的失败模式                              |
| 以 category theory 为唯一基础        | 最为通用但抽象，难以对接具体的 eval 成果；对目标生态系统不可及                       |
| 四个互不相连的模型由代码粘合         | 重现 OpenClaw 式膨胀；无形式一致性；observability-as-structure 失败                  |

## 后果

**正面（以接受门槛为条件）：**

- 一旦相应的投影定理确实得证，即可针对全部四种基线失败模式。
- 对 LangGraph 具备可辩护性（组合性切入点：类型化边 + 资源语义 + 模型解耦的路由 + observability-as-structure）。
- 可观察商 LTS、event-lift/穷尽性关系、共享事件同一性、粒度策略与终止谓词被独立定义并证明一致之后，可观察性、重放与死锁分类才随之而来。
- 分阶段扩展自然（逐步添加投影）。

**负面 / 风险：**

- 规约复杂性：函子一致性要求非平凡，是主要技术风险。**Mitigation：** 将一致性证明设为 P1 门槛；若无法对全部四者证成，则缩减至一致子集并记录该缩减。**状态更新（2026-07-27）：** 通用一致性接口与参考见证完整。产品特定实例化（rank 函数、firing 映射、资源策略）是包符合性义务，不阻断核心理论 FCP。
- 若投影无节制累加则有范围/膨胀风险。**Mitigation：** 分阶段计划（RFC §13）；每个投影必须通过其 eval 声称。
- 评审人缺口：尚无第二位评审人。**Mitigation：** ADR-0001 的接受以评审人签字为门槛。

## ADR-0001 的开放问题（获批前解决）

1. `CantiluneGraph` 的具体语法/类型系统。——**部分解决：** 见 `docs/spec/formal-semantics.md` v0.1（SMC $C$ $+$ rewriting $R$）；Q4（策略 DSL）仍开放。
2. 各投影之间的函子映射——需精确陈述而非含糊带过。——**已澄清（2026-07-27）：** 理论建立通用证书接口（`ProjectionCertificate`、`ProductRuleProofBundle`）与参考见证（60/60 P1c 矩阵）。产品用具体规则映射实例化这些接口。通用 DAG rankable-graph 投影与 Petri pre-net 构造完整；产品特定 rank 函数与 firing 映射是包符合性义务，非理论门槛。
3. 若无法证明完全的四向一致性，最小一致子集是什么？（回退方案）——**已作为策略解决：** RFC-0002 §6 绑定回退（将 π 缩减至已证子语言，其余标记为 unverified）；P1c（完全 π mobility）被显式推迟。
4. 策略 DSL 的表达能力与终止保证之间的关系（与 Petri projection 相互作用）。——**仍开放。**
5. 状态同余、administrative-step 策略、可观察推导域与成功终止谓词的归属。——**已解决：** 见 `docs/spec/formal-semantics.md` 与 RFC-0002 条款 (4)。

## 2026-07-23 后续决策（作为结构性 ADR 的正式记录记于此）

- **统一对象已具体化：** $\text{CantiluneGraph} = (C, R)$——SMC $C$（静态）$+$ string-diagram rewriting $R$（动态）。取代早期的 6 元组草稿 $(N, E, S, T, C, M)$，后者只是一个容器，而非一个统一体。
- **π-projection 范围（half-π (II)）：** request/accept、十五个 normative event family、typed/polarised presented Open-π、fresh nominal operational realization 与 D1-A actual-Agent commutation；它仍是证明义务而非 by construction，精确候选边界见末尾更新。
- **Dynamics：** string-diagram rewriting（而非裸 LTS）。通用证书和实质 reference 已构造；生产产品仍须为各自具体事件、投影、终态与 trajectory 提供 Product Conformance。
- **证明策略：** 明示分期（phased, explicit）——P1a、P1b、P1c、D1-A 与最终 common-chain 分开证明。当前状态由 RFC-0002 §25–§27、proof manifest 和不可变证据治理，而非原始的“三条 by construction”期望。

## 2026-07-23 独立审计附录

本附录更正证明状态与来源使用；它 **不** 选择替代性的 π 目标，也不改变统一结构决策。

| 字段           | 结果                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| Classification | 形式架构审计；S2；QA-L4；Pre-FCP/M1                                                    |
| P1a            | 静态构造部分完成；态射单位情形完成；DAG/Petri 规则映射开放                             |
| P1b A–B        | 已验证；目标 variance 已更正为协变 $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$ |
| P1b C          | 交接的非标准 π-并行张量被作为 ill-typed 否决                                           |
| P1b D          | 已识别 pointwise-cartesian 条件定理；缺失实际的对象/生成元映射                         |
| P1b E          | 在 request/accept BNF 与 $R_{\mathrm{RA}}$ 定义之前不良形                              |
| Disposition    | **Iterate, not Promote**；ADR 仍为 Proposed                                            |

审计还否决了两条承重捷径：强 monoidality 不蕴含保持 DPO pushout，且 bisimulation 商既非必要也非充分，不足以将 π 进程元素变为所需的目标 SMC。

## 2026-07-23 实施决策附录

继独立审计之后，实现范围同时选择两个目标，而非以其中一个替代另一个：

1. 一个类型化 open-process SMC，其中接口为对象，组合为 plugging plus hiding，张量为并行组合；以及
2. 协变 FMS 函子范畴路由及其 pointwise cartesian 张量，其中 π 并行保持为 agent 对象上的一个内部操作。

接受要求一条从类型化路由、经擦除的原生 π、到所钉定的 FMS 接口的交换与观察兼容性定理。原生单步源事件不得被静默弱化为 $\tau^*$。

本附录仅选择证明架构。当前未经评审的 Lean 树现已 kernel-build 所呈现的 open-process SMC、原生擦除、有限闭 request/accept 与一次委托证书，后者从其映射状态反映每个原生动作、finite-control alpha/structural late-π、真正的 pointwise finite-power monad、自然 supported-process 支持语义、有限 `P_f(H-)` 阶段，以及一个条件性支持层 FMS 交换定理。支持分配后随 hiding 现满足 continuous-natural-transformation 收缩方程，但这只是一条支持对象律，而非 FMS agent restriction/coherence 包。强化后版本锁定的 `CompleteExternalFMSTheoremPackage` 陈述了完整接受接口，但 `CompleteFMSAvailable` 无 inhabitant。有限参考 π 列现已在全部 15 行中原生化，且三个关键的 admit 操作有精确的事件/epoch/重放轨迹定理，包括精确存储的端点、任意有限子段重放与固定签名 epoch 对齐，以及 kernel 导出的有限高度期望界。然而，当前开放的 reconnect/delete 编码有额外的 standard-late 环境变迁，因此其事件索引证书并非对整个原始 late LTS 的完全反射。一个独立的闭重设计为四个内部事件族提供真正的原生 $\tau$ 步，并精确分类来自那四个闭源的每个原生变迁。这仍不提供完全反射证书：闭 open/close 端点有一个进一步的载荷 $\tau$ 步，且 Lean 证明当前每事件两态的源 LTS 无法反射那个完整目标。需要经评审的多状态协议或不同的终止端点。其余 product-wide 规则族仍未构造。该树也未提供共享的四投影执行包或全定理。
精确范围记录于 `formal/proof-obligations.json`；故 ADR 仍为 **Proposed**。

**Proposed amendment, 2026-07-23：** 在请求者明确授权继续完整理论之后，finite-control π 参考演算加入标准的证明守护 mismatch 形式 `[a≠b]P`。Instance reconnect 被解释为普通通道委托，quiescent instance deletion 被解释为零 continuation 的原生关闭握手。三者皆为真正的单步 π 推导；不引入元数据变迁或弱闭包。这解除了早先缺失见证的障碍：全部 15 个 P1c π 单元现皆有原生见证。它并不解除更强的 full-late-reflection 障碍：开放的 reconnect/delete 握手也有环境变迁。有限参考演算随后关闭了全部 60 个事件索引单元与四张受限操作证书。
在 Owner/DRI 与进程语义评审之前，ADR 仍为 Proposed；一般的 admitted-rule/static/resource/admission 定理仍开放。

接受前所需证据：

**理论 FCP 门槛（抽象元定理与通用接口）：**

1. ✓ 定义精确源语法、configurations、规则、freshness 与粒度（完整）；
2. ✗ 构造并独立检查当前显式的完整 FMS
   powerdomain/continuous-natural-initial-domain-solution/action/
   hiding/process-pair-full-abstraction 接口的 inhabitant，连同 Cantilune
   另行识别的 exact-operational 与 divergence/deadlock 条件，**或**取得
   RFC-0002 §16 有限控制范围边界的 FCP 批准，使原生操作 π 成为规范性投影，
   FMS 作为可选符合性；
3. ✓ 通用证书接口（`ProjectionCertificate`、`ProjectionFamily`、
   `ProductRuleProofBundle`）支持产品实例化；参考见证（60/60 P1c 矩阵，异构
   运行时）展示非空洞性（kernel-built）；
4. ✓ 独立定义可观察目标推导、状态同余、administrative-step 策略与
   event-lift/穷尽性关系（完整）；
5. ✓ 在参考见证中定义并证明成功终止谓词的保持/反射（完整）；
6. ✗ 取得独立形式数学/范畴/进程语义评审（治理阻断）。

**产品符合性门槛（具体包实例化，FCP 后）：**

各八个产品包（Cantilune、Cantilune Notation、Libretto、Cast、Baton、Cue、Chorus、
Reprise）独立提供：

1. 包清单与规则清单（`packages/<name>/<name>.yaml`、`rules/`）；
2. 每规则证书，实例化 `ProductRuleProofBundle`，以理论参考构造为模板；
3. 各 admitted 规则的 DAG rank 函数与 rank 保持证明；
4. 各 admitted 规则的 Petri pre-net token 语义与 firing 推导；
5. 运行时操作事实：资源/会话策略、删除/静止谓词、授权谓词、冲突解决；
6. 随机证据：公平性/稳定窗口定义、正-ε 进展界、opportunity-epoch 对齐、生产
   kernel 构造。

**边界修正（2026-07-27）：** 早前作为理论接受门槛列出的项（扩展到完整
admitted 规则集、完成 DAG/Petri 直接规则映射证明）是产品特定实例化义务，不阻断核心
理论 FCP。理论通过参考见证证明通用接口可满足；产品稍后用具体操作事实实例化这些接口。

## 2026-07-24 实施范围校正

后续 kernel-built 的工作更改了若干实现事实，但不改变本 ADR 的决策状态。

- `GeneralFiniteOpenDPOI` 对所有有限、incidence-complete 的类型化 open hypergraph（带所选有序 boundary）证明了范畴桥：在 adhesive slice 中与 full replete essential image 等价、对任意 encoded-monic 的合法 boundary-retaining 匹配有内蕴 DPO 见证、内蕴 residual，以及对任意 parallel-independent 对的内蕴并发同构。两个典范 DPO 方块在 ambient adhesive slice 中皆为 Van Kampen。无限制 slice 的等价仍不成立。一个独立的 `ExactPositionalObject` 谓词现刻画该 essential image，且一个有限 boundary-duplicate 对象证明了为何不存在更弱的 whole-slice 声称。
- `P1cFullNativeRefinement` 通过采用显式中间协议状态修复了早先的两态障碍。它为全部 15 个有限参考族给出精确的 native-step 分类与一个 sound、reflective、terminal-preserving 的 `ProjectionCertificate`，包括原生 mismatch 决策、reconnect 与 quiescent delete。这尚未提供共享的 product-wide admitted 规则族或全四投影定理。每个精炼步也是真正的未过滤 α/structural late 步。然而在当前 runtime-version 字段下，纯进程完全证书不可能：admission 改变源版本而纯 π 状态保持版本零。故元数据层的选择回归 RFC-0002。
- 旧的分裂 FMS powerdomain API 现被机械证明为不一致，仅以 `Legacy*` 保留。更正后的接受结构将 divergence 与 deadlock 区分开来，把 unit/divergence/deadlock/choice 保持置于同一泛性质中，并要求 strong-commutative、parallel/action、hiding/compositional 与 full-abstraction coherence。这只是一个更正后的接口：精确的 binder hiding round-trips 与精确的 action-fold/left-merge/synchronization/four-way-parallel 接受方程现已 kernel-build，但其 Table-2 映射仍是所供数据，且 exact 与 complete FMS 可用性皆无 inhabitant。
- 每个有限异构 `EpochChain` 现有一个完整的 dependent native-event/replay/runtime-execution-epoch 一致。一条 `Fin (N + 1)` 上的真正 Ionescu--Tulcea 律几乎必然遵循该调度。其终止自环是 administrative stutter，而非伪造的 `DPOEvent` 或 admission。与反馈观察机会的对齐仍是一个调度器层义务。对于调用者提供的 kernel，若其后续相概率为一且终止相为吸收，则同一共同轨迹成立；该前提是 Dirac 的，不证明业务事件间的随机选择。一个稍后的有限分支 kernel 确实对显式业务选择赋予概率、保持同端点事件相异，并直接从采样的 dependent edge 导出重放。它仍需要一个具体的异构 runtime/scheduler 实例化。
- `CoherentProjection` 现使静态/操作连接显式：在状态比较同构下，映射的 rewrite 单元在目标 Arrow 范畴中交换。其实现是商感知的，并使步单元独立于 α/structural 代表。四投影定理有一个需要四条此类记录的 coherent 变体。最强的 FMS-gated 变体额外要求一个具体的 exact FMS 包与一个操作性 π/FMS 桥，将映射的状态、动作与单步变迁与该包的指称相识别。仓库无共享 product 执行包、exact FMS inhabitant 或此类桥，故全定理仍开放。

本地 `formal/` 树不再被顶层 ignore 规则覆盖，但仍为 untracked，且 `.gitignore` 已被修改。因此这些结果缺乏不可变提交溯源与独立 QA-L4 评审。RFC-0002 仍为 Pre-FCP，本 ADR 仍为 **Proposed**。

## 2026-07-25 扩展族校正

实现现有一个 extension-indexed 的四投影接口：实际执行包、state/event reindex 组合、已验证事件的 replay naturality、单一共享源族，以及 per-signature 的四目标操作一致性。一条采样的固定签名业务边也决定其 DPO 重放、runtime/opportunity epoch，以及全部四个原生目标步。

exact-positional 对象刻画现是与 adhesive typed-presheaf slice 的 full exact 子范畴的一个显式等价，而非 fixed-host 或 thin-inclusion 表示。跨越一条有限异构 epoch 链，对齐的四投影族还对每个采样的业务或 admission 相给出几乎必然的事件级共同证据。admission 仍为 `AdmissionReplays`；当前 boundary 记录仍缺四个目标 admission 变迁。一个已检验的 no-go 定理证明它们不能是纯 reindexing，因为 reindexing 保持签名版本，而 admission 严格推进它。

P1a DAG boundary 现在显式可 rank 的类型化 open hypergraph 上是构造性的，而早先的自环仍反驳无限制 domain。P1b 有真正的 structural strong-late forward soundness，但跨所有 structural 代表的精确反射仍开放。授权、quorum 冲突与 positive-support 反馈桥是显式的；一个零质量 administrative reset 被形式化地从 pathwise monotone 反馈语义中排除。离散 finite-set CPO 片段也被证明不能承载 FMS powerdomain 所需的一般连续单例 unit。

这些结果收窄了未竟工作，但未解决架构接受门槛。仍无生产四族 inhabitant、完整 P1b 反射、all-rule rank/Petri/resource 映射、异构目标 admission 重放、异构公平调度器，或真正的 FMS domain/full-abstraction 模型。未记录任何独立评审或不可变提交证据。故本 ADR 仍为 **Proposed**。

## 2026-07-27 理论/产品边界修正

研究日志 0018 识别出八个产品包（Cantilune、Cantilune Notation、Libretto、Cast、
Baton、Cue、Chorus、Reprise）错误地阻断核心理论 FCP 完成。本修订前的接受标准（第
161-174 行）混淆两个不同门槛：

1. **核心理论 FCP** —— 抽象元定理、通用接口、参考见证
2. **产品符合性** —— 具体包实例化、运行时事实、授权策略

**根本原因：** 当前 RFC-0002 与早期 ADR-0001 接受标准混淆抽象理论完成（证明
通用证书接口可满足）与具体产品实例化（为特定包提供操作事实）。

**施行修正：** 接受标准部分现已分离：

- **理论 FCP 门槛：** 通用证书接口（`ProjectionCertificate`、
  `ProductRuleProofBundle`）、参考见证（60/60 P1c 矩阵，异构运行时）、FMS 范围决策、
  独立评审
- **产品符合性门槛（FCP 后）：** 各包独立提供规则清单、DAG rank 函数、Petri
  firing 映射、资源/授权策略、公平性/ε 证据

**Q2 澄清：** 通用 DAG rankable-graph 投影与 Petri pre-net/SSMC 构造完整（理论）。
各包 admitted 规则的产品特定 rank 函数与 firing 映射是包符合性义务，不阻断理论。

**后果修订：** 风险评估现反映通用一致性接口与参考见证完整。产品实例化义务是独立的
FCP 后门槛。

**关键洞察：** 理论证明证书是*可能的*（通过参考见证）。产品证明它们是*现实的*（通过
具体实例化）。第一个门槛不阻断于第二个。

本边界修正不改变架构决策（统一四投影结构）或其 **Proposed** 状态，后者仍待 FMS
范围决策（RFC-0002 §16）、独立评审与 FCP 接受。

## 2026-07-25 原生规则与生成运行时校正

后续本地 Lean 工作收窄若干证明缺口，但不改变本决策：

- 规范性类型化关系现包含标准 late-pi freshness 前提，并与原生 untyped 变迁一一擦除；全部十五个参考 P1c 族居其中；
- 十四个固定签名业务族共享一个可重放的源执行包与四个原生目标推导，而签名 admission 仍是一个显式异构变迁；
- 具体轨迹一致现保留事件同一性、精确的已验证 `DPOEvent` 重放，以及 execution/opportunity epoch 对齐；一个生成的有限调度器跨越真实的 admission，并在每条边上携带四个目标推导；
- 十四个固定签名业务事件现共享可重放的 DAG、Petri 与 morphism 证书，并有独立的原生目标推导；且具体 admitted 操作现能在同一计算出的 post-rewrite configuration 上区分成功、外部等待、死锁与有产出的无限观察；
- 有限位置类型化 open hypergraph 与 adhesive slice 的 full exact-positional 子范畴等价，在该范围内有任意合法 monic 补与 parallel-independent 并发。无限制 slice 等价为假，并被已检验的反例排除；以及
- 一个真正的非离散严格 omega-CPO 计算片段将 divergence 与 deadlock 分离，但它不是 Abramsky powerdomain、递归 FMS domain 解、coherent hiding/action 模型，或 full-abstraction 实例。

全新全量 CI/审计与独立评审——针对已实现 P1b residual 反射、生产 projection/resource 族、product scheduler 前提与不可变提交证据——仍是接受门槛。RFC-0002 §16 现提议将完整的 source-pinned FMS inhabitant 设为可选 conformance extension，而非 P1 门槛，因为 P1 排除递归与复制。该范围变更在 FCP 与 Decision Owner 接受之前不生效；若被拒绝，完整 FMS inhabitant 仍为接受门槛。故本 ADR 仍为 **Proposed**。

在其记录的 2026-07-25 快照处，本地证据门槛通过 234 个 Lean 源、8889 个 build job、零禁用证明占位符与 487 个 allowlisted 的 kernel-dependency 报告。之后的 worktree 变更不在该快照之内，需一次全新门槛。由于该树未提交且未评审，历史结果不改变 ADR 状态。

## 2026-07-26 residual 与 admission 证据更新

后续 kernel-built 工作现提供一个非空的可执行跨 epoch 参考，含四个独立类型化的目标 admission 关系、严格版本推进、精确重放，以及一个真正的可见 pi 注册输入。这取代了早先"无参考目标 admission 变迁存在"的陈述。它不提供生产 DAG/Petri/morphism admission 语义、coherent 跨 epoch product 投影族，或 product authorization/fairness/probability 见证。

P1b 请求轨道也更强：唯一的自由载荷被证明在整个 alpha/structural 轨道中未被捕获且位于一个活跃的 output-value 位置。一个原生 parallel-zero 反例证明最终 residual 定理必须将端点按 structural congruence 分类，而非按精确语法。Public/session/input-binder incidence 与任意原生 inversion 仍开放。这些变更收窄了剩余证明，但未满足 FMS 范围决策、独立 QA-L4 或 FCP；本 ADR 仍为 **Proposed**。

## 2026-07-25 待裁决的 FMS 范围

RFC-0002 §16 记录了指称 FMS 路线的各备选方案与后果。本 ADR 故意在 FCP 之前不作选择：

- 接受 finite-control 边界，则原生操作 late-π 成为规范性第四投影，并保留 `FMSGatedFourProjection` 作为可选的 source-pinned extension；或
- 拒绝该边界，则保留完整的 `Cpo^I` powerdomain、递归 continuous-natural initial domain solution、hiding/coherence、adequacy 与 process-pair full-abstraction 包作为 P1 接受门槛，连同 Cantilune 另加的精确 per-label one-step、observation inverse-image 与 divergence/deadlock 分离条件。

任何实现结果、作者断言或异议缺失都不解决该选择。它需要指名的 Decision Owner 与独立的进程语义/形式数学评审。

## 2026-07-26 标记化 residual 与产品接口更新

本地 kernel 工作从每个请求性 structural 代表中提取一个共享的、极化的原生 split，并规范化其 restriction envelope。`P1bNominalIncidenceClosure` 现为全部四个真正的 sync/close 构造子证明 `RequestingSplitSupportTransfer`，从而居留非循环的 nominal-incidence 分类器。精确的请求性 residual 反射、完整 `StandardLateReflection`，以及无条件的 `pi_ra_certificate`（跨未过滤的 structural strong-late LTS）均已 kernel-built。CENTRAL-13 因此为 `implemented_unverified`。一次全新完整本地 CI/axiom 审计通过；不可变提交证据与独立进程语义/Lean 评审仍待。

更正后的异构 product 证书也有一个完整的有限 identity-reference inhabitant，含 static/operational coherence、严格 admission、ranked business step、policy、fairness、一条概率为一的 kernel edge（从不稳定状态出发的那条业务步），以及 scheduling。同一参考证明该业务步在 admission 之前不可用、之后可用，且经校验的重放拒绝错误规则或错误来源。
这证明接口非空，但未实例化生产 DAG/Petri/pi/morphism 语义。闭 P1b 操作证明同样不决定 complete-FMS 范围问题，也不提供 product-specific 证书。完整 FMS 或一项被接受的 RFC 范围变更、不可变证据、独立 QA-L4、FCP 与 ADR 接受仍悬而未决。本 ADR 仍为 **Proposed**。

## 2026-07-26 完整本地 gate 与更强参考证据

集成的 dirty working tree 现通过完整本地证据门槛：283 个 Lean 源，聚合 `f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`，8938 个 build job，零禁用证明占位符，667 份 kernel dependency 报告，限定于 `propext`、`Classical.choice` 与 `Quot.sound`。
一次对抗性实现评审在 P1b residual 证明中未发现弱闭包、过滤、变迁搬运或循环端点前提。这不是不可变提交绑定证据或独立 QA-L4 签名。

有限非空 Hoare 构造现是有限 omega-CPO 上一个真正的范畴 Monad，含连续 Kleisli 律，但仍缺空 deadlock、分离 divergence、all-omega-CPO powerdomain、递归 domain 解、hiding/coherence 与 full abstraction。一个新的 nominal atom 门槛也在 named open-pi 边界处强制精确自由支持，而组合式 plug/hide adequacy 仍开放。

第一个非单位 product-rule 参考现使用一条真实的 reconnect 事件，它添加一条边并给出原生 DAG、Petri、standard-late-pi 与 morphism 推导，完整的四事件反射、精确重放，以及概率为一的调度证据。它只是一个参考出现，而非八个生产包实例化。

故实现证据实质更强，但既未解决未决 FMS 范围决策，也未解决人工接受链。完成门槛正确拒绝全部 18 项义务：11 项为 `implemented_unverified`，7 项为 `partial_scaffold`，无一为 `reviewed`。本 ADR 仍为 **Proposed**。

## 2026-07-26 FMS 来源范围澄清

本澄清既不改变架构决策，也不改变其 **Proposed** 状态。它记录四条边界，任何后续 FCP 裁决都必须保留：

- FMS 将 `A = μX. P(H X)` 呈现为通过标准递归 domain 方程技术获得的初始解。一般代数紧致性可作为局部构造方法，但其本身不是被援引的 FMS 定理，也不是本 ADR 选定的强制方法。
- FMS full abstraction 通过指称相等与强 late bisimilarity 来比较两个进程项。"递归 domain 的每个元素皆可定义"不是一条定理。一个独立的可定义性义务需要 RFC 对其载体与量词给出显式定义。
- 源演算含 guarded replication `!α.P`；当前 Lean finite-control `Raw.Proc` 既不含复制也不含递归。故其当前结果是一个片段定理。将本地演算扩展至任意进程源范围仍落后于既有的 RFC/ADR 停止条件。
- 精确的 per-label 原生单步对应、强 powerdomain-observation inverse-image 律，以及指定的 divergence/deadlock 不等，是 Cantilune 在直接 FMS 定理陈述之外的接受条件。

`CompleteFMSAvailable` 与 `ExactFMSAvailable` 皆不因本次文档更新而被居留。RFC-0002 仍为 Pre-FCP，本 ADR 仍为 **Proposed**。

## 2026-07-26 精确 action 与有限链更新

可变证明树现构造出精确的局部连续 FMS action endofunctor 与局部连续的未分离复合 `P ∘ H`。它还含 chosen-product strong/commutative coherence、complete-join universal extension 定理、一个真正的有限初始逼近塔，以及一条面向未来 continuous-natural 递归 domain 解的 proof-carrying 条件边界。该条件边界不构造其不动点，也不能制造完整的 FMS 接受包。

一般有限跨 epoch product 链现保持精确的五视图重放、事件/admission 同一性、严格签名版本、执行 epoch，以及 source-probability-space 的事件级轨迹。直接 FMS 定理为一行保留实际规则与 admission 变迁。对抗评审拒绝了多行解读，因为直接中间 epoch 不匹配，且既无共同 FMS 包也无指称端点缝合被记录。这些定理消费包所有的证据；它们并不创造缺失的八个包规则清单或证书。

常规本地门槛通过 343 个 Lean 文件、8997 个 build job 与 987 个已审计声明。`-RequireComplete` 仍拒绝全部 18 项核心义务：11 项为 `implemented_unverified`，7 项为 `partial_scaffold`。分离的 Abramsky powerdomain、构造的递归 domain 解、完整 hiding/adequacy/full abstraction、总的 named Open-pi 操作 SMC、生产包输入、不可变溯源、独立 QA-L4 与 FCP 仍待解决。

此证据实质收窄实现缺口，但不做架构决策。RFC-0002 仍为 Pre-FCP，本 ADR 仍为 **Proposed**。

## 2026-07-26 NDωCPO 与精确边界更新

> 历史检查点：稍后的 all-source-adjunction 更新取代了本节关于全局解集缺失的陈述。

一般的不确定性 omega-CPO 范畴、其已实现的小极限、局部连续 hom action、分离的 nullary initial object，以及条件性的 general-adjoint-functor 构造现均 kernel-built。全局解集 inhabitant 与 Fubini/enriched coherence 则否。此外，一个已检验的反例证明分离的有限严格 powerset 候选在任何非空有限 equality 源上都不是自由的；仅构造了 empty-source 的局部 universal arrow。

一般 bound-output action-label alpha 商已构造，但非空 named-boundary 张量与 exact-name plug 在当前表示下被阻碍。common-FMS 两行链仅对一个所供 common 包与典范确定性重放记录操作与指称接缝及精确 event/action 位置。一个稍后的条件定理现耦合两个调用者提供的真实生产 kernel 与一个共同 exact-FMS 接缝；它仍不构造任何 kernel、耦合、包或 product 事实。

精确的可变树常规门槛通过 359 个 Lean 文件、9013 个 build job 与 1043 个已审计声明。完成门槛仍为红，含 11 项 `implemented_unverified` 与 7 项 `partial_scaffold` 条目。八个包事实集仍缺失，且无不可变溯源、人工 QA-L4、FCP 或接受决策发生。故本 ADR 仍为 **Proposed**。

## 2026-07-26 全源伴随与 Fubini 不相容更新

all-source 一般解集条件与 enriched free/forgetful hom 等价现已在可变树中 kernel-built。所得的典范顺序 Fubini 映射是联合连续的。其 pure-unit、双变量 naturality、两个 unitor、reassociation、left multiplication 与 pure-left right-multiplication 律均已 kernel-checked。它在其第一个计算参数上对 divergence、deadlock 与 choice 严格。

一个精确的 no-go 定理现证明：swap 交换性加上对两个区分常量的严格保持与 `divergence_ne_empty` 相矛盾。这不是早先的 finite-powerset 捷径反例，也不反驳未分离的 FMS 构造。它揭示了本 ADR 当前强化接受目标中的一个冲突：分离常量、严格双常量顺序与典范交换性不能同时保留。

选择未分离的交换 effect、分离的非交换 effect，或不同的 algebra/morphism 理论都会改变可观察语义，并需要 FCP。位置性 named-boundary 实验没有端点重命名或 quotient-Hom-to-raw adequacy 桥；其 finite-control no-go 以一个显式假设的任意长运行实现为条件。故它不授权复制、递归或抽象 wire quotient，且八个生产包事实集仍缺失。

本次更新不选定任何路线。本 ADR 仍为 **Proposed**。

## 2026-07-26 分离支撑与受守护复制候选

可变 formal 树现为支持分离架构提供证据，但并不采纳。它构造一个有限支持的部分交换 separation algebra、一个带全部所列 coherence 方程的分离张量表示、精确的原生独立动作 diamond，以及仅由显式见证的原生交换方块生成的重放等价，而非仅由标签支持生成。
依赖通信仍是一个有序的原生同步。

分离载体进一步被提升为一个 supported omega-CPO 范畴，含显式 omega-sup 支持有界性、连续 support-exact morphism、连续张量映射、自然 coherence 映射，以及全部所列对象层 coherence 方程。这移除了早先的 set-only 限制，但仍不构造 powerdomain、monad、free adjunction 或递归 FMS agent。

Nominal finite-world 与 omega-CPO 模型现给出至多固定旧世界的置换内的全新分配，以及一个自然分配/hiding 收缩。既有的未分离 omega-Scott world monad 另外满足 shift、unit、multiplication、allocation 与 Fubini delta 方程。这些构造无一为分离的 Abramsky powerdomain、递归 agent 解，或完整 FMS hiding 与 full abstraction。

一个独立的候选语法提供单前缀 guarded replication、一个与嵌入旧项兼容的确定性 alpha-freshening 替换算法、对旧像上原生步的精确保持/反射、一个对全局全新替换的 no-capture-risk 定理，以及任意长的原生 trace。它还携带一条真实的 Nat-索引无限 strong-native tau 运行，并将该操作 divergence 谓词与零 deadlock 分离。这不是语义 powerdomain 分离。对嵌入旧语法的一步保守性现已证明。精确 free-name 替换、self-substitution、支持组合、replicated-input 冲突分支，以及显式全语法 freshness 下的进程组合亦被证明。反例排除无条件的 syntactic no-op 与无限制组合。严格置换等变仍为假，故通信闭包必须按 alpha 表述。它不是完整的 FMS 源演算或其指称。

该候选还有一个生成的 alpha 等价与有限置换 action，覆盖新的 replicated-input binder 与 bound-output 标签。原生等变对非通信构造子是精确的。新的 action-and-derivative alpha 商通过精确 derivative-alpha 见证允许嵌入、同步与 close 变迁；当其替换不触发数值 freshening 时，所有构造子皆严格等变。一个已检验的有限 swap 反例仍显示确定性数值选择器并非字面等变。一个独立的 common-fresh-name/fuel 归纳现证明：对每个数值 freshening 分支，总可执行替换按 `RecursiveAlpha` 等变。剩余的完整 sync/close `NativeStep` 结果需要 alpha 相关源体上的替换同余，而非识别字面名字的许可。

递归 domain 路线现也有连续 embedding-projection 对、为实际 agent endofunctor 设的一个具体单例种子迭代塔、omega-CPO 与 world-model 范畴中的 coherent-thread 逆极限、联合单射的有限投影，以及从 `F L` 到 `L` 的典范连续 fold。shifted projection 锥的保持、连续双逆与该 fold 的 `IsIso` 现已被 kernel 证明等价；一个保持见证构造遗留不动点见证。当前 hom-local-continuity 记录不提供该保持 inhabitant。故这仍是 bilimit 论证的 projection-极限 一半，而非 `A ≅ P(H A)`、代数紧致性、hiding、adequacy、definability 或 full abstraction 的无条件 inhabitant。

既有的 named-boundary 元数据现有一个精确的重命名演算：含 unit/associativity 律的恒等与复合、支持层同余、顺序 freshening，以及 avoidance-preserving refresh。当前极性擦除的 `publicSupport` 与不相交输入/输出 atom 证书仍拒绝非空同名恒等 wire。选择位置性或具体 boundary 出现、极性/使用 multiplicity、wire 语义、fresh environment、process/action transport、quotient 相等，以及精确操作 adequacy 关系仍是 RFC/FCP 决策；不从元数据律推断出总的操作 Open-pi SMC。

真实 kernel 概率层也比早先的典范重放检查点更强。两条调用者提供的 Ionescu--Tulcea 生产律现可被耦合并连接到一个共同 exact FMS 包，产出几乎必然的原生标签、DPO 重放、epoch/签名对齐、共同动作，以及链式指称端点。这是一条条件定理：不制造任何生产 kernel、耦合、exact FMS inhabitant 或 product 事实集。

采纳此路线会更改两项公开语义决策：一般 all-pairs 交换性将变为支持索引的交换，而 finite-control 公开进程类型将获得一个不同的递归扩展。这些决策需要 FCP。named-boundary 表示、递归 FMS domain/hiding/full abstraction、实际生产 inhabitant，以及八个 product 事实集仍悬而未决。本 ADR 仍为 **Proposed**。

## 2026-07-26 FMS bottom/zero 来源范围校正

受审计的 FMS 源要求一个交换 monad、一个 semilattice zero 与 choice，以及严格 semilattice 同态，但不要求 powerdomain 序的 bottom 不同于 semilattice zero。它也不陈述带无限原生 tau 运行的 guarded 进程指称载体 bottom。

故 kernel no-go 识别的是 Cantilune 强化接受目标中的一个冲突，而非原始 FMS 构造的失败。与源兼容的选项是省略 effect 层不等，并通过递归 agent 与 full abstraction 证明进程层区分。若保留该不等，则交换性、严格性或 algebra/morphism 理论必须改变。当两个区分常量皆具空支持时，仅支持分离并不避免该冲突。`FMSCpoFiniteSupportStrictConstantsNoGo` 现在 supported omega-CPO 层检验该精确空支持情形。它不反驳一般的 Abramsky 构造。

这是一项承重的语义选择，需要 FCP。本 ADR 仍为 **Proposed**。

## 2026-07-27 内核闭包更新

本检查点取代早先关于 bilimit 穷尽性与递归替换同余的条件性陈述。当前树无条件构造 `ConcreteBilimitExhaustivity` 与 `concreteActualFixedPointWitness`，即对仓库未分离 omega-Scott lower/Hoare 函子的一个连续自然不动点 `A ≅ P(H A)`。它还构造 `RecursiveAlpha.substitutionCongruent`，将每个递归 native-step 构造子按 alpha 相关的一步 residual 封闭，并为同一未分离 world model 提供 monadic `powerHiding` coherence。

这些是真实的 kernel 闭包，但该不动点不是 Abramsky powerdomain、initial-algebra/terminal-coalgebra 见证，也不是代数紧致性。包层定理 `no_distinguishedFubiniStrictness` 另在不假设有限 powerset 表示的情况下证明：分离的 divergence/deadlock、交换 Fubini，以及两个常量的 first-input 严格性不能同时成立。`no_strengthenedExactFMSAcceptancePackage` 将该矛盾提升到完整的 exact-acceptance 边界。两定理均不反驳省略该强化组合的 Abramsky 构造。

仍无源兼容的 Abramsky 包、递归 agent restriction、adequacy/definability/full-abstraction 包，或总的非空 named-boundary 操作 SMC。八个计划中的 product 包仍无受领的规则清单或运行时证据。选择公开 boundary 表示并修订不一致的强化 FMS 接受目标是 FCP 决策。故本 ADR 仍为 **Proposed**。

## 2026-07-27 人类 DRI 路线确认与状态校正

**Decision Owner：** Joker-of-Gotham

**架构状态：** Proposed

**实现授权：** 已授予

**最终独立评审：** Pending

DRI 已确认 RFC-0002 §25 的实现路线：Core Theory 与 Product
Conformance 分离；D1-A effect 使用非分离、对称交换 Fubini，而原生
late-π、终态与产品层继续区分 divergence/deadlock；Open-π 使用
typed/polarised 抽象端口和 fresh nominal operational realization；
十五个 native event family 为规范核心，六十 operation 经
`refinesTo` registry 接入；每个规范事件使用 genuine strong late-π
一步；DAG 采用 SCC condensation 加严格 rankable subview；Petri
采用 individual-token provenance。

这项人类决定授权实现，但不接受历史附录中的“Accepted subject to
gates”措辞。条件式接受不是本项目的 ADR 状态。本 ADR 在不可变 kernel
证据、独立 QA-L4 审阅与最终人类签署前保持 **Proposed**。即使全部
技术义务达到 `proved`，外部签署前聚合状态也最多是
`proved / review-pending`。

**2026-08-16 Owner Accept：** 本 ADR 现为 **Accepted**（Owner COI；不设第二评审人）。Lean 义务行保持 `proved`；治理为 Owner-accepted。promotion form 未走。RFC-0002 仍为 FCP open。

## 2026-07-27 Kernel-backed 最大相容校正

1. **Separated 与 D1-A 不得混同。** FMS 来源区分 least element `⊥`
   与 semilattice zero `0`。仓库 separated branch 的 all-source
   solution-set/enriched adjunction 与 D1-A branch 的对称 chosen
   Fubini、lower-ω-Scott monad、递归 `A ≅ P(H A)` 属于不同模型。
   Separated branch 的 canonical sequential Fubini 非交换；D1-A
   合并两个 effect 常量，不能被称为 separated Abramsky powerdomain。
2. **Full-abstraction 范围必须写进类型。** Kernel no-go 排除：
   暴露两个不等价 nullary divergence/deadlock 却把二者指称为同一
   bottom；以及 D1-A 对 finite tau/choice constructor-sensitive
   strong bisimulation 的 full abstraction。finite/guarded 正面结果
   是 lower-ω-Scott finite-trace Hoare/contextual-Hoare 定理。
   unrestricted actual-Agent strong-bisimulation full abstraction 不成立。
3. **Actual-Agent 正面边界。** 实际 recursive `Agent` 上的
   equality/native-path full abstraction 只覆盖 deterministic typed
   tau/free-output prefix trie 及其显式 `CompactPrefixPoint`
   realization。总 supported finite-control coalgebra与十五 family
   commutation 是独立正定理，不扩大上述 full-abstraction 范围。
4. **All-domain definability no-go。** Cantor 对角论证排除由一个 π
   语法定义每个 ωCPO 的全部元素。`contextualSourceInterpretation`
   只是源到语义的解释，不是 reverse semantic-image definability。
5. **Open-π 两层结构。** Presented algebraic wiring SMC 负责
   identity/tensor/composition/plug/hide/restriction 与协调；fresh
   nominal raw process 负责 genuine native step。固定 finite raw relay
   不是结构单位，也不能无限复用；不宣称 raw-process SMC functor 保持
   algebraic identity。
6. **产品边界。** 八个 production package 仍须分别提供规则、
   admission、rank、pre-net、resource/session、authorization、
   fairness、stable-window、positive-epsilon、kernel/trajectory 和
   四投影证书。

## 2026-07-27 最终技术闭包候选

候选架构已有 total supported finite-control coalgebra、到 actual
recursive `Agent` 的唯一 terminal mediator，以及十五个 normative
family 的 typed compiler、genuine strong late-π first step、joint
DerivativeAlpha 和 exact actual-Agent source/target/terminal 方程。

`ProductPiFMSAlignment` 目前连接 product π occurrence、normative
family、raw realization 与 actual-Agent commutation，但 CENTRAL-18
完成还要求同一证书：

- 选择 `OperationId` 并证明 registry `refinesTo`/`familyAt` 等于该
  normative family；
- 保持 payload 与 `StableMetadata` 的 version、rule、session、
  correlation、occurrence；
- 将 heterogeneous admission endpoint 连接到同一 candidate；
- 携带 selected mark 等于该 candidate event 的
  `TrajectoryAgreement`；
- 在 `.instanceReconnect` 参考中把 admission、四 native/replay
  view、trajectory、SCC/terminal/feedback 和 actual-Agent endpoint
  放进同一记录。

在该 common-chain kernel-built 并绑定不可变证据前，本节只记录
candidate，不能把 CENTRAL-18 标为 `proved`。构建本身也不能完成独立
评审、通过 FCP 或接受本 ADR。

## 2026-07-27 承重接缝实现校正

本节只校正实现事实，不改变架构决策及其状态。ADR-0001 仍为
**Proposed**。

通用 conformance record 现强制携带 proof-bearing P1a semantic
certificate。DAG view 是从同一选定并 replay 的 `DPOEvent` 两端计算出的
dependency graph，再取 canonical SCC condensation；edge coverage、
condensation acyclicity 与严格 edge rank 均为派生定理。Petri view 使用由该
事件 signature version/rule id 确定的有序单事件 declaration、canonical
individual provenance-token marking 及精确 endpoint delta；enabling、firing
与 retained-token identity 亦为派生定理。因此产品不能再用任意 identity view
仅以 “DAG/Petri” 名称通过 P1a。

Dynamic partner admission 现为显式强两阶段协议：visible input 到达
`admissionEstablished` 的 reconnect-ready process；随后
`admissionReconnect` 以 genuine τ transition 到达 terminal reconnect
process。第一个 actual-Agent target 与后续 `.instanceReconnect` 行的 source
字面相等。该路线在不引入 weak step、也不改变十五个 normative event family
的前提下解决了旧 terminal-admission seam no-go。

可变源码层原有 CENTRAL-18 candidate 缺口现由
`CompleteProductCommonTrajectoryCertificate` 闭合。同一记录把同一个 core
candidate、registry operation/`refinesTo` family、canonical event metadata、
native/replay/raw derivation、joint derivative alpha 和 actual-Agent endpoint
绑定到同一个 selected positive trajectory row。`reference_technical_closure`
对实质 reconnect 执行居留该通用组合；admission/reconnect alignment 同时给出
跨签名的 literal endpoint seam。该结论不实例化八个生产包。

具名 Open-π realization 边界亦已收紧：singleton wire 要求 source、target、
binder 三个名字 pairwise fresh，canonical tensor freshening 使两块具名
boundary 全局不交。该前提保留两层架构决策，并不宣称 raw-process structural
wire identity。

最终构造现已绑定 source commit
`59a1a6885ef6a2774b2731f487f83228e67d15dc` 与不可变 QA 构建/审计记录；
source integrity、placeholder/axiom audit、proved manifest 与 strict
proved/tree gate 均记录于其中。技术状态为 `proved / Owner-accepted`，不是
Lean `reviewed`；RFC-0002 仍为 FCP open，不是 Accepted。

## 参考文献

Petri 决策现已在真实签名边界上实现。旧声明构成字面前缀，其 incidence
沿精确 admission extension 重索引，选定目标版本声明随后 append；同一个
dependent certificate 同时携带目标 admission 的原生/replay 证据与相连
candidate 的 enabled firing。通用接口仍允许合法的空初始注册表；实质
参考则另外证明非空 legacy endpoint delta 及其精确保留。这样既保持一般性，
又防止最终反空洞定理由空旧网真空满足。

## 参考文献

- RFC-0001（`docs/rfc/0001-cantilune-architecture.md`）
- RFC-0002（`docs/rfc/0002-projection-consistency.md`）
- 形式语义（`docs/spec/formal-semantics.md`）
- P1b 独立审计（`docs/research/0001-p1b-pi-bridge-audit.md`）
- 最终承重接缝（`docs/research/0027-final-load-bearing-seams-2026-07-27.md`）
- 分诊记录（2026-07-23，本对话——将写入 Issue 作为权威来源）
