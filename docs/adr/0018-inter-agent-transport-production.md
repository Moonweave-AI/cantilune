# ADR-0018: Inter-Agent Transport — Production Wire, Endpoint Authority, and Cross-Process Delivery

| Field          | Value                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (2026-08-15 Owner + independent Architecture/Security: Joker-of-Gotham, COI disclosed)      |
| Date           | 2026-08-14                                                                                               |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                    |
| Reviewers      | Independent Architecture + Security/Threat-Model reviewer required before Acceptance (COI: Owner is DRI) |
| Related        | RFC-0001 §7, ADR-0003, ADR-0004, ADR-0007, ADR-0008, ADR-0015, `@cantilune/comms`, formal Cantilune/Pi   |
| Supersedes     | None (extends ADR-0004 M3 loopback scope to production wire)                                             |
| Superseded by  | None                                                                                                     |

## Context

ADR-0004 accepted `@cantilune/comms` at **M3 engineering scope** with a **loopback transport** and explicitly deferred production network surfaces as network Stop-Ship gates:

> Deferred (network Stop-Ship): File-backed CommsStore + cross-process L7; Production IdentityVerifier / TLS / mTLS; Pinned A2A interop certification harness; Full send/receive/ack runtime consumer integration.

The whole-project audit (finding **D1**) recorded that **inter-agent transport is not implemented** — the loopback transport resolves every `dynamicPartnerAdmission` / `instanceReconnect` in-process; no two Cantilune processes have ever exchanged a `CommunicationOccurrenceRecord` over a real wire. The π-calculus communication facet therefore exists as a typed, durable, admission-bound _protocol package_ but not as a _transport_.

This ADR closes that gap by specifying the production wire without re-opening the M3 protocol decisions (15-family/60-code registry, wire v1 strict codec, `AdmissionReconnectPlan`, `CommsStore` atomic units, `a2a/0.1` profile — all unchanged).

### Non-negotiable constraints (carried from ADR-0004/0007/0008)

1. Runtime remains the sole collaboration mutator; transport produces `ObservationEntry` via ports, never writes the collaboration world directly.
2. `ActorRef` is the network identity; no free-form `targetEpochId` — epoch/binding come from the committed `SchemaAdmissionReceipt`.
3. Payload is **by reference only** (`ContentRef`); no inline secrets in published evidence roots.
4. E-Stop must fire on ingress / send / reconnect / retry.
5. Unknown fields are rejected on the wire (strict v1).
6. Formal Lean proofs do not cover the comms package; production transport requires Product Conformance evidence separately.

## Decision

### 1. Transport is a swappable port behind the existing protocol surface

The M3 `Transport` port already exists (loopback is one instance). Production adds two realizations behind the **same** port so the protocol layer, wire codec, `CommsStore` units, and reconnect coordinator are untouched:

| Transport           | Scope                                | Use                                   |
| ------------------- | ------------------------------------ | ------------------------------------- |
| `LoopbackTransport` | in-process (existing, M3)            | CI, unit tests, single-process demo   |
| `FileTransport`     | cross-process via a shared directory | local multi-process swarm on one host |
| `NetTransport`      | cross-host over TCP+TLS              | production multi-host swarm           |

`FileTransport` is the **minimum production cross-process transport** (unblocks the multi-host swarm without inventing a certificate authority). `NetTransport` is the full production surface. Both implement the same `Transport` interface; selection is a `BootConfig` choice, never a protocol change.

### 2. Endpoint authority: `ActorRef` ↔ transport identity binding

- Each `ActorRef` binds to exactly one transport endpoint, resolved through the `AdmissionReconnectPlan` (ADR-0004 option 2). The plan's `planDigest` already binds receipt + session + template + endpoints.
- A new **`EndpointIdentityVerifier`** port (replacing the M3 stub) confirms that a presented peer identity matches the `ActorRef` the receipt committed. `FileTransport` verifies by filesystem ACL + process pid; `NetTransport` verifies by mTLS certificate fingerprint pinned in the receipt.
- `provenanceUnavailable` flag (RFC-0004 §11.2 pattern) is required when a peer endpoint cannot be pinned; such sessions MUST NOT carry publishable superiority claims without reviewer exception.

### 3. Cross-process delivery and durability (closes the cross-process L7 gate)

