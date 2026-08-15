---
title: Agent execution continuity and evidence integrity QA-L5 packet
document_type: quality-evidence-and-release-gate
status: implementation-verified / release-blocked
risk: S3
quality_target: QA-L5
maturity: M2
owner: Joker-of-Gotham
dri: Codex implementation team
updated: 2026-08-14
review_cycle: on every Agent, epoch, content, or durable-session change
related: ADR-0012, ADR-0003, ADR-0006, @cantilune/boot, @cantilune/syscall, @cantilune/runtime, @cantilune/cli
---

# Conclusion

The reported single-Agent continuity, content-reference, and false-success defects are closed in the
implementation and deterministic regression suite. File-backed world/content reopen now restores
the exact validated private tool-result history at completed response/tool-group checkpoints, rather
than reconstructing evidence from UI cards. This packet does **not** authorize production swarm
execution, cross-process schema-epoch activation, external-tool exactly-once execution, per-tool
crash durability inside one multi-tool LLM response, or a claim that arbitrary tasks have a
domain-specific proof of semantic completion.

## Classification

| Field              | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| Work object        | Agent session continuity, content reachability, truthful completion, epoch recovery |
| Risk / QA          | S3 / QA-L5                                                                          |
| Maturity           | M2; single-Agent file-backed execution verified                                     |
| Owner              | Joker-of-Gotham                                                                     |
| DRI                | Codex implementation team; not an independent reviewer                              |
| Decision authority | ADR-0012 (Proposed), ADR-0003, ADR-0006                                             |

## Verified evidence

| Boundary                   | Evidence                                                                         | Result |
| -------------------------- | -------------------------------------------------------------------------------- | ------ |
| Cross-run private history  | exact Boot history, poison-on-checkpoint-failure, v3 restart, v2 safe migration  | Pass   |
| Session/world isolation    | only an exact durable/path/principal binding can hydrate a private transcript    | Pass   |
| Context compaction         | bounded LLM view, separate exact evidence, latest-group fit or fail-closed       | Pass   |
| Content binding            | write -> introduce -> exact artifact ref -> read/replay                          | Pass   |
| Runtime content authority  | direct runtime rejects missing/dangling/throwing authority before durable commit | Pass   |
| Authority/store identity   | memory/file stores provide sync proof; boot and CLI inject that exact instance   | Pass   |
| File re-open content       | a fresh boot instance reads exact body from the perceived SHA-256 ref            | Pass   |
| Truthful termination       | failed read/tool/coordination + `done` returns failed `RunResult`                | Pass   |
| Typed failure closure      | perceive/action discovery/tool exceptions emit structured terminal errors        | Pass   |
| Observation-only recovery  | exact receipt retry observes stored output without a second executor call        | Pass   |
| Cancellation boundary      | ignored abort/timeout cannot dispatch late tool calls or stream deltas           | Pass   |
| Graceful group termination | unexecuted siblings are explicit skipped failures and exact evidence is saved    | Pass   |
| Runtime reconfiguration    | awaited shutdown; memory clears history, same-generation file mode preserves it  | Pass   |
| Static epoch resume        | explicit reviewed alias commits incident trace; unlisted epochs fail closed      | Pass   |
| Dynamic epoch preflight    | schema/head/binding/quiescence/TOCTOU failures leave head and holders unchanged  | Pass   |
| Cross-epoch replay         | strict epoch-only bridge and resolver-backed historical replay                   | Pass   |
| File identity              | generated principal persists; unregistered explicit principal fails before LLM   | Pass   |
| Heartbeat fidelity         | typed operands and commit-time timestamp survive codec, replay, and file reopen  | Pass   |
| Snapshot authority         | nested world values and memory-store ingress/egress are deeply detached/frozen   | Pass   |
| Schema/policy authority    | canonical schema digest and detached binding/policy boundaries fail closed       | Pass   |
| File-lock exclusion        | fsynced token + atomic hard-link publication closes stale-reclaim ABA            | Pass   |
| Published package surface  | external tarball consumers import Boot/Syscall runtime values and public types   | Pass   |

Executed serially on 2026-08-13 after the final heartbeat, snapshot/replay authority, file-lock,
private-history checkpoint, and package-consumer changes:

