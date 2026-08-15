# ADR-0016: External-Tool Exactly-Once via Tiered Invocation Journal

| Field              | Value                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status             | **Proposed** (Owner review requested; lifts SS-03 of QA-0012)                                                                                                                                                                                                 |
| Created            | 2026-08-14                                                                                                                                                                                                                                                    |
| Updated            | 2026-08-14 (§4 corrected: `completed`-reuse path removed — see "Design correction" below)                                                                                                                                                                     |
| Decision Owner     | Joker-of-Gotham                                                                                                                                                                                                                                               |
| Implementation DRI | Codex implementation team                                                                                                                                                                                                                                     |
| Reviewers          | Independent Architecture and Security review pending (QA-L5 exit gate)                                                                                                                                                                                        |
| Summary            | Add a durable pre-invocation journal and a stable idempotency key so an external tool side effect survives a crash at any of the four boundaries, then reconcile via a tiered outcome-query contract that never re-executes a side effect that already landed |
| Canonical          | This ADR; RFC-0001 remains the architectural authority                                                                                                                                                                                                        |
| Related            | ADR-0012, ADR-0003, `@cantilune/syscall`, `@cantilune/tools`, `@cantilune/runtime`, `@cantilune/boot`                                                                                                                                                         |
| Supersedes         | None (extends ADR-0012 §observation-only recovery)                                                                                                                                                                                                            |
| Superseded by      | None                                                                                                                                                                                                                                                          |

## Context

`docs/qa/0012-agent-execution-continuity-qa.md` (SS-03) records the exactly-once gap. An exact read of `useTool` (`src/packages/syscall/src/act.ts:458`) confirms the four boundaries and the window that is not closed:

```
line 499:  toolExecutor.execute(toolName, args)     ← SIDE EFFECT lands here
            ═══ boundary 2: post-side-effect / pre-output ═══  (NOT closed)
line 521:  contentStore.put(execResult.output)       ← output becomes durable
            ═══ boundary 3: post-output / pre-receipt ═══      (NOT closed)
line 525:  createObservationRecovery(...)            ← receipt becomes durable (contentStore.put)
            ═══ boundary 4: post-receipt / pre-observation ═══ (partially closed: retryToolObservation)
line 537:  runtime.observe(...)                      ← observation durable
```

The existing recovery path (`retryToolObservation`, `act.ts:570`) starts at **boundary 4**: `validateObservationRecovery` (`:606`) checks the content-addressed receipt against the caller, tool, arguments digest, and output ref, then re-observes without re-executing. This is sound from the moment the output **and** its receipt are both durable. It does not cover:

- **Boundary 1 (pre-dispatch)**: there is no journal entry before `toolExecutor.execute`, so after a crash there is no record that a side effect was _attempted_ — the run cannot tell "never dispatched" from "dispatched, side-effect landed, output lost."
- **Boundary 2 (post-side-effect/pre-output)**: the executor returned, the side effect is in the world, but `contentStore.put` has not happened. On restart the run re-dispatches and the side effect fires a second time.
- **Boundary 3 (post-output/pre-receipt)**: the output is durable but the receipt is not. `retryToolObservation` cannot reconcile because there is no receipt to validate, so the run re-dispatches.

`AbortSignal` and `maxTimeMs` (per the QA packet) cannot safely preempt an already-running call — preemption would leave an unobserved late side effect. So the budget is not a hard wall-clock cap for in-flight tools; the correct close is idempotent outcome reconciliation, not cancellation.

The Owner's prior decision (this conversation) set the approach to **"分层契约" (tiered contract)**: different tool classes (read-only vs. side-effecting) get different reconciliation obligations, rather than one uniform mechanism. A read-only tool that crashes at boundary 2 can simply be re-dispatched (no side effect to double); a side-effecting tool must reconcile via an outcome-query before re-dispatch.

## Decision

Close the exactly-once gap with a durable pre-invocation journal, a stable executor idempotency key, and a tiered outcome-query contract. The four boundaries each have a defined recovery. No tool is re-executed when a side effect has already landed and is observable.

### 1. Stable idempotency key

The idempotency key for a tool invocation is the pair `(principal, toolName, argumentsDigest, originalToolCallId)`, which is exactly the identity `validateObservationRecovery` already checks (`act.ts:652-659`). This key is stable across crashes because:

- `principal` is the bound actor (survives in the durable world).
- `toolName` and `argumentsDigest` come from the canonicalized args (`canonicalToolArguments`, `act.ts:260`), which are deterministic.
- `originalToolCallId` is the LLM-supplied call id, persisted in the private history checkpoint at the group boundary (ADR-0012).

