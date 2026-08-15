# ADR-0015：生产 swarm 生命周期、Manifest 绑定与可信 commit-feed

| 字段       | 值                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态       | **Proposed**（已请求 Owner 审查；解除 QA-0012 的 SS-01）                                                                                                                                                                                                   |
| 创建时间   | 2026-08-14                                                                                                                                                                                                                                                 |
| 更新时间   | 2026-08-14                                                                                                                                                                                                                                                 |
| 决策 Owner | Joker-of-Gotham                                                                                                                                                                                                                                            |
| 实现 DRI   | Codex 实现团队                                                                                                                                                                                                                                             |
| 审查人     | 独立架构与安全审查待进行（QA-L5 出口门禁）                                                                                                                                                                                                                 |
| 摘要       | 使生产 swarm 真实化：一个由 active 发起方 admit 的 `activate_participant` 操作、一个在激活时绑定的 content-addressed Manifest、一个 supervisor 订阅的 `ChangeLog.since` commit-feed 游标、agent 完成时持久化的 `signal_done`，以及由心跳调度的活性过期退役 |
| 权威来源   | 本 ADR；RFC-0001 仍是架构权威                                                                                                                                                                                                                              |
| 相关       | ADR-0006、ADR-0007、ADR-0012、ADR-0014、`@cantilune/core`、`@cantilune/runtime`、`@cantilune/comms`、`@cantilune/boot`、`@cantilune/control-plane`                                                                                                         |
| 取代       | 无（扩展 ADR-0007 activation authority 与 ADR-0012 completion 语义）                                                                                                                                                                                       |
| 被取代     | 无                                                                                                                                                                                                                                                         |

## 背景

`docs/qa/0012-agent-execution-continuity-qa.md`（SS-01）记录了五个具体缺陷，合在一起意味着生产 swarm 实际从未形成。对当前代码的精确阅读逐一确认：

1. **无可信 committed-change 订阅。** `ClusterSupervisor.start()`（`src/packages/boot/src/cluster/clusterSupervisor.ts:86`）只启动一个 stale-detector `setInterval`；它从不订阅 change feed。`evaluateConditions()`（`:112`）经由 `this.shared.runtime.getHead()` 读取一次性快照，而非消费已提交变更。游标 API 在 durable 端口上存在——`DurableCoordinator.since(fromRef: SnapshotRef)`（`src/packages/runtime/src/ports/durableCoordinator.ts:44`）——但 supervisor 从不调用它。CLI 数据路径确认：`runtimeSync.ts:359` 将 `durable.changes()` 整体转储，`ClusterView.tsx` 渲染一个以字面量 `CLUSTER_PROJECTION_NOTICE` 为前缀的只读投影。

2. **无 participant 激活。** 生命周期转换 `registered → active` 在 `src/packages/runtime/src/cluster/lifecycleTransitions.ts:12` 注册，但**整个仓库中不存在 `activate_participant` 操作模板、处理器与发射代码**。`register_participant`（`src/packages/runtime/src/execution/handlers/registerParticipant.ts:38`）以状态 `"registered"` 创建 participant 并留在原地。`ClusterSupervisor.startAgent()` 随后运行 agent 循环，从不提交 `registered → active` 转换。

3. **无权威 Manifest 绑定。** `Participant`（`src/packages/core/src/nodes/participant.ts:39`）只携带 `{ actorId, kind, status }`——无 manifest 引用。`AgentManifest` 文档注释（`src/packages/core/src/coordination/agentManifest.ts:5`）陈述了 _意图_——"一个 participant 持有一个 `manifestRef: ContentRef`，链接到其序列化 manifest"——但该字段从未被添加。`ClusterSupervisor.resolveManifest()`（`clusterSupervisor.ts:327`）改为扫描 `head.auditTail`，从 content store 逐一获取 `payloadRef`，`JSON.parse` 之，并返回第一个 `agentId` 按字符串相等匹配的——无 content-addressed 摘要校验，无 `SchemaEpochBinding.handlerManifestRef` 查询，无 manifest-id 解析。

