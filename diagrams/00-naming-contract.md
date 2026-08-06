# Cantilune 工程设计命名契约（初稿）

| 字段 | 值 |
|---|---|
| 状态 | **草案** |
| 类型 | 工程设计 / 命名规范 |
| 受众 | 运行时、SDK、控制面、可观测性工程师 |
| 更新日期 | 2026-08-06 |
| 关联图表 | `01-coordination-event-and-actor.puml`（PlantUML 类图） |
| 形式化对照 | 附录 A（Lean / 数学符号，供实现层映射） |

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
   依赖图、资源账本、通信会话、组合结构是同一变更的不同观察面，工程命名上统一从 `CoordinationChange` 派生。

---

## 2. 图 01：四个问题的统一答案

> **图 01 结构：一状态 + 一变更 + 一边界**
> 数学主线只有三条轴：`Config σ`、`DPOEvent σ`、`externalObservations`。
> admission / ProposedChange / Command 是**实现机制**（旁注），不是第四种数学对象。

### 2.1 数学 ↔ 工程对照（图 01 核心）

| 数学 | 工程 | 回答的问题 |
|---|---|---|
| `Config σ` | `CollaborationSnapshot` | 现在世界里有什么 |
| `DPOEvent σ` | `CoordinationEvent` | 发生了什么合法变更 |
| `externalObservations` | `auditTail` / `ObservationEntry` | 外部世界送来了什么 |
| `ruleId` + 前置条件 | `OperationTemplate` + admission | 这次变更为何合法 |

### 2.2 四个问题

**Q1 最初任务如何从外部进入？**

1. 外部输入 → `ObservationEntry` 追加到 `CollaborationSnapshot.auditTail`（**此时图结构未变**）
2. Runtime admission 匹配 `introduce_artifact` → 产生 `CoordinationEvent`
3. `after` 快照新增 `WorkArtifact`（`dataToken`）；正文在 `contentRef`，**不在 Event**

`Command` = SDK 便利层；数学落点仍是 observation 或直接 rule match。

**Q2 Actor 怎么表示？**

| 位置 | 工程名 | 数学落点 |
|---|---|---|
| 世界里常驻 | `ActorRegistration` ≈ `Participant` | `Config.nodes` + `nodeLabel` |
| 事件里引用 | `ActorRef` | DPOEvent 归因：`initiator` / `involved` |

Actor **不发射** Event。`initiator` = 主责归因，不是触发器。

**Q3 Actor 如何进行后续一系列协调事件？**

`Config_n` +（可选新 `ObservationEntry`）→ admission → `DPOEvent` → `Config_{n+1}`。  
典型链：`introduce_artifact` → `delegate` → `accept` → `invoke_tool` → …

**Q4 协调事件怎么表示？**

`CoordinationEvent` = 已验证的 `DPOEvent σ`。见 §2.3 字段对照。刻意**无** payload 字段。

### 2.3 CoordinationEvent ↔ DPOEvent 字段对照

