# ADR-0006: Control-Plane Schema Admission and Epoch Activation

| Field          | Value                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (M3 in-process scope; production epoch recovery Stop-Ship reopened 2026-08-13; FCP review pending)                               |
| Date           | 2026-08-11                                                                                                                                    |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                                         |
| Reviewers      | Joker-of-Gotham (DRI interim Architecture + Security); external independent review before FCP — see `docs/governance/reviewer-assignments.md` |
| Related        | RFC-0001 §7, ADR-0003, ADR-0007, ADR-0005, `@cantilune/control-plane`, `@cantilune/runtime`, `@cantilune/conformance`, formal Signature.lean  |

> **QA correction — 2026-08-13:** the claim that cross-process epoch recovery is
> closed is suspended. `MemoryEpochAdministration` keeps its prepared/committed
> receipt journal in process memory, so a crash after durable head CAS and
> before holder/journal update cannot be recovered from `admissionId`. M3
> in-process behavior remains implemented, but production/FCP epoch atomicity is
> Stop-Ship pending a durable epoch journal or an approved authenticated
> recovery protocol. See ADR-0012 and
> `docs/qa/0012-agent-execution-continuity-qa.md`.

## Context

Prior `@cantilune/control-plane` stubs treated registry writes as activation and allowed caller-supplied authorization strings. Runtime captured static schema at construction time. A Stop-Ship review (2026-08-11) found split-brain commit ordering, forgeable prepared tokens, and non-durable file recovery.

Distributed control-plane semantics are covered by **ADR-0007** (threat model). This ADR records engineering decisions and M3 delivery scope.

## Decision

Implement control-plane as an **immutable schema/policy catalog + server-validated qualification/authorization + evidence-bound four-view admission + CAS epoch activation** boundary, separate from business `CoordinationIntent` admission.

### M3 scope (landed in repo)

| Capability                                                                                 | Status                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Branded control-plane IDs in `@cantilune/core`                                             | ✅                                  |
| `AdministrationContext` + role-based qualification/authorization evaluators                | ✅                                  |
| Four-view evidence bound to admission subject (`@cantilune/conformance`)                   | ✅                                  |
| Server-side `PreparedAdmissionRecord` + opaque commit handle                               | ✅                                  |
| Two-phase commit: `decided → runtime_applied → finalized` + forward recovery               | ✅                                  |
| Immutable schema revisions + wire codec                                                    | ✅                                  |
| Strict ingress wire codec (unknown field rejection) on administration commands             | ✅                                  |
| Memory + file durable store (Map-safe snapshot, decisions, receipts, events)               | ✅                                  |
| Cross-process binding CAS via file lock + `casActiveBindingDurable`                        | ✅                                  |
| Runtime `MemoryEpochAdministration` + live `schemaContext` holder + in-process idempotency | ⚠️ cross-process recovery Stop-Ship |
| Policy activation: binding CAS + runtime `onPolicyActivated` notification                  | ✅                                  |
| L5 contract negatives + L6 live schema switch + L7 file recovery / OS CAS tests            | ✅                                  |
| ADR-0007 control-plane threat model                                                        | ✅                                  |

### Still deferred (production / FCP exit)

- Independent external Security + Architecture sign-off (non-DRI)
- Lean proof bridge to four-view certificates
- Multi-tenant activation domains + networked administration API (mTLS/HSM)
- Fleet rollout durable reconciliation journal
- Mutation testing on auth/CAS branches

## Key invariants

1. Schema revision content is immutable after registration; digest verified on read.
2. Registration does not activate; activation requires admission + runtime commit + binding CAS.
3. Qualification and authorization require trusted `AdministrationContext` — not caller strings.
4. Prepared tokens are server records; clients receive opaque handles only.
5. Four-view evidence must match admission subject (domain, epochs, plan digest, head).
6. Commit is two-phase: durable decision, idempotent runtime apply, atomic finalize with forward recovery.
7. Policy activation bumps binding generation and notifies runtime via hook.
8. Proposer cannot self-approve (`separation_of_duties_violation`).

## Consequences

- Runtime wiring MUST use mutable `schemaContext` holder or resolver — static capture removed from admit/replay paths.
- Breaking schema changes require a new schema family; monotone extension preserves existing declarations.
- Observability consumes admission receipts as epoch boundaries; it does not perform admission.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Architecture / Security Review**: Joker-of-Gotham (interim, COI disclosed) — external reviewer pending FCP  
**Date**: 2026-08-11
