# ADR-0019：多 Agent CLI 启动——监督者入口、共享世界集群与单 Agent 后向兼容

| 字段       | 值                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| 状态       | **Proposed**（待 Owner 批准；实现未启动）                                                                      |
| 日期       | 2026-08-14                                                                                                     |
| 决策负责人 | Joker-of-Gotham (DRI)                                                                                          |
| 评审人     | Acceptance 前需独立架构 + 安全评审人（COI：Owner 为 DRI）                                                      |
| 相关       | RFC-0001 §8, ADR-0012, ADR-0015, ADR-0014, ADR-0018, `@cantilune/boot`, `@cantilune/cli`, `@cantilune/runtime` |
| 取代       | 无（扩展 ADR-0015 swarm 生命周期至 CLI 启动表面）                                                              |
| 被取代     | 无                                                                                                             |

## 背景

全项目审计（发现 **D2**）记录了**CLI 仍启动单个 Agent**，经 `bootCantilune`。`bootCantilune`（`src/packages/boot/src/bootCantilune.ts:394`）构造一个 `CantilunOS`，它拥有"一条有序的私有历史"且是**单飞**的（`singleFlightFailure`，`:266`：_"CantilunOS.run 是单飞的，因为一个 OS 拥有一条有序的私有历史"_）。CLI 恰好调用 `bootCantilune` 一次（`runtimeSync.ts:367`）。

ADR-0015 在运行时/监督者层使生产 swarm 真实化：`activate_participant`、`Participant.manifestRef`、commit-feed 游标 `ClusterSupervisor`、持久 `signal_done`、心跳调度的活性过期退役，以及重启时的活性对账。但 ADR-0015 的 `ClusterSupervisor` 尚不是一个 **CLI 入口点**：不存在用户调用来针对一个共享持久世界启动多个 agent 的 `bootSwarm`（或等效物）。swarm 生命周期作为一个 CLI 未暴露的运行时能力存在。

本 ADR 闭合该缺口：它规约启动并监督一个多 Agent swarm、针对单一共享持久 `CollaborationSnapshot` 的 CLI/boot 表面，同时为观察者/开发者场景保留单 Agent `bootCantilune` 路径。

### 不可协商的约束

1. **一个世界，每个 agent 一条有序历史。** 每个 agent 拥有自己的私有历史（每个 `CantilunOS` 单飞）；协作世界是共享权威。无 agent 读取另一个的私有转录。
2. **无新权威角色。** 激活使用 ADR-0015 §1 已固定的 active-initiator 规则；监督者的 `from` 权威是所配置的 `supervisorPrincipal` 或 head 上第一个 `active` participant（ADR-0015 §4）。
3. **committed-feed 是唯一可信信号路径。** 监督者消费 `runtime.since(cursor)`；无推送注入（ADR-0015 §3）。
4. **崩溃安全。** 监督者重启从持久 `lastObservedHead` 游标恢复；一个孤立的 `active` participant 经活性对账（ADR-0015 §4）与 `retire_participant` 收敛。
5. **生产代码，无 mock。** 依 AGENTS.md，`src/` 必须是真实可运行逻辑；生产路径上无 mock/placeholder/hardcoded 旁路。
6. **覆盖率门禁。** 所有新代码在 L2–L7 阈值下（语句/函数/行 ≥90%，分支 ≥88%）。

## 决策

### 1. 在 `bootCantilune` 旁新增 `bootSwarm`，而非替代它

- `bootCantilune` 保持**单 Agent** 入口（观察者模式、开发者 REPL、一个 agent + 一个 human）。不变。
- `bootSwarm(deps): CantiluneSwarm` 是一个**新**的启动入口，构造一个绑定到单个共享持久世界加一个 **`CantilunOS` agent 实例池**的 `ClusterSupervisor`（ADR-0015），每个 `active` participant 经 `activate_participant` admit 一个实例。
- `CantiluneSwarm` **不是**第二个协作变更器。运行时仍是唯一变更器；swarm 启动 agent OS 实例，这些实例经运行时端口提交 `CoordinationIntent`，恰如单 Agent 路径所做。

### 2. 共享持久世界，每个 agent 私有历史

- swarm 针对一个**单一** `createFileRuntimePersistence` 世界（ADR-0014 持久 epoch journal）启动。所有 participant 共享同一个 `CollaborationSnapshot`。
- 每个 agent OS 实例由 `bootCantilune` 构造，使用**同一共享 runtime/content/syscall store** 但**不同的私有历史**（依 ADR-0012 会话-世界隔离的不同的 `principal` / 持久路径绑定）。无 agent 水合另一个的私有转录。
- 这逐字复用现有 ADR-0012 隔离不变式：_"仅一个确切的持久/路径/principal 绑定可水合私有转录。"_

