# ADR-0002: Core Engineering Boundaries — Runtime Topology, Replay Recipe, and Footprint Authority

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| Status         | **Accepted**                                                  |
| Date           | 2026-08-10                                                    |
| Decision Owner | Joker-of-Gotham (DRI)                                         |
| Related        | RFC-0001, `diagrams/00-naming-contract.md`, `@cantilune/core` |

## Context

A strict code review (2026-08-10) found drift between RFC-0001's static `CantiluneGraph` framing and the implemented `@cantilune/core` model where agents propose runtime topology via `CompositionIntent`, while observation views derive from committed facts. Additional blockers included non-replayable `CoordinationChange` targets, unsafe parallel footprint trust, and publish-risk in `@cantilune/core`.

## Decision

We adopt the following engineering boundaries for core and runtime:

### 1. Schema vs runtime topology

| Layer                                                              | Role                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `OrchestrationSchema`                                              | Static allowed space: object types, operation templates, port contracts |
| `CollaborationSnapshot`                                            | Current running collaboration world                                     |
| `CompositionIntent`                                                | Agent proposal to change live topology (write model)                    |
| Derived views (`deriveDiagnosticSummary`, future ObservationIndex) | Read-only projections from Snapshot + History — never write paths       |

Static schema **does not** mean a pre-authored dead runtime graph. Agents compose at runtime; structure is derived from committed changes.

### 2. Change as auditable receipt; replay recipe is explicit

`CoordinationChange` remains **payload-free**. Replay sufficiency is carried by:

- `operationTypeId` + optional versioned `templateRef`
- **`matchBindings`** (named roles: `task`, `from`, `to`, `capability`, …)
- legacy flat `targets` (derived from bindings; lossy fallback only)
- `beforeRef` / `afterRef`, `epochId`, evidence lists, `createdSessionRefs`
- future runtime fields: input ContentRef bindings, complement selectors, fresh entity refs

Until `@cantilune/runtime` implements `applyAdmittedChange`, Change is an **auditable receipt**, not a claim of independent replay.

### 3. Footprint authority (C-prime)

| Field                                     | Meaning                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `CompositionIntent.footprint`             | Agent-requested isolation scope (may be wider; must cover targets)           |
| `effectiveFootprintOfCompositionIntent()` | **Authoritative** touch set from `targets` (+ sessions on committed changes) |
| `compatibleConcurrently()`                | Uses **effective** footprint only                                            |
| Runtime `AdmittedIntent` (future)         | Opaque post-admission object with template-computed effective footprint      |

### 4. SnapshotRef identity

- `snapshotRef` identifies a **persisted snapshot version** (graph + auditTail + policyContext).
- In-memory helpers (`appendObservation`, `with*`) produce new objects but **do not** assign new refs.
- Callers must call `withSnapshotRef` at commit boundaries.
- `auditTail` is part of persisted identity for storage/replay alignment.

### 5. Derive minimal commitment

`deriveDiagnosticSummary` (formerly `deriveCompositionView`) is a **diagnostic summary only** — not for scheduling, concurrency, or structure projection until a follow-up ADR defines full projection semantics.

### 6. Package publish posture

`@cantilune/core` remains `"private": true` until LICENSE, prepack consumer tests, and runtime replay closure exist.

## Consequences

**Positive**

- Aligns RFC narrative with implemented three-pillar core
- Closes parallel safety hole (empty declared footprint + overlapping targets)
- Makes replay gaps explicit instead of implied
- Establishes consistency layer without reversing pillar dependency at runtime

**Negative / follow-ups**

- `@cantilune/runtime` must implement apply + replay before L6–L7 claims
- Wire DTO / codec for Map serialization still OPEN
- Full structure projection ADR still required
- ADR-0002 control-plane threat model (RFC-0001 §9) — runtime scope in **ADR-0003**; comms/network still gated

## Alternatives rejected

| Option                                 | Why rejected                                                    |
| -------------------------------------- | --------------------------------------------------------------- |
| Keep static CantiluneGraph as sole API | Contradicts implemented agent-composition write model           |
| Trust agent footprint for concurrency  | Proven unsafe (review counterexample)                           |
| Embed payload in Change for replay     | Violates core invariant I2                                      |
| Publish core immediately               | dist-only exports without consumer tests = false publish signal |

## Implementation tasks

- [x] `MatchBinding`, `effectiveFootprintOfCompositionIntent`, defensive snapshot copy
- [x] `consistency` module, `validateSnapshotIntegrity`, `CoreViolation`
- [x] `deriveDiagnosticSummary` rename + deprecation alias
- [x] `@cantilune/runtime`: OperationTemplateRegistry, AdmissionGateway, applyAdmittedChange, ReplayVerifier (M2 prototype)
- [ ] Wire DTO / canonical wire order → **@cantilune/runtime**（strict unknown 校验已落地）
- [x] CI: core typecheck + tests + build（coverage 可选：`pnpm test:coverage`）
- [x] CI: runtime typecheck + tests + lint + format + pack smoke（`.github/workflows/runtime.yml`）