- repository `pnpm test`: all 13 packages with test scripts pass, totaling 522 files / 2,635 tests;
- core: 61 files / 143 tests; coverage 90.67 statements, 91.51 branches, 91.21 functions, 90.67 lines;
- runtime: 105 files / 403 tests; coverage 92.64 / 89.09 / 97.11 / 92.64;
- content: 3 files / 64 tests; coverage 91.91 / 89.58 / 97.05 / 91.91;
- conformance: 51 files / 183 tests; coverage 94.96 / 92.50 / 99.37 / 94.96;
- observability: 27 files / 90 tests; coverage 96.33 / 93.12 / 99.20 / 96.33;
- comms: 103 files / 278 tests; coverage 93.10 / 88.17 / 94.71 / 93.10;
- evaluation: 28 files / 241 tests; coverage 94.91 / 88.31 / 97.46 / 94.91;
- syscall: 7 files / 86 tests; coverage 93.31 / 88.17 / 100 / 93.31;
- tools: 15 files / 111 tests; coverage 96.87 / 89.71 / 100 / 96.87;
- boot: 23 files / 326 tests; coverage 92.80 / 88.34 / 98.09 / 92.80;
- control-plane: 41 files / 175 tests; coverage 93.39 / 88.67 / 97.17 / 93.39;
- adapter: 17 files / 126 tests; coverage 97.36 / 94.00 / 100 / 97.36;
- CLI: 41 files / 409 tests; coverage 97.20 / 89.37 / 97.95 / 97.20;
- repository `pnpm build`, `pnpm test`, `pnpm test:coverage`, and `pnpm test:static` pass;
- Boot and Syscall external `pnpm pack` runtime/type consumer smoke pass after installing their full
  tarball dependency closures in fresh temporary consumer projects outside the repository.

No result above is an independent security or architecture review signature.

The content and boot restart cases above verify graceful close/re-open behavior. They do not claim
power-loss testing at every filesystem instruction boundary. Likewise, the content invariant is a
forward guard: legacy `content://<artifactId>` rows need original bytes or reviewed migration
evidence and are not reconstructed automatically.

File-lock hardening closes the stale-PID/ABA double-writer path by failing closed. It does not
provide automatic crash recovery: an abandoned lock can block availability until an operator proves
quiescence and follows the recovery runbook.

## Field-incident forensic record

A read-only parse of the preserved local transcript found that
`introduce_artifact("financial-ecosystem-overview")` ran before the content write and therefore had no
authoritative content reference. The subsequent `write_content` did succeed. Its exact 1,097-byte
UTF-8 Markdown body recomputes to
`sha256:dd24a81fe31e4a810ec178acd7597ac3fa994f14aa10749e9c27ef13273cb8ed`, exactly matching the
returned reference.

The later run called `read_content` twice with the ArtifactId `financial-ecosystem-overview`, not
with that ContentRef. The resulting claim that the content had never been written is therefore
false. The historical runtime/content bundle is not currently present, so this evidence does not
prove that the blob remains installed or that the legacy artifact mapping has been repaired. The
source bytes are recoverable from transcript evidence, but no state repair was performed.

## Scoped limitations

- `done` proves only that the loop received a non-empty completion claim and has no unresolved
  execution failures known to the current run's ledger. Ordinary read/write/coordination failures
  do not automatically poison an independent later instruction; their results remain visible in
  private history. Unresolved external observation receipts do cross runs because the prior side
  effect remains ambiguous. None of this proves that an Agent invoked every operation required by
  the user's domain-level success predicate. A task that needs a particular artifact, approval, or
  shared-world transition must supply and verify that predicate explicitly.
- Graceful early termination inside one received tool group is closed by explicit skipped results
  and a complete checkpoint. This does not close the hard-crash window below.
- Private history is checkpointed at the complete LLM response/tool-group boundary. A hard crash
  between tools in one multi-tool response can leave already durable content without a corresponding
  private-history checkpoint; per-tool recovery requires a separately designed execution journal.

## Stop-Ship release gates

### SS-01: Production swarm lifecycle is not implemented

`ClusterSupervisor` has no trusted committed-change subscription; runs
`registered` participants without an admitted `active` transition; discovers
Manifest JSON by scanning arbitrary observations; does not bind local `done` to
`signal_done`; and can wait forever or report vacuous success. CLI cluster
views are therefore read-only projections and must not be represented as an
operational swarm.

The previously reported heartbeat operand defect is closed: `turnCount` and `lastAction` are typed
replay scalars rather than content references, and `emittedAt` is captured once at commit and
persisted as replay authority. Exact operands survive codec, synchronous replay, resolver-backed
replay, and file restart. This closes record fidelity only; it does not provide the trusted commit
feed, participant activation, canonical Manifest binding, durable completion, liveness policy, or
permission semantics required for an operational swarm.

Lift conditions require an Owner-approved RFC/ADR covering participant
activation authority, canonical Manifest binding, durable commit-feed cursor,
cluster membership/completion semantics, heartbeat scheduling/liveness-expiry, and comms/human
permission boundaries, followed by a real-runtime L6/L7 closed-loop test with
no mock signal injection.

