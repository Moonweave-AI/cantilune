# ADR-0004: Comms Facet and A2A Transport

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Status         | **Accepted** (M3 engineering scope — network Stop-Ship gates documented) |
| Date           | 2026-08-11                                                               |
| Decision Owner | Joker-of-Gotham (DRI)                                                    |
| Reviewers      | Joker-of-Gotham (**Accepted** M4); external Security reviewer before FCP |
| Related        | RFC-0001 §7, ADR-0003, ADR-0006, `@cantilune/comms`, formal Cantilune/Pi |

## Context

RFC-0001 defines comms as the π-calculus communication facet with A2A-compatible transport. Prior `@cantilune/comms` exposed only an echo `instanceReconnect()` stub. Theory requires typed late-π occurrences (15 families / 60 registry codes), durable delivery, admission-bound reconnect, and runtime-authoritative state mutation.

## Decision

Implement `@cantilune/comms` as a **protocol package** that:

1. Reuses `@cantilune/core` `CommunicationSession`, `ActorRef`, branded IDs — no parallel session types.
2. Consumes authoritative `SchemaAdmissionReceipt` via **`AdmissionReconnectPlan`** (ADR option 2 — signed plan binding receipt + session + template + endpoints).
3. Persists **CommunicationOccurrenceRecord** with registry-derived family, native action, footprint, and evidence refs.
4. Separates four state axes: π phase, occurrence lifecycle, endpoint disposition, transport delivery.
5. Enforces strict **wire v1** ingress with unknown-field rejection.
6. Uses **CommsStore** atomic units (outbox/inbox/reconnect/close) with durable saga to runtime ports.
7. Pins **A2A profile `a2a/0.1`** for adapter compatibility matrix (reference adapter + loopback for CI).

### Admission → reconnect seam

```text
control-plane schema admission commit
  → SchemaAdmissionReceipt (core)
  → AdmissionReconnectPlan (comms, planDigest)
  → dynamicPartnerAdmission (newChannel) [future network]
  → instanceReconnect (reconnect)
  → runtime commit (RuntimeCommitPort)
  → binding/channel CAS + occurrence journal
```

Caller MUST NOT supply free-form `targetEpochId`; epoch/binding come from committed receipt.

### M3 landed scope

| Subsystem                        | Status |
| -------------------------------- | ------ |
| 15-family / 60-code registry     | ✅     |
| Peer descriptor + negotiation    | ✅     |
| Wire v1 strict codec             | ✅     |
| Session transport binding        | ✅     |
| Durable inbox/outbox (memory)    | ✅     |
| Reconnect coordinator + recovery | ✅     |
| Quiescent close + force close    | ✅     |
| CommsIngress + E-Stop            | ✅     |
| Loopback transport               | ✅     |
| Sanitized CommsEvent envelope    | ✅     |
| L3–L5 tests                      | ✅     |

### Deferred (network Stop-Ship)

- File-backed CommsStore + cross-process L7
- Production IdentityVerifier / TLS / mTLS
- Pinned A2A interop certification harness
- Full send/receive/ack runtime consumer integration
- DLQ replay privileged workflow
- Observability package wiring
- Product Conformance certificates

## Threat model summary

See `docs/adr/0008-comms-threat-model.md` (companion). Key boundaries: network identity → `ActorRef`, replay window, endpoint allowlist, payload by reference only, E-Stop on ingress/send/reconnect/retry.

## Consequences

- Runtime remains sole collaboration mutator; comms produces `ObservationEntry` via ports.
- Control-plane integration tests must pass `admissionReceipt` into reconnect API.
- Formal Lean proofs do not cover comms package — conformance evidence required separately.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Date**: 2026-08-11
