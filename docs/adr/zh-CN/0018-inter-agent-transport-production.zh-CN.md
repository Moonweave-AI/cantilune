# ADR-0018：跨 Agent 传输——生产接线、端点权威与跨进程交付

| 字段       | 值                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 状态       | **Proposed**（待 Owner 批准；实现未启动）                                                              |
| 日期       | 2026-08-14                                                                                             |
| 决策负责人 | Joker-of-Gotham (DRI)                                                                                  |
| 评审人     | Acceptance 前需独立架构 + 安全/威胁模型评审人（COI：Owner 为 DRI）                                     |
| 相关       | RFC-0001 §7, ADR-0003, ADR-0004, ADR-0007, ADR-0008, ADR-0015, `@cantilune/comms`, formal Cantilune/Pi |
| 取代       | 无（扩展 ADR-0004 M3 loopback 范围至生产接线）                                                         |
| 被取代     | 无                                                                                                     |

## 背景

ADR-0004 在 **M3 工程范围**下接受了 `@cantilune/comms`，配有一个 **loopback transport**，并将生产网络表面显式延迟为网络 Stop-Ship 门禁：

> 延迟（网络 Stop-Ship）：文件支撑的 CommsStore + 跨进程 L7；生产 IdentityVerifier / TLS / mTLS；pinned A2A 互操作认证线束；完整的 send/receive/ack 运行时消费者集成。

全项目审计（发现 **D1**）记录了**跨 Agent 传输未实现**——loopback transport 在进程内解析每个 `dynamicPartnerAdmission` / `instanceReconnect`；从未有两个 Cantilune 进程通过真实线路交换过 `CommunicationOccurrenceRecord`。因此 π-演算通信 facet 作为一个有类型、持久、受准入约束的 _协议包_ 存在，而非 _传输_。

本 ADR 通过规约生产接线来闭合该缺口，而不重新开启 M3 协议决策（15-family/60-code 注册表、wire v1 strict 编解码器、`AdmissionReconnectPlan`、`CommsStore` 原子单元、`a2a/0.1` profile——全部不变）。

### 不可协商的约束（承自 ADR-0004/0007/0008）

1. 运行时仍是唯一的协作变更器；传输经端口产生 `ObservationEntry`，从不直接写协作世界。
2. `ActorRef` 是网络身份；无自由形式的 `targetEpochId`——epoch/binding 来自已提交的 `SchemaAdmissionReceipt`。
3. 载荷**仅按引用**（`ContentRef`）；已发布证据根中无内联密钥。
4. E-Stop（紧急停止）必须在 ingress / send / reconnect / retry 上触发。
5. 线上的未知字段被拒绝（strict v1）。
6. 形式化 Lean 证明不覆盖 comms 包；生产传输需单独的产品合规性证据。

## 决策

### 1. 传输是现有协议表面之后的可替换端口

M3 `Transport` 端口已存在（loopback 是一个实例）。生产在**同一**端口之后新增两个实现，使协议层、wire 编解码器、`CommsStore` 单元与重连协调器不受触碰：

| 传输                | 范围               | 用途                       |
| ------------------- | ------------------ | -------------------------- |
| `LoopbackTransport` | 进程内（现有，M3） | CI、单元测试、单进程 demo  |
| `FileTransport`     | 经共享目录跨进程   | 单宿主上的本地多进程 swarm |
| `NetTransport`      | 经 TCP+TLS 跨宿主  | 生产多宿主 swarm           |

`FileTransport` 是**最小生产跨进程传输**（无需发明证书权威即可解除多宿主 swarm 的阻塞）。`NetTransport` 是完整生产表面。两者实现同一 `Transport` 接口；选择是一个 `BootConfig` 选择，从不是协议变更。

### 2. 端点权威：`ActorRef` ↔ 传输身份绑定