### 3. 监督者生命周期接线（CLI 表面）

- `bootSwarm` 调用 `ClusterSupervisor.start()`，后者从 `runtime.getHead()` 播种 `lastObservedHead` 并运行 `reconcileLivenessFromWorld(head)`（ADR-0015 §4），故来自崩溃监督者的孤立 `active` participant 收敛。
- drain 循环消费 `runtime.since(lastObservedHead)`。一个 `activate_participant` 变更（带其绑定的 `manifestRef`）是 `startAgent()` 的触发点：监督者解析 manifest（content-addressed，ADR-0015 §2），为该 participant 启动一个 `CantilunOS`，并运行其 agent 循环。
- `signal_done` 退役 participant；`retire_participant`（活性过期）退役静默 participant。两者都是同一 feed 上的已提交变更。

### 4. CLI 命令表面

- 一个新 CLI 命令族（例如 `/swarm start` / `/swarm status` / `/swarm retire`）暴露监督者，镜像现有 `/cluster` 命令族但**可写**（`/cluster` 命令族依其 `CLUSTER_PROJECTION_NOTICE` 保持只读投影）。
- swarm 命令经 `bootSwarm` 启动；单 Agent TUI 继续经 `bootCantilune` 启动。两者在一个 CLI 进程内互斥（每个进程一个运行时权威），由显式 flag/命令选择，从不是经隐式 fallback。
- headless runner 获得 `--swarm` 模式，启动监督者、admit 已配置的 participant，并运行至 cluster 完成（每个未退役 participant 为 `done`）或 E-Stop。

### 5. 崩溃与重启语义

- 监督者进程崩溃留下持久世界完好（ADR-0014）与持久 bundle 中的 `lastObservedHead` 游标（ADR-0015 §3）。
- 重启时，`bootSwarm` 重新读取游标与 head，对账活性，并重新驱动：仍有存活 agent 进程的 `active` participant 不被重复启动（游标已越过其 `activate_participant` 变更）；agent 进程已死去的 participant 被播种为已过期并在首个 staleness tick 时退役（ADR-0015 §4）。
- 一个 **L7 跨进程崩溃测试**（平行于现有 `closedLoopSwarmCrash.test.ts`，ADR-0015）在生命周期中途 kill 监督者进程并验证针对同一世界的新 `bootSwarm` 收敛而不重复 `startAgent`/`signal_done`，并退役孤立的 `active` participant。

### 6. 每个 agent 的 comms 传输

- 在 `startAgent` 时，swarm 为每个 agent 分配一个传输（ADR-0015 comms 边界中已有的 `MeshTransportRouter`）；在 `signal_done`/`retire` 时释放。伴随 ADR-0018，这成为真实 `FileTransport`/`NetTransport` 而非 loopback。本 ADR 不新增 comms 权威；仅使分配/释放跟随已提交 feed。

### 7. 单 Agent 后向兼容与迁移

- `bootCantilune` 与单 Agent TUI 不变。单 Agent 路径下播种的世界携带其现有 epoch binding；swarm 可在一个新 epoch 下 admit 新 participant（ADR-0014 schema-digest 迁移），不就地重写历史 epoch。
- `activate_participant` 模板在 ADR-0015 之后已位于默认 schema 中，故 schema 摘要已为新世界反映它。

## 考虑过的备选方案

- **一个内部多路复用多个 agent 的 `CantilunOS`**：否决。它会坍缩私有历史隔离不变式（ADR-0012）——一个 OS 拥有一条有序私有历史；一个多 Agent OS 会要求 agent 共享私有转录或 OS 多路复用历史，两者都违反单飞/私有历史边界。
- **control-plane 发行的 agent 启动**：否决。Agent 启动是由已提交 feed 上的 `activate_participant` 触发的运行时协调关注点（ADR-0015），而非 control-plane 管理关注点。耦合它们重新开启 ADR-0015 §"备选方案"已否决的粒度问题。
- **CLI 中隐式的单→多 fallback**：否决。两条路径互斥且显式选择；隐式 fallback 会让用户在意图单 agent 时意外运行 swarm，或反之，且权威语义不同。

## 结果

- CLI 获得一个多 Agent 启动表面；单 Agent 路径为观察者/开发者用途保留。
- swarm 共享一个持久世界；每个 agent 保持其私有历史（ADR-0012 隔离保留）。
- 崩溃/重启收敛依赖 ADR-0015 §4 活性对账；本 ADR 新增调用它的 CLI 表面。
- 本 ADR 依赖 ADR-0018（真实传输）以支持跨宿主 swarm；`FileTransport` 足以支持单宿主 swarm 并可先行落地。
- 形式化 Lean 覆盖排除 boot/cli；生产 swarm 启动需依形式化范围边界的产品合规性证据。

