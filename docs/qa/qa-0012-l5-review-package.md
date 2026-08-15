---
title: QA-0012 Independent L5 Architecture + Security Review Package
document_type: review-package
status: review-ready / awaiting-non-dri-reviewer
risk: S3
quality_target: QA-L5
maturity: M2
owner: Joker-of-Gotham (DRI — COI, cannot self-attest)
updated: 2026-08-14
related: docs/qa/0012-agent-execution-continuity-qa.md, ADR-0014–0020
---

# QA-0012 Independent L5 Review Package

This package assembles everything an **independent, non-DRI** Architecture +
Security reviewer needs to sign off the QA-0012 release gate. It is
**review-ready**: all implementation is realized and green; the only missing
signature is the independent review itself.

> **COI disclosure.** The Owner (Joker-of-Gotham) is the DRI for every ADR and
> every implementation artifact listed here. Per the governance baseline, the
> DRI cannot self-attest their own DRI work. The signatures collected via this
> package MUST come from reviewers who are not the DRI. Any signature by the
> DRI on this package is a COI violation and does not lift the Stop-Ship.

## 1. Scope of this review

This package covers the seven ADRs whose realization closes the QA-0012
release gate (the three Stop-Ship gates SS-01/02/03, the CLI #4 advanced-command
gap, and the three follow-up design gaps D1/D2/C2):

