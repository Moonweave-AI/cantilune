# ADR-0022：Namespace RBAC 与 Transcript 访问授权

| 字段       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| 状态       | **Accepted**                                                |
| 日期       | 2026-08-15                                                  |
| 决策负责人 | Joker-of-Gotham                                             |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露） |
| 相关       | ADR-0021、ADR-0005、ADR-0006、ADR-0007                      |
| 取代       | 无                                                          |
| 被取代     | 无                                                          |

> 英文正文为唯一权威来源：[`docs/adr/0022-namespace-rbac-transcript-access.md`](../0022-namespace-rbac-transcript-access.md)。

## 背景

Fleet 管理必须成为跨租户控制台，而不能共享一份明文世界。Temporal 与 Kubernetes 用 Namespace + RBAC 隔离，而不是「一个管理员看见每一段对话」。

## 决策

1. Core `CollaborationNamespace` + `Participant.namespaceId`（缺省 `default`）。
2. 控制面 RBAC：每个 Namespace 的 `admin` / `member` / `observer`。
3. 跨命名空间默认：仅元数据 + `summarizeTranscript`。
4. `TranscriptAccessRequest` 是已提交的世界状态。**只有被看历史的 Actor** 可以批准、拒绝或撤销。
5. 批准物化为 `ScopedCapability`，kind 为 `transcript_read`，作用域为 `{ kind: "transcript", actorId, namespaceId }` —— 不另起平行授权类型。
6. 超管 fleet 视图不得绕过脱敏。

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-15