The key is computed **before** dispatch and written to the pre-invocation journal, so it exists even if the executor never returns.

### 2. Durable pre-invocation journal (closes boundary 1)

Before `toolExecutor.execute` runs, `useTool` writes a **pre-invocation journal entry** that records the idempotency key and the dispatch intent, durably. The journal lives in the content store (the same content-addressed authority the output and receipt already use), as a new receipt kind: `tool-invocation-intent@1`.

- The entry carries: principal, toolName, originalToolCallId, argumentsDigest, `dispatchedAt` (commit timestamp), and a status of `dispatched`.
- It is written via `contentStore.put` with a dedicated MIME type and creator tag, exactly like the existing observation receipt (`createObservationRecovery`, `act.ts:346`).
- On a fresh `useTool` call, before dispatch, the run **queries the journal** for the idempotency key. If a `dispatched` or `completed` entry exists, the run does not dispatch blindly — it proceeds to the outcome-query (§4). This is the "never re-execute a side effect that already landed" guard.

This makes boundary 1 recoverable: after a crash at pre-dispatch, the journal has no entry (dispatch never happened) and the run re-dispatches safely; after a crash at post-dispatch/pre-return, the journal has a `dispatched` entry and the run reconciles instead of re-dispatching.

### 3. Tiered executor contract (the "tiered contract")

Not all tools need the same reconciliation. The executor declares its tier, and `useTool` reconciles accordingly. Extend `ToolExecutor` (`syscall.ts:166`) with an optional `reconcile` and a `tier` declaration:

- **Tier 0 — read-only** (`tier: "read"`): the tool has no side effect (e.g. `read_content`, a pure MCP query). A crash at any boundary is closed by re-dispatch — there is no side effect to double. The journal entry is still written for observability and to suppress duplicate audit observations, but the run may safely call `execute` again.
- **Tier 1 — idempotent-side-effect** (`tier: "idempotent"`, with `reconcile`): the tool has a side effect but supports an outcome-query (e.g. a file write keyed by the arguments digest, an MCP call with a request id). After a crash the run calls `reconcile(key)` _instead of_ `execute`. If reconcile returns the prior output, the run reuses it (same as a successful execute); if reconcile returns "unknown", the run re-dispatches knowing the prior side effect did not land (or the executor confirms idempotency makes re-dispatch safe). This is the file/shell/MCP-with-request-id tier.
- **Tier 2 — non-idempotent-side-effect** (`tier: "non-idempotent"`): the tool has a side effect and no outcome-query. The run **must not** re-dispatch after a `dispatched` journal entry whose output is not durably recoverable. On restart, the run reports the invocation as `ambiguous` — the side effect may have landed — and surfaces it as a typed failure requiring an operator decision, rather than silently re-executing. This is the tier for shell commands without idempotency, arbitrary MCP tools that mutate, etc. The operator runbook (not code) resolves ambiguity.

The existing executors are classified: `read`/`list` style tools → Tier 0; `write`/`shell` with a stable path → Tier 1; unknown MCP tools → Tier 2 by default (fail safe). A tool that declares no tier defaults to Tier 2 (least privilege: assume it is non-idempotent).

The `ToolExecutor` interface declares a single `tier` (the fail-safe default for the executor) plus an optional `tierFor(toolName)` so an executor that serves mixed-tier tools — the filesystem executor serves both `read_file` (Tier 0) and `write_file`/`edit_file` (Tier 1/2) — can classify per tool. The syscall run resolves `tierFor(toolName) ?? tier ?? "non-idempotent"` before branching on the tier.

The built-in executors are declared as follows (`@cantilune/tools`):

| Executor / tool                                                                                             | Tier             | `reconcile`                       |
| ----------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------- |
| `filesystem_read_file`, `filesystem_list_directory`, `filesystem_search_files`, `filesystem_search_content` | `read`           | n/a (re-dispatch)                 |
| `filesystem_write_file`                                                                                     | `idempotent`     | `reconcile → unknown` (see note)  |
| `filesystem_edit_file`                                                                                      | `non-idempotent` | none (re-dispatch unsafe)         |
| `shell_run_command`                                                                                         | `non-idempotent` | none                              |
| `web_search`, `web_fetch`                                                                                   | `read`           | n/a (re-dispatch)                 |
| any `mcp_*` tool                                                                                            | `non-idempotent` | none (unknown remote side effect) |

