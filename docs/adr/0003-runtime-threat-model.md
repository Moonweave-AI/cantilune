# ADR-0003: Runtime Threat Model and Permission Boundaries

| Field          | Value                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Status         | **Accepted** (engineering prototype scope)                                                                                          |
| Date           | 2026-08-10                                                                                                                          |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                                               |
| Reviewers      | Joker-of-Gotham (DRI，兼任 Security + Architecture second reader；COI 见 `reviewer-assignments.md`)；FCP 前外部 Security 招募仍开放 |
| Related        | RFC-0001 §9, ADR-0002, `@cantilune/runtime`, `diagrams/02-runtime/`                                                                 |

## Context

RFC-0001 §9 requires a Threat Model before runtime/comms/network implementation. A 2026-08-10 code review found `@cantilune/runtime` could not serve as a trusted permission boundary: forged admission tickets, TOCTOU on bindings, non-atomic commit, shallow replay verification, and observation rewrite of historical snapshot refs.

This ADR records the **runtime-local threat model** and permission matrix for M2 engineering prototype scope. Comms/A2A/network facets remain out of scope until ADR follow-up.

## Threat actors and assets

| Actor                         | Capability                                                                           | Primary assets                                |
| ----------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| External caller (untrusted)   | Submits `CoordinationIntent`, `ObserveInput` (source + payloadRef), composition DTOs | `CollaborationSnapshot`, `ChangeLog`, locks   |
| Malicious agent participant   | Holds or seeks artifact/capability; may mis-bind roles                               | Task ownership, scoped capabilities, sessions |
| Compromised test/support code | Must not ship in production wiring                                                   | Policy evaluators, ID generators              |
| Storage fault injector        | Partial writes, reorder, crash                                                       | Durable head, changelog, sidecar              |

## Trust boundaries

```
Untrusted DTO ──► normalize + validate ──► AdmissionGateway ──► registry-scoped ticket
                                                      │
PolicyEvaluator (default deny; templateAware for M2) ◄┘
                                                      │
Internal registry (AdmittedRecord) ◄── ticket resolves ──► Committer ──► DurableCoordinator
ObserveInput ──► principal must match source ──► ingestObservation ──► head CAS
FileResourceLockTable ──► cross-process footprint exclusion (same dir as bundle)
```

| Boundary                 | Rule                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Ticket                   | Registry-scoped `AdmissionTicket` + `AdmittedId`; commit resolves via internal registry (not a crypto token) |
| Principal (coordination) | `initiator` / `from` role must match authenticated `ActorRef` principal                                      |
| Principal (observe)      | `ObserveInput.source` must match explicit `principal` option on `runtime.observe`                            |
| Footprint                | Derived only from normalized `matchBindings`; never widens topology via isolation scope                      |
| Apply                    | Handlers are pure over `(before, recipe)`; fresh entity refs pre-allocated in recipe                         |
| Persist                  | Single `DurableCoordinator.commit(expectedHead, …)` CAS; observation allocates new `snapshotRef`             |
| Cross-process lock       | `FileResourceLockTable` shares lock file dir with bundle; disjoint footprints only                           |

## Permission matrix (M2)

| Operation            | Requires (admission)                                                                            | Ensures (post-apply)                            | Capability check                      |
| -------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| `introduce_artifact` | `from` registered; task absent                                                                  | task exists; `from` holds write-lock            | scoped `artifact` capability          |
| `delegate`           | task exists; `from` holds scoped lock; `to` registered                                          | `to` holds lock                                 | `delegator.holds` strict scope/holder |
| `create_session`     | `from` registered                                                                               | `from` registered                               | —                                     |
| `fork_branch`        | `from` registered                                                                               | `from` registered                               | —                                     |
| `publish_artifact`   | task exists; `from` holds                                                                       | task exists                                     | owner or scoped capability            |
| `transfer_session`   | session exists; **`from` is controller** (`session.controller_matches`); `from`/`to` registered | session exists                                  | controller transfer only              |
| `observe`            | explicit principal matches source; head CAS                                                     | new snapshot ref; append-only auditTail segment | principal/source alignment            |

Default when `policy` omitted: **`denyByDefaultPolicyEvaluator()`**. M2 wiring SHOULD use **`templateAwarePolicyEvaluator()`** (template `requires` already gate admission). `allowAllPolicyEvaluator` is test-support only.

## Mitigations implemented (2026-08-10)