- 每个 `ActorRef` 绑定到恰好一个传输端点，经 `AdmissionReconnectPlan`（ADR-0004 option 2）解析。该计划的 `planDigest` 已绑定 receipt + session + template + endpoints。
- 一个新的 **`EndpointIdentityVerifier`** 端口（替代 M3 stub）确认所呈现的对端身份与 receipt 提交的 `ActorRef` 匹配。`FileTransport` 经文件系统 ACL + 进程 pid 校验；`NetTransport` 经 receipt 中 pinned 的 mTLS 证书指纹校验。
- 当对端端点无法 pinned 时，要求 `provenanceUnavailable` 标志（RFC-0004 §11.2 模式）；此类会话在无评审人例外时**不得**承载可发布的优越性主张。

### 3. 跨进程交付与持久性（闭合跨进程 L7 门禁）

- `CommsStore` 在现有内存实现旁新增一个**文件支撑**的原子单元实现。outbox/inbox/reconnect/close 单元被 journal 到一个 content-addressed store（复用 `@cantilune/content` 的文件 store），故进程在 saga 中途崩溃可从最后提交的单元恢复——镜像 ADR-0014 的持久 epoch journal 与 ADR-0016 的预调用 journal。
- 交付为**至少一次**，接收方以 `occurrenceRecordId` 为键幂等；这与 syscall 精确一次分层（ADR-0016）组合，故由远程消息触发的外部工具调用不会跨传输重试被重复执行。
- 一个跨进程 **L7 崩溃测试**（平行于 `epoch-transition-crash-atomic.test.ts` 与 `toolInvocationCrashBoundaries.test.ts`）在 send 中途 kill 一个对端，并验证新进程从持久 outbox 重新驱动而不向幂等接收方重复交付。

### 4. 线上的 E-Stop 与安全状态

- ingress/send/reconnect/retry 各带一个 E-Stop 检查。传输级 E-Stop（例如 TLS 握手失败、端点身份不匹配、重放窗口违规）进入**安全状态**：会话被静默，不再尝试进一步 send，一个 `EStopEvent` 经脱敏的 `CommsEvent` 封套发出。
- 安全状态是**非破坏性的**：持久 outbox 被保留，故运维者可诊断并在授权后重放；协作世界不因传输失败而被变更。

### 5. 互操作认证线束（pinned `a2a/0.1`）

- 一个参考适配器 + loopback 已 pin `a2a/0.1`。生产新增一个 **`NetTransport` 合规性线束**，对参考适配器执行 pinned profile：wire-v1 strict 编解码器往返、15-family/60-code 注册表覆盖、受准入约束的重连排序，以及每个故障上的 E-Stop。
- 该线束是 `NetTransport` 的 CI 门禁；`FileTransport` 复用进程内线束。在线束变绿且独立安全评审人签署威胁模型之前，不得授权任何公开 A2A 互操作性主张。

### 6. 可观测性包接线

- 传输事件经脱敏的 `CommsEvent` 封套流入 `@cantilune/observability`。无原始载荷、密钥或对端私有材料越过可观测性边界——封套是结构性的（family、action、phase、disposition、evidence refs），依 ADR-0008。

## 威胁模型增量（相对于 ADR-0008）

| 关注点       | ADR-0008 边界（M3）          | 本 ADR（生产）                                                 |
| ------------ | ---------------------------- | -------------------------------------------------------------- |
| 网络身份     | `ActorRef`，仅进程内         | 经 `EndpointIdentityVerifier` 的 `ActorRef` ↔ 传输身份         |
| 重放窗口     | 内存中                       | 持久，绑定到 `occurrenceRecordId` + content-addressed outbox   |
| 端点允许列表 | loopback（单进程）           | receipt-pinned 端点；未 pinned 的 `provenanceUnavailable` 标志 |
| 载荷         | 按引用，进程内               | 按引用，content-addressed 跨进程（线上无内联载荷）             |
| TLS / mTLS   | 不适用（loopback）           | 仅 `NetTransport`；`FileTransport` 依赖文件系统 ACL            |
| E-Stop 表面  | ingress/send/reconnect/retry | + 传输级（握手、身份、重放窗口故障）                           |
| DLQ 重放     | 延迟                         | 保留的 outbox + 运维者授权的特权重放工作流                     |

