# ADR-0008: Comms Threat Model

| Field   | Value                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| Status  | **Accepted** (0.x engineering; Owner + independent Security: Joker-of-Gotham, COI disclosed). FCP still not entered. |
| Date    | 2026-08-11                                                                               |
| Revised | 2026-08-16 — public A2A 1.0.0 (ADR-0027); C2 signed for this 0.x release (COI)           |
| Related | ADR-0004, ADR-0003, ADR-0018, RFC-0001                                                   |

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
- ReplayProtector digest window — process/file adapters injectable (no silent Memory default in production `createCommsServices`)
- SessionAuthority controller/member checks on send — **landed**
- E-Stop on ingress/send/reconnect — **landed**
- HmacIdentityVerifier (timing-safe, empty-actor reject) — **landed** (optional boot pin; ActorId verifier is mesh default)
- FileCommsStore fail-closed on corrupt snapshot — **landed**
- MessagingSagaCoordinator + delivery state updates — **landed**; privileged DLQ replay still residual (A20)
- LoopbackTransport — **landed**
- FileTransport + EndpointIdentityVerifier (`file-owner-pid`) — **landed** (see STRIDE delta)
- NetTransport TLS 1.3 + mTLS + fingerprint pin — **landed** (ADR-0018 T3)
- A2A `a2a/0.1` conformance harness — **CI gate**; public interop claim is **A2A 1.0.0** (ADR-0027, Owner C6 authorized 2026-08-15)

## Production transport STRIDE delta (2026-08-15)

### FileTransport (same-host cross-process)

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| Spoofing | Attacker writes a forged `endpoint-identity.json` (fake pid/owner) under a peer store | Verifier requires `record.owner === resolveStoreOwner(storeRoot)` and presented owner matches; forged owner fail-closes and freezes E-Stop before peek |
| Tampering | Inbox frame rewrite / reorder | At-least-once file frames + ingress replay protector + idempotent claim |
| Repudiation | Deny send/receive | Occurrence / event sink adapters (process/file) required in production composition |
| Information disclosure | Reading another agent's outbox | OS directory ACL + distinct outbox/inbox roots per endpoint; identity binds ActorRef↔owner+pid |
| Denial of service | Flood frames / lock files | maxFrameBytes; E-Stop freeze on identity failure |
| Elevation of privilege | Claim another ActorRef via sidecar | `actorRef` must match expected peer; owner must match FS truth |

**Residual (File):** pid liveness / OS ACL enforcement is host-dependent; not a substitute for Net mTLS across hosts.

### NetTransport (cross-host)

| STRIDE | Threat | Mitigation |
| ------ | ------ | ---------- |
| Spoofing | Fake peer certificate | TLS 1.3 + mTLS + `EndpointIdentityVerifier` fingerprint pin |
| Tampering | Wire rewrite | TLS record layer + strict net frame codec |
| Elevation | Directory publish without fingerprint | `MeshHostDirectory.publish` fail-closed when fingerprint empty (ADR-0019 S4) |

## Residual risks (Stop-Ship / Owner)

- Privileged DLQ replay authorization path — engineering residual A20
- Independent Security for this 0.x release — **C2 signed** by Joker-of-Gotham (COI disclosed, 2026-08-15). External Security still required before FCP.
- CommsProductCertificate via `@cantilune/conformance` — not auto-signed (G11)
- Dual-process mTLS adversarial suites are the CI stand-in for dual-machine LAN (G12)

**DRI Signature**: Joker-of-Gotham (2026-08-15; COI disclosed). This is 0.x engineering Acceptance, not FCP.