- `CommsStore` gains a **file-backed** atomic unit implementation alongside the existing memory one. The outbox/inbox/reconnect/close units are journaled to a content-addressed store (reusing `@cantilune/content`'s file store), so a process crash mid-saga resumes from the last committed unit — mirroring ADR-0014's durable epoch journal and ADR-0016's pre-invocation journal.
- Delivery is **at-least-once** with idempotent receivers keyed by `occurrenceRecordId`; this composes with the syscall exactly-once tiers (ADR-0016) so an external tool invocation triggered by a remote message is not double-executed across a transport retry.
- A cross-process **L7 crash test** (parallel to `epoch-transition-crash-atomic.test.ts` and `toolInvocationCrashBoundaries.test.ts`) kills a peer mid-send and verifies the fresh process redrives from the durable outbox without duplicate delivery to an idempotent receiver.

### 4. E-Stop and safe state on the wire

- Ingress/send/reconnect/retry each carry an E-Stop check. A transport-level E-Stop (e.g., TLS handshake failure, endpoint identity mismatch, replay-window violation) enters **safe state**: the session is quiesced, no further sends are attempted, and an `EStopEvent` is emitted through the sanitized `CommsEvent` envelope.
- Safe state is **non-destructive**: the durable outbox is preserved so the operator can diagnose and, after authorization, replay; the collaboration world is not mutated by the transport failure.

### 5. Interop certification harness (pinned `a2a/0.1`)

- A reference adapter + loopback already pin `a2a/0.1`. Production adds a **`NetTransport` conformance harness** that exercises the pinned profile against a reference adapter: wire-v1 strict codec round-trip, 15-family/60-code registry coverage, admission-bound reconnect sequencing, and E-Stop on each fault.
- The harness is a CI gate for `NetTransport`; `FileTransport` reuses the in-process harness. No public A2A interoperability claim is authorized until the harness is green AND an independent Security reviewer signs the threat model.

### 6. Observability package wiring

- Transport events flow through the sanitized `CommsEvent` envelope into `@cantilune/observability`. No raw payloads, secrets, or peer private material cross the observability boundary — the envelope is structural (family, action, phase, disposition, evidence refs) per ADR-0008.

## Threat model deltas (relative to ADR-0008)

| Concern            | ADR-0008 boundary (M3)       | This ADR (production)                                                     |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------- |
| Network identity   | `ActorRef`, in-process only  | `ActorRef` ↔ transport identity via `EndpointIdentityVerifier`            |
| Replay window      | in-memory                    | durable, tied to `occurrenceRecordId` + content-addressed outbox          |
| Endpoint allowlist | loopback (single process)    | receipt-pinned endpoints; `provenanceUnavailable` flag for unpinned       |
| Payload            | by reference, in-process     | by reference, content-addressed cross-process (no inline payload on wire) |
| TLS / mTLS         | n/a (loopback)               | `NetTransport` only; `FileTransport` relies on filesystem ACL             |
| E-Stop surface     | ingress/send/reconnect/retry | + transport-level (handshake, identity, replay-window faults)             |
| DLQ replay         | deferred                     | preserved outbox + operator-authorized privileged replay workflow         |

A companion **ADR-0008 amendment** (this ADR's Acceptance condition) updates the STRIDE mapping for the production transport surface. The full STRIDE mapping is reviewed by an independent Security/Threat-Model reviewer before Acceptance.

## Consequences

- `@cantilune/comms` gains a file-backed `CommsStore` and two real transports; the protocol layer, wire codec, and reconnect coordinator are unchanged (no re-open of ADR-0004 M3 decisions).
- The multi-host swarm (ADR-0015) becomes reachable over `FileTransport` (one host) and `NetTransport` (multi-host) instead of only in-process.
- Formal Lean coverage still excludes comms; production transport requires Product Conformance certificates per the formal scope boundary.
- This ADR does **not** authorize public A2A interoperability claims; those require the green conformance harness + independent Security review.

## Implementation stages (T0–T4)

| Stage  | Scope                                                                                       | Status                       |
| ------ | ------------------------------------------------------------------------------------------- | ---------------------------- |
| **T0** | `Transport` port already exists; `EndpointIdentityVerifier` port + `FileTransport` skeleton | Done (impl)                  |
| **T1** | File-backed `CommsStore` atomic units; durable outbox/inbox journaling                      | Done (impl)                  |
| **T2** | `FileTransport` cross-process delivery + idempotent receive + L7 crash test                 | Done (impl)                  |
| **T3** | `NetTransport` TCP+TLS+mTLS + `EndpointIdentityVerifier` mTLS path                          | Done (impl)                  |
| **T4** | `a2a/0.1` conformance harness as CI gate; Security review                                   | Done (impl) / Owner-accepted COI 2026-08-16 |

> "Done (impl)" denotes realized code with green automated tests and coverage
> gates; it is not ADR Acceptance. The T0–T2 rows previously read "Not started"
> while the Approval section below recorded T1 as realized — that contradiction
> is corrected here, not resolved by weakening the Approval note.

## Test / QA plan

| Tier  | Scope                                                                              | Status         |
| ----- | ---------------------------------------------------------------------------------- | -------------- |
| L2–L4 | Unit/contract for transport port, identity verifier, file store                    | Done (green)   |
| L5    | Architecture + Security/Threat-Model review                                        | Owner-accepted COI 2026-08-16 |
| L6    | Integration: admission → reconnect → `FileTransport` / `NetTransport` send/receive | Done (green)   |
| L7    | Cross-process crash mid-send; idempotent receive; transport E-Stop (file + net)    | Done (green)   |
| CI    | `a2a/0.1` conformance harness (loopback + file + net)                              | Done (green)   |

> **Cross-process evidence correction (2026-08-15).** The L7 row previously
> depended on `tests/system/file-transport-cross-process.test.ts`, which gated
> itself on `existsSync(dist/...)` and **skipped silently** when the package was
> unbuilt. Under `pnpm test` the workspace build raced the suite, so the two
> cross-process cases were reported as skipped rather than run — the evidence
> was never actually produced in that configuration. The suite now fails loudly
> on a missing `dist/`, and `@cantilune/comms` gained `pretest`/`pretest:coverage`
> hooks that build the package first. Comms is 305 tests green with both
> cross-process cases genuinely executing.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; T1 `FileTransport` realized. T3 `NetTransport` TCP+TLS 1.3+mTLS + T4 `a2a/0.1` harness realized 2026-08-15 — "Done (impl)" only.)
**Status**: Proposed. Acceptance requires: (1) Owner signature (design-approved above); (2) independent Architecture reviewer sign-off; (3) independent Security/Threat-Model reviewer sign-off on the ADR-0008 amendment; (4) green conformance harness (now implemented; the harness being green is not itself the Security sign-off). The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers. This update does **not** authorize public A2A interoperability claims.
