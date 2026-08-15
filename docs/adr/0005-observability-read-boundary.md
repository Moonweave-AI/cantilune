# ADR-0005: Observability Read Boundary and Access Policy

| Field          | Value                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (M2–M3 engineering prototype scope)                                                                                      |
| Date           | 2026-08-11                                                                                                                            |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                 |
| Reviewers      | Joker-of-Gotham (DRI，兼任 Architecture second reader；COI 见 `reviewer-assignments.md`)；形式化 ProjectionCertificate 独立审查仍开放 |
| Related        | RFC-0001 §7, RFC-0002, ADR-0002, ADR-0003, `docs/spec/observable-lts-policies.md`, `@cantilune/observability`                         |

## Context

A 2026-08-11 code review found `@cantilune/observability` could not yet be frozen as a trusted read-only observation boundary. Among other gaps, the package had no defined **access policy**: the public API returned full terminal snapshots (private sessions, capabilities, internal changes) without principal, scope, or field redaction.

This ADR records the **observability-local read boundary** for M2–M3 prototype scope. Formal `ProjectionCertificate` verification remains owned by `@cantilune/conformance` (planned).

## Decision

**M2–M3 default:** `@cantilune/observability` is a **trusted internal read API**.

| Aspect              | M2–M3 rule                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Callers             | Same process / same trust zone as runtime (dashboard, debug tooling, integration tests, control-plane)      |
| Principal / scope   | **Not required** on `observeCommitted()`; caller is assumed fully authorized for the runtime store it reads |
| Data returned       | Full terminal `CollaborationSnapshot`, full change window, full four read angles                            |
| Write path          | **Forbidden** — observability MUST NOT call runtime admit/commit/apply                                      |
| Output immutability | Returned `FourViewBundle` MUST be deep-cloned + frozen at the package boundary (see `immutableBoundary.ts`) |
| Evidence            | `ReadModelDerivationEvidence` is optional engineering self-check; **not** a formal projection certificate   |

**Future (post-M3 / production-facing):** introduce `ObservationAccessContext` on the stable facade:

```typescript
interface ObservationAccessContext {
  readonly principal: ActorRef;
  readonly scope: Footprint; // or policy-derived readable scope
  readonly visibilityPolicy: ObservableLtsPolicy; // external vs administrative
}
```

Production-facing SDK/UI MUST NOT call observability without that context once exposed beyond the trust zone.

## Observable vs administrative visibility

Core already tags changes with `ChangeVisibility` (`external` | `administrative`). Observability MUST:

1. Keep **Raw EventSpine** complete (all committed changes in the window).
2. Apply **read-angle filters** so dependency/resource/communication/coordination-structure views hide or mark administrative changes per `observable-lts-policies.md`.
3. Document which invariants (E1–E7, O6 evidence) apply to filtered vs raw slices.

M2–M3 ships filtering in-engine; policy tables remain configurable only via internal options, not public principal API.

## Trust boundaries

```
Runtime durable store (authoritative)
        │ read-only ports: head · getSnapshot · changesSince · runHistory
        ▼
ObservationCut (atomic sinceRef→headRef validation)
        ▼
ObservationWorld + EventSpine + four read angles
        ▼
CrossViewInvariants + optional ReadModelDerivationEvidence
        ▼
Frozen FourViewBundle (consumer MUST NOT mutate)
```

| Boundary             | Rule                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| Input                | Only via `ObservationReadPorts`; no direct store mutation                               |
| Historical snapshots | Every `beforeRef`/`afterRef` resolved strictly; no terminal fallback                    |
| Concurrent commits   | Cut reader double-reads head and retries or fails closed on torn window                 |
| Output               | Deep clone + `Object.freeze`; mutation of returned bundle MUST NOT affect runtime store |
| Formal certificates  | `ProjectionCertificate` reserved for `@cantilune/conformance`; not re-exported here     |

## Consequences

### Positive

- Clear separation: engineering read models vs formal conformance proofs.
- Internal tooling can consume full snapshots without premature RBAC complexity.
- Immutable output closes the “TypeScript-only readonly” bypass found in review.

### Negative / deferred

- External/multi-tenant dashboards cannot rely on observability alone for redaction until `ObservationAccessContext` lands.
- Administrative filtering policy is not yet user-configurable at the public API surface.
- L7 durable/cross-process observe-cut tests remain runtime+observability joint work.

## Compliance checklist (M2–M3)

- [x] Public export surface narrowed to facade + invariant types
- [x] `ReadModelDerivationEvidence` replaces informal “certificate” naming
- [x] Atomic observation cut + since→head closure
- [x] Immutable bundle boundary
- [x] Administrative visibility filter in read angles
- [ ] `ObservationAccessContext` on public API (deferred)
- [ ] `@cantilune/conformance` owns formal `ProjectionCertificate` (deferred)

## Approval

**DRI Signature**: Joker-of-Gotham  
**Date**: 2026-08-11  
**Decision Reference**: observability Request Changes review (2026-08-11), RFC-0001 §7, `observable-lts-policies.md`
