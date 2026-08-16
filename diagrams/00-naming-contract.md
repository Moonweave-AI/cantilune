# Cantilune 工程设计命名契约（初稿）

| 字段       | 值                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态       | **草案**                                                                                                                                                                                  |
| 类型       | 工程设计 / 命名规范                                                                                                                                                                       |
| 受众       | 运行时、SDK、控制面、可观测性工程师                                                                                                                                                       |
| 更新日期   | 2026-08-15                                                                                                                                                                                |
| 关联图表   | `diagrams/01-core/`（01A–01D）；`diagrams/02-runtime/`（02A–02H）；`diagrams/03-observability/`（03A–03H）；`diagrams/04-control-plane/`（04A–04H）；`diagrams/05-evaluation/`（05A–05H）；`diagrams/05-comms/`（05A–05H）；`diagrams/06-conformance/`（06A–06H）；`diagrams/07-production/`（07A–07H） |
| 代码锚点   | `src/packages/core/` · `src/packages/runtime/` · `src/packages/observability/` · `src/packages/control-plane/` · `src/packages/comms/` · `src/packages/tools/` · `src/packages/evaluation/` |
| 形式化对照 | 附录 A（Lean / 数学符号，供实现层映射）                                                                                                                                                   |

> **定位：** 本文档定义**编排工程语言**——开发者、运维和系统设计者在讨论 Cantilune 时应使用的名字。
> 数学符号与 Lean 结构是实现层的**落点**，不是对外 API 的第一词汇。

---

## 1. 设计原则

1. **先说协作问题，再说形式对象**  
   优先回答：谁在做、谁持有权限、任务如何委派、会话如何转移、这次变更为何合法、能否重放。

2. **一个变更，一条记录**  
   编排中的每一步是带身份、带证据、带前后快照的 `CoordinationChange`，不是匿名状态突变。

3. **权限与产物分离**  
   `WorkArtifact`（可传递的工作对象）与 `ScopedCapability`（不可随意复制的稀缺能力）不得混在同一抽象里。

4. **规则模板 ≠ 变更实例**  
   `OperationTemplate`（如 delegate）可被多次实例化；每次实例化产生不同的 `CoordinationChange`。

5. **四视图是读模型，不是四个子系统**  
   依赖图、资源账本、通信会话、组合结构是**同一 EventSpine 上 SourceEvent 的四 lens 读面**；经 `deriveEventSlice` → `foldFourViews` 生成，禁止四模块独立 parse `CoordinationChange`。

---

## 2. 图 01：四个问题的统一答案

> **图 01 结构：一状态 + 一变更 + 一边界**
> 数学主线只有三条轴：`Config σ`、`DPOEvent σ`、`externalObservations`。
> admission / ProposedChange / Command 是**实现机制**（旁注），不是第四种数学对象。

### 2.1 数学 ↔ 工程对照（图 01 核心）

| 数学                   | 工程                              | 回答的问题                                |
| ---------------------- | --------------------------------- | ----------------------------------------- |
| `Config σ`             | `CollaborationSnapshot`           | 现在世界里有什么                          |
| `DPOEvent σ`           | `CoordinationChange`              | 发生了什么合法变更                        |
| `externalObservations` | `auditTail` / `ObservationEntry`  | 外部世界送来了什么                        |
| Agent 结构动词         | `CompositionIntent` + `Footprint` | Agent 如何在运行时改拓扑                  |
| 运行历史               | `RunHistory`                      | 与 auditTail / ChangeLog 对齐的可切片轨迹 |
| `ruleId` + 前置条件    | `OperationTemplate` + admission   | 这次变更为何合法（**runtime**）           |

### 2.2 四个问题

**Q1 最初任务如何从外部进入？**

1. 外部输入 → `ObservationEntry` 追加到 `CollaborationSnapshot.auditTail`（**此时图结构未变**）
2. Runtime admission 匹配 `introduce_artifact` → 产生 `CoordinationChange`
3. `after` 快照新增 `WorkArtifact`（`dataToken`）；正文在 `contentRef`，**不在 Event**

`Command` = SDK 便利层；数学落点仍是 observation 或直接 rule match。