4. **无持久化完成。** `onAgentComplete()`（`clusterSupervisor.ts:234`）在内存中 `agentResults` map 记录结果并重新求值条件，但**从不向 runtime 提交 `signal_done` `CoordinationIntent`**。`signalDoneHandler`（`src/packages/runtime/src/execution/handlers/signalDone.ts:9`）存在且完整测试，但只在测试中由手工注入的变更触发（`clusterSupervisor.test.ts:122`、`topologies.test.ts:99`）。本地 agent 完成因此从不会持久反映到 collaboration world。

5. **无带过期的活性策略。** supervisor 维护一个 `liveness` map，但没有调度的心跳校验来退役静默 participant。`emit_heartbeat` 作为模板/处理器存在，但没有任何东西按截止时间消费心跳来驱动 `retire_participant`。

Owner 之前的决定（本对话）将 **activation authority** 设为 **"已 active 的发起方激活"**：一个已 `active` 的 participant admit 一个 `registered` participant 到 `active`。这镜像了现有 `register_participant` 前置条件（`registerParticipant.ts:27`：`fromParticipant.status !== "active"` ⇒ 拒绝），因此激活遵循与注册相同的可信发起方规则，无新权限角色。

## 决策

生产 swarm 由五项变更构成，作为一个协调生命周期闭合五个缺陷。任一变更都不引入平行实体类型或 mock 路径；每个都扩展现有 core/runtime 结构。

### 1. `activate_participant` 操作与处理器（闭合缺陷 2）

新增操作 `activate_participant`，将一个 `registered` participant 转换为 `active`，由已 `active` 的发起方 admit。

- **模板**（`src/packages/runtime/src/schema/defaultSchema.ts`）：新 `ACTIVATE_PARTICIPANT` 条目，含 `requiredRoles: ["from", "participant"]`、`requires: [{ kind: "participant.registered", bindings: { participant: "participant" } }]`、`ensures: [{ kind: "participant.registered", bindings: { participant: "participant" } }]`、`defaultVisibility: "external"`、`mayCreateSessions: false`、`templateRef: operationTemplateRef("activate_participant", "1")`。它被 append 到 `DEFAULT_TEMPLATES` 中 `REGISTER_PARTICIPANT` 之后。
- **处理器**（`src/packages/runtime/src/execution/handlers/activateParticipant.ts`）：镜像 `register_participant` 与 `signal_done`。它 (a) 要求 `from` binding 与 `participant` binding；(b) 解析 `from` participant，除非 `from.status === "active"` 否则拒绝（Owner 决定的权威——active 发起方 admit）；(c) 解析目标 participant，除非 `validateTransition(current.status, "active")` 通过（即 `registered → active` 或 `waiting → active` 或 `blocked → active`）否则拒绝；(d) 在激活路径上还 **绑定 manifest**（§3）；(e) 产出 `participant(...)` 设为 `"active"` 的 after-snapshot，携带已绑定的 manifest ref。
- **注册**（`src/packages/runtime/src/execution/handlers/index.ts`）：`registry.register(operationTypeId("activate_participant"), activateParticipantHandler, "1")` 并再导出。
- **转换表**：`registered → active` 已存在（`lifecycleTransitions.ts:12`）；`waiting → active`（`:13`）与 `blocked → active`（`:19`）也已存在。无需新转换。

这使得 `registered → active` 转换 _可通过已提交变更到达_，而当前并不可达。该操作由与 `register_participant` 相同的权威（active 发起方）admit，因此不引入新权限角色，并将 admission 边界保持在 ADR-0007 范围内。

### 2. 在激活时绑定 Manifest，content-addressed（闭合缺陷 3）

添加 `AgentManifest` 文档注释已承诺的字段，并在激活转换时原子绑定。