| ADR      | Boundary                                   | Gate   | Status                                                       |
| -------- | ------------------------------------------ | ------ | ------------------------------------------------------------ |
| ADR-0014 | Durable epoch journal atomic with head     | SS-02  | Proposed; Owner design-approved; impl green                  |
| ADR-0015 | Production swarm lifecycle                 | SS-01  | Proposed; Owner design-approved; impl green                  |
| ADR-0016 | External-tool exactly-once execution       | SS-03  | Proposed; Owner design-approved; impl green                  |
| ADR-0017 | Petri net executor (CLI #4 petri sub-item) | CLI #4 | Proposed; Owner design-approved; impl green                  |
| ADR-0018 | Inter-agent transport (FileTransport, T1)  | D1     | Proposed; Owner design-approved; T1 green; T3/T4 not started |
| ADR-0019 | Multi-agent CLI boot (bootSwarm, S0–S3)    | D2     | Proposed; Owner design-approved; S0–S3 green; S4 not started |
| ADR-0020 | LLM judge verifier (J1–J3)                 | C2     | Proposed; Owner design-approved; J1–J3 green; J4 not started |

Two shared ADRs provide the foundational invariants this review builds on
(already Accepted at M2 interim): **ADR-0003** (runtime threat model) and
**ADR-0012** (agent execution continuity / SS-02 origin). ADR-0006/0007/0008
(control-plane + comms threat models) are referenced where transport security
boundaries are touched.

## 2. Reviewer roles to fill

| Role                          | ADRs                                     | COI                | Current    |
| ----------------------------- | ---------------------------------------- | ------------------ | ---------- |
| Architecture second reader    | 0014, 0015, 0016, 0017, 0018, 0019, 0020 | Yes (DRI authored) | unassigned |
| Security / Threat Model       | 0014, 0015, 0016, 0018, 0019, 0020       | Yes (DRI authored) | unassigned |
| AI-Eval (RFC-0004 §12 quorum) | 0020 only                                | Yes (DRI authored) | unassigned |

> The Security reviewer covers ADR-0017 only if they judge the Petri engine's
> future `firingDigest` binding in scope; the engine is pure/read-only today,
> so ADR-0017's security surface is nil by construction (noted in its ADR).

## 3. Artifacts under review

### 3.1 ADR-0014 (SS-02 — epoch crash atomicity)

- **Decision:** `docs/adr/0014-durable-epoch-journal.md` (English primary);
  `docs/adr/zh-CN/0014-durable-epoch-journal.zh-CN.md` (mirror).
- **Production code:** `src/packages/runtime/src/` — `DurableWireBundle` extended
  with optional `schemaBinding`; `DurableCoordinator.compareAndSwapHeadWithBinding`
  (head + binding atomic CAS); `commitEpochTransition` / `recoverEpochTransition`
  use the durable bundle as authority when the in-memory journal is empty.
- **L7 crash test:** `src/packages/runtime/tests/system/l7/epoch-transition-crash-atomic.test.ts`
  (child commits an epoch transition, is killed after durable CAS, fresh process
  loads the bundle and reconstructs holders from the durable binding).
- **Coverage gate:** runtime — 441 tests; statements 92.33 / branches 88.7 /
  functions 96.94 / lines 92.29; EXIT=0.

### 3.2 ADR-0015 (SS-01 — production swarm lifecycle)

- **Decision:** `docs/adr/0015-production-swarm-lifecycle.md`; zh-CN mirror.
- **Production code:** `src/packages/boot/src/cluster/` —
  `activate_participant` operation + handler; `Participant.manifestRef`
  content binding at activation; `ClusterSupervisor` rewritten to consume
  `runtime.changes(cursor)` commit-feed cursor; durable `signal_done`
  (`from` = completing agent, corrected during implementation — see §4 defect log);
  heartbeat-scheduled liveness-expiry `retire_participant`;
  `reconcileLivenessFromWorld(head)` called from `start()` (the §4
  liveness-reconciliation fix surfaced by the L7 test).
- **L6 test:** `src/packages/boot/tests/system/cluster/closedLoopSwarm.test.ts`
  (3 tests, real feed closed loop, no mock signal injection).
- **L7 test:** `src/packages/boot/tests/system/cluster/closedLoopSwarmCrash.test.ts`
  (3 tests) + child `src/packages/boot/tests/support/swarmSupervisorChild.mjs`
  (file-backed durable world; supervisor killed mid-lifecycle, fresh process
  restarts; no-duplicate `startAgent`/`signal_done`; orphan converges via
  `retire_participant`).
- **Coverage gate:** boot — `clusterSupervisor.ts` 100% stmts / 98.62% branches
  / 100% functions; package gate green (see QA packet §"SS-01" for the exact
  numbers at the time of that lift).

### 3.3 ADR-0016 (SS-03 — external-tool exactly-once)

- **Decision:** `docs/adr/0016-external-tool-exactly-once.md`; zh-CN mirror.
- **Production code:** `src/packages/syscall/src/syscall.ts` (`ToolExecutor`
  extended with `tier` / `tierFor` / `reconcile`); `src/packages/syscall/src/act.ts`
  (`useTool` rewritten: pre-execute `dispatched` journal entry, tier-branch on
  restart, post-execute `completed`); new `intentRef`/`readIntent`/`strictIntent`/
  `writeIntent`/`invocationKey` helpers; `disposition?: "ambiguous"` on `ToolResult`.
  `src/packages/tools/` tier declarations (filesystem=read/idempotent/non-idempotent,
  shell=non-idempotent, web=read, mcp=non-idempotent fail-safe).
- **Design correction (recorded in ADR §4):** the original "completed-reuse" path
  was dead code — a content-addressed store places a blob at `sha256(blob)`, so a
  `completed` blob's ref depends on the output and is NOT findable from the key
  after a crash. Removed; the findable `dispatched` entry drives recovery.
- **L7 tests:** `src/packages/syscall/tests/system/toolInvocationCrashBoundaries.test.ts`
  (5 tests) + child `src/packages/syscall/tests/support/toolInvocationCrashChild.mjs`
  (four boundaries + read-tier re-dispatch).
- **Coverage gates:** syscall — 125 tests / branches 90.15% / EXIT=0; tools —
  125 tests / branches 90.06% / EXIT=0.

### 3.4 ADR-0017 (CLI #4 — Petri net executor)

- **Decision:** `docs/adr/0017-petri-net-executor.md`; zh-CN mirror.
- **Production code:** `src/packages/petri/` — new dep-free package:
  `net.ts` (structural types + marking + enablement + self-loop rejection),
  `firing.ts` (token-game consume/produce, immutable next marking), `reachability.ts`
  (bounded BFS with mandatory `maxSteps`), `invariants.ts` (S-invariants via
  Martinez–Silva signed elimination). CLI wiring: `src/packages/cli/src/wiring/petriControl.ts`,
  `petriCommands.ts`, `PetriView.tsx`.
- **Tests:** `petri.test.ts` (53, engine math), `petriControl.test.ts` (15),
  `petriCommands.test.ts` (10), `petriView.test.ts` (8).
- **Coverage gate:** petri — 53 tests / 96.92/88.33/100/96.92 / EXIT=0; CLI gate green.
- **Security surface:** nil by construction — the engine is pure, dep-free,
  read-only over the runtime. Firing never commits to the world.

### 3.5 ADR-0018 (D1 — inter-agent transport, T1 FileTransport)

- **Decision:** `docs/adr/0018-inter-agent-transport-production.md`; zh-CN mirror.
- **Production code:** `src/packages/comms/src/transports/file/fileTransport.ts`
  — `CommunicationTransport` backed by filesystem: dispatch = E-Stop →
  `assertVerifiedEnvelope` → `encodeCommunicationWireFrame` →
  `atomicWriteFileSync` (fsync + atomic rename + pid-sequenced temp); receive =
  E-Stop → `peekInbox` (readdir FIFO by sequence prefix) → read →
  `maxFrameBytes*2` guard → **explicit base64-shape `BASE64_FRAME` regex guard**
  (Node's `Buffer.from(_, "base64")` is lenient and never throws — the explicit
  guard makes corrupt frames fail at the transport boundary instead of silently
  decoding to wrong bytes) → byte-length>0; acknowledge = peek + unlink (benign).
  `connectFileTransportPair` cross-links a-outbox↔b-inbox.
- **Tests:** unit `fileTransport` (21) + contract conformance (4) + system
  cross-process (2).
- **Coverage gate:** comms — 301 tests; `fileTransport.ts` 98.86/90.9/100/98.86;
  package branches 88.31% / EXIT=0.
- **Not in scope of this review (T3/T4):** `NetTransport` TCP+TLS+mTLS +
  `a2a/0.1` conformance harness — not yet started; the ADR stage table records
  this. Do NOT sign T3/T4.

### 3.6 ADR-0019 (D2 — multi-agent CLI boot, S0–S3)

- **Decision:** `docs/adr/0019-multi-agent-cli-boot.md`; zh-CN mirror.
- **Production code:** `src/packages/boot/src/swarm/bootSwarm.ts` — `bootSwarm`
  beside `bootCantilune` (single-Agent path byte-identical, zero regression);
  pluggable `AgentFactory` on `ClusterSupervisor` builds a full `CantilunOS` per
  `active` participant against the SAME shared durable world (one
  `CollaborationSnapshot`) with a distinct `principalId` / private history
  (ADR-0012 isolation preserved). `CantilunSwarm { supervisor, start, stop,
status, waitForCompletion, shutdown }`. Crash/restart reuses ADR-0015 §4
  `reconcileLivenessFromWorld` — no new liveness logic.
- **CLI surface (S2):** `src/packages/cli/src/wiring/swarmControl.ts`,
  `src/packages/cli/src/commands/swarmCommands.ts` (`/swarm`,
  `/swarm status|start|stop`, `/swarm activate <agentId>`, `/swarm wait`),
  `src/packages/cli/src/views/SwarmView.tsx`, `ViewContainer.tsx`, `store.ts`
  `ViewType`, `app.tsx` service + `resetRuntime` stop. Headless `--swarm` in
  `src/packages/cli/src/headless/headlessRunner.ts` (`defaultSwarmBoot`: builds
  real swarm, finds first worker + active initiator, seeds manifest with
  instruction + `ALWAYS_CONDITION`, commits `activate_participant`, drives
  `waitForCompletion`; real non-hanging failure results when no registered agent
  or activation rejected).
- **L6 test:** `src/packages/boot/tests/system/swarm/bootSwarmClosedLoop.test.ts`
  (2 tests — real feed closed loop + stop-aborts-in-flight).
- **L7 test:** `src/packages/boot/tests/system/swarm/bootSwarmCrash.test.ts`
  (3 tests) + child `src/packages/boot/tests/support/bootSwarmChild.mjs`
  (`describeOrSkip = distBuilt ? describe : describe.skip`; the no-duplicate
  assertion: `startAgent` exactly once across the WHOLE lifecycle, ZERO on
  restart, `signal_done` ZERO, orphan converges to `retired` via `agent_stale`).
- **Unit tests:** `src/packages/boot/tests/unit/swarm/bootSwarm.test.ts` (10 —
  incl. heartbeat-while-running + full-spread optional-deps branch coverage);
  cli `swarmControl.test.ts` (14), `swarmCommands.test.ts` (17),
  `headlessRunner.test.ts` (+3), `panelViews.test.tsx` (+8 SwarmView).
- **Coverage gate:** boot — 456 tests / statements 94.27 / branches 88.31 /
  functions 98.02 / lines 94.27 / EXIT=0; cli — 584 tests / branches 88.11 / EXIT=0.
- **Not in scope of this review (S4):** `NetTransport`-backed multi-host swarm —
  not yet started (depends on ADR-0018 T3/T4). Do NOT sign S4.

### 3.7 ADR-0020 (C2 — LLM judge verifier, J1–J3)

- **Decision:** `docs/adr/0020-llm-judge-verifier.md`; zh-CN mirror.
- **Production code:** `src/packages/boot/src/termination/judgeVerifier.ts`
  (`LLM_JUDGE_VERIFIER_ID="llm_judge"`, `DEFAULT_JUDGE_RHO=0.5`,
  `JUDGE_PLACEHOLDER_RHO=0.3`, `createJudgeVerifier(options, seedSource)`).
  Synchronous `Verifier.evaluate` preserved via async pre-pass + per-tick cache
  (mirrors `contractLlm`). Blinding excludes `pendingReply.text`; q clamped
  [0,1]; unparseable → q=0 fail-closed; rho on fallback → 0.3 (placeholder);
  pinned seed from contract digest injected into prompt text. Multi-judge =
  median + inter-rater spread. `STRUCTURED_RUBRIC_VERIFIER` placeholder kept as
  fail-closed fallback (NOT replaced). `judgeAudit.ts` (append-only journal),
  `judgeCalibration.ts` (frozen fixture, diagnostic-only). Wired in
  `src/packages/boot/src/termination/index.ts`.
- **Tests:** `judgeVerifier.test.ts` (17), `judgeCalibration.test.ts` (5).
- **Coverage gate:** boot — part of the 456-test / EXIT=0 gate above.
- **Not in scope of this review (J4):** BudgetPolicy integration — not yet
  started. Any production termination claim relying on the judge additionally
  requires RFC-0004 §12 quorum + independent AI-Eval review (the AI-Eval
  reviewer role above).

## 4. Defects found and fixed during implementation (reviewer focus)

These are real production defects the implementation work surfaced, NOT known
ahead of time. They are documented here because each was invisible to prior
tests (the tests used no-op mocks). The reviewer should confirm each fix is
correct and that no analogous defect remains.

1. **SS-01 `signal_done` binding-semantics (ADR-0015 §4).** `submitLifecycleIntent`
   committed `signal_done` with `from` = supervisor principal, but
   `signalDoneHandler` transitions the **`from`** binding — so it transitioned
   the initiator (not the completed worker) to `done`. Invisible to prior tests
   (no-op mock `proposeAndCommit`). Fix: `signal_done` is the completing agent's
   own signal (`from` = target, committed under the target's principal);
   `retire_participant` remains a supervisor action (`from` = resolved supervisor
   principal, `participant` = target).
2. **SS-01 liveness reconciliation on (re)start (ADR-0015 §4).** The liveness
   table is an in-process Map, so a fresh supervisor started with an empty table
   and the stale detector never saw the orphaned `active` participant — the
   world did not converge. Fix: `start()` calls `reconcileLivenessFromWorld(head)`
   with the same head read the cursor was seeded from (no extra `getHead()`).
   It re-seeds a liveness entry for every `active` participant with a bound
   `manifestRef` (distinguishing a real worker from the `active` initiator who
   was never activated), seeded already-expired so the first staleness tick
   retires the orphan. The `checkStaleAgents` retire decision is gated only on
   `elapsed > threshold` (the `this.agents.has()` guard was removed — it
   suppressed the only convergence path for an orphan with no `AgentInstance`).
3. **SS-03 completed-reuse dead code (ADR-0016 §4 "Design correction").** The
   draft §4 step 3 looked up a `completed` journal entry by key — but a
   content-addressed store places a blob at `sha256(blob)`, and the `completed`
   blob carries `outputRef`, so its ref depends on the output and is NOT
   findable from the key after a crash. The path was dead code (boundary-3 test
   silently passed via reconcile). Removed; the findable `dispatched` entry
   drives recovery.
4. **D1 base64 leniency (ADR-0018).** Node's `Buffer.from(_, "base64")` is
   lenient and never throws — a corrupt frame would silently decode to wrong
   bytes. Fix: explicit `BASE64_FRAME` regex guard at the transport receive
   boundary.
5. **D2 heartbeat-never-fires (ADR-0019 test, non-obvious).** The in-memory LLM
   `chat()` resolves via microtasks only (no macrotask yield), so `os.run`
   completes in a single microtask batch before the 5 ms `setInterval` macrotask
   fires; `.finally(stopHeartbeat)` clears the timer before the first tick. Fix
   is test-only: `await new Promise((r) => setTimeout(r, 20))` in `chat()` to
   yield to the event loop. No production code change — the production heartbeat
   path is correct; the test was not exercising it.

## 5. Architecture review checklist

For each ADR, the Architecture reviewer confirms:

- [ ] The decision matches the implemented code (no drift between ADR and `src/`).
- [ ] The invariants the ADR claims are actually enforced by the code (e.g.,
      ADR-0012 private-history isolation in ADR-0019's per-agent `CantilunOS`;
      ADR-0003 runtime/content authority boundary in ADR-0016's content-addressed journal).
- [ ] The "no parallel entity type" rule (AGENTS.md) holds: cross-package types
      compose/extend core fields (e.g., ADR-0017's `PetriNet` matches `pnmlExporter`'s
      type; ADR-0019 reuses `ClusterSupervisor`, no second supervisor).
- [ ] The crash/restart convergence proof is real (L7 tests use file-backed
      durable worlds + real child processes, not mocks; `describeOrSkip` does not
      silently skip on the reviewer's machine — `pnpm build` then re-run).
- [ ] The defects in §4 are genuinely fixed and no analogous defect remains.
- [ ] Stages marked "not started" (ADR-0018 T3/T4, ADR-0019 S4, ADR-0020 J4) are
      NOT signed — only the realized stages are in scope.
- [ ] The single-Agent `bootCantilune` path is byte-identical (ADR-0019 S0
      back-compat claim) — diff `bootCantilune.ts` against the pre-ADR-0019 state if
      the reviewer wants hard proof.

## 6. Security / Threat Model review checklist

- [ ] **ADR-0014:** the durable binding is atomic with the head; no window
      where a crash leaves a head without its matching schema binding (the L7 test
      kills the child after durable CAS). Confirm no TOCTOU between binding read
      and head read on recovery.
- [ ] **ADR-0015:** `signal_done` authority is the completing agent (not the
      supervisor) — confirm a participant cannot forge another's `signal_done`
      (committed under the target's principal; the runtime enforces principal
      authority). `retire_participant` is a supervisor-only action — confirm the
      `resolveSupervisorPrincipal` path cannot be spoofed.
- [ ] **ADR-0016:** the tier contract is fail-safe (non-idempotent → `ambiguous`,
      never silent re-execute). The `dispatched` journal entry carries no
      `outputRef` (findable) — confirm no secret leakage in journal entries. The
      `mcp_*` tools are non-idempotent fail-safe (unknown remote side effect).
- [ ] **ADR-0018 (T1):** the `BASE64_FRAME` regex guard rejects corrupt frames
      at the boundary. `atomicWriteFileSync` (fsync + rename) prevents torn writes.
      `maxFrameBytes*2` guard prevents resource exhaustion. The pid-sequenced temp
      prevents cross-process collision. Confirm the E-Stop path cannot leave a
      partial frame readable (atomic rename is the publication point).
- [ ] **ADR-0019:** per-agent `principalId` isolation holds — no agent hydrates
      another's private transcript (ADR-0012 invariant). The headless `--swarm`
      failure results are real (non-hanging) — no silent-success path. Confirm the
      shared `contentStore` does not leak one agent's manifest/artifacts to another's
      private history.
- [ ] **ADR-0020:** prompt blinding excludes `pendingReply.text` (no answer
      leakage into the judge prompt). q is clamped [0,1]; unparseable → q=0
      fail-closed. The pinned seed from the contract digest is injected into the
      prompt text (determinism). `judgeLlm` must NOT share the loop adapter
      (ADR-0020 §"Must not share"). The `STRUCTURED_RUBRIC_VERIFIER` placeholder
      (rho=0.3) is fail-closed, not a silent pass. **Secret sanitization:** confirm
      no API key or secret is logged in `judgeAudit` records.
- [ ] No ADR introduces secret leakage, unprovenanced assets, or embodied
      control without E-Stop + safe state (governance Stop-Ship triggers).
- [ ] Coverage gates are package-level (statements/functions/lines ≥90%,
      branches ≥88%, index/barrel excluded) — confirm no file was excluded to
      meet the gate (the `exclude` is only `src/**/index.ts`).

## 7. How to reproduce the green gates

```bash
# Build (the L7 tests import from dist/)
pnpm -r build

# Per-package coverage gates (the reviewer should run these, not trust this doc)
pnpm --filter @cantilune/runtime test:coverage   # ADR-0014
pnpm --filter @cantilune/boot test:coverage      # ADR-0015, 0019, 0020
pnpm --filter @cantilune/syscall test:coverage   # ADR-0016
pnpm --filter @cantilune/tools test:coverage     # ADR-0016 tool tiers
pnpm --filter @cantilune/petri test:coverage     # ADR-0017
pnpm --filter @cantilune/comms test:coverage     # ADR-0018
pnpm --filter @cantilune/cli test:coverage       # ADR-0017/0019 CLI surface

# The L7 crash tests specifically (cross-process; require dist built)
pnpm --filter @cantilune/runtime vitest run tests/system/l7/epoch-transition-crash-atomic.test.ts
pnpm --filter @cantilune/boot vitest run tests/system/cluster/closedLoopSwarmCrash.test.ts
pnpm --filter @cantilune/boot vitest run tests/system/swarm/bootSwarmCrash.test.ts
pnpm --filter @cantilune/syscall vitest run tests/system/toolInvocationCrashBoundaries.test.ts
```

Every gate must report EXIT=0. If any L7 test reports `describe.skip` (dist not
built), run `pnpm --filter @cantilune/boot build` (or the relevant package
build) and re-run — `describeOrSkip` is a convenience, not a silent pass.

## 8. Sign-off

> The reviewer fills this in. A signature here lifts ONLY the ADR(s) the
> reviewer's role covers, and ONLY the realized stages listed in §3. It does
> NOT lift T3/T4 (ADR-0018), S4 (ADR-0019), or J4 (ADR-0020). It does NOT
> constitute production release authority (Product Conformance per RFC-0003
> remains separate). It does NOT waive the COI rule: the DRI's signature here
> is void.

| Role                       | Reviewer (name) | ADR(s) / stages                                            | Verdict                    | Date | Signature |
| -------------------------- | --------------- | ---------------------------------------------------------- | -------------------------- | ---- | --------- |
| Architecture second reader | _________       | 0014, 0015, 0016, 0017, 0018(T1), 0019(S0–S3), 0020(J1–J3) | ☐ Accept ☐ Request changes | ____ | _________ |
| Security / Threat Model    | _________       | 0014, 0015, 0016, 0018(T1), 0019(S0–S3), 0020(J1–J3)       | ☐ Accept ☐ Request changes | ____ | _________ |
| AI-Eval (RFC-0004 §12)     | _________       | 0020(J1–J3)                                                | ☐ Accept ☐ Request changes | ____ | _________ |

### Reviewer notes (attach findings here)

<!-- Each reviewer appends: findings, requested changes, residual risks, and
the exact commit/SHA they reviewed against. -->

## 9. What this package is NOT

- **Not** production release authority. Product Conformance (RFC-0003, ADR-0009,
  ADR-0010) is a separate gate with its own checklist
  (`docs/qa/conformance-l5-review-checklist.md`).
- **Not** a Lean / formal-proof review. The formal kernel (ADR-0001, the Lean
  theory) is out of scope; this package covers the production engineering
  boundaries only.
- **Not** a waiver of the COI rule. The DRI (Joker-of-Gotham) authored all
  artifacts; the DRI cannot sign this package. Only non-DRI signatures count.
- **Not** a claim that T3/T4 (ADR-0018), S4 (ADR-0019), or J4 (ADR-0020) are
  done — those stages are explicitly out of scope and unsigned.
