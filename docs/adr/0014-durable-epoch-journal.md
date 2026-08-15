# ADR-0014: Durable Epoch Journal Atomic With the Head

| Field              | Value                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status             | **Proposed** (Owner review requested; lifts SS-02 of QA-0012)                                                                                                      |
| Created            | 2026-08-14                                                                                                                                                         |
| Updated            | 2026-08-14                                                                                                                                                         |
| Decision Owner     | Joker-of-Gotham                                                                                                                                                    |
| Implementation DRI | Codex implementation team                                                                                                                                          |
| Reviewers          | Independent Architecture and Security review pending (QA-L5 exit gate)                                                                                             |
| Summary            | Fold the active schema epoch binding into the same atomic write that publishes the head, so a crash after head CAS and before holder/journal update is recoverable |
| Canonical          | This ADR                                                                                                                                                           |
| Related            | ADR-0006, ADR-0012 (SS-02), RFC-0001, `@cantilune/runtime`, `@cantilune/control-plane`, `@cantilune/boot`                                                          |
| Supersedes         | None (extends ADR-0006 §"cross-process recovery Stop-Ship")                                                                                                        |
| Superseded by      | None                                                                                                                                                               |

## Context

`MemoryEpochAdministration.commitEpochTransition` (in `src/packages/runtime/src/engine/memoryEpochAdministration.ts`) commits an epoch switch in an ordered sequence. The critical section is:

```
line 607:  deps.durable.compareAndSwapHead(headRef, after)   ← DURABLE (atomic, via withMutate)
            ═══ crash window opens ═══
line 611:  deps.schemaHolder.set(record.targetContext)       ← in memory
line 612:  deps.bindingHolder.set(record.toBinding)          ← in memory
lines 614-629: committed.set(admissionId, …)                 ← in memory
            ═══ crash window closes ═══
```

The durable head CAS publishes the new snapshot (with the new `epochId`) atomically through `FileDurableCoordinator.withMutate`, which writes the whole `DurableWireBundle` via `atomicWriteFileSync` (temp file + fsync + rename + dir fsync). But the bundle contains only `t0Ref`, `headRef`, `snapshots`, `changes`, `recipes` — it carries **no `SchemaEpochBinding`, no `schemaRef`, no `admissionId`**. The schema holder, binding holder, and the `committed` receipt journal that follow are in-memory closures. A crash in that window loses all three.

`recoverEpochTransition(admissionId)` looks up `committed.get(admissionId)` — an in-memory `Map` that is empty after a crash — and returns `replay_mismatch`. On restart, the boot wiring (`runtimeDependenciesWithStaticSchema`) reconstructs the schema context from a static default schema and `BOOT_EPOCH_ID`; the head's epoch is now the new epoch and does not match, so the runtime refuses to start. The control-plane side already persists a durable binding (`FileControlPlaneStore.casActiveBindingDurable` + `commitReceipts`), but the runtime recovery path does not consult it.

This is SS-02 of `docs/qa/0012-agent-execution-continuity-qa.md`: a cross-process crash at the exact boundary between durable head CAS and the in-memory holder/journal updates is not recoverable.

## Decision

The Owner chose **"扩展 DurableWireBundle 原子同写"**: make the active schema epoch binding part of the same atomic durable transaction that publishes the new head. The crash window disappears because the bundle on disk always carries the binding that matches its head; recovery reads the bundle and reconstructs the holders without needing the in-memory journal or the control-plane store.

This decision keeps the recovery path self-contained in the runtime persistence layer and does not introduce a cross-package runtime→control-plane recovery dependency (the rejected alternative). It does not duplicate the control-plane's own durable binding: the control-plane binding remains the admission authority; the runtime bundle's binding is the runtime's active-context recovery record. ADR-0006's M3 in-process scope is unchanged; only the cross-process recovery Stop-Ship is lifted.

### 1. Extend the durable bundle with an active binding field

Add an optional `schemaBinding` field to `DurableWireBundle`:

- The field carries the **active** `SchemaEpochBinding` (the `toBinding` of the last committed epoch transition, or the initial binding for a seeded world).
- It is a wire DTO mirroring the `SchemaEpochBinding` shape — all fields are primitive strings, so no structural codec is needed beyond strict field validation (reuse the `snapshotSchemaEpochBinding` snapshot/validate pattern already exported from `@cantilune/runtime`).
- The field is **optional for backward compatibility**: a bundle without it is a legacy/pre-SS-02 bundle. On import, a missing `schemaBinding` is tolerated only when the boot wiring supplies an explicit static schema (the existing path); the new recovery path requires the field to be present and to match the head's epoch. This preserves forward integrity without breaking existing worlds on first load.

### 2. Extend the durable coordinator with an atomic head+binding CAS

Add `compareAndSwapHeadWithBinding(expected, snapshot, binding)` to the `DurableCoordinator` port:

- For `MemoryDurableCoordinator`, it performs the head CAS and stores the binding in a coordinator-held active-binding slot, as one logical operation.
- For `FileDurableCoordinator`, it runs inside `withMutate` so the head CAS **and** the binding update are published in the same `writeBundleAtomic` call. The bundle written to disk carries the new `headRef` and the new `schemaBinding` together, or neither.
- Plain `compareAndSwapHead` (used by observation ingest and all non-epoch head moves) leaves the active binding unchanged — observations do not change the schema epoch.