| 工程字段 | 数学含义 |
|---|---|
| `changeId` | 变更日志唯一身份 |
| `epochId` | `signatureVersion` |
| `operation` | `ruleId` (ρ) |
| `targets` | `matchEmbedding` (m) |
| `beforeRef` / `afterRef` | `source` / `target` (X, X') |
| `initiator` / `involved` | 工程归因（主责 / 参与） |
| `authorization` | `policyEvidence` (α) |
| `external` | `externalEvidence` (ω)，常指向 `ObservationEntry` |
| `visibility` | `EventKind` (k) |

### 2.4 标准故事线（T0 → Event #1 → Event #2）

- **T0** `Config₀`：有 Human, Planner, Coder；尚无 task  
- **①** Human「实现登录」→ `ObservationEntry` → `auditTail`（还不是 Event）  
- **Event #1** `introduce_artifact` → `Config₁` 新增 `WorkArtifact(task-T)`  
- **Event #2** `delegate` → `Config₂`：owner→Coder, session, write-lock  
- **后续** `accept` → `invoke_tool` → … 每条 `Config_n → Config_{n+1}`

### 2.5 旁注（非图 01 核心块）

| 名称 | 性质 |
|---|---|
| `AdmissionGateway` / Runtime | 实现 rule firing + policy 验证 |
| `ProposedChange` | 运行时瞬态，commit 前 |
| `Command` | Notation/SDK 便利层 |

---

## 3. 核心工程词汇

### 3.1 编排运行时（现在世界里有什么）

| 工程名 | 中文 | 职责 | 典型问题 |
|---|---|---|---|
| `CollaborationSnapshot` | 协作快照 | 某一时刻的完整协作世界 | 现在谁连着谁？谁拿着什么？ |
| `Participant` | 参与者 | Agent / Tool / Human / Environment 的运行实例 | Planner 还在等吗？ |
| `CollaborationLink` | 协作关系 | 依赖、委派、评审、供数等有向关系 | Reviewer 在等 Coder 吗？ |
| `WorkArtifact` | 工作产物 | 任务、计划、代码、评审意见等可传递对象 | 这份 Plan 归谁？ |
| `ScopedCapability` | 作用域能力 | 写锁、预算、审批槽、工具租约等线性资源 | 谁占着唯一写权限？ |
| `CommunicationSession` | 通信会话 | 私有或共享通道、任务会话 | 这条会话谁控制？ |
| `PolicyContext` | 策略上下文 | 授权模式、投票进度、重试/反馈状态 | 还需要几人批准？ |
| `ObservationEntry` | 外部观察 | 人类批准、工具回执、环境输入（有序） | 批准何时到达？ |
| `EntityTombstone` | 实体墓碑 | 已删除参与方/会话/能力的审计痕迹 | 删了什么，还能追溯吗？ |

### 3.2 编排变更（发生了什么）

| 工程名 | 中文 | 职责 | 典型问题 |
|---|---|---|---|
| `OperationTemplate` | 操作模板 | 一类合法变更的声明（输入/输出/前置/后置） | delegate 允许什么？ |
| `CoordinationChange` | 协调变更 | 一次已识别的编排步骤 | 谁委派了什么给谁？ |
| `ChangeTargets` | 变更目标 | 本次操作匹配到的任务、参与方、能力等 | 动的是 Task T 还是 T'？ |
| `AuthorizationEvidence` | 授权证据 | 证明本次变更被策略允许 | Planner 有权委派吗？ |
| `ExternalEvidence` | 外部证据 | 人工批准、评审记录、工具回执 | 批准单据是什么？ |
| `ChangeVisibility` | 变更可见性 | internal / external / administrative | 这步进 observable trace 吗？ |

### 3.3 编排语言（静态合同）

| 工程名 | 中文 | 职责 |
|---|---|---|
| `OrchestrationSchema` | 编排模式 | 当前 epoch 允许的对象类型、操作类型、资源规则 |
| `ObjectTypeDeclaration` | 对象类型声明 | Task、Artifact、WritePermission 等 |
| `OperationTypeDeclaration` | 操作类型声明 | delegate、accept、reject、createSession 等 |
| `PortContract` | 端口合同 | requires / ensures |
| `ResourceRule` | 资源规则 | 能否复制、能否丢弃（linear / copyable 等） |
| `SchemaRevision` | 模式修订 | 签名单调扩展，不破坏旧声明 |

### 3.4 编排服务（系统能力）

| 工程名 | 中文 | 职责 |
|---|---|---|
| `ChangeLog` | 变更日志 | 追加写入、按序保存 `CoordinationChange` |
| `ReplayVerifier` | 重放校验器 | 从变更记录 + 前快照独立算出后快照 |
| `PolicyEvaluator` | 策略评估器 | 判定授权证据是否满足 `PolicyContext` |
| `CollaborationStore` | 协作状态库 | 读写当前 `CollaborationSnapshot` |
| `ObservationIndex` | 观察索引 | 从变更派生依赖/资源/通信/结构四视图（读模型） |

---

## 3. 禁止混用的名字

| 应该说 | 不要说（除非实现层内部） | 原因 |
|---|---|---|
| `CollaborationSnapshot` | `Config`, `State`, `Graph` | 太泛，丢失「协作世界」语义 |
| `CoordinationChange` | `Event`, `Transition`, `DPOEvent` | 对外是编排变更；DPO 是实现细节 |
| `OperationTemplate` | `rule`, `ruleId`（单独使用时） | 模板 ≠ 一次发生 |
| `ScopedCapability` | `Resource`, `Token`, `Permission`（混用） | 必须强调归属与不可复制性 |
| `WorkArtifact` | `Data`, `Payload` | 必须强调工作对象与归属 |
| `epochId` | `signature`, `version`（单独使用时） | epoch 是运行版本，不是编排模式本身 |
| `OrchestrationSchema` | `Sigma`, `Signature`（对外 API） | 形式化名仅限实现/论文层 |

---

## 4. 模块与包命名（草案）

```
cantilune.orchestration.runtime     # CollaborationSnapshot, Participant, ...
cantilune.orchestration.change      # CoordinationChange, OperationTemplate, ...
cantilune.orchestration.schema      # OrchestrationSchema, declarations
cantilune.orchestration.replay      # ReplayVerifier, ChangeLog
cantilune.orchestration.policy      # PolicyContext, PolicyEvaluator
cantilune.orchestration.views       # ObservationIndex（四视图读模型）
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
  external: []  # 若需人工批准，填 ObservationEntry 引用
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

| 工程 ID | 说明 |
|---|---|
| `ParticipantId` | 参与者实例 |
| `ArtifactId` | 工作产物 |
| `CapabilityId` | 作用域能力（写锁、预算、审批槽等） |
| `SessionId` | 通信会话 |
| `ChangeId` | 协调变更（全局唯一、可审计） |
| `OperationTypeId` | 操作类型（delegate、accept…） |
| `EpochId` | 运行 epoch / 模式版本戳 |
| `EvidenceRef` | 授权或外部证据引用 |

---

## 7. 与「用户能看到的五个视图」对齐

（来源：README「What a user should be able to see」）

| 用户视图 | 主要工程对象 | 读模型组件 |
|---|---|---|
| 协作结构 | `Participant`, `CollaborationLink` | `ObservationIndex.structure` |
| 依赖视图 | `CollaborationLink`（DependsOn / waits_for） | `ObservationIndex.dependency` |
| 资源与权限 | `ScopedCapability` | `ObservationIndex.capability` |
| 通信视图 | `CommunicationSession`, delegate 类变更 | `ObservationIndex.communication` |
| 重放与反馈 | `CoordinationChange`, `ObservationEntry` | `ChangeLog`, `ReplayVerifier` |

---

## 附录 A. 工程名 ↔ Lean Core 映射（实现层）

> 实现 formal core 或写适配器时使用；**不**作为对外 API 命名。

| 工程名 | Lean Core |
|---|---|
| `CollaborationSnapshot` | `Config σ` |
| `epochId` | `signatureVersion` |
| `Participant` / 节点集合 | `nodes` + `nodeLabel` |
| `CollaborationLink` | `edges` |
| `WorkArtifact` | `dataTokens` + `dataOwner` |
| `ScopedCapability` | `resourceTokens` + `resourceOwner` |
| `CommunicationSession` | `names` + `sessionOwner` |
| `PolicyContext` | `policyState` |
| `ObservationEntry` | `externalObservations`（列表元素） |
| `EntityTombstone` | `tombstones` |
| `CoordinationChange` | `DPOEvent σ` |
| `OperationTemplate` | `ruleId` 指向的规则声明 |
| `ChangeTargets` | `matchEmbedding` + 相关字段 |
| `AuthorizationEvidence` | `policyEvidence` |
| `ExternalEvidence` | `externalEvidence` |
| `ChangeVisibility` | `EventKind` |
| `OrchestrationSchema` | `FinSignature` |
| `SchemaRevision` | `SignatureExtension` |
| `ReplayVerifier` | `ReplayKernel` |
| 经验证变更 | `DPOEvent.Verified` |

### 字段级映射：`CollaborationSnapshot`

| 工程字段 | Lean `Config` 字段 |
|---|---|
| `epochId` | `signatureVersion` |
| `participants` | `nodes`, `nodeLabel` |
| `links` | `edges` |
| `artifacts` | `dataTokens`, `dataOwner` |
| `capabilities` | `resourceTokens`, `resourceOwner` |
| `sessions` | `names`, `sessionOwner` |
| `policyContext` | `policyState` |
| `auditTail` | `externalObservations` |
| `retiredEntities` | `tombstones` |

### 字段级映射：`CoordinationChange`

| 工程字段 | Lean `DPOEvent` 字段 |
|---|---|
| `epochId` | `signatureVersion` |
| `operationTypeId` | `ruleId` |
| `before` | `source` |
| `after` | `target` |
| `targets` | `matchEmbedding` 等 |
| `preservedContext` | `complementTag` |
| `createdSessions` | `freshNames` |
| `authorization` | `policyEvidence` |
| `external` | `externalEvidence` |
| `visibility` | `kind` |

---

## 附录 B. 复审清单

- [ ] 每个对外 API 类型能在 §2 找到工程名
- [ ] 每个工程名能在附录 A 找到 Lean 落点
- [ ] delegate 案例能完整走通：Schema → Change → Snapshot 差异 → Replay
- [ ] 四视图命名只出现在 `ObservationIndex`，不出现在核心写入路径