**Q2 Actor 怎么表示？**

| 位置       | 工程名                              | 数学落点                                |
| ---------- | ----------------------------------- | --------------------------------------- |
| 世界里常驻 | `ActorRegistration` ≈ `Participant` | `Config.nodes` + `nodeLabel`            |
| 事件里引用 | `ActorRef`                          | DPOEvent 归因：`initiator` / `involved` |

Actor **不发射** Event。`initiator` = 主责归因，不是触发器。

**Q3 Actor 如何进行后续一系列协调事件？**

`Config_n` +（可选新 `ObservationEntry`）→ admission → `DPOEvent` → `Config_{n+1}`。  
典型链：`introduce_artifact` → `delegate` → `accept` → `invoke_tool` → …

**Q4 协调事件怎么表示？**

`CoordinationChange` = 已验证的 `DPOEvent σ`。见 §2.3 字段对照。刻意**无** payload 字段。

### 2.3 CoordinationChange ↔ DPOEvent 字段对照

| 工程字段                 | 数学含义                                          |
| ------------------------ | ------------------------------------------------- |
| `changeId`               | 变更日志唯一身份                                  |
| `recordedAt`             | 入账时间戳                                        |
| `epochId`                | `signatureVersion`                                |
| `operationTypeId`        | `ruleId` (ρ)                                      |
| `targets`                | `matchEmbedding` (m)                              |
| `beforeRef` / `afterRef` | `source` / `target` (X, X')                       |
| `initiator` / `involved` | 工程归因（主责 / 参与）                           |
| `authorization`          | `policyEvidence` (α)                              |
| `external`               | `externalEvidence` (ω)，常指向 `ObservationEntry` |
| `createdSessionRefs`     | `freshNames`                                      |
| `visibility`             | `EventKind` (k)                                   |

### 2.4 标准故事线（T0 → Event #1 → Event #2）

- **T0** `Config₀`：有 Human, Planner, Coder；尚无 task
- **①** Human「实现登录」→ `ObservationEntry` → `auditTail`（还不是 Event）
- **Event #1** `introduce_artifact` → `Config₁` 新增 `WorkArtifact(task-T)`
- **Event #2** `delegate` → `Config₂`：owner→Coder, session, write-lock
- **后续** `accept` → `invoke_tool` → … 每条 `Config_n → Config_{n+1}`

### 2.5 旁注（非图 01 核心块）

| 名称                                    | 性质                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| `CoordinationIntent` / `ProposedChange` | core 瞬态类型；commit 前                                 |
| `AdmissionGateway` / Runtime            | 实现 rule firing + policy 验证（**@cantilune/runtime**） |
| `Command`                               | Notation/SDK 便利层                                      |

---

## 3. 核心工程词汇

### 3.1 编排运行时（现在世界里有什么）

| 工程名                  | 中文       | 职责                                          | 典型问题                   |
| ----------------------- | ---------- | --------------------------------------------- | -------------------------- |
| `CollaborationSnapshot` | 协作快照   | 某一时刻的完整协作世界                        | 现在谁连着谁？谁拿着什么？ |
| `Participant`           | 参与者     | Agent / Tool / Human / Environment 的运行实例 | Planner 还在等吗？         |
| `CollaborationLink`     | 协作关系   | 依赖、委派、评审、供数等有向关系              | Reviewer 在等 Coder 吗？   |
| `WorkArtifact`          | 工作产物   | 任务、计划、代码、评审意见等可传递对象        | 这份 Plan 归谁？           |
| `ScopedCapability`      | 作用域能力 | 写锁、预算、审批槽、工具租约等线性资源        | 谁占着唯一写权限？         |
| `CommunicationSession`  | 通信会话   | 私有或共享通道、任务会话                      | 这条会话谁控制？           |
| `PolicyContext`         | 策略上下文 | 授权模式、投票进度、重试/反馈状态             | 还需要几人批准？           |
| `ObservationEntry`      | 外部观察   | 人类批准、工具回执、环境输入（有序）          | 批准何时到达？             |
| `EntityTombstone`       | 实体墓碑   | 已删除参与方/会话/能力的审计痕迹              | 删了什么，还能追溯吗？     |

### 3.2 编排变更（发生了什么）

| 工程名                  | 中文         | 职责                                              | 典型问题                     |
| ----------------------- | ------------ | ------------------------------------------------- | ---------------------------- |
| `CoordinationIntent`    | 协调意图     | Actor 或 Runtime 提交的准入前意图                 | 谁想做什么操作？             |
| `ProposedChange`        | 待提交变更   | 已准入、待原子 commit 的瞬态                      | 当前 beforeRef 是什么？      |
| `OperationTemplate`     | 操作模板     | 一类合法变更的声明（输入/输出/前置/后置）         | delegate 允许什么？          |
| `CoordinationChange`    | 协调变更     | 一次已识别的编排步骤                              | 谁委派了什么给谁？           |
| `ChangeTargets`         | 变更目标     | 本次操作匹配到的任务、参与方、能力等              | 动的是 Task T 还是 T'？      |
| `MatchBinding`          | 命名匹配绑定 | 带 role 的重放 recipe（task/from/to/capability…） | delegate 的 from/to 是谁？   |
| `AuthorizationEvidence` | 授权证据     | 证明本次变更被策略允许                            | Planner 有权委派吗？         |
| `ExternalEvidence`      | 外部证据     | 人工批准、评审记录、工具回执                      | 批准单据是什么？             |
| `ChangeVisibility`      | 变更可见性   | internal / external / administrative              | 这步进 observable trace 吗？ |

### 3.2b 组合结构（Agent 写模型 · @cantilune/core structure）

| 工程名                    | 中文                | 职责                                    | 典型问题                       |
| ------------------------- | ------------------- | --------------------------------------- | ------------------------------ |
| `CompositionIntent`       | 组合意图            | Agent 结构动词（attach/delegate/fork…） | 这次要改什么拓扑？             |
| `Footprint`               | 实体触达集          | Agent 声明的隔离域（须覆盖 targets）    | 请求锁多大范围？               |
| `effectiveFootprint`      | 权威触达集          | 从 targets 派生；并发判定唯一依据       | 实际会碰哪些实体？             |
| `RunHistory`              | 运行历史            | observation + rewrite 段的可切片轨迹    | 某 artifact 范围内发生了什么？ |
| `deriveDiagnosticSummary` | 只读结构投影        | serial/parallel/nest；**不可**用于调度  | 当前粗粒度结构？               |
| `DerivedCompositionView`  | （deprecated 别名） | 同 `deriveDiagnosticSummary`            | —                              |

### 3.2c 一致性校验（@cantilune/core consistency）

| 工程名                            | 中文       | 职责                                       |
| --------------------------------- | ---------- | ------------------------------------------ |
| `validateSnapshotIntegrity`       | 快照完整性 | 注册表、Map key、link 端点、墓碑冲突       |
| `validateAuditTailMatchesHistory` | 观察对齐   | auditTail 与 RunHistory observation 段一致 |
| `validateCollaborationWorld`      | 世界校验   | integrity + 可选 history 对齐              |
| `CoreViolation`                   | 违规描述   | 带 code/path/expected/actual 的可机读错误  |

### 3.3 编排语言（静态合同）

| 工程名                     | 中文         | 职责                                          |
| -------------------------- | ------------ | --------------------------------------------- |
| `OrchestrationSchema`      | 编排模式     | 当前 epoch 允许的对象类型、操作类型、资源规则 |
| `ObjectTypeDeclaration`    | 对象类型声明 | Task、Artifact、WritePermission 等            |
| `OperationTypeDeclaration` | 操作类型声明 | delegate、accept、reject、createSession 等    |
| `PortContract`             | 端口合同     | requires / ensures                            |
| `ResourceRule`             | 资源规则     | 能否复制、能否丢弃（linear / copyable 等）    |
| `SchemaRevision`           | 模式修订     | 签名单调扩展，不破坏旧声明                    |

### 3.4 编排服务（系统能力）

| 工程名               | 中文       | 职责                                                                         |
| -------------------- | ---------- | ---------------------------------------------------------------------------- |
| `ChangeLog`          | 变更日志   | 追加写入、按序保存 `CoordinationChange`                                      |
| `ReplayVerifier`     | 重放校验器 | 从变更记录 + 前快照独立算出后快照                                            |
| `PolicyEvaluator`    | 策略评估器 | 判定授权证据是否满足 `PolicyContext`                                         |
| `CollaborationStore` | 协作状态库 | 读写当前 `CollaborationSnapshot`                                             |
| `ObservationIndex`   | 观察索引   | 从 `ObservationWorld` + `EventSpine` fold 出四视图读模型（`FourViewBundle`） |

### 3.5 可观测性（EventSpine 中轴）

| 工程名                 | 中文         | 职责                                                                  |
| ---------------------- | ------------ | --------------------------------------------------------------------- |
| `ObservationWorld`     | 只读协调世界 | 终端 `CollaborationSnapshot` + 校验 `RunHistory` + `changeIndex`      |
| `EventSpine`           | 事件脊柱     | 有序 `SourceEvent[]`，与 `ChangeLog` 同序                             |
| `SourceEvent`          | 源事件       | `eventTag` + `CoordinationChange`（组合 core，不重复 change 字段）    |
| `AtEvent<T>`           | 读角索引包装 | `eventTag` + core 类型 `T`；非新实体                                  |
| `ProjectionSlice`      | 投影切片     | 单步四 Delta；Delta 字段均为 core 类型或 ID diff                      |
| `ProjectionEngine`     | 投影引擎     | `deriveEventSlice` + `foldFourViews` 唯一调度                         |
| `FourViewBundle`       | 四角度产物   | spine + dependency/resource/communication/structure + 可选 diagnostic |
| `CrossViewInvariants`  | 跨读角不变量 | E1–E7：event 覆盖、core 字段一致、禁止平行 obs 实体类型、无 footprint |
| `ObservabilityService` | 可观测门面   | `observeCommitted(sinceRef)` → `FourViewBundle`                       |

---

### 3.6 生产隔离与发布面（图 07）

> **图 07 结构：** `diagrams/07-production/` 八视图（07A–07H）。英文 ADR-0021–0029 为权威。
> 画的是 Namespace / Transcript / durable / sandbox / 平台导出 / A2A 1.0 / MCP epoch / fleet 脱敏，不是评测包（评测仍是图 05）。

| 工程名                      | 中文           | 职责                                         | 典型问题                         |
| --------------------------- | -------------- | -------------------------------------------- | -------------------------------- |
| `CollaborationNamespace`    | 协作命名空间   | 租户隔离域；Participant 组合 `namespaceId`   | 这两个 Agent 是否同域？          |
| `ParticipantTranscript`     | 参与者对话记录 | 已提交循环历史；在场 ≠ 授权                  | 同 NS 能否读全文？               |
| `TranscriptAccessRequest`   | 记录访问申请   | 跨 NS 申请；**仅被看方 Actor** 可裁决        | 谁批准了跨域阅读？               |
| `transcript_read`           | 记录阅读能力   | 既有 `ScopedCapability` kind，不平行授权类型 | 授权作用域是哪个 Actor？         |
| `visibleTranscript`         | 可见记录       | full / summary / absent                      | 跨 NS 默认看到什么？             |
| `DurableCoordinator`        | 耐久协调器     | file / Postgres HA / 官方 etcd Raft          | 跨副本是否共享同一 head？        |
| `RaftKv`                    | Raft KV 端口   | 线性一致 get/txn/lease；生产 etcd            | 多宿主有没有共享 head？          |
| `RaftDurableCoordinator`    | Raft 耐久实现  | ADR-0029；官方 etcd v3.5.21                  | fencing lease 谁持有？           |
| `OsSandbox`                 | OS 沙箱        | win32 Hyper-V / linux gVisor；探测失败关闭   | 缺运行时会不会落到宿主进程？     |
| `ObservabilityTraceExporter`| OTLP 导出      | 官方 OTel；Cantilune 导出已生产；`gen_ai.*` 官方仍为 Development | SIEM 是否只经 OTLP？             |
| `AgUiEvent`                 | AG-UI 事件     | 从已提交世界 + 可见 transcript 派生          | 用户面看到的是哪一轮？           |
| `A2AOperationName`          | A2A 1.0 操作   | Send/Stream/Get/List/Cancel + Card + push    | 公开主张钉死哪个版本？           |
| `applyMcpAttach`            | MCP epoch 热挂 | 须 SchemaAdmissionReceipt；当前回合不换面    | 新工具何时生效？                 |

---

## 3. 禁止混用的名字

| 应该说                  | 不要说（除非实现层内部）                  | 原因                               |
| ----------------------- | ----------------------------------------- | ---------------------------------- |
| `CollaborationSnapshot` | `Config`, `State`, `Graph`                | 太泛，丢失「协作世界」语义         |
| `CoordinationChange`    | `Event`, `Transition`, `DPOEvent`         | 对外是编排变更；DPO 是实现细节     |
| `OperationTemplate`     | `rule`, `ruleId`（单独使用时）            | 模板 ≠ 一次发生                    |
| `ScopedCapability`      | `Resource`, `Token`, `Permission`（混用） | 必须强调归属与不可复制性           |
| `WorkArtifact`          | `Data`, `Payload`                         | 必须强调工作对象与归属             |
| `epochId`               | `signature`, `version`（单独使用时）      | epoch 是运行版本，不是编排模式本身 |
| `OrchestrationSchema`   | `Sigma`, `Signature`（对外 API）          | 形式化名仅限实现/论文层            |
| `CollaborationNamespace` | `Tenant`（单独当身份层）                 | 租户是 Namespace + RBAC，不另起身份 |
| `visibleTranscript`     | 把 Snapshot.transcripts 当明文广播        | 在场 ≠ 授权；跨 NS 默认摘要        |
| A2A **1.0.0**           | 把 `a2a/0.1` harness 写成公开互操作主张   | 0.1 是 CI 回归；公开钉死 1.0.0     |

---

## 4. 模块与包命名（草案）

```
@cantilune/core
  src/nodes/           # Participant, WorkArtifact, ScopedCapability, …
  src/coordination/    # CollaborationSnapshot, CoordinationChange, validation
  src/structure/       # CompositionIntent, Footprint, RunHistory, derive
  src/consistency/     # validateSnapshotIntegrity, validateCollaborationWorld
  src/primitives/      # branded IDs, refs, MatchBinding, CoreViolation

@cantilune/runtime    # 六层运行时抽象（L1 World … L6 Verification）；codec/admission/replay/execution（ADR-0002）

@cantilune/observability  # EventSpine 中轴 · 沿用 core 类型（diagrams/03-observability/）
  src/world/           # ObservationWorld · EventSpine · SourceEvent
  src/spine/           # deriveEventSlice · fold · ProjectionEngine
  src/projection/      # 四 lens + View（字段 import @cantilune/core）
  src/input/           # O1 装配 · runtime 读端口
  src/index/           # FourViewBundle · ObservationIndex
  src/invariants/      # CrossViewInvariants E1–E7
  src/diagnostic/      # deriveSnapshotStats 压缩（非四投影数据源）
  src/foundation/      # EventTag · AtEvent<T> · ReadOnlyViolation
  src/engine/          # ObservabilityService
  # 禁止：entityRegistry · DependencyNode · ResourceToken 等平行实体模块

@cantilune/control-plane  # 六层治理 G1–G6（diagrams/04-control-plane/）
  src/schema/            # SchemaRevision · monotoneExtensionValidator
  src/admission/         # SchemaAdmissionRequest/Record/State · PreparedSchemaAdmission
  src/activation/        # createNextBinding · EpochTransitionPlan
  src/engine/            # ControlPlaneService · controlPlaneWorker
  src/policy/            # PolicyRevision · activatePolicyRevision
  src/manifest/          # HandlerManifest 校验
  src/rollout/           # ReconciliationService · RuntimeBinding
  src/ports/             # ControlPlaneStore
  src/events/            # ControlPlaneOutbox
  src/memory/ · src/file/  # 持久化

@cantilune/comms          # π 通信分面 + A2A transport（diagrams/05-comms/）
  src/foundation/        # comms IDs · StableCommunicationMetadata · state axes
  src/protocol/          # 15-family / 60-code registry · occurrence record
  src/peer/              # PeerDescriptor · AuthenticatedPeerContext
  src/envelope/          # CommunicationEnvelope · PayloadDescriptor (content-ref)
  src/session/           # SessionTransportBinding · handshake
  src/delivery/          # outbox/inbox · ack levels · retry
  src/mobility/          # delegation · fresh endpoint allocation
  src/reconnect/         # AdmissionReconnectPlan · ReconnectCoordinator
  src/close/             # QuiescentClose · forceClose
  src/codec/             # wire v1 strict ingress
  src/engine/            # CommsIngress · *Service composition
  src/memory/            # MemoryCommsStore · LoopbackTransport
  src/ports/             # CommsStore · transport · runtime ports
  # 禁止：平行 Session/Actor 类型；inline payload 入 CoordinationChange

@cantilune/conformance    # 产品证据验证 · 四轴状态 · sealed 决策（diagrams/06-conformance/）
  src/foundation/        # ConformanceProfile · ConformanceStatusAxes · profileEvidenceRequirements
  src/canonical/         # evidenceDigest · replayRecipeChainDigest · canonicalEncoding
  src/evidence/          # engineering · fourProjection · leanBuildAttestation
  src/subject/           # AdmissionSubject · RuleOccurrence · admissionSubjectEquality
  src/manifest/          # ConformanceTargetManifest · ruleInventory · formalProofManifestBinding
  src/verifier/          # *Verifier（按 C0–C9 evidence 族）
  src/engine/            # ConformanceEngine · sealedAdmissionGate · releaseConformanceGate
  src/lifecycle/         # sealedDecision · reviewWorkflow · revocation · supersession
  src/certificate/       # PackageConformanceCertificate · SignedHumanReviewAttestation
  src/ports/             # EvidenceStore · TrustStore · RevocationStore · DpoReplayPort
  src/adapters/memory/   # 测试/原型内存适配
  src/adapters/file/     # CAS · decision log · fileLock（L7 durable）
  src/adapters/runtime/  # createRuntimeDpoReplayPort（optional peer runtime）
  src/testing/           # **仅 harness** · 禁止生产 import
  # 禁止：自审批 helper 从根 export；boolean-only 验证

@cantilune/evaluation     # 经验主张验证 · 配对实验 · 证据发布（diagrams/05-evaluation/）
  src/foundation/        # evaluationIds · evaluationResult · evaluationStatus · opaqueTokens
  src/claims/            # EvaluationClaim · EvaluationProtocol · claimStateMachine · claimRegistry
  src/benchmarks/        # BenchmarkSuite · BenchmarkCase · suiteStateMachine
  src/datasets/          # DatasetManifest · datasetStateMachine
  src/subjects/          # CandidateSubject · BaselineSubject · evaluationSubject
  src/plans/             # EvaluationRunPlan · CaseSelection · BlindingConfig
  src/execution/         # EvaluationRun · RunAttempt · runStateMachine · evaluationEngine
  src/collection/        # CertifiedTraceEvidence · FourProjectionResults
  src/oracles/           # TheoryOracleEvidence · KnownOracleSymbol
  src/scoring/           # MetricDefinition · MetricObservation · JudgeProtocol · HumanReviewRecord
  src/analysis/          # AggregateAnalysis · EstimateResult · IntervalResult
  src/review/            # ClaimDecision · ReviewerAttestation · GuardrailViolation
  src/budget/            # EvaluationBudgetPolicy · BudgetLedger · reserveBudget · reconcileBudget
  src/reports/           # EvaluationReport · ReportMetricRow
  src/ports/             # 40+ 端口（产品证据 / Benchmark / 执行 / 评分 / 治理）
  src/adapters/memory/   # 测试/原型内存适配
  src/adapters/file/     # CAS · RunStore · ClaimLedger（L7 durable）
  src/adapters/cantilune/ # C9 Resolver · ReplayAdapter（消费 conformance sealed output）
  # 禁止：修改 runtime world；签发 conformance 证书；将 benchmark 结果包装成产品优越性
  # 命名空间：evaluation.c1–evaluation.c5（与 conformance C0–C9 严格隔离）

cantilune.orchestration.schema      # OrchestrationSchema, declarations
cantilune.orchestration.replay      # ReplayVerifier, ChangeLog
cantilune.orchestration.policy      # PolicyContext, PolicyEvaluator
cantilune.formal.core               # Lean 映射层（内部）
```

---

## 5. 标准案例：任务委派（delegate）

以下用语是工程讨论和 API 文档的**标准例子**：

```yaml
# 操作模板（声明层）
operation: delegate
requires:
  - task.exists
  - delegator.holds(task.ownership)
  - delegatee.can_accept(task)
produces:
  - task.ownership -> delegatee
  - optional: new private session

# 一次具体变更（运行层）
change:
  id: chg-7f3a
  epoch: 42
  operation: delegate
  targets:
    task: task-T
    from: planner-p
    to: coder-c
    capability: write-lock-w
  created_sessions: [session-s]
  authorization: planner-authorized-delegation
  external: [] # 若需人工批准，填 ObservationEntry 引用
  visibility: external

# 变更前后（协作快照差异，示意）
before:
  task-T.owner: planner-p
  write-lock-w.holder: planner-p
after:
  task-T.owner: coder-c
  write-lock-w.holder: coder-c
  session-s.controller: coder-c
  link: reviewer-r --waits_for--> coder-c
```

**关键区分：**

- `operation: delegate` → `OperationTemplate`
- `change.id: chg-7f3a` → `CoordinationChange`
- 同一 `delegate` 模板委派 `task-T'` 给 `coder-c'` → 另一条 `CoordinationChange`

---

## 6. ID 与类型命名

| 工程 ID           | 说明                               |
| ----------------- | ---------------------------------- |
| `ParticipantId`   | 参与者实例                         |
| `ArtifactId`      | 工作产物                           |
| `CapabilityId`    | 作用域能力（写锁、预算、审批槽等） |
| `SessionId`       | 通信会话                           |
| `ChangeId`        | 协调变更（全局唯一、可审计）       |
| `OperationTypeId` | 操作类型（delegate、accept…）      |
| `EpochId`         | 运行 epoch / 模式版本戳            |
| `EvidenceRef`     | 授权或外部证据引用                 |

---

## 7. 与「用户能看到的五个视图」对齐

（来源：README「What a user should be able to see」）

| 用户视图   | 主要工程对象                                 | 读模型组件                            | EventSpine 路径                               |
| ---------- | -------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| 协作结构   | `Participant`, `CollaborationLink`           | `FourViewBundle.structure`            | structureLens → StructureDelta → fold         |
| 依赖视图   | `CollaborationLink`（DependsOn / waits_for） | `FourViewBundle.dependency`           | dependencyLens → DependencyDelta → fold       |
| 资源与权限 | `ScopedCapability`                           | `FourViewBundle.resource`             | resourceLens → ResourceDelta → fold           |
| 通信视图   | `CommunicationSession`, delegate 类变更      | `FourViewBundle.communication`        | communicationLens → CommunicationDelta → fold |
| 重放与反馈 | `CoordinationChange`, `ObservationEntry`     | runtime `ChangeLog`, `ReplayVerifier` | **不在 observability 写路径**                 |

---

## 附录 A. 工程名 ↔ Lean Core 映射（实现层）

> 实现 formal core 或写适配器时使用；**不**作为对外 API 命名。

| 工程名                   | Lean Core                          |
| ------------------------ | ---------------------------------- |
| `CollaborationSnapshot`  | `Config σ`                         |
| `epochId`                | `signatureVersion`                 |
| `Participant` / 节点集合 | `nodes` + `nodeLabel`              |
| `CollaborationLink`      | `edges`                            |
| `WorkArtifact`           | `dataTokens` + `dataOwner`         |
| `ScopedCapability`       | `resourceTokens` + `resourceOwner` |
| `CommunicationSession`   | `names` + `sessionOwner`           |
| `PolicyContext`          | `policyState`                      |
| `ObservationEntry`       | `externalObservations`（列表元素） |
| `EntityTombstone`        | `tombstones`                       |
| `CoordinationChange`     | `DPOEvent σ`                       |
| `OperationTemplate`      | `ruleId` 指向的规则声明            |
| `ChangeTargets`          | `matchEmbedding` + 相关字段        |
| `AuthorizationEvidence`  | `policyEvidence`                   |
| `ExternalEvidence`       | `externalEvidence`                 |
| `ChangeVisibility`       | `EventKind`                        |
| `OrchestrationSchema`    | `FinSignature`                     |
| `SchemaRevision`         | `SignatureExtension`               |
| `ReplayVerifier`         | `ReplayKernel`                     |
| 经验证变更               | `DPOEvent.Verified`                |

### 字段级映射：`CollaborationSnapshot`

| 工程字段          | Lean `Config` 字段                | core 类型                              |
| ----------------- | --------------------------------- | -------------------------------------- |
| `snapshotRef`     | （工程扩展）                      | `SnapshotRef`                          |
| `epochId`         | `signatureVersion`                | `EpochId`                              |
| `participants`    | `nodes`, `nodeLabel`              | `Map<ActorId, Participant>`            |
| `links`           | `edges`                           | `Map<LinkId, CollaborationLink>`       |
| `artifacts`       | `dataTokens`, `dataOwner`         | `Map<ArtifactId, WorkArtifact>`        |
| `capabilities`    | `resourceTokens`, `resourceOwner` | `Map<CapabilityId, ScopedCapability>`  |
| `sessions`        | `names`, `sessionOwner`           | `Map<SessionId, CommunicationSession>` |
| `policyContext`   | `policyState`                     | `PolicyContext`                        |
| `auditTail`       | `externalObservations`            | `ObservationEntry[]`                   |
| `retiredEntities` | `tombstones`                      | `EntityTombstone[]`                    |
| `namespaces`      | （工程扩展；ADR-0022）            | `Map<NamespaceId, CollaborationNamespace>` |
| `transcripts`     | （工程扩展；ADR-0021）            | `Map<ActorId, ParticipantTranscript>`  |
| `transcriptAccessRequests` | （工程扩展；ADR-0022）     | `Map<RequestId, TranscriptAccessRequest>` |

### 字段级映射：`CoordinationChange`

| 工程字段                 | Lean `DPOEvent` 字段  | core 类型                 |
| ------------------------ | --------------------- | ------------------------- |
| `changeId`               | （工程扩展）          | `ChangeId`                |
| `recordedAt`             | （工程扩展）          | `Timestamp`               |
| `epochId`                | `signatureVersion`    | `EpochId`                 |
| `operationTypeId`        | `ruleId`              | `OperationTypeId`         |
| `beforeRef` / `afterRef` | `source` / `target`   | `SnapshotRef`             |
| `matchBindings`          | `matchEmbedding` 等   | `MatchBinding[]`          |
| `targets`                | （legacy 扁平原列表） | `TargetRef[]`             |
| `initiator` / `involved` | 工程归因              | `ActorRef` / `ActorRef[]` |
| `authorization`          | `policyEvidence`      | `EvidenceRef[]`           |
| `external`               | `externalEvidence`    | `EvidenceRef[]`           |
| `createdSessionRefs`     | `freshNames`          | `SessionId[]`             |
| `visibility`             | `kind`                | `ChangeVisibility`        |
| `preservedContext`       | `complementTag`       | （尚未在 core 暴露）      |

---

## 附录 B. 复审清单

- [ ] 每个对外 API 类型能在 §2 找到工程名
- [ ] 每个工程名能在附录 A 找到 Lean 落点
- [ ] 每个 core 类型能在 `src/packages/core/src/` 找到实现
- [ ] delegate 案例能完整走通：Schema → Change → Snapshot 差异 → Replay
- [ ] 四视图命名只出现在 `FourViewBundle` / `ObservationIndex`，不出现在核心写入路径
- [ ] observability 四 View 均由 `EventSpine` fold 生成，非四 parser 并列