`filesystem_write_file` is idempotent by content (writing the same content to the same path is a no-op), so re-dispatch after a crash is safe. The ADR-0016 idempotency key carries only a digest of the args, not the args themselves, so `reconcile` cannot re-derive the target path/content from the key to confirm "already written"; it therefore reports `unknown` and the run re-dispatches, which is a no-op overwrite. The Tier 1 declaration still matters: it documents that re-dispatch is safe, in contrast to `filesystem_edit_file` (Tier 2), whose re-dispatch is unsafe (a second edit fails because `oldString` is gone). `filesystem_edit_file` has no outcome query and must not re-dispatch.

### 4. Outcome-query / reconcile protocol (closes boundaries 2 and 3)

`useTool` gains a reconcile-first path after a crash:

1. Compute the idempotency key.
2. Query the journal for the `dispatched` entry for the key. No entry → safe dispatch (boundary 1 clean side).
3. `dispatched` entry present → call `executor.reconcile(key)` (or branch on tier):
   - Tier 0: re-dispatch (no side effect to double).
   - Tier 1: if reconcile returns prior output, reuse it; if "unknown", re-dispatch (the executor confirms re-dispatch is safe by idempotency).
   - Tier 2: do not re-dispatch; report `ambiguous`, require operator resolution.
4. On a successful dispatch (or reconciled output), write the output + observation receipt (the existing boundary-4 path) and write a `completed` journal entry for observability.

This closes boundary 2 (post-side-effect/pre-output): the reconcile query asks the executor whether the side effect landed and returns the output if so. It closes boundary 3 (post-output/pre-receipt): the findable `dispatched` entry drives reconcile, which returns the prior output; the receipt is rebuilt from the reconciled output. Boundary 4 (post-receipt/pre-observation) remains closed by the existing `retryToolObservation` path, which the caller drives from the observation-recovery handle returned by `useTool`.

#### Design correction (2026-08-14): the `completed`-reuse path is removed

The original draft of §4 step 3 read "Entry with status `completed` and a durable output → reuse the output, re-observe." That path is **not implementable** on a content-addressed store and has been removed; the `dispatched` entry is the only findable recovery artifact. The reasoning is recorded here so the gap is not reintroduced:

- The `dispatched` journal entry carries **no** `outputRef` (the output does not exist yet when it is written), so its content-addressed ref is a function of `(key, "dispatched")` alone and is **findable from the idempotency key** after a crash. This is the recovery lookup that `useTool` performs.
- The `completed` journal entry **does** carry the `outputRef` (it records which output was produced), so its content-addressed ref is a function of `(key, "completed", outputRef)` and is **not** findable from the key alone — the caller does not know `outputRef` after a crash.
- A content-addressed store places every blob at `sha256(blob bytes)`; there is no "store this blob at an arbitrary address" operation and no new API was introduced. Therefore a blob that carries `outputRef` cannot be addressed by a ref that excludes `outputRef`. Any "look up the completed entry by key" path is therefore dead code that can never match: it was removed from `useTool` (`reuseCompletedOutput`).
- Recovery still converges correctly without it:
  - **Tier 0 (read)**: the `dispatched` entry is found, the tool has no side effect, the run re-dispatches.
  - **Tier 1 (idempotent)**: the `dispatched` entry is found, `reconcile(key)` returns the prior output, the run reuses it without re-executing. A completed clean-restart is recovered the same way.
  - **Tier 2 (non-idempotent)**: the `dispatched` entry is found, the run cannot prove the side effect did or did not land from the key alone, so it reports `ambiguous` and does not re-dispatch. For a call that _did_ complete, this is a fail-safe hold: the operator resolves the durable output via `retryToolObservation` (driven from the audit-tail observation-recovery handle, not from a key lookup) or out of band. This is honest — the runtime cannot safely auto-reuse a non-idempotent side effect it cannot prove completed.
- The `completed` journal entry is still **written** (after the output is durable) for observability and audit; it is simply not a recovery lookup target.

### 5. AbortSignal threading (the "cannot safely preempt" acknowledgement)

`AbortSignal` and `maxTimeMs` continue to bound LLM waits and prevent _late dispatch_ (a tool call scheduled after the budget expired). This ADR does **not** claim they preempt an in-flight executor. The executor may accept an `AbortSignal` to stop waiting for a result, but stopping the wait does not undo the side effect. After an abort, the journal entry remains `dispatched`, and the next `useTool` call for that key reconciles rather than re-dispatches. This is the honest model: the budget bounds waiting, not side effects; side effects are bounded by reconciliation.

## Alternatives considered