- **`Participant` 获得 `manifestRef?: ContentRef`**（`src/packages/core/src/nodes/participant.ts`）。它可选仅因为 pre-activation participant 与非 agent participant（human、runtime）无 manifest；一个 `agent` participant 一旦 `active` **必须**携带 `manifestRef`。`participant(...)` 工厂与 `cloneParticipant`（`collaborationSnapshot.ts:63`）被扩展以携带该字段。这是对现有 core 类型的组合，而非平行实体。
- **content-addressed 完整性分两层校验，匹配 runtime 现有内容边界**（ADR-0003：runtime 无 content store；内容权威是独立关注点）：
  - **激活时（runtime 处理器，apply 时）**：`activate_participant` 处理器将 manifest ref 作为 `recipe.inputContentRefs[0]` 携带（与 `introduce_artifact` 用于其 content ref 的同一通道，`recipe.ts:43`）。若 `agent` participant 缺少该绑定则处理器拒绝——agent 无 manifest ref 不能被激活。它**不**触碰 content store，因为 runtime 无 store；ref 的 content-addressed 有效性在 manifest 写入时即已建立。这镜像 `introduce_artifact` 信任 recipe 上 ref 的方式。
  - **启动时（supervisor，`resolveManifest`）**：`ClusterSupervisor.resolveManifest()` 被替换。它不再扫描 `auditTail` 并按字符串匹配 JSON-parse。它读取 `participant.manifestRef`（激活时绑定的权威 ref），从 `this.shared.contentStore` 获取，重算摘要并在不匹配时拒绝，反序列化，并在 `AgentManifest.agentId` 不等于目标 `participant` actorId 时拒绝。若字段缺失则 participant 从未被激活，不得启动。这是 content store 所在之处，故摘要与 `agentId` 校验属于此处。这彻底移除了"扫描任意 observation"缺陷。
- **Epoch binding 关系**：active `SchemaEpochBinding.handlerManifestRef`（`schemaAdmissionReceipt.ts:27`）仍是 epoch 级 _哪个 handler manifest 治理操作_ 的权威。一个 participant 的 `manifestRef` 是 per-agent _配置_ manifest（system prompt、task、start condition、heartbeat interval）。它们是不同对象上的不同 ref；两者都是 content-addressed。handler manifest 治理操作 admission；agent manifest 治理 agent 启动。无混淆。

### 3. supervisor 上的可信 commit-feed 游标（闭合缺陷 1）

`ClusterSupervisor` 停止轮询快照，开始消费 committed-change feed。

- **游标**：游标是一个 `SnapshotRef`（supervisor 最后观察到的 head），匹配现有 `DurableCoordinator.since(fromRef: SnapshotRef)` API（`durableCoordinator.ts:44`）。supervisor 持有自己的 `lastObservedHead: SnapshotRef`，在 `start()` 时初始化为 head。
- **drain 循环**：`start()` 调度一个 drain，调用 `runtime.since(lastObservedHead)`，按序处理每个 `CoordinationChange`，并将 `lastObservedHead` 推进到该变更的 `afterRef`。处理是确定性的：`register_participant` 变更记录一个候选；`activate_participant` 变更（带其绑定的 `manifestRef`）将 participant 移至 `active`，并是 `startAgent()` 的触发点——而非注册。`emit_heartbeat` 变更刷新活性。`signal_done` 变更将 participant 从 supervisor 的 live 集合退役。
- **无推送注入**：`onSignalReceived(change)`（手工推送路径）被移除或限制为测试。可信路径是 feed；supervisor 不接受带外信号。这是"无 mock 信号注入"解除条件，应用于生产路径。
- **崩溃安全游标**：`lastObservedHead` 是一个在 durable bundle 中存活的快照 ref（它是 runtime 提交的 head）。supervisor 重启时游标从 durable head 恢复；无内存中游标状态被信任。这与 ADR-0014 的 bundle 权威原则一致。

### 4. 完成时持久化 `signal_done`（闭合缺陷 4）

本地 agent 完成被写回 collaboration world。

- **`onAgentComplete()`** 在记录本地结果与重新求值条件之**前**，为正在完成的 participant 向 runtime 提交一个 `signal_done` `CoordinationIntent`。runtime 经由现有 `signalDoneHandler` admit 它，后者校验 `active → done` 并在 supervisor 消费的同一 commit feed（§3）上发布变更。
- **绑定语义（2026-08-14 澄清）**：`signalDoneHandler` 转换 **`from`** binding，`retireParticipantHandler` 转换 **`participant`** binding。因此 supervisor 以不同的 `from` 权威提交两个生命周期 intent：
  - `signal_done` 是正在完成的 agent 自身的"我完成了"信号，经 feed 往返：`from` = 正在完成 participant 的 id，以该 participant 自身 principal 提交。（若 supervisor 以自身 principal 提交 `signal_done` 且 `from` = supervisor，处理器会转换 _supervisor_ 为 `done`，而非 worker——这是真实 runtime L6 测试暴露的缺陷。）
  - `retire_participant` 是 supervisor 动作：`from` = 解析出的 supervisor principal，`participant` = 被退役的目标。解析出的 principal 是所配置的 `supervisorPrincipal` 回调（若提供），否则是 runtime head 上第一个 `active` participant（§1 的 active-initiator 权威）。
