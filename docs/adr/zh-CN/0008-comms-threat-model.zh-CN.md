# ADR-0008：通信威胁模型

| 字段     | 值                                                                                          |
| -------- | ------------------------------------------------------------------------------------------- |
| Status   | **Accepted**（0.x 工程；Owner + 独立 Security：Joker-of-Gotham，COI 已披露）。未进入 FCP。     |
| Date     | 2026-08-11                                                                                  |
| Revised  | 2026-08-16 — 公开 A2A 1.0.0（ADR-0027）；本轮 0.x 的 C2 已由 Owner 兼任签署（COI）            |
| Related  | ADR-0004、ADR-0003、ADR-0018、RFC-0001                                                      |

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
- ReplayProtector 摘要窗口 —— 可注入 process/file 适配器（生产 `createCommsServices` 禁止静默 Memory\* 默认）
- SessionAuthority 在发送时进行 controller/member 检查 —— **已落地**
- 入口/发送/重连上的 E-Stop —— **已落地**
- HmacIdentityVerifier —— **已落地**（mesh 默认 ActorId 钉扎；HMAC 可选）
- FileCommsStore 损坏快照 fail-closed —— **已落地**
- MessagingSagaCoordinator + 投递状态 —— **已落地**；特权 DLQ 回放仍为残差（A20）
- LoopbackTransport —— **已落地**
- FileTransport + EndpointIdentityVerifier（`file-owner-pid`）—— **已落地**（见 STRIDE 增量）
- NetTransport TLS 1.3 + mTLS + 指纹钉扎 —— **已落地**（ADR-0018 T3）
- A2A `a2a/0.1` 一致性 harness —— **CI 门禁**；公开互操作主张 —— **Owner 门 C6**

## 生产传输 STRIDE 增量（2026-08-15）

### FileTransport（同主机跨进程）

| STRIDE | 威胁 | 缓解 |
| ------ | ---- | ---- |
| Spoofing | 伪造 `endpoint-identity.json`（假 pid/owner） | 校验 `record.owner === resolveStoreOwner(storeRoot)`；失败则 E-Stop 冻结 |
| Tampering | 收件箱改写/乱序 | at-least-once 帧 + 入口 replay + 幂等 claim |
| Repudiation | 否认收发 | 生产组合强制 event sink |
| Information disclosure | 读他人 outbox | 目录 ACL + 每端独立根 + ActorRef↔owner+pid |
| Denial of service | 帧洪泛 | maxFrameBytes；身份失败冻结 |
| Elevation of privilege | 冒充 ActorRef | actorRef 与期望 peer 一致且 owner 对齐 FS |

**残差（File）：** pid 存活性 / OS ACL 依赖主机；跨主机须用 Net mTLS。

### NetTransport（跨主机）

| STRIDE | 威胁 | 缓解 |
| ------ | ---- | ---- |
| Spoofing | 假证书 | TLS 1.3 + mTLS + 指纹钉扎 |
| Tampering | 线路改写 | TLS + 严格 net frame |
| Elevation | 无指纹发布目录 | `MeshHostDirectory.publish` 空指纹 fail-closed（ADR-0019 S4） |

## 残余风险（Stop-Ship / Owner）

- 特权 DLQ 回放授权路径 —— 工程残差 A20
- 本轮 0.x 独立 Security —— **C2 已签**：Joker-of-Gotham（COI 已披露，2026-08-15）。FCP 前仍须外部 Security。
- CommsProductCertificate —— 不自动签（G11）
- CI 用双进程 mTLS 对抗套件代替真双机 LAN（G12）

**DRI 签署**：Joker-of-Gotham（2026-08-15；COI 已披露）。此为 0.x 工程 Acceptance，不是 FCP。