- **Uniform re-dispatch with dedup by idempotency key**: rejected. It is correct for Tier 0 and safe for Tier 1 only if the executor is genuinely idempotent; for Tier 2 it doubles non-idempotent side effects. The Owner chose the tiered contract precisely because a uniform rule is unsafe for the side-effecting tools that motivated SS-03.
- **A separate durable invocation log outside the content store** (a bespoke journal file): rejected. It would introduce a second authority for tool-invocation identity alongside the content-addressed receipts, splitting the integrity model. The content store is already the authority for the output and the receipt; the journal lives there too, so one content-addressed integrity check covers all three.
- **Cancellation as the close**: rejected. `AbortSignal` cannot undo a side effect; treating cancellation as the exactly-once close is the false premise SS-03 calls out. The close is reconciliation, not preemption.
- **Always re-dispatch on crash, let the executor dedup**: rejected. It offloads a correctness invariant (never double a side effect) onto every executor, including untrusted MCP tools, with no enforcement. Tier 2's fail-safe `ambiguous` report keeps the invariant in the runtime.

## Migration and verification

This ADR adds a new content receipt kind (`tool-invocation-intent@1`) and an optional `tier`/`reconcile` on `ToolExecutor`. It does not change the existing observation receipt kind or the existing `retryToolObservation` contract; it extends them. Existing executors that do not declare a tier default to Tier 2 (fail safe), so existing wiring is unchanged in behavior until an executor opts into a tier.

### Crash tests at the four boundaries (the lift gate)

Real crash tests (cross-process, like the SS-02 epoch crash test) at each boundary, using a Tier-1 executor with a recorded side effect:

1. **Pre-dispatch crash**: kill the process after the journal query but before `execute`. On restart, no `dispatched` entry exists; the run dispatches; the side effect lands exactly once.
2. **Post-side-effect/pre-output crash**: the executor applies the side effect and returns, but the process is killed before `contentStore.put` of the output. On restart, the journal has `dispatched`; `reconcile(key)` returns the prior output (the executor recorded it by idempotency key); the run reuses it; the side effect is not repeated.
3. **Post-output/pre-receipt crash**: the output is durable but the observation receipt is not. On restart, the findable `dispatched` journal entry is present; the Tier-1 executor's `reconcile(key)` returns the prior (durable) output, the run reuses it and rebuilds the receipt; no re-dispatch. (The `completed` entry is not findable from the key — see "Design correction"; the `dispatched` entry drives recovery.)
4. **Post-receipt/pre-observation crash**: the receipt is durable but the observation is not. On restart, `retryToolObservation` validates the receipt and re-observes; no re-dispatch. (This boundary is already closed; the test proves it survives in the new flow.)

Plus a Tier-2 test: a non-idempotent executor crashed at post-side-effect/pre-output reports `ambiguous` and does not re-dispatch.

### Coverage gate

New unit tests: the journal write/query, the reconcile-first path per tier, the `ambiguous` Tier-2 report, and the journal-suppresses-duplicate-observation path. Coverage must meet the repository L2–L7 thresholds (statements/functions/lines ≥90%, branches ≥88%) for `@cantilune/syscall` and `@cantilune/tools`.

## Lift mapping

| SS-03 lift condition                       | Closed by                                                                              | Section      |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------ |
| Durable pre-invocation journal             | `tool-invocation-intent@1` entry written before `execute`                              | 2            |
| Stable executor idempotency key            | `(principal, toolName, argumentsDigest, originalToolCallId)`, computed before dispatch | 1            |
| Outcome-query contract                     | `executor.reconcile(key)` reached from a `dispatched` journal entry                    | 4            |
| Crash test at pre-dispatch                 | Boundary 1 test                                                                        | Verification |
| Crash test at post-side-effect/pre-output  | Boundary 2 test (Tier-1 reconcile)                                                     | Verification |
| Crash test at post-output/pre-receipt      | Boundary 3 test (`dispatched` entry + Tier-1 reconcile(known) reuses output)           | Verification |
| Crash test at post-receipt/pre-observation | Boundary 4 test (existing retry, proven in new flow)                                   | Verification |
| Cancellation is not the close              | AbortSignal bounds waiting only; reconciliation bounds side effects                    | 5            |

All lift conditions are addressed and will be evidenced by the four-boundary crash tests before this ADR moves from Proposed to Accepted.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; implementation realized & green — four-boundary cross-process crash tests pass, coverage gates EXIT=0)
**Status**: Proposed. Acceptance additionally requires independent Architecture + Security reviewer sign-off (QA-L5 exit gate). The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers.