- **崩溃排序**：durable `signal_done` 变更在 supervisor 将 participant 视为退役之**前**提交。若 supervisor 在 agent 循环返回后但在 `signal_done` 提交前崩溃，重启时 feed 仍显示该 participant 为 `active`；supervisor 不会重复启动它（feed 游标已越过其 `activate_participant` 变更，故 `drainFeed` 不会再次观察到 `startAgent` 触发）——或者，若 agent 进程已消失，活性过期路径（§5）将其退役。无论哪种，世界收敛；participant 绝不会被静默丢失。
- **(重)启动时活性对账（2026-08-14 澄清，L7）**：§5 活性表是进程内 Map；新 supervisor 进程以空表启动，故从崩溃进程遗留的 `active` participant 无活性条目，stale detector 永不会看到它。`start()` 因此以游标播种时读取的同一 head 调用 `reconcileLivenessFromWorld(head)`（无额外 `getHead()` 调用）。它为每个有绑定 `manifestRef`（由 `activate_participant` admit 的 participant 的标志，区分真实 worker 与从未被激活的 `active` 发起方）且未被跟踪的 `active` participant 重新播种一个活性条目，并从绑定 manifest 读取 `heartbeatIntervalMs`。其 agent 进程随前一进程死去的 participant 被播种为**已过期**（`lastHeartbeatTime = now − threshold − 1`），故首个 staleness tick 经 `retire_participant` 将其退役——文档记录的"agent 进程已消失"时的收敛路径。真正存活的 agent 永不被对账：它由自身的 `startAgent`（激活时，游标之前）播种，而非由对账播种，故对账永不覆盖 live 条目。`checkStaleAgents` 退役决策仅以 `elapsed > threshold` 门禁（无 `this.agents.has()` 守卫），故 orphan-with-no-`AgentInstance` 情形退役；运行中的健康 agent 经 `emit_heartbeat` 刷新心跳，永不过期。
- **完成 vs. 空洞成功**：supervisor 不再仅从内存中 `agentResults` map 报告"cluster complete"。Cluster 完成由已提交 world 派生：每个未退役 participant 为 `done`。这与 `ClusterView` 已投影的同一权威，故 CLI 与 supervisor 构造上一致。

### 5. 心跳调度的活性与过期退役（闭合缺陷 5）

`AgentManifest`（`agentManifest.ts:31`）中已有的 `heartbeatIntervalMs` 成为一项活契约。

- **Per-participant 截止时间**：当 `activate_participant` 提交时，supervisor 为该 participant 记录 `lastHeartbeatAt`（提交时间戳）与从绑定 manifest 读取的 `heartbeatIntervalMs`。`emit_heartbeat` feed 变更刷新 `lastHeartbeatAt`。
- **过期**：drain 循环的 tick 按 `now - lastHeartbeatAt > heartbeatIntervalMs * graceFactor` 校验每个 `active` participant。过期 participant 被提交 `retire_participant`（现有 `* → retired` 转换与处理器），而非静默丢弃。退役是一个已提交变更，故其持久并在 feed 上可见。
- **Grace factor**：一个小的固定乘子（默认 2×），选为容忍 commit-feed 延迟而不承认无限静默。它是 supervisor 策略，非 per-agent 覆盖，故被妥协的 manifest 不能延长自身的活性窗口。

### Comms / human 权限边界

解除条件提到"comms/human 权限边界"。本 ADR 将其保持在现有位置：