### SS-02: Epoch transition crash atomicity is incomplete

`MemoryEpochAdministration` keeps prepared/committed receipts in memory. A
process crash after durable head CAS but before holder/journal update cannot be
recovered from `admissionId` because the snapshot lacks schema ref, admission
id, and from-binding evidence.

Immutable binding snapshots and schema-digest recomputation prevent in-process alias and content
substitution drift; they do not make the epoch receipt journal durable or close this crash window.

Lift conditions require a durable epoch journal atomically committed with the
head, or a separately reviewed authenticated recovery protocol, plus a true
cross-process crash test at that exact boundary.

### SS-03: External-tool exactly-once execution is incomplete

The verified recovery path begins only after the external output and its strict
recovery receipt are durable. It safely retries `runtime.observe` without a
second executor call. It does not close the earlier window where the executor
has applied a filesystem, shell, or MCP side effect but output/receipt storage
fails or the process crashes. At a completed group boundary, CLI v3 does
automatically persist and restore `AgentLoopHistory.pendingToolObservations`;
that later checkpoint cannot reconstruct an invocation that crashed before its
output and receipt became durable.

`AbortSignal` and `maxTimeMs` bound LLM waits and prevent later dispatch, but
they cannot safely preempt an already-running external/content/runtime call
without leaving an unobserved late side effect. The budget is therefore not a
hard wall-clock cap for in-flight tools until cancellation and idempotent
outcome reconciliation are part of the executor contract.

Lift conditions require a durable pre-invocation journal, a stable executor
idempotency key and outcome-query contract, and crash tests at pre-dispatch,
post-side-effect/pre-output, post-output/pre-receipt, and
post-receipt/pre-observation boundaries.

## Lift status (2026-08-14)

This section records the real work performed against each gate. It does not
retrospectively rewrite the defect descriptions above; those remain the
as-reported record. Items not yet executed are marked **unverified** per the
governance baseline.

### SS-02: CLOSED (ADR-0014)

`docs/adr/0014-durable-epoch-journal.md` (Proposed → lift evidenced). `DurableWireBundle`
extended with an optional `schemaBinding`; `DurableCoordinator.compareAndSwapHeadWithBinding`
commits head + binding atomically; `commitEpochTransition` and `recoverEpochTransition` use
the durable bundle as the authority when the in-memory journal is empty. Real cross-process
crash test at `src/packages/runtime/tests/system/l7/epoch-transition-crash-atomic.test.ts`.
Runtime suite: 441 tests pass; coverage 92.33 statements / 88.7 branches / 96.94 functions /
92.29 lines.

### SS-01: §1–6 done + boot coverage gate passed; ADR-0015 §4 binding-semantics corrected (ADR-0015)

`docs/adr/0015-production-swarm-lifecycle.md` (Proposed; lift evidenced through §6 L6).
Implemented `activate_participant` operation + handler, `Participant.manifestRef` content
binding at activation, the `runtime.changes(cursor)` commit-feed cursor the supervisor
subscribes to, durable `signal_done` on completion, and heartbeat-scheduled liveness-expiry
`retire_participant`. The real-runtime L6 closed-loop test
(`src/packages/boot/tests/system/cluster/closedLoopSwarm.test.ts`, 3 tests, no mock signal
injection) drives activate → supervisor `startAgent` from the feed → `signal_done`
round-trip → `isClusterComplete` derived from the committed world.

The L6 test surfaced a real production defect: `submitLifecycleIntent` committed `signal_done`
with `from` = supervisor principal, but `signalDoneHandler` transitions the **`from`** binding,
so it transitioned the initiator (not the completed worker) to `done`. The defect was invisible
to every prior test because they used no-op mock `proposeAndCommit`. Fix (ADR-0015 §4):
`signal_done` is now the completing agent's own signal (`from` = target, committed under the
target's principal); `retire_participant` remains a supervisor action
(`from` = resolved supervisor principal, `participant` = target).

Boot coverage gate passes: 416 tests, statements 93.47% / branches 88.10% / functions 97.76% /
lines 93.47% (exit 0; `clusterSupervisor.ts` at 100% branch coverage). The 5 branches the
binding-semantics fix reopened are covered by
`src/packages/boot/tests/unit/cluster/supervisorLifecycleIntentCoverage.test.ts`
(retire/`resolveSupervisorPrincipal` paths via direct `checkStaleAgents()` drive + the real
`startAgent` duplicate guard).

