# ADR-0007: Control-Plane Threat Model and Administration Boundaries

| Field          | Value                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (M3 engineering scope — complements ADR-0003 runtime-local model)                                      |
| Date           | 2026-08-11                                                                                                          |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                               |
| Reviewers      | Joker-of-Gotham (DRI interim); external Security reviewer recruitment open before FCP (see governance doc)          |
| Related        | ADR-0003, ADR-0006, RFC-0001 §7, `@cantilune/control-plane`, `@cantilune/conformance`, `diagrams/04-control-plane/` |

## Context

ADR-0003 covers runtime-local admission/commit boundaries. Control-plane introduces a separate administration surface: schema/policy catalog writes, qualification/authorization, four-view evidence, prepared tokens, epoch activation CAS, and fleet rollout. Stop-Ship review (2026-08-11) required an explicit threat model before treating control-plane as a trusted activation authority.

## Threat actors and assets

| Actor                         | Capability                                                                 | Primary assets                                      |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| External API caller           | Submit wire DTOs for register/submit/approve/prepare/commit/policy/rollout | Schema catalog, active binding, admission audit log |
| Compromised proposer          | Attempt self-approval, forged evidence digests, stale CAS                  | Admission workflow integrity                        |
| Compromised operator          | Attempt commit without authorization roles                                 | Epoch activation, runtime schema head               |
| Split-brain operator pair     | Runtime epoch applied while binding CAS fails                              | Binding generation monotonicity                     |
| Storage fault injector        | Partial snapshot/journal writes, cross-process races                       | Durable binding head, commit decisions              |
| Malicious runtime participant | Cannot directly mutate catalog — must go through admission                 | Runtime head referenced by binding                  |

## Trust boundaries

```
Untrusted wire DTO ──► ingressWireCodec (strict keys) ──► AdministrationContext roles
        │                                                      │
        ├─ qualification evaluator ◄── schema-qualifier ───────┤
        ├─ authorization evaluator ◄── schema-authorizer ──────┤
        ├─ four-view verifier ◄── conformance bundle ──────────┤
        └─ prepared record (server-only) ──► opaque handle ────┘
                                   │
                     prepare ──► runtime epoch admin (readiness gates)
                                   │
                     commit ──► decided → runtime_applied → finalize (binding CAS)
                                   │
                     recovery ──► forward finalize when binding drift detected
```

| Boundary              | Rule                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Ingress               | Versioned wire codec rejects unknown fields; branded IDs parsed server-side               |
| Roles                 | `AdministrationContext` carries role set; proposer ≠ approver; commit requires authorizer |
| Prepared token        | Server `PreparedAdmissionRecord`; clients receive opaque handle only                      |
| Evidence              | Four-view bundle must match admission subject (domain, epochs, plan digest, runtime head) |
| Activation            | Binding bump via CAS on `(activationDomainId, bindingGeneration)`                         |
| Two-phase commit      | Durable `CommitDecisionRecord` tracks `decided → runtime_applied → finalized`             |
| Split-brain recovery  | `recovery_required` + `recoverForwardCommit` finalize when runtime already advanced       |
| Policy activation     | Policy revision registered + binding CAS + `onPolicyActivated` runtime notification hook  |
| Cross-process durable | File snapshot protected by `.control-plane.lock` + atomic rename on persist               |
| E-Stop                | `setFrozen` blocks register/submit/approve/prepare/commit/policy/rollout/ack              |

## Permission matrix (M3)

| Operation                | Required roles                         | Ensures                                              |
| ------------------------ | -------------------------------------- | ---------------------------------------------------- |
| Register schema revision | catalog-writer (service bootstrap)     | Immutable revision keyed by `(schemaId, revisionId)` |
| Submit admission         | schema-proposer + schema-qualifier     | Admission record in submitted state                  |
| Approve admission        | schema-authorizer (≠ proposer)         | Authorization evidence attached                      |
| Prepare admission        | schema-committer + valid four-view     | Server prepared record + runtime prepared epoch      |
| Commit admission         | schema-authorizer + valid prepared     | Binding generation +1, runtime schema head aligned   |
| Recover commit           | operator with existing decision record | Idempotent finalize or forward recovery              |
| Activate policy          | policy-admin + compatible schema       | Binding generation +1, policy ref updated            |
| Fleet rollout / ack      | rollout-admin / runtime-worker         | Reconciliation report only — no catalog mutation     |

## Mitigations implemented (2026-08-11)

| Risk                        | Mitigation                                                               |
| --------------------------- | ------------------------------------------------------------------------ |
| Forged prepared handle      | Commit resolves server record by preparedId; opaque client handle        |
| Self-approval               | `separation_of_duties_violation` when proposer == approver               |
| Evidence swap               | Conformance verifier binds digests to admission subject                  |
| Split-brain commit          | Two-phase decision log + `recoverForwardCommit`                          |
| Stale binding CAS           | Expected generation checked on submit/prepare/commit/policy              |
| Unknown wire fields         | `ingressWireCodec` strict key allowlists                                 |
| Policy activation no-op     | CAS binding update + `onPolicyActivated` hook for runtime evaluator swap |
| Cross-process snapshot race | `casActiveBindingDurable` under file lock                                |
| Non-monotone schema         | Monotone extension validator + immutable revisions                       |
| Control-plane freeze bypass | `ensureNotFrozen` on all mutating commands                               |

## Residual risks (M3 → production)

| Risk                                   | Status   | Notes                                                  |
| -------------------------------------- | -------- | ------------------------------------------------------ |
| External Security independent sign-off | Open     | DRI interim reviewer; recruit before FCP               |
| Lean proof bridge for four-view        | Open     | Digest-level conformance only                          |
| Multi-tenant isolation                 | Deferred | Single activation domain in M3 harness                 |
| HSM / mTLS for administration API      | Deferred | In-process service wiring only                         |
| Fleet reconciliation auth hardening    | Partial  | Role gates present; durable rollout journal incomplete |

## Consequences

- Control-plane MUST NOT accept caller-supplied authorization strings without `AdministrationContext`.
- Runtime integrations MUST wire mutable schema context + policy notification on activation.
- File-backed deployments MUST use `casActiveBindingDurable` (or equivalent lock + reload) for cross-process workers.
- Observability remains read-only; epoch boundaries come from admission receipts.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Architecture / Security Review**: Joker-of-Gotham (interim, COI disclosed) — external reviewer pending FCP  
**Date**: 2026-08-11