一份伴随的 **ADR-0008 修订**（本 ADR 的 Acceptance 条件）更新生产传输表面的 STRIDE 映射。完整 STRIDE 映射在 Acceptance 前由独立安全/威胁模型评审人评审。

## 结果

- `@cantilune/comms` 获得一个文件支撑的 `CommsStore` 与两个真实传输；协议层、wire 编解码器与重连协调器不变（不重新开启 ADR-0004 M3 决策）。
- 多宿主 swarm（ADR-0015）可经 `FileTransport`（单宿主）与 `NetTransport`（多宿主）到达，而非仅进程内。
- 形式化 Lean 覆盖仍排除 comms；生产传输需依形式化范围边界的产品合规性证书。
- 本 ADR **不**授权公开 A2A 互操作性主张；那些要求变绿的合规性线束 + 独立安全评审。

## 实现阶段（T0–T4）

| 阶段   | 范围                                                                           | 状态              |
| ------ | ------------------------------------------------------------------------------ | ----------------- |
| **T0** | `Transport` 端口已存在；`EndpointIdentityVerifier` 端口 + `FileTransport` 骨架 | 已实现            |
| **T1** | 文件支撑的 `CommsStore` 原子单元；持久 outbox/inbox journaling                 | 已实现            |
| **T2** | `FileTransport` 跨进程交付 + 幂等接收 + L7 崩溃测试                            | 已实现            |
| **T3** | `NetTransport` TCP+TLS+mTLS + `EndpointIdentityVerifier` mTLS 路径             | 已实现            |
| **T4** | `a2a/0.1` 合规性线束作为 CI 门禁；独立安全评审                                 | 已实现 / 评审待签 |

> 「已实现」指代码落地且自动化测试与覆盖率门禁为绿，**不等于 ADR Acceptance**。T0–T2 此前写作
> `Not started`，与下方批准段记录的 T1 已实现自相矛盾；此处修正表格，而非弱化批准记录。

## 测试 / QA 计划

| 层级  | 范围                                                                        | 状态           |
| ----- | --------------------------------------------------------------------------- | -------------- |
| L2–L4 | 传输端口、身份校验器、文件 store 的单元/契约测试                            | 已绿           |
| L5    | 架构 + 安全/威胁模型评审                                                    | Owner-accepted COI 2026-08-16 |
| L6    | 集成：admission → reconnect → `FileTransport` / `NetTransport` send/receive | 已绿           |
| L7    | 跨进程 send 中途崩溃；幂等接收；传输 E-Stop（file + net）                   | 已绿           |
| CI    | `a2a/0.1` 合规性线束（loopback + file + net）                               | 已绿           |

> **跨进程证据更正（2026-08-15）。** L7 一行此前依赖
> `tests/system/file-transport-cross-process.test.ts`，而该套件以
> `existsSync(dist/...)` 自我门控、包未构建时**静默跳过**。在 `pnpm test` 下工作区构建与该
> 套件互相踩踏，两个跨进程用例被报告为 skipped 而非执行 —— 该配置下证据从未真正产生。
> 现在缺失 `dist/` 会显式失败，且 `@cantilune/comms` 增加了先行构建的
> `pretest`/`pretest:coverage` 钩子。comms 305 测试全绿，两个跨进程用例真实执行。

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；T1 `FileTransport` 已落地。T3 `NetTransport` TCP+TLS 1.3+mTLS + T4 `a2a/0.1` 线束于 2026-08-15 落地 —— 仅为「已实现」。）
**状态**：Proposed。Acceptance 要求：(1) Owner 签名（设计批准见上）；(2) 独立架构评审人签署；(3) 独立安全/威胁模型评审人对 ADR-0008 修订的签署；(4) 合规性线束变绿（现已实现；线束变绿本身不是安全签署）。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。本次更新**不**授权公开 A2A 互操作性主张。