**L7 cross-process crash variant (2026-08-14, evidenced):**
`src/packages/boot/tests/system/cluster/closedLoopSwarmCrash.test.ts` (3 tests, cross-process,
no mock signal injection) with child `tests/support/swarmSupervisorChild.mjs` against a
**file-backed** durable world (`createFileRuntimePersistence`). The supervisor process is
killed mid-lifecycle (after `startAgent`, before `signal_done`) and a fresh process is restarted
against the same file-backed world. The durable head carries the cursor, so the restart does NOT
duplicate `startAgent` (the cursor is past `activate_participant`) or `signal_done`. The orphaned
`active` worker converges via `retire_participant` (the §5 liveness-expiry path).

The L7 test surfaced a real production defect that the ADR's own §4 crash-ordering prose
assumed away: the liveness table is an in-process Map, so a fresh supervisor process started with
an empty table and the stale detector never saw the orphaned `active` participant — the world did
not converge. Fix (ADR-0015 §4, "Liveness reconciliation on (re)start"): `start()` now calls
`reconcileLivenessFromWorld(head)` with the same head read the cursor was seeded from (no extra
`getHead()` call). It re-seeds a liveness entry for every `active` participant that has a bound
`manifestRef` (distinguishing a real worker from the `active` initiator who was never activated)
and is not already tracked, reading `heartbeatIntervalMs` from the bound manifest; an orphan
whose agent process died is seeded already-expired so the first staleness tick retires it. The
`checkStaleAgents` retire decision is gated only on `elapsed > threshold` (no `this.agents.has()`
guard) so the orphan-with-no-`AgentInstance` case retires; a running healthy agent refreshes via
`emit_heartbeat` and never reaches the threshold.

The no-duplicate lift assertion (proved by the shared side-effect log across the whole
kill/restart lifecycle): `startAgent` recorded exactly once (in the crashed process), zero times
on restart; `signal_done` zero; restart converges via `retire_participant`. Boot coverage gate
after the L7 work: 419 tests, statements 93.5% / branches 88.2% / functions 97.77% / lines 93.5%
(exit 0); `clusterSupervisor.ts` at 100% statements / 98.62% branches / 100% functions.

**Remaining for full SS-01 lift (unverified):** independent Architecture + Security review for
QA-L5 exit.

### SS-03: production code + tool tiers + cross-process crash tests done; coverage gates green (ADR-0016)

`docs/adr/0016-external-tool-exactly-once.md` (Proposed; implementation evidenced). Tiered
contract (read / idempotent / non-idempotent), durable pre-invocation journal in the content
store, `executor.reconcile(key)` outcome query, and four-boundary crash tests.

**Implementation (`@cantilune/syscall`):** `ToolExecutor` extended with `tier`, a per-tool
`tierFor(toolName)`, and `reconcile(key)` (`src/packages/syscall/src/syscall.ts`). `useTool`
(`src/packages/syscall/src/act.ts`) now writes a `dispatched` journal entry before execute,
branches on the resolved tier when a `dispatched` entry is found on restart
(`read` → re-dispatch, `idempotent` → reconcile, `non-idempotent` → `ambiguous`), and writes a
`completed` entry after the output is durable. New `intentRef`/`readIntent`/`strictIntent`/
`writeIntent`/`invocationKey` helpers; new `disposition?: "ambiguous"` on `ToolResult`.

**Design correction (recorded in ADR-0016 §4):** the original draft §4 step 3 had a
"completed-reuse" path that looked up a `completed` journal entry by key. A content-addressed
store places a blob at `sha256(blob bytes)`; the `completed` blob carries the `outputRef`, so
its ref depends on the output and is **not** findable from the key after a crash. The path was
dead code (the boundary-3 test was silently passing via reconcile instead). `reuseCompletedOutput`
and the completed-lookup were removed; ADR-0016 §4 was rewritten with a "Design correction
(2026-08-14)" note. The findable `dispatched` entry (which carries no `outputRef`) drives
recovery; the `completed` entry is retained for observability only.

**Tool tier declarations (`@cantilune/tools`):** filesystem read/list/search → Tier 0 (`read`);
`filesystem_write_file` → Tier 1 (`idempotent`, `reconcile → unknown` — idempotent re-dispatch
is safe, the key carries no original args to prove "already written");
`filesystem_edit_file` → Tier 2 (`non-idempotent` — a second edit fails because `oldString` is
gone); `shell_run_command` → Tier 2; `web_search`/`web_fetch` → Tier 0; any `mcp_*` tool →
Tier 2 (unknown remote side effect, fail safe). The `createToolSet` composite routes `tierFor`/
`reconcile` to the owning executor.