- `human` participant 不能被 `activate_participant` 激活以运行 agent 循环——处理器只激活 `agent`-kind participant（manifest 绑定要求 `AgentManifest`，而 human 没有）。human 通过 `register_participant` 进入世界并通过自身提交的 coordination intent 行动，与今天完全一致。
- comms（`@cantilune/comms`）仍是 peer transport 层：`MeshTransportRouter` 在 `startAgent` 时为每个 agent 分配 transport，在完成/退役时释放，不变。本 ADR 不新增 comms 权威；仅使分配的 _触发_（`active` 转换）与释放的 _触发_（`signal_done`/`retire`）来自已提交变更而非内存中 supervisor 状态。

## 考虑过的备选方案

- **control-plane 发行的激活**（active binding 的 `activatedBy` admit participant）：否决。它将 participant 激活耦合到 epoch admission，这是错误的粒度——一个 swarm 可能在一个 epoch 下激活多个 participant，且 epoch admission 已要求完整 ADR-0007 四视图证据。participant 激活是 runtime 协调关注点，非 control-plane 管理关注点。Owner 选择 active-initiator 规则。
- **manifest ref 存于 `auditTail`，靠扫描发现**（现状）：否决。它不是 content-addressed 权威（无摘要校验），未绑定到 participant（按 `agentId` 字符串匹配），且在压缩 tail 的世界重载后不持久。激活时绑定使 ref 成为 participant 的字段，存活于快照。
- **基于推送的信号**（`onSignalReceived`）：在生产路径上否决。推送的信号不在已提交 feed 上，故不持久、不排序、对其他 supervisor 或 CLI 不可见。只有 feed 被信任。
- **per-tool 心跳覆盖**：否决。manifest 已设置 `heartbeatIntervalMs`；允许工具延长活性窗口将使被妥协的 agent 能静默自身的过期。grace factor 是 supervisor 策略。

## 迁移与验证

本 ADR 向默认 schema 增加操作模板，改变默认 schema 摘要。依 ADR-0014，schema 摘要是持久 epoch binding 的一部分。影响：

1. **现有世界**：在旧默认 schema 下播种的世界携带 `schemaRef.digest` 早于 `activate_participant` 的 epoch binding。加载时，旧 binding 对其 epoch 仍有效；必须 admit 一个新 epoch（通过正常 ADR-0006/0007 admission 工作流）以激活新 schema。不就地重写现有 epoch。
2. **新世界**：在更新后默认 schema 下播种，从首个 epoch 起携带 `activate_participant`。boot 种子被更新以构造含新模板的默认 schema；不迁移历史数据。
3. **覆盖率门禁**：所有新代码落在仓库 L2–L7 阈值下（语句/函数/行 ≥90%，分支 ≥88%）。新测试：`activateParticipant` 处理器单元套件（admit-by-active、reject-inactive-initiator、reject-non-registered-target、manifest-missing/invalid-digest/agentId-mismatch 分支）；新 `Participant.manifestRef` 字段 round-trip 单元套件；commit-feed drain 循环集成测试；以及下方的真实 runtime L6/L7 闭环测试。

### 真实 runtime L6/L7 闭环测试（解除门禁）

一个无 mock 信号注入、通过真实 runtime 驱动完整生命周期的测试：

1. 播种一个含一个 `active` 发起方与 N 个 `registered` agent 的世界，每个 agent 的真实 manifest 在一个真实（文件或内存）content store 中。
2. 发起方为每个 agent 提交 `activate_participant`（由 active-initiator 规则 admit），绑定每个 manifest。
3. supervisor 的 feed drain 观察每个 `activate_participant` 变更并调用真实 `startAgent`（循环是真实的；测试中 agent 的"工作"是一个确定性函数，完成时经由 runtime 提交 `signal_done`）。
4. 每个 agent 的 `signal_done` 在 feed 上提交；supervisor 观察到它并**不**重启 participant。
5. 一个 agent 被配置为静默（无心跳）。活性过期 tick 为其提交 `retire_participant`。
6. 测试断言已提交 world 的最终状态：激活的 agent 为 `done`，静默 agent 为 `retired`，supervisor 内存中视图与已提交 world 一致（无漂移）。
7. 崩溃变体：supervisor 进程在 drain 中途被 kill 并重启；它从 durable head 游标恢复，观察已提交的转换，不重复 `startAgent` 或 `signal_done`。

