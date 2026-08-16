# ADR-0027: Public A2A Protocol 1.0.0

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0004, ADR-0008, ADR-0018                                         |
| Canonical spec | https://a2a-protocol.org/latest/specification/ (Released 1.0.0)      |

## Context

Owner authorized a public A2A interoperability claim and a full 1.0.0 implementation. The pinned `a2a/0.1` harness is insufficient for that claim. A2A 1.0.0 layers: data model (AgentCard, Task, Message, Part, Artifact), operations, bindings (JSON-RPC, gRPC, HTTP/REST). Streaming and push are required.

## Decision

1. `@cantilune/comms` implements A2A 1.0.0 data model + Send/Stream/Get/List/Cancel Task + Get Agent Card + push.
2. Bindings: JSON-RPC 2.0, HTTP/REST, SSE streaming, and the official gRPC service `lf.a2a.v1.A2AService` from [specification/a2a.proto](https://github.com/a2aproject/A2A/blob/v1.0.0/specification/a2a.proto) via `@grpc/grpc-js` + `@grpc/proto-loader`. JSON-RPC/REST/gRPC share one `A2AOperationEngine`. Agent Card discovery stays on HTTP `/.well-known/agent-card.json` (the proto has no GetAgentCard RPC). A JSON gRPC frame mapper remains for hosts that already own a transport.
3. Public claim is **A2A 1.0.0 compliant**, not “every future draft.”
4. Existing `a2a/0.1` harness remains as a regression profile.
5. Untrusted-network controls in ADR-0008 still apply (mTLS, pin, deny-by-default).

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