**Cross-process crash boundary tests (the lift gate):**
`src/packages/syscall/tests/system/toolInvocationCrashBoundaries.test.ts` (5 tests) against a
file-backed content store, with a child process killed at each boundary
(`tests/support/toolInvocationCrashChild.mjs`; requires `pnpm build` of core/content/syscall):
boundary 1 (pre-dispatch) → restart fresh-dispatches (one execute); boundary 2 idempotent
(post-side-effect/pre-output) → reconcile(known), no second execute; boundary 2 non-idempotent
→ `ambiguous`, no re-dispatch; boundary 3 idempotent (post-output/pre-receipt) →
reconcile(known), no second execute; read tier → safe re-dispatch. Side-effect sidecar proves
exactly-once across process death.

**Coverage gates pass:** `@cantilune/syscall` 125 tests / statements 94.68% / branches 90.15%
/ functions 100% / lines 94.68% (exit 0). `@cantilune/tools` 125 tests / statements 96.95% /
branches 90.06% / functions 100% / lines 96.95% (exit 0). `intentRef`/`strictIntent`/`readIntent`
are exported as `@internal` white-box helpers and unit-tested directly (their defensive arms are
unreachable through the public entry with an honest content-addressed store).

**Remaining for full SS-03 lift (unverified):** independent Architecture + Security review for
QA-L5 exit.

### CLI #4 (advanced commands display-only): 4/4 done — all sub-items real

Owner approved "按四个子项依次全做" (do all four sub-items in sequence: content → cluster →
eval/schema → petri+ADR-0017). Plan approved (plan mode, 2026-08-14); governance
routing applied (S2 / S3 boundary on `/content gc` destructive delete → dry-run
default + `--confirm`; QA-L4 rising to QA-L5 at exit; M2→M3; ADR-0017 required for
the Petri executor since no firing engine exists — only a PNML structure and a
conformance digest verifier).

**content (DONE, verified 2026-08-14):** Real content store wired behind
`/content cat|ls|stats|gc|put|search`. `ContentStore` interface extended with
`list()` and `remove()` (destructive, GC-only, human-gated via `--confirm`); both
adapters (memory + file) implement them. `CliRuntimeHandle` now exposes
`contentStore()` and `syscallRuntime()`. `/content` handlers prefetch through
`CommandServices.contentStore` and stash results in `store.viewArgs`; `ContentView`
renders prefetched data with a runtime-audit-tail fallback. `content-gc` is
dry-run by default; `--confirm` deletes orphans (referenced refs from the audit
tail are never deleted). Removed the "Content body loading requires SyscallContentStore
injection" / "Connect content store" stubs. Coverage: content package 81 tests,
94.58/90.34/100/94.58; CLI 441 tests, 94.22/88.9/97.14/94.22 — both gates green.

**cluster (DONE, verified 2026-08-14):** Real `ClusterSupervisor` (ADR-0015)
wired behind `/cluster start|stop|status|topology|activate`. New
`src/packages/cli/src/wiring/clusterControl.ts` builds a controller from the
live `CliRuntimeHandle` backends (`syscallRuntime()` + `contentStore()` +
`storagePath()`) and an LLM adapter rebuilt from the store's provider/model
config; the controller builds a real `ClusterSupervisor` with the trusted
committed-change feed, `createDefaultConditionRegistry`, and the CLI's LLM
adapter. `/cluster start` builds and starts the supervisor; `/cluster stop`
calls the governed E-Stop (`supervisor.stop()`); `/cluster activate <agentId>`
stores an agent manifest via `contentStore.put()` and commits
`activate_participant` through `syscallRuntime.proposeAndCommit(coordinationIntent(...))`
as the active-initiator principal (ADR-0015 §1). The cluster view prefetches the
controller `status()` into `viewArgs.clusterStatus` and renders the live
supervisor event log alongside the world projection; the read-only
"ClusterSupervisor is not connected" notice was removed. `CommandServices`
gained `clusterControl?: () => ClusterController`; `app.tsx` holds one controller
per App lifecycle (lazily built, rebound on reboot, stopped on `resetRuntime`).
Coverage: CLI 461 tests, 94.07/88.59/96.56/94.07 — gate green. Controller logic
covered by `clusterControl.test.ts` (10 tests: start/stop/status/activate + all
rejection paths + runtime-rejection reporting); command wiring by
`clusterCommands.test.ts` (10 tests).

