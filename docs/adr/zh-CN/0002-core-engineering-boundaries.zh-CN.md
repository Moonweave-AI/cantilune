# ADR-0002：核心工程边界——运行时拓扑、重放配方与足迹权威

| 字段           | 值                                                            |
| -------------- | ------------------------------------------------------------- |
| Status         | **Accepted**                                                  |
| Date           | 2026-08-10                                                    |
| Decision Owner | Joker-of-Gotham (DRI)                                         |
| Related        | RFC-0001、`diagrams/00-naming-contract.md`、`@cantilune/core` |

## 背景

一次严格的代码评审（2026-08-10）发现 RFC-0001 的静态 `CantiluneGraph` 框架与已实现的 `@cantilune/core` 模型之间存在漂移：agent 通过 `CompositionIntent` 提议运行时拓扑，而观察视图派生自已提交的事实。其余阻塞项还包括不可重放的 `CoordinationChange` 目标、不安全的并行足迹信任，以及 `@cantilune/core` 的发布风险。

## 决策

我们为 core 与 runtime 采纳以下工程边界：

### 1. 模式与运行时拓扑

| 层                                                           | 角色                                           |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `OrchestrationSchema`                                        | 静态允许空间：对象类型、操作模板、端口契约     |
| `CollaborationSnapshot`                                      | 当前运行中的协作世界                           |
| `CompositionIntent`                                          | agent 更改在线拓扑的提议（写模型）             |
| 派生视图（`deriveDiagnosticSummary`、未来 ObservationIndex） | 来自 Snapshot + History 的只读投影——绝非写路径 |

静态模式**并不**意味着一个预先编写好的死运行时图。agent 在运行时组合；结构派生自已提交的变更。

### 2. 变更作为可审计收据；重放配方是显式的

`CoordinationChange` 保持**无载荷**。重放充分性由以下各项承载：

- `operationTypeId` + 可选的带版本 `templateRef`
- **`matchBindings`**（命名角色：`task`、`from`、`to`、`capability`、……）
- 遗留的扁平 `targets`（由绑定派生；仅为有损回退）
- `beforeRef` / `afterRef`、`epochId`、证据列表、`createdSessionRefs`
- 未来运行时字段：输入 ContentRef 绑定、补集选择器、新实体引用

在 `@cantilune/runtime` 实现 `applyAdmittedChange` 之前，Change 是一个**可审计收据**，而非对独立重放的声称。

### 3. 足迹权威（C-prime）

| 字段                                      | 含义                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| `CompositionIntent.footprint`             | agent 请求的隔离范围（可以更宽；必须覆盖 targets）     |
| `effectiveFootprintOfCompositionIntent()` | 来自 `targets`（+ 已提交变更上的会话）的**权威**触及集 |
| `compatibleConcurrently()`                | 仅使用**effective** 足迹                               |
| 运行时 `AdmittedIntent`（未来）           | 模板计算 effective 足迹的不透明准入后对象              |

### 4. SnapshotRef 同一性

- `snapshotRef` 标识一个**已持久化的快照版本**（graph + auditTail + policyContext）。
- 内存内辅助方法（`appendObservation`、`with*`）产生新对象但**不**分配新引用。
- 调用者必须在提交边界处调用 `withSnapshotRef`。
- `auditTail` 是持久化同一性的一部分，用于存储/重放对齐。

### 5. 派生最小承诺

`deriveDiagnosticSummary`（前称 `deriveCompositionView`）是**只读结构投影**（由已提交 rewrite 历史与 snapshot 参与者派生 serial / parallel / nest）。**不得**被 `SwarmScheduler` 或任何写/准入路径使用。见下方 2026-08-15 后续说明。

### 6. 包发布姿态

`@cantilune/core` 保持 `"private": true`，直至 LICENSE、prepack 消费者测试与运行时重放闭包就绪。

## 后果

**正面**

- 使 RFC 叙述与已实现的三支柱核心对齐
- 闭合并行安全漏洞（空声明足迹 + 重叠 targets）
- 使重放缺口变为显式而非隐含
- 建立一致性层而不反转运行时的支柱依赖

**负面 / 后续**

- `@cantilune/runtime` 必须在 L6–L7 声称之前实现 apply + replay
- 用于 Map 序列化的 Wire DTO / 编解码器 —— **已完成**（`snapshotCodec` + `wireValidation` 未知字段拒绝；Map 字段以 DTO 数组/对象往返）
- 结构投影工程说明——**后续已完成**（2026-08-15）；非 Acceptance
- ADR-0002 控制面威胁模型（RFC-0001 §9）——运行时范围在 **ADR-0003**；comms/网络仍受门禁约束

## 考虑过的备选方案

| 选项                                 | 被否决的原因                                 |
| ------------------------------------ | -------------------------------------------- |
| 保留静态 CantiluneGraph 作为唯一 API | 与已实现的 agent 组合写模型矛盾              |
| 为并发信任 agent 足迹                | 已证明不安全（评审反例）                     |
| 为重放在 Change 中嵌入载荷           | 违反核心不变式 I2                            |
| 立即发布 core                        | 无消费者测试的 dist-only 导出 = 虚假发布信号 |

## 实现任务

- [x] `MatchBinding`、`effectiveFootprintOfCompositionIntent`、防御式快照拷贝
- [x] `consistency` 模块、`validateSnapshotIntegrity`、`CoreViolation`
- [x] `deriveDiagnosticSummary` 重命名 + 弃用别名
- [x] `@cantilune/runtime`：OperationTemplateRegistry、AdmissionGateway、applyAdmittedChange、ReplayVerifier（M2 原型）
- [x] Wire DTO / 规范 wire 顺序 → **@cantilune/runtime**（`src/packages/runtime/src/codec/snapshotCodec.ts` + `wireValidation`；Map 序列化已闭合）
- [x] CI：core typecheck + tests + build（coverage 可选：`pnpm test:coverage`）
- [x] CI：runtime typecheck + tests + lint + format + pack smoke（`.github/workflows/runtime.yml`）
- [x] 结构投影工程说明（2026-08-15 后续）——非 Acceptance

## 后续（2026-08-15）：结构投影工程说明

| 字段   | 值                                                                          |
| ------ | --------------------------------------------------------------------------- |
| Status | **Proposed / follow-up Done**（仅工程说明——**非** Acceptance）              |
| Date   | 2026-08-15                                                                  |

`deriveDiagnosticSummary` **就是**只读结构投影：由已提交 rewrite 历史派生 `serial` / `parallel` / `nest`（`create_session` → nest，`fork_branch` → parallel）。Observability `FourViewBundle.structure`（经 `diagnosticStepFromChange` / `foldStructureComposition`）与 CLI `/observe structure` 消费此 derive——不是平行类型。

此投影**不得**被 `SwarmScheduler`（ADR-0019）消费。调度在每次 drain 时对已提交世界重新求值 start condition。本说明不授权公开优越性主张或产品 Acceptance。
