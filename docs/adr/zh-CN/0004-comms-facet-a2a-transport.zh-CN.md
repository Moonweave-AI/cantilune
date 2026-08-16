# ADR-0004：通信侧面与 A2A 传输

| 字段           | 值                                                                       |
| -------------- | ------------------------------------------------------------------------ |
| Status         | **Accepted**（M3 工程范围——网络 Stop-Ship 门禁已记录）                   |
| Date           | 2026-08-11                                                               |
| Decision Owner | Joker-of-Gotham (DRI)                                                    |
| Reviewers      | Joker-of-Gotham（**Accepted** M4）；FCP 前外部 Security reviewer         |
| Related        | RFC-0001 §7、ADR-0003、ADR-0006、`@cantilune/comms`、formal Cantilune/Pi |

## 背景

RFC-0001 将 comms 定义为 π-calculus 通信侧面，具备 A2A 兼容的传输。此前 `@cantilune/comms` 仅暴露一个回显 `instanceReconnect()` 桩。理论要求 typed late-π 出现（15 family / 60 registry 码）、持久投递、admission 约束的 reconnect，以及运行时权威的状态变更。

## 决策

将 `@cantilune/comms` 实现为一个**协议包**，它：

1. 复用 `@cantilune/core` 的 `CommunicationSession`、`ActorRef`、branded ID——无并行 session 类型。
2. 通过 **`AdmissionReconnectPlan`**（ADR 选项 2——绑定 receipt + session + template + endpoints 的签名计划）消费权威 `SchemaAdmissionReceipt`。
3. 持久化 **CommunicationOccurrenceRecord**，含 registry 派生的 family、原生动作、足迹与证据引用。
4. 分离四个状态轴：π phase、occurrence 生命周期、endpoint 处置、transport 投递。
5. 强制严格 **wire v1** 入口，拒绝未知字段。
6. 使用 **CommsStore** 原子单元（outbox/inbox/reconnect/close），含至运行时端口的持久 saga。
7. 钉定 **A2A profile `a2a/0.1`** 用于适配器兼容性矩阵（参考适配器 + CI 用 loopback）。

### Admission → reconnect 接缝

```text
control-plane schema admission commit
  → SchemaAdmissionReceipt (core)
  → AdmissionReconnectPlan (comms, planDigest)
  → dynamicPartnerAdmission (newChannel) [future network]
  → instanceReconnect (reconnect)
  → runtime commit (RuntimeCommitPort)
  → binding/channel CAS + occurrence journal
```

调用者**不得**提供自由格式的 `targetEpochId`；epoch/binding 来自已提交的 receipt。

### M3 已落地范围

| 子系统                        | 状态 |
| ----------------------------- | ---- |
| 15-family / 60-code registry  | ✅   |
| Peer descriptor + negotiation | ✅   |
| Wire v1 严格编解码器          | ✅   |
| Session 传输绑定              | ✅   |
| 持久 inbox/outbox（内存）     | ✅   |
| Reconnect 协调器 + 恢复       | ✅   |
| Quiescent close + force close | ✅   |
| CommsIngress + E-Stop         | ✅   |
| Loopback 传输                 | ✅   |
| 净化后的 CommsEvent 信封      | ✅   |
| L3–L5 测试                    | ✅   |

### 网络 / 传输随访（2026-08-15）

ADR-0018 **T0–T4 工程已落地**：loopback、`FileTransport`（owner+pid 身份）、
`NetTransport`（TLS 1.3 + mTLS 指纹钉扎），以及钉定的 `a2a/0.1` harness（CI
门禁）。Boot 现调用生产 `createCommsServices`（无静默 Memory\* 默认），带 hub
路由与会话泵。P1–P2（A1–A5）因此**不再**列为开放工程缺口。

**仍开放（不是 T0–T4）：**

- 公开 A2A 互操作市场主张 —— Owner C6；harness ≠ 授权
- Product Conformance 证书 —— 未经 Owner 签署
- ADR-0008 / ADR-0018 的独立安全 / 威胁模型签核 —— Owner C2
- 分区 / 重连风暴套件仍在扩展（见 COMMS-DESIGN-CLOSURE）

DLQ 授权回放（`dlqAuthorizedReplay`）与可观测性 comms 桥接已有工程实现；它们
不解除 C2/C6。

## 威胁模型摘要

见 `docs/adr/0008-comms-threat-model.md`（伴生文档）。关键边界：网络身份 → `ActorRef`、重放窗口、endpoint 允许列表、仅按引用传递的 payload、ingress/send/reconnect/retry 上的 E-Stop。

## 后果

- 运行时仍是唯一的协作变更者；comms 经端口产出 `ObservationEntry`。
- 控制面集成测试必须将 `admissionReceipt` 传入 reconnect API。
- 形式化 Lean 证明不覆盖 comms 包——须单独提供符合性证据。

## 批准

**DRI 签字**：Joker-of-Gotham
**日期**：2026-08-11