**eval-schema (DONE, verified 2026-08-14):** Real `EvaluationEngine` (ADR-0011)
wired behind `/eval list|run|report|compare`. New
`src/packages/cli/src/wiring/evalControl.ts` assembles a local
`EvaluationEngine` from the in-memory eval ports
(`@cantilune/evaluation/memory`: runStore, suiteRegistry, budgetLedger,
content-addressed store) plus three CLI-local adapters the package does not
ship: a `CandidateRunner`/`BaselineRunner` that bridge the CLI's
`createAdapter(buildLlmConfig(...))` LLM through a single-turn chat, store the
output + trace in the eval content store, and produce a `RunnerOutput` with a
content-addressed result digest and genuine token accounting from the adapter
receipt; and a `ConformanceCertificateResolver` local-mode shim that resolves
a self-attested certificate to a valid `ResolvedCertificate` whose digest
matches the candidate subject (production fleet resolution stays in the
conformance package). A minimal frozen `BenchmarkSuite`
("cli-local-smoke", 1 case) + frozen `EvaluationRunPlan` + `CandidateSubject`
(with `ArtifactSubject` from `@cantilune/conformance`, added as a direct CLI
dependency) + `EvaluationBudgetPolicy` are assembled at boot. `/eval run` is
an operation that drives the real engine path `admitRun → executeAttempt →
completeRun` — the attempt is marked "executed" from the genuine engine path,
never fabricated. `/eval list|report|compare` prefetch real
`suiteRegistry.listAll`/`runStore.listByPlan`/`runStore.listAttempts` into
`store.viewArgs`; `EvalView` renders prefetched suites, runs, and attempts with
a runtime-no-snapshot fallback. Removed the
`EVAL_INTEGRATION_MESSAGE`/"Evaluation data requires @cantilune/evaluation"
stub. `CommandServices` gained `evalControl?: () => EvalController`; `app.tsx`
holds one controller per App lifecycle (lazily built, dropped on `resetRuntime`
so a new run sequence starts from an empty run store). Coverage: CLI 512
tests, 94.07/88.06/96.84/94.07 — gate green. Controller logic covered by
`evalControl.test.ts` (20 tests: bootstrap helpers + real admit→execute→
complete path + admit/execute/complete rejection paths + runner
output/trace-put failure branches + certificate resolver); command + view
wiring by `evalCommands.test.ts` (19 tests). `@cantilune/control-plane` (real
`ControlPlaneService`, ADR-0006) was already wired behind `/schema *` in the
prior pass (schema sub-item): `controlPlaneControl.ts` bootstraps a genesis
schema revision + active binding; `/schema *` prefetch
`listSchemaRevisions`/`getActiveBinding`/`getSchemaRevision`/`readEvents` and
compute the real `computeMonotoneExtensionPlan` monotone-extension verdict;
`SchemaView` renders from prefetched data with a runtime-projection fallback.
`schemaControl.test.ts` (11 tests). Both eval + schema are now real.

**petri+ADR-0017 (DONE, verified 2026-08-14):** ADR-0017 (Proposed; English
primary at `docs/adr/0017-petri-net-executor.md`, Chinese mirror at
`docs/adr/zh-CN/0017-petri-net-executor.zh-CN.md`) records the decision. A new
dep-free package `@cantilune/petri` ships a real Petri firing engine:
`net.ts` (structural types + marking + enablement + self-loop rejection),
`firing.ts` (token-game consume/produce over the arc structure, immutable
next marking, forward-compat no-op `binding` for PT nets),
`reachability.ts` (bounded BFS with mandatory `maxSteps`, dead-marking
verdict), and `invariants.ts` (S-invariants from the incidence matrix via
Martinez–Silva signed elimination, with scalar-multiple + duplicate
reduction). The package's structural `PetriNet` type matches the existing
`pnmlExporter` type so a PNML-exported net is assignable without conversion
(honors AGENTS.md "跨包类型须继承/组合"). CLI wiring:
`src/packages/cli/src/wiring/petriControl.ts` projects the runtime
(artifacts + capabilities → places, observed operationTypeIds →
transitions, i-th capability → i-th transition → i-th artifact arcs),
drives the real `fire`/`reachable`/`placeInvariants`, and returns typed
snapshots; `petriCommands.ts` async-prefetches through
`services.petriControl()` and stashes in `store.viewArgs.petriData`;
`PetriView.tsx` renders genuine before/after markings, reachability
verdict + trace, and the S-invariant basis + change-chain T-invariant flag
— replacing the cosmetic "After (simulated)" stub. `/petri fire` is an
`operation` category. `CommandServices` gained
`petriControl?: () => PetriController`; `app.tsx` builds a stateless
controller (no LLM). Coverage: petri package 53 tests,
96.92/88.33/100/96.92 (gate green); CLI 542 tests, 93.91/88.17/96.51/93.91
(gate green). Petri engine math covered by `petri.test.ts`; CLI projection

- controller glue by `petriControl.test.ts` (15 tests); command wiring +
  view fallback by `petriCommands.test.ts` (10 tests); view rendering by
  `petriView.test.ts` (8 tests). typecheck/lint/prettier/build clean on both
  packages.