这是 QA 门禁（line 146–147）要求的测试：一个无 mock 信号注入的真实 runtime L6/L7 闭环 swarm 测试。

**L7 实现（2026-08-14，有证据）：**
`src/packages/boot/tests/system/cluster/closedLoopSwarmCrash.test.ts`（3 个测试，跨进程）。子进程（`tests/support/swarmSupervisorChild.mjs`）对一个能在进程死亡后存活的 **文件支持** durable world（`createFileRuntimePersistence`）驱动 `ClusterSupervisor`。模式：

- `seed` —— 干净闭环：`start()`（游标从 T0 播种）→ `activate_participant` 提交 → `drainFeed` → `startAgent` → scripted-LLM `done` → `signal_done` 提交 → worker `done`。副作用日志记录一次 `startAgent`、一次 `activate_committed`、零次 `retire_participant`。
- `crash-pre-done` —— `start()` → `activate_participant` → `drainFeed` 调用 `startAgent`（记录一次 `startAgent`）但 agent 使用 **挂起** 的 LLM 永不返回 `done`，故 agent 进程在任何 `signal_done` 提交前被 kill（exit 1）。durable head 已越过 `activate_participant`；worker 为 `active` 且 `signalDoneCount = 0`。
- `recover` —— 一个全新进程加载同一文件支持世界。`start()` 从 durable head（越过 `activate_participant`）播种游标，故 `drainFeed` 观察到**无** activate 变更并调用**无** `startAgent`。孤立的 `active` worker 被对账进活性表且已过期（`reconcileLivenessFromWorld`，§4），staleness tick 经 `retire_participant` 将其退役。世界收敛到 `retired`。

解除断言（"无重复"证明）：在整个 kill/重启生命周期中，副作用日志记录 `startAgent` **恰好一次**（在崩溃进程中）且重启时**零**次；`signal_done` 记录零次；重启经 `retire_participant` 收敛。第三个测试确认干净 `done` 之后的重启不重新处理已收敛世界（仍一次 `startAgent`，零次 `retire`）。这是 ADR-0015 §7 步骤 7 的跨进程崩溃变体，无 mock 信号注入。

## 后果

- **正面**：swarm 由已提交变更形成；CLI 投影与 supervisor 共享同一权威（commit feed）；完成是持久的；静默 agent 被退役而非泄漏；manifest 是 content-addressed 并绑定到 participant，而非从 observation 扫描。
- **负面**：默认 schema 摘要变化，故现有世界需要一个新 epoch admission 以使用 `activate_participant`（这是正确的、经审查的路径，非静默重写）。supervisor 的 drain 循环增加一个 feed 处理路径，须测试大 change log 下的背压。
- **中性**：`ClusterView` 保持只读投影——但它现在投影的是一个真正被活 swarm 驱动的世界，故"只读"框架成为真实状态的真投影，而非休眠快照的投影。

## 解除映射

| SS-01 缺陷                                                | 闭合方式                                     | 节   |
| --------------------------------------------------------- | -------------------------------------------- | ---- |
| 无可信 committed-change 订阅                              | `DurableCoordinator.since` 游标 + drain 循环 | 3    |
| 运行 `registered` participant 而无 admit 的 `active` 转换 | `activate_participant` 操作 + 处理器         | 1    |
| 通过扫描任意 observation 发现 Manifest                    | `Participant.manifestRef` 在激活时绑定       | 2    |
| 未将本地 `done` 绑定到 `signal_done`                      | `onAgentComplete` 提交 `signal_done`         | 4    |
| 可永远等待或报告空洞成功                                  | 已提交世界完成 + 活性过期退役                | 4, 5 |

全部六项解除条件主题（participant 激活权威、规范 Manifest 绑定、durable commit-feed 游标、cluster 成员/完成语义、心跳调度/活性过期、comms/human 权限边界）均已在上方涉及，并将在本 ADR 从 Proposed 转为 Accepted 之前由真实 runtime 闭环测试提供证据。

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；实现已落地并变绿 —— L6 闭环 + L7 跨进程崩溃测试通过）
**状态**：Proposed。Acceptance 另需独立架构 + 安全评审人签署（QA-L5 出口语门禁）。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。