| Blocker                 | Mitigation                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| Forged admission        | Internal `AdmissionRegistry`; commit resolves ticket + lock + head CAS         |
| TOCTOU bindings         | `normalizeCoordinationIntent` deep-copy; targets from bindings only            |
| Non-atomic commit       | `DurableCoordinator` single-transaction memory impl; lock release in `finally` |
| Shallow replay          | `snapshotsCanonicallyEqual`; recipe carries fresh link/session refs            |
| Observation rewrite     | New `snapshotRef` per observation via `compareAndSwapHead`                     |
| Ticket ID collision     | Monotonic admitted-id sequence per gateway instance                            |
| Observe source spoof    | `validateObservePrincipal`; principal required on `runtime.observe`            |
| Non-controller transfer | `session.controller_matches` at admission schema                               |
| Cross-process lock gap  | `FileResourceLockTable` + `createFileRuntimePersistence().locks`               |
| Shallow snapshot codec  | Strict `parseSnapshotWire` entity validation                                   |
| Default policy gap      | Optional policy → deny-by-default; export `templateAwarePolicyEvaluator`       |

## Residual risks（core/runtime 范围）

| Risk                                | Status          | Notes                                                                        |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Async/multi-process storage + locks | **Closed (M2)** | `FileDurableCoordinator` + `FileResourceLockTable` + L7 cross-process/worker |
| Template/handler revision replay    | Closed          | Versioned registry + tests                                                   |
| Codec strict validation             | Closed          | `parseChangeWire` + `parseSnapshotWire`                                      |
| Pack consumer smoke                 | Closed          | CI `test:pack`                                                               |
| L7 concurrency/soak                 | Closed          | `tests/system/l7/*` (76/76 pass)                                             |
| M2 prototype Stop-Ship              | **Lifted**      | Reviewer 裁定 2026-08-10；本地 runtime/core 工程可继续                       |
| ADR-0003 reviewer Accept            | **Accepted**    | Joker-of-Gotham (DRI)；2026-08-10                                            |
| External Security pre-FCP           | Open            | 非 DRI 独立签核仍须                                                          |

**Out of M2 scope（非 Stop-Ship，不阻塞 core/runtime 原型）：**

| Item                                   | Reason                                |
| -------------------------------------- | ------------------------------------- |
| Distributed DB / multi-replica durable | 未来 ADR；file durable 为单目录 CAS   |
| A2A / comms / network                  | 外置 02G；须后续 ADR                  |
| Lean FCP / QA-L4 theory gate           | 形式化验收链，与 runtime 工程边界分离 |

## Consequences

**Positive**

- RFC-0001 §9 gate satisfied for runtime prototype scope
- Permission checks documented and testable (`ticket-security`, `concurrent-admit-reconcile`)
- Clear separation between engineering prototype and production network boundary

**Negative**

- Memory durable suitable for single-process; **file durable** for cross-process CAS (not distributed DB)
- Threat model does not cover A2A/comms (future ADR)
- Production boundary still requires reviewer Accept of this ADR; external security sign-off required pre-FCP

## Alternatives rejected

| Option                                      | Why rejected                        |
| ------------------------------------------- | ----------------------------------- |
| Public `AdmittedIntent` constructor         | Trivial policy bypass               |
| Trust caller-supplied footprint for locking | TOCTOU + topology corruption        |
| Separate Store + ChangeLog without CAS      | Orphan snapshots on partial failure |
| Map-size replay equality                    | False-positive verified replays     |

## Implementation tasks

- [x] Opaque ticket + internal registry
- [x] Deny-by-default policy; allow-all test-only
- [x] DurableCoordinator atomic commit (memory)
- [x] Canonical snapshot replay comparison
- [x] Observation immutability via new refs
- [x] Strict codec validation pipeline (`wireValidation`, `decode*FromUnknown`)
- [x] Cold-start replay CI (`tests/system/l7/cold-start-replay`)
- [x] Pack consumer smoke (`scripts/pack-consumer-smoke.mjs`, CI `test:pack`)
- [x] Template/handler revision replay (`templateRegistry@revision`, `handlerRegistry@revision`)
- [x] L7 soak / crash-restart / concurrent batch (`tests/system/l7/*`)
- [x] File-backed transactional durable + **cross-process resource locks**
- [x] Observe principal validation; transfer_session controller at admission
- [x] Strict snapshot wire validation; default deny + templateAware policy export
- [x] ADR-0003 reviewer Accept (2026-08-10, Joker-of-Gotham)
- [ ] External Security reviewer sign-off pre-FCP (recruitment open)