**Remaining for CLI #4 lift (unverified):** independent Architecture +
Security review for QA-L5 exit (shared with the SS-01/02/03 review gate).

## Follow-up decisions (D1/D2/C2) — all implemented & green (2026-08-14)

The whole-project audit that followed the SS-01/02/03 + CLI #4 lift recorded
three further design gaps (D1 inter-agent transport surface, D2 multi-agent
CLI boot, C2 soft-criterion LLM judge). The Owner approved "全部实现（推荐）"
(implement all three) via AskUserQuestion. ADRs 0018/0019/0020 (Proposed; Owner
design-approved 2026-08-14) record the decisions. Implementation realized and
green; independent Architecture + Security review remains the single shared
QA-L5 exit gate.

### D1: inter-agent transport — FileTransport realized (ADR-0018, T1)

`docs/adr/0018-inter-agent-transport-production.md` (Proposed; T1 FileTransport
evidenced). `src/packages/comms/src/transports/file/fileTransport.ts` implements
`CommunicationTransport` backed by the filesystem (fills the gap between the
in-process `LoopbackTransport` and the cross-host `A2ATransportAdapter`):
dispatch = E-Stop check → `assertVerifiedEnvelope` →
`encodeCommunicationWireFrame` → `atomicWriteFileSync` (fsync + atomic rename +
pid-sequenced temp); receive = E-Stop → `peekInbox` (readdir FIFO by sequence
prefix) → read → `maxFrameBytes*2` guard → **explicit base64-shape `BASE64_FRAME`
regex** (Node's `Buffer.from(_, "base64")` is lenient and never throws — the
explicit guard makes corrupt frames fail at the transport boundary instead of
silently decoding to wrong bytes) → byte-length>0; acknowledge = peek + unlink
(benign). `connectFileTransportPair` cross-links a-outbox↔b-inbox.

**Tests:** unit `fileTransport` (21) + contract conformance (4) + system
cross-process (2, real child process). **Comms gate:** 301 tests,
`fileTransport.ts` 98.86 statements / 90.9 branches / 100 functions / 98.86
lines; package branches 88.31% (≥88%), exit 0. typecheck/lint/prettier/build
green. **T3 `NetTransport` (TCP+TLS+mTLS) + T4 `a2a/0.1` conformance harness not
yet started** (recorded in the ADR stage table).

### D2: multi-agent CLI boot — bootSwarm realized (ADR-0019, S0–S3)

`docs/adr/0019-multi-agent-cli-boot.md` (Proposed; S0–S3 evidenced). `bootSwarm`
beside `bootCantilune` (single-Agent path byte-identical, zero regression); a
pluggable `AgentFactory` on `ClusterSupervisor` builds a full `CantilunOS` per
`active` participant against the SAME shared durable world (one
`CollaborationSnapshot`) with a distinct `principalId` / private history
(ADR-0012 isolation preserved). `CantiluneSwarm { supervisor, start, stop,
status, waitForCompletion, shutdown }`. Crash/restart reuses ADR-0015 §4
`reconcileLivenessFromWorld` — no new liveness logic.

**CLI surface (S2):** `/swarm` command family (`swarmCommands.ts` — `/swarm`,
`/swarm status|start|stop`, `/swarm activate <agentId>`, `/swarm wait`);
`SwarmController` (`swarmControl.ts`) boots via `bootSwarm`; `SwarmView.tsx` +
`ViewContainer` map entry + `ViewType` union; `app.tsx` service + `resetRuntime`
stop. Headless `--swarm` (`headlessRunner.ts`): `defaultSwarmBoot` builds a real
swarm, finds the first worker + active initiator, seeds the worker manifest with
the instruction + `ALWAYS_CONDITION`, commits `activate_participant`, and drives
`waitForCompletion`; real non-hanging failure results when no registered agent
exists or activation is rejected.

**Tests:** boot `bootSwarm.test.ts` (10 unit — incl. heartbeat-while-running +
full-spread optional-deps branch coverage), `bootSwarmClosedLoop.test.ts` (L6,
2 — real feed closed loop + stop-aborts-in-flight), `bootSwarmCrash.test.ts`
(L7, 3 — cross-process kill/restart via `bootSwarmChild.mjs`,
`describeOrSkip = distBuilt ? describe : describe.skip`; the no-duplicate
assertion: `startAgent` exactly once across the WHOLE lifecycle, ZERO on
restart, `signal_done` ZERO, orphan converges to `retired` via `agent_stale`).
CLI `swarmControl.test.ts` (14), `swarmCommands.test.ts` (17),
`headlessRunner.test.ts` (+3), `panelViews.test.tsx` (+8 SwarmView).