### 3. Commit the epoch transition atomically

`commitEpochTransition` replaces the split sequence with one atomic call:

```
deps.durable.compareAndSwapHeadWithBinding(headRef, after, record.toBinding)
  ← durable: head + binding published together (or neither)
deps.schemaHolder.set(record.targetContext)
deps.bindingHolder.set(record.toBinding)
committed.set(admissionId, …)
```

The in-memory holder/journal updates still follow, but they are now **convergent reconstructions of durable state**, not the source of truth. A crash after the durable CAS and before the holder/journal update is harmless: the bundle has the binding; the holders can be reconstructed from it.

### 4. Recover from the bundle

`recoverEpochTransition(admissionId)` gains a fallback: when the in-memory `committed` journal is empty (post-crash), it reads the active binding from the durable coordinator, verifies it against the head's epoch, resolves and validates the target schema, and reconstructs the holders. The control-plane's `recoverForwardCommit` path (which calls `recoverEpochTransition(admissionId)`) now succeeds cross-process because the binding is durable.

### 5. Reconstruct the schema context on restart

The boot wiring gains a bundle-sourced binding path. When a durable bundle carries an active `schemaBinding`, the boot layer reconstructs the `ActiveSchemaContext` from it rather than forcing a static default schema. The existing static-schema path remains for worlds that have no binding (legacy or explicitly static). `runtimeDependenciesWithStaticSchema`'s invariant — never infer schema identity from an epoch string alone — is preserved: the binding is a full `SchemaEpochBinding` with `schemaRef`/`admissionId`/`activatedBy`, not a bare epoch name.

## Key invariants

1. The bundle on disk always carries the binding that matches its head. A reader never observes a head whose epoch has no binding.
2. Head and binding publish in one atomic write (temp + fsync + rename + dir fsync). A crash leaves either the old head+old binding or the new head+new binding, never a mismatch.
3. The in-memory holders and `committed` journal are reconstructions of durable state, not independent authority. Losing them to a crash is recoverable from the bundle.
4. The runtime recovery path is self-contained: it does not depend on the control-plane store. The control-plane binding remains the admission authority; the bundle binding is the runtime active-context record.
5. Legacy bundles without a `schemaBinding` field are tolerated on import only through the existing explicit static-schema path; the new recovery requires the field.

## Alternatives considered

| Alternative                                           | Disposition | Rationale                                                                                                                                                  |
| ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime recovery reads control-plane durable binding  | Rejected    | Introduces a runtime→control-plane cross-package recovery dependency and ordering concern; chosen path keeps recovery self-contained in the runtime bundle |
| Bundle + control-plane cross-validation               | Rejected    | Largest effort and double-consistency test surface; the self-contained bundle already closes the window                                                    |
| Keep in-memory journal, add periodic checkpoint       | Rejected    | A periodic checkpoint still has a crash window between CAS and the next checkpoint; does not close the boundary                                            |
| Make `done`/observation ingest also carry the binding | Rejected    | Observations do not change the schema epoch; carrying the binding on every head move is wasteful and obscures the epoch boundary                           |

## Consequences

### Positive

- The cross-process crash window after durable head CAS is closed; SS-02 is lifted.
- `recoverEpochTransition` succeeds cross-process from durable state alone.
- The boot layer no longer refuses to restart a world whose head advanced to a new epoch.
- The runtime persistence layer remains the sole recovery authority — no new cross-package dependency.

### Negative

- The `DurableWireBundle` wire format gains a field; a strict codec must validate it on import. Legacy bundles without the field require the explicit static-schema path on first load (no automatic relabelling, preserving ADR-0012 §4).
- `DurableCoordinator` gains a method; `MemoryDurableCoordinator` gains an active-binding slot it must snapshot on ingress.
- A new cross-process crash test at the exact CAS/binding boundary is required (no mock signal injection) to lift the gate.

## Migration and verification

1. Extend `DurableWireBundle` + `importDurableBundle`/`exportDurableBundle` with the optional validated `schemaBinding` field; tolerate absence for legacy.
2. Add `compareAndSwapHeadWithBinding` to the `DurableCoordinator` port, `MemoryDurableCoordinator`, and `FileDurableCoordinator` (the latter inside `withMutate`).
3. Rewrite `commitEpochTransition` to use the atomic head+binding CAS; keep the in-memory holder/journal updates as convergent reconstructions.
4. Add the bundle-sourced recovery fallback to `recoverEpochTransition`.
5. Add the bundle-sourced binding reconstruction path to the boot wiring; keep the static-schema path for legacy/unbound worlds.
6. Add a real cross-process crash test: a child process commits an epoch transition (advancing the head and binding) and is killed immediately after the durable CAS; a fresh process loads the bundle and confirms the holders are reconstructed from the durable binding and the runtime starts under the new epoch.
7. Run affected package unit, integration, contract, system, lint, format, and type checks; meet the ≥90/88 coverage gate.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; implementation realized & green)
**DRI Signature**: Joker-of-Gotham — 2026-08-14
**Date**: 2026-08-14
**Decision Reference**: QA-0012 SS-02, ADR-0006 §"cross-process recovery Stop-Ship", ADR-0012 §6
**Status**: Proposed. Acceptance additionally requires independent Architecture + Security reviewer sign-off (QA-L5 exit gate). The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers.
