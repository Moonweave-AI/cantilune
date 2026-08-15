# ADR-0011: Evaluation Architecture — Persistence, Isolation, and Budget Boundaries

| Field          | Value                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Status         | **Accepted** (M2–M3 engineering scope)                                                                                   |
| Date           | 2026-08-12                                                                                                               |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                    |
| Reviewers      | Joker-of-Gotham (DRI interim Architecture)                                                                               |
| Related        | RFC-0003, ADR-0009, ADR-0010, `@cantilune/evaluation`, `@cantilune/conformance`, `@cantilune/core`, `@cantilune/runtime` |

## Context

Cantilune needs an explicit architecture for `@cantilune/evaluation` before the module can serve as a trustworthy harness for agent behavior, benchmark claims, and conformance-adjacent evidence. The evaluation layer must persist run artifacts and audit trails, isolate untrusted execution (including LLM judges), enforce budget limits on external calls, and produce metric rows that bind to verifiable evidence per RFC-0003.

Without these boundaries, evaluation runs risk silent data loss, credential leakage via judges, unbounded provider spend, ambiguous retry semantics, and published metrics that cannot be replayed or audited against a policy version.

## Decision

### 1. Four storage types

| Store                              | Semantics                     | Holds                                                                |
| ---------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| **Immutable CAS**                  | Content-addressed; write-once | Dataset fixtures, subject artifacts, oracle outputs, evidence blobs  |
| **Transactional Run Store**        | ACID per run/suite            | Run state, attempt records, intermediate scoring inputs              |
| **Append-only Claim/Audit Ledger** | Ordered, tamper-evident       | Claim decisions, budget events, external-call attempts, audit events |
| **Restricted Encrypted Store**     | Key-scoped; separate from CAS | Provider credentials, PII-bearing judge prompts (if any)             |

Adapters MUST NOT collapse these into a single generic blob store. Cross-store references use digests only.

### 2. Execution isolation

Evaluation execution runs in a **deny-by-default sandbox**:

- Subject runs MAY invoke configured adapters (runtime, observability) under declared footprint.
- **LLM judge** processes MUST have **no tools, no network, and no secrets** — inputs and outputs are opaque text bound to attempt records.
- Sandbox policy is enforced at the execution port, not left to caller discipline.

### 3. Budget control

External calls (LLM providers, remote oracles) follow **reserve-before-call, reconcile-after**:

1. Reserve estimated cost/units from run budget before issuing the call.
2. Reconcile actual usage after provider receipt (refund or charge delta).
3. **Fail-closed** when budget is exhausted — no silent overage or negative balance.

### 4. External calls are not exactly-once

Provider APIs do not guarantee exactly-once delivery. Every external invocation MUST record:

- **Request attempt** (attempt id, payload digest, reservation id)
- **Provider receipt** (response digest, billed units, provider correlation id)
- **Possible duplicates** flag when idempotency cannot be proven

Retries create new attempt records; they MUST NOT overwrite failed or ambiguous prior records.

### 5. Certificate revocation during run

If a trust root or certificate relied on by the run is **revoked mid-run** (per ADR-0009 revocation checkpoint), the engine MUST detect the change and **fail-closed** — no partial publish of metrics bound to stale trust state.

### 6. Published metric binding (RFC-0003)

Every published metric row MUST bind:

| Field                | Source                                           |
| -------------------- | ------------------------------------------------ |
| Artifact subject     | Evaluated subject digest + kind                  |
| Verifier build       | Engine/oracle build digest                       |
| Policy version       | Evaluation policy digest                         |
| Evidence root digest | Merkle/root over attempt + oracle evidence chain |

Rows without full binding MUST NOT be exported as authoritative scores.

### 7. Theory oracle premise discipline

Theory oracles (formal/Lean-adjacent checks) MUST return **`premiseMissing`** when theorem premises are not satisfied — they MUST **never pass** on incomplete or unmet premises. Pass requires explicit premise satisfaction recorded in evidence.

### 8. Retry semantics

A retry ALWAYS creates a **new attempt** with a new attempt id. Failed, ambiguous, or superseded attempts remain in the ledger for audit. No in-place overwrite of terminal failure records.

## Trust boundaries

```
Dataset/subject CAS ──► run planner ──► sandbox executor
                              │                │
                              ▼                ▼
                    budget ledger ◄── external call port
                              │
                              ▼
              scoring + metric binding (subject · verifier · policy · evidence root)
                              │
                              ▼
                    published report (immutable export)
```

| Boundary  | Rule                                                                   |
| --------- | ---------------------------------------------------------------------- |
| Ingress   | Subjects and datasets resolved via CAS digest; no path-based trust     |
| Execution | Deny-by-default; judge isolation enforced                              |
| Egress    | External calls only through budgeted port with attempt/receipt logging |
| Publish   | Metric rows require four-way binding; revocation re-check at export    |

## Consequences

### Positive

- Evaluation artifacts are auditable and replayable with explicit evidence chains aligned to RFC-0003.
- LLM judge isolation closes a common credential-exfiltration path in benchmark harnesses.
- Budget reserve/reconcile prevents runaway provider spend with deterministic fail-closed behavior.
- Retry and duplicate semantics are explicit — no silent loss of failed attempts.

### Negative

- Four store types increase adapter surface area versus a single persistence backend.
- Reserve-before-call adds latency and requires accurate cost estimation for some providers.
- Mid-run revocation fail-closed may abort long suites when trust rotates — operators must plan checkpoint boundaries.
- Theory `premiseMissing` strictness may reduce headline pass rates until datasets declare premises completely.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Date**: 2026-08-12  
**Decision Reference**: `@cantilune/evaluation` module design, RFC-0003 evidence binding, ADR-0009 trust lifecycle