**Heartbeat test root cause (non-obvious):** the in-memory LLM `chat()` resolves
via microtasks only (no macrotask yield), so `os.run` completes in a single
microtask batch before the 5 ms `setInterval` macrotask fires; the
`.finally(stopHeartbeat)` clears the timer before the first tick. Fix:
`await new Promise((r) => setTimeout(r, 20))` in `chat()` to yield to the event
loop.

**Gates:** boot 456 tests, coverage statements 94.27 / branches 88.31 /
functions 98.02 / lines 94.27, exit 0; cli 584 tests, branches 88.11, exit 0.
typecheck/lint(touched files)/prettier/build green. **S4 `NetTransport`-backed
multi-host swarm not yet started** (depends on ADR-0018 T3/T4).

### C2: soft-criterion LLM judge — realized (ADR-0020, J1–J3)

`docs/adr/0020-llm-judge-verifier.md` (Proposed; J1–J3 evidenced).
`src/packages/boot/src/termination/judgeVerifier.ts` exports
`LLM_JUDGE_VERIFIER_ID="llm_judge"`, `DEFAULT_JUDGE_RHO=0.5`,
`JUDGE_PLACEHOLDER_RHO=0.3`, `createJudgeVerifier(options, seedSource)`. The
synchronous `Verifier.evaluate` is preserved via an async pre-pass + per-tick
cache (mirrors the `contractLlm` pattern). Blinding excludes
`pendingReply.text`; q is clamped to [0,1]; unparseable → q=0 fail-closed; rho
on fallback → 0.3 (placeholder); the pinned seed from the contract digest is
injected into the prompt text. Multi-judge = median + inter-rater spread. The
`STRUCTURED_RUBRIC_VERIFIER` placeholder is kept as a fail-closed fallback, not
replaced. `judgeAudit.ts` (append-only journal) + `judgeCalibration.ts` (frozen
fixture, diagnostic-only) are wired in `termination/index.ts`.

**Tests:** `judgeVerifier` (17) + `judgeCalibration` (5). **Boot gate:** part of
the 456-test / exit-0 gate above. typecheck/lint/prettier/build green. **J4
BudgetPolicy integration not yet started** (recorded in the ADR stage table).

### Summary: the single remaining gate

SS-01/02/03 + CLI #4 + D1/D2/C2 are all implemented and green (real production
code, real L6/L7 crash tests, coverage gates exit 0). **The only remaining
gate across the entire QA-0012 packet is the independent QA-L5 Architecture +
Security review.** The Owner is the DRI (COI) and cannot self-attest; the review
must be signed by non-DRI external reviewers. ADRs 0014–0020 remain Proposed
until that review and the Owner Acceptance signature. No merge/deploy proceeds
until Acceptance.

## QA gate conclusion

| Gate                          | Conclusion                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Q0 scope/governance           | Pass for reported single-Agent defect; ADR-0012 Owner approval pending                                                                     |
| Q1 static/unit                | Pass on affected packages                                                                                                                  |
| Q2 integration/contract       | Pass for history, content, completion, identity, epoch preflight                                                                           |
| Q3 system/restart             | World/content/private history pass; SS-01/02/03 + CLI #4 + D1/D2/C2 implementation closed, independent review pending                      |
| Q4 coverage                   | Pass; every affected package meets the repository threshold                                                                                |
| Q5 independent review/release | **Fail / Stop-Ship** — SS-01/02/03 + CLI #4 + D1/D2/C2 all implemented & green; await independent Architecture + Security review for QA-L5 |

## Owner decisions required

1. Approve or revise ADR-0012.
2. Choose the swarm lifecycle and Manifest identity contract before any CLI
   supervisor wiring. — **DONE** (ADR-0015, Owner design-approved 2026-08-14).
3. Choose durable epoch journal versus authenticated recovery input. — **DONE**
   (ADR-0014, Owner design-approved 2026-08-14).
4. Assign independent Architecture and Security reviewers for S3/QA-L5 exit. —
   **OPEN.** All implementation is realized and green; the Owner is the DRI
   (COI) and cannot self-attest. This is the single remaining gate. A review
   package + checklist is prepared at `docs/qa/qa-0012-l5-review-package.md`
   for assignment to non-DRI external reviewers.
5. Choose the durable external invocation journal and executor idempotency/status contract. —
   **DONE** (ADR-0016, Owner design-approved 2026-08-14).
6. **(Added) D1/D2/C2 follow-up** — **DONE** (ADR-0018/0019/0020, Owner
   design-approved 2026-08-14; all implemented and green).