## 实现阶段（S0–S4）

| 阶段   | 范围                                                                                    | 状态        |
| ------ | --------------------------------------------------------------------------------------- | ----------- |
| **S0** | `bootSwarm` 入口；`CantiluneSwarm` 类型；复用 ADR-0015 `ClusterSupervisor` 的监督者接线 | Done (impl) |
| **S1** | 每个 agent 的 `CantilunOS` 构造，共享 store + 不同私有历史                              | Done (impl) |
| **S2** | CLI `/swarm` 命令族 + headless `--swarm` 模式                                           | Done (impl) |
| **S3** | `FileTransport` 支撑的单宿主 swarm + L7 跨进程崩溃测试                                  | Done (impl) |
| **S4** | `NetTransport` 支撑的多宿主 swarm（依赖 ADR-0018 T3/T4）                                | Not started |

> "Done (impl)" 仅表示实现 + 自动化测试/覆盖率门禁已变绿。ADR 仍为 **Proposed** —— Acceptance 仍需 Owner 签名加独立架构 + 安全评审（COI：Owner 即 DRI）。S0–S3 状态反映已落地的代码/测试，而非 ADR Acceptance。

## 测试 / QA 计划

| 层级  | 范围                                                           | 状态           |
| ----- | -------------------------------------------------------------- | -------------- |
| L2–L4 | `bootSwarm`、`CantiluneSwarm`、监督者接线的单元/契约测试       | Done (green)   |
| L5    | 独立架构 + 安全评审                                            | review-pending |
| L6    | 集成：`bootSwarm` → activate → startAgent → signal_done → done | Done (green)   |
| L7    | 跨进程监督者崩溃；孤立退役；无重复启动                         | Done (green)   |
| CI    | boot + cli + runtime 的 `pnpm test:coverage`                   | Done (green)   |

> 自动化层级（L2–L4、L6、L7、CI）已落地并变绿（boot：456 测试，覆盖率门禁 EXIT=0 —— stmt 94.27 / branch 88.31 / func 98.02 / line 94.27；cli：584 测试，branch 88.11 EXIT=0）。L5 是剩余的独立架构 + 安全评审，DRI 不能自证（COI）。ADR 保持 **Proposed** 直到该评审与 Owner 签名完成。

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；S0–S3 已落地并变绿 —— L6 + L7 跨进程崩溃测试通过，覆盖率门禁 EXIT=0）
**状态**：Proposed。Acceptance 要求：(1) Owner 签名（设计批准见上）；(2) 独立架构评审人签署；(3) 独立安全评审人签署；(4) L7 崩溃测试变绿。按治理基线，聊天/Agent 摘要并非事实之源；本 ADR 为权威，在独立架构 + 安全评审（L5）完成前保持 Proposed。Owner（DRI）已授权在 Acceptance 之前分阶段落地 S0–S3，以解除 QA-0012 发布门禁阻塞；本 ADR 在此记录该授权。Acceptance 之前不进行 merge/部署。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。本 ADR 排序在 ADR-0015（已完成）之后，且可就 `FileTransport` 单宿主情形与 ADR-0018（传输）并行推进。

### 已落地产物（S0–S3，未评审）

- `src/packages/boot/src/swarm/bootSwarm.ts` —— `bootSwarm`、`CantiluneSwarm`、可插拔 `AgentFactory` → 每 agent 一个 `CantilunOS`（S0/S1）。
- `src/packages/cli/src/wiring/swarmControl.ts`、`src/packages/cli/src/commands/swarmCommands.ts`、`src/packages/cli/src/views/SwarmView.tsx`、headless `--swarm`（`src/packages/cli/src/headless/headlessRunner.ts`）（S2）。
- `src/packages/boot/tests/unit/swarm/bootSwarm.test.ts`（10 测试）、`src/packages/boot/tests/system/swarm/bootSwarmClosedLoop.test.ts`（L6，2 测试）、`src/packages/boot/tests/system/swarm/bootSwarmCrash.test.ts` + `src/packages/boot/tests/support/bootSwarmChild.mjs`（L7，3 测试，跨进程无重复门禁）。
- 覆盖率门禁变绿：boot EXIT=0（stmt 94.27 / branch 88.31 / func 98.02 / line 94.27），cli EXIT=0（branch 88.11）。typecheck/lint/prettier/build 在触及文件上变绿。
