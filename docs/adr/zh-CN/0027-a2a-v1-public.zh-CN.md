# ADR-0027：公开 A2A 协议 1.0.0

| 字段       | 值                                                               |
| ---------- | ---------------------------------------------------------------- |
| 状态       | **Accepted**                                                     |
| 日期       | 2026-08-15                                                       |
| 决策负责人 | Joker-of-Gotham                                                  |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露）      |
| 相关       | ADR-0004、ADR-0008、ADR-0018                                     |
| 规范权威   | https://a2a-protocol.org/latest/specification/（Released 1.0.0） |
| 取代       | 无                                                               |
| 被取代     | 无                                                               |

> 英文正文为唯一权威来源：[`docs/adr/0027-a2a-v1-public.md`](../0027-a2a-v1-public.md)。

## 背景

Owner 授权公开 A2A 互操作主张，并要求完整实现 1.0.0。钉死的 `a2a/0.1` harness 不足以支撑该主张。A2A 1.0.0 分层：数据模型（AgentCard、Task、Message、Part、Artifact）、操作、绑定（JSON-RPC、gRPC、HTTP/REST）。流式与 push 为必需。

## 决策

1. `@cantilune/comms` 实现 A2A 1.0.0 数据模型 + Send/Stream/Get/List/Cancel Task + Get Agent Card + push。
2. 绑定：JSON-RPC 2.0、HTTP/REST、SSE 流式，以及官方 gRPC 服务 `lf.a2a.v1.A2AService`（[specification/a2a.proto](https://github.com/a2aproject/A2A/blob/v1.0.0/specification/a2a.proto)，`@grpc/grpc-js` + `@grpc/proto-loader`）。JSON-RPC/REST/gRPC 共用同一 `A2AOperationEngine`。Agent Card 发现仍走 HTTP `/.well-known/agent-card.json`（官方 proto 没有 GetAgentCard RPC）。JSON gRPC frame mapper 留给已自带传输的宿主。
3. 公开主张是 **A2A 1.0.0 符合**，不是「每一个未来草案」。
4. 既有 `a2a/0.1` harness 作为回归 profile 保留。
5. ADR-0008 的不可信网络控制仍然适用（mTLS、钉扎、默认拒绝）。

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-15
