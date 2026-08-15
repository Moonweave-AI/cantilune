# ADR-0008：通信威胁模型

| 字段    | 值                                                                              |
| ------- | ------------------------------------------------------------------------------- |
| Status  | **Draft**（草案）—— M2–M3 原型；生产 FCP 之前须进行外部安全审查（**required**） |
| Date    | 2026-08-11                                                                      |
| Related | ADR-0004、ADR-0003、RFC-0001                                                    |

## 威胁主体

| 主体           | 能力                 | 资产                |
| -------------- | -------------------- | ------------------- |
| 远端对等节点   | 发送帧、握手、ack    | 会话、收件箱、绑定  |
| 被攻陷的 agent | 伪造主体声称         | 会话成员关系        |
| 操作员         | 重连、关闭、DLQ 重放 | Occurrence 日志     |
| 存储注入器     | 部分写入、重排序     | 发件箱/收件箱、序列 |

## 缓解措施（已实现 / 进行中）

- 严格线路编解码器（SHA-256 完整性、字段校验）—— **已落地**
- 入口 fail-closed 流水线（identity → expiry → replay → authz → inbox）—— **已落地**
- 不透明密封认证 / 已验证信封能力 —— **已落地**
- ReplayProtector 摘要窗口 —— 部分（内存；持久化重放待定）
- SessionAuthority 在发送时进行 controller/member 检查 —— **已落地**
- 入口/发送/重连上的 E-Stop —— **已落地**
- HmacIdentityVerifier（时序安全、拒绝空 actor）—— **已落地**
- FileCommsStore 在快照损坏时 fail-closed —— **已落地**
- MessagingSagaCoordinator + 投递状态更新 —— **进行中**
- A2A 适配器 —— **仅实验性进程内**

## 残余风险（关闭前 Stop-Ship）

- 无实时外部 A2A 互操作性 oracle
- Saga 阶段在 store 中尚未完全持久化
- 缺乏完整 runtime/control-plane 接线的生产组合
- 独立安全审查人签署 —— **OPEN**
- 通过 `@cantilune/conformance` 的 CommsProductCertificate

## 残余风险

- 尚无生产 TLS/mTLS
- 默认接线中使用 IdentityVerifier 桩
- 仅内存 store —— 无跨进程 CAS
- A2A 互操作性未经独立认证

**DRI 签署**：Joker-of-Gotham —— 2026-08-11
