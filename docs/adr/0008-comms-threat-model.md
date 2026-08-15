# ADR-0008: Comms Threat Model

| Field   | Value                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| Status  | **Draft** — M2–M3 prototype; external Security review **required** before production FCP |
| Date    | 2026-08-11                                                                               |
| Related | ADR-0004, ADR-0003, RFC-0001                                                             |

## Threat actors

| Actor             | Capability                    | Assets                    |
| ----------------- | ----------------------------- | ------------------------- |
| Remote peer       | Sends frames, handshake, acks | Sessions, inbox, bindings |
| Compromised agent | Forges principal claims       | Session membership        |
| Operator          | Reconnect, close, DLQ replay  | Occurrence journal        |
| Storage injector  | Partial writes, reorder       | Outbox/inbox, sequences   |

## Mitigations (implemented / in progress)

- Strict wire codec (SHA-256 integrity, field validation) — **landed**
- Ingress fail-closed pipeline (identity → expiry → replay → authz → inbox) — **landed**
- Opaque sealed auth / verified envelope capabilities — **landed**
- ReplayProtector digest window — partial (memory; durable replay TBD)
- SessionAuthority controller/member checks on send — **landed**
- E-Stop on ingress/send/reconnect — **landed**
- HmacIdentityVerifier (timing-safe, empty-actor reject) — **landed**
- FileCommsStore fail-closed on corrupt snapshot — **landed**
- MessagingSagaCoordinator + delivery state updates — **in progress**
- A2A adapter — **experimental in-process only**

## Residual risks (Stop-Ship until closed)

- No live external A2A interop oracle
- Saga phase not fully durable in store
- Production composition without full runtime/control-plane wiring
- Independent Security reviewer sign-off — **OPEN**
- CommsProductCertificate via `@cantilune/conformance`

## Residual risks

- No production TLS/mTLS yet
- Stub IdentityVerifier in default wiring
- Memory store only — no cross-process CAS
- A2A interop not independently certified

**DRI Signature**: Joker-of-Gotham — 2026-08-11
