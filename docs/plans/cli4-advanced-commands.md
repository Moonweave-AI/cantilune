# CLI #4 — Advanced Commands (content / cluster / eval / schema / petri)

> Status: **EXECUTED — all four sub-items landed (2026-08-14)**
> Date: 2026-08-14
> Owner: Joker-of-Gotham (DRI)
> QA Packet: `docs/qa/0012-agent-execution-continuity-qa.md` → CLI #4 zone
>
> This plan is retained as the execution record for the original four
> sub-items (content / cluster / eval-schema / petri). Those phases shipped.
> It is **not** “only independent review left”: A23–A26 / A45–A53 residuals
> are recorded below. Owner gates C1–C8 stay open.

---

## 0. Governance Routing (Moonweave Governance Router)

### Classification & Rationale

- **Work object**: Feature (multi-package implementation). Four advanced CLI views move from display-only stubs to wired, runnable behavior; one new Petri executor package is created.
- **One-sentence restatement**: Make `/content cat|ls|stats|gc` read a real content-addressed store, make `/cluster start` instantiate and drive a real `ClusterSupervisor`, make `/eval *` and `/schema *` call real `@cantilune/evaluation` + `@cantilune/control-plane` services, and replace the simulated `petri-fire` with a real Petri-net firing engine (new package + ADR-0017) — all with tests passing the CLI coverage gate.

### Risk / Quality / Maturity

| Axis         | Level                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Risk**     | **S2** (with one S3 boundary)                                                | No secret handling, no network egress added (eval runner will be in-process/adapter-bound, same egress surface as the existing chat adapter), no destructive data, no embodiment. The one S3 boundary: `/content gc` deletes unreferenced blobs from the content store — a destructive filesystem action. Mitigated: dry-run default + explicit `--confirm` flag; never auto-delete. |
| **QA**       | **QA-L4** (the existing CLI target) rising toward **QA-L5** (Stop-Ship exit) | Production-path code with per-package coverage gate (statements/functions/lines ≥90%, branches ≥88%, vitest v8). CLI gate: 90/88/90/90.                                                                                                                                                                                                                                              |
| **Maturity** | **M2→M3**                                                                    | Petri executor is a new M2 scaffold-with-tests; the four view rewirings promote existing M2 stubs to M3 wired+covered.                                                                                                                                                                                                                                                               |

### Required Artifacts & Reviewers

| Artifact                                   | Required?                      | Status                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR-0017** (Petri executor)              | ✅ required                    | TO DRAFT (highest existing ADR is 0016). Formal-semantics §5.2 authorizes the place/transition net but §12.2 marks the firing lift _unverified_ — the executor realizes it.              |
| ADR (content/cluster/eval/schema rewiring) | reuse existing                 | ADR-0015 (cluster lifecycle), ADR-0011/0012 (eval), ADR-0006 (control-plane). No new ADR; record wiring notes in QA-0012.                                                                |
| RFC                                        | reuse                          | RFC-0004 (evaluation harness) covers eval; RFC-0001 (architecture) covers the four projections.                                                                                          |
| Threat model delta                         | ⚠️ check                       | `/content gc` adds a destructive path; `/cluster start` spawns agent processes. Both stay within ADR-0003/0015 threat models. Flag for Security review at QA-L5 exit, not a blocker now. |
| Architecture review                        | ✅ at exit                     | Independent Architecture + Security review for QA-L5 (shared with SS-01/02/03 final review).                                                                                             |
| Coverage gate                              | ✅ per-package ≥90/≥88/≥90/≥90 | Enforced by `vitest.config.ts` in each package.                                                                                                                                          |

### Stop-Ship scan

- No secret leakage. No unprovenanced assets. No unreviewed sensitive data. No high-impact Agent behavior without permission boundaries: `/cluster start` reuses the already-governed `ClusterSupervisor` (ADR-0015, E-Stop via `shutdown()`), no new permission surface. `/content gc` is the only new destructive action → gated behind `--confirm`. **No Stop-Ship trigger.**

### Cadence (Owner-chosen)

"ADR 与实现分区并行" — ADR-0017 drafted in parallel with implementation; ADR-0017 + plan approved before the Petri executor package and view rewirings are written. This matches the Owner's standing instruction.

---

## 1. Scope & Non-goals

### In scope (4 sub-items, done in sequence per Owner's "按四个子项依次全做")

1. **content** — real content store behind `/content cat|ls|stats|gc`.
2. **cluster** — real `ClusterSupervisor` behind `/cluster start` (and a live cluster view).
3. **eval/schema** — wire `@cantilune/evaluation` + `@cantilune/control-plane`.
4. **petri + ADR-0017** — real Petri-net executor replacing the simulated `petri-fire`.

### Non-goals

- No new network egress / no new provider integrations (eval runner reuses the existing in-process `@cantilune/adapter`, same egress surface as the chat path).
- No change to the SS-01/02/03 production fixes.
- Pre-existing `anthropicAdapter.test.ts` 401 test is **out of scope** (requires network-access authorization; flagged separately).
- Not building a full benchmark dataset; the eval wiring ships with a minimal frozen suite + the missing ports as thin in-process adapters, sufficient to prove the path and pass coverage.

---

## 2. Key architectural facts (verified this session)

- **`CliRuntimeHandle`** ([runtimeSync.ts:175](src/packages/cli/src/runtimeSync.ts#L175)) is a closure capturing `coordinationRuntime`, `wrappedRuntime` (the syscallRuntime), `durable`, `contentStore`, `os`. It currently exposes only `os / privateHistory() / syncRuntime() / shutdown()`. The `contentStore` and `syscallRuntime` it already holds are **not exposed** — exposing them is a trivial, additive change.
- **`CommandServices`** ([registry.ts:10](src/packages/cli/src/commands/registry.ts#L10)) is the command side-effect channel; every member optional, absent in headless/inspect. Built in [app.tsx:242](src/packages/cli/src/app.tsx#L242). The handle lives in `useAgentLoop`'s `runtimeHandleRef` ([useAgentLoop.ts:264](src/packages/cli/src/tui/hooks/useAgentLoop.ts#L264)) and is **not** passed to commands or to `services`. → To surface `contentStore`/`syscallRuntime`/control-plane/eval to commands+views, extend `CliRuntimeHandle` to expose them, expose the handle via a `useAgentLoop` accessor, and add accessor methods to `CommandServices`.
- **`ContentStore`** ([contentStore.ts:42](src/packages/content/src/contentStore.ts#L42)) interface = `isAvailable/put/get/exists/metadata/count`. **No `list()`** → needed for `content-ls/stats/gc`. Both adapters (`fileContentStore`, memory) must be extended.
- **`ControlPlaneService`** ([controlPlaneService.ts:95](src/packages/control-plane/src/engine/controlPlaneService.ts#L95)) is fully implemented: `listSchemaRevisions/getSchemaRevision/getActiveBinding/getSchemaAdmission/readEvents`. `bootstrapDefaultControlPlane(store)` returns `{ service, genesisRevision, genesisBinding }`. `computeMonotoneExtensionPlan` (exported from index) is the real schema-diff primitive.
- **`EvaluationEngine`** ([evaluationEngine.ts:51](src/packages/evaluation/src/execution/evaluationEngine.ts#L51)) is implemented (`admitRun/executeAttempt/completeRun`). Its ports need `candidateRunner/baselineRunner/certificateResolver` — **NO implementation exists** (only test mocks). These three ports must be built as thin in-process adapters for the CLI wiring to run.
- **`@cantilune/evaluation` + `@cantilune/control-plane` are OPTIONAL peerDeps** in `cli/package.json` (lines 43-56), **not** in `dependencies`. They must move to `dependencies` for the CLI build to import them in production.
- **No Petri firing engine exists anywhere.** `pnmlExporter.ts:18` defines a `PetriNet` _structure_ only; `conformance/petriVerifier.ts` only verifies SHA-256 digests over `PetriSemanticEvidence`, it does not fire. Formal-semantics §5.2 authorizes a place/transition net; §12.2 marks the firing lift unverified. → A new package + ADR-0017 is required.
- CLI `vitest.config.ts` thresholds: statements/functions/lines ≥90%, branches ≥88%.

---

## 3. Implementation plan (sequential, per Owner's cadence)

### Phase A — content (wiring + list() + tests)

**A1.** Extend `ContentStore` interface with `list(): readonly ContentEntry` (ContentEntry = `{ ref, byteLength, source? }`); implement in both `fileContentStore` (scan `<2hex>/<64hex>.blob` + read `.meta.json`) and `memoryContentStore`. Export `ContentEntry` from content barrel.
**A2.** Extend `CliRuntimeHandle` to expose `contentStore(): CliContentStore | undefined`.
**A3.** Expose the handle back to `services`: add a `runtimeBackends?: () => { contentStore?; syscallRuntime? }` accessor to `CommandServices`; wire it in `app.tsx` from the `useAgentLoop`-exposed handle accessor.
**A4.** Rewrite `ContentView`:

- `content-cat`: `contentStore.get(ref)` → render bytes (utf-8 text; hex preview for binary).
- `content-ls`: `contentStore.list()` → real ref/size table.
- `content-stats`: `list()` → total blobs, total bytes, referenced (cross-ref auditTail), orphans.
- `content-gc`: **dry-run default** — list orphans; only delete with `--confirm`. Print `Deleted N blobs (unverified until confirmed run)`.
- Remove "Content body loading requires SyscallContentStore injection" / "Connect content store".
  **A5.** Tests: extend `contentStore` unit tests for `list()`; new `contentViewWiring.test.ts` exercising cat/ls/stats/gc(dry-run) against a memory store; ensure existing `viewOutputs*.test.ts` content assertions still pass or are retargeted. Keep CLI coverage gate green.

### Phase B — cluster (real supervisor behind /cluster start)

**B1.** Extend `CliRuntimeHandle` to expose `syscallRuntime()` (the wrappedRuntime).
**B2.** Add `/cluster start` command (operation category) that builds a `ClusterSupervisor` from the handle's `SharedResources`-equivalent + the CLI's existing LLM adapter via an `llmAdapterFactory` (`(manifest) => createAdapter(llmConfig)` — reuse `buildLlmConfig`/`createAdapter` already in [useAgentLoop.ts:200](src/packages/cli/src/tui/hooks/useAgentLoop.ts#L200)). The supervisor uses the **same** coordination runtime / content store / condition registry as the handle (reuse `createStaticSchemaProvider` + `DEFAULT_TEMPLATES`).
**B3.** Surface supervisor lifecycle via `CommandServices` (a `clusterControl?: { start, stop, status }` channel) + a `cluster` slice in `RuntimeState`/`AppStore` (agents, lastEvent) so `ClusterView` can render live state.
**B4.** Remove the read-only notice at [ClusterView.tsx:14-15](src/packages/cli/src/views/ClusterView.tsx#L14) ("[Read-only world projection] ClusterSupervisor is not connected"); render the supervisor's agent table + event feed when connected, keep a clean "not started" empty state otherwise. E-Stop = `supervisor.shutdown()` (already governed by ADR-0015).
**B5.** Tests: `clusterCommands.test.ts` for `/cluster start`/`stop`/`status`; a `clusterViewWiring.test.tsx` rendering a seeded supervisor state; reuse the existing `swarmSupervisorChild.mjs` harness to assert the CLI-started supervisor converges (startAgent → done). Keep coverage gate green.

### Phase C — eval/schema (wire the two optional-peer services)

**C1.** Move `@cantilune/evaluation` and `@cantilune/control-plane` from optional `peerDependencies` → `dependencies` in `cli/package.json`. (Verification: `pnpm --filter @cantilune/cli... build` then `vitest` still green.)
**C2.** Build the three missing eval ports as **thin in-process adapters** in `src/packages/cli/src/wiring/evalAdapters.ts`:

- `CandidateRunner`/`BaselineRunner`: bridge `@cantilune/adapter` (`createAdapter`) + a single-turn prompt → `RunnerOutput` (`outputRefs` via the content store, `tokenUsage` from adapter receipt, `resultDigest` from `core` digest, `terminalDisposition`). No `ToolSandbox` complexity in v1 (manifest may declare zero tools).
- `ConformanceCertificateResolver`: a minimal resolver that accepts a self-attested certificate ref for the CLI local-mode path (resolve → valid, checkRevocation → false). Documented as the local-mode shim; production fleet resolution stays in the control-plane package.
  **C3.** Construct an `EvaluationEngine` + a minimal frozen `BenchmarkSuite` (1-2 cases) at boot; register in a `SuiteRegistry`; expose `evalEngine()` + `suiteRegistry()` from `CliRuntimeHandle`.
  **C4.** Rewrite `EvalView`:
- `eval-list`: `suiteRegistry.list()` → real suites.
- `eval-run`: `engine.admitRun` → `executeAttempt` (seed from `viewArgs`/index) → `completeRun`; show attempt status + token usage. Mark live results "executed"; never fabricate.
- `eval-report`: read the `RunAttempt`s for `viewArgs.runId` → real summary.
- `eval-compare`: diff two runs' `RunAttempt[]` in-CLI (no compare API exists — confirmed).
- Remove `EVAL_INTEGRATION_MESSAGE`.
  **C5.** Construct a `ControlPlaneService` (via `bootstrapDefaultControlPlane(new MemoryControlPlaneStore())`) at boot; expose `controlPlane()` from `CliRuntimeHandle`.
  **C6.** Rewrite `SchemaView` (replace `schemaDataFromRuntime`):
- `schema-ops`: `service.listSchemaRevisions()` → `getSchemaRevision` → real `operationTypes`/`templates` catalog.
- `schema-epoch`: `service.getActiveBinding(domain)` → real `SchemaEpochBinding`.
- `schema-epoch-history`: `service.readEvents()` filtered to schema/policy events → real append-only timeline.
- `schema-diff`: `getSchemaRevision(A/B)` + `computeMonotoneExtensionPlan` → real monotone-extension verdict.
- `schema-validate`: `computeMonotoneExtensionPlan` against current vs candidate → real verdict.
  **C7.** Tests: `evalViewWiring.test.ts`, `schemaViewWiring.test.ts`; retarget `viewOutputs*.test.ts` eval/schema assertions from stub strings to service-derived content. Keep coverage gate green.

### Phase D — petri + ADR-0017 (real executor)

**D1.** Draft **ADR-0017** (`docs/adr/0017-petri-executor.md`, + zh-CN mirror): scope = realize the formal-semantics §5.2 place/transition net; net built from `OrchestrationSchema.operationTypes` port contracts (inputs/outputs = arcs, object types = places) + registered operation handlers as transitions; firing = consume input tokens / produce output tokens, check `requires`/`ensures` (`TemplateCondition`), resolve `MatchBinding`; reachability = BFS toward goal; invariants = S-invariant (token-sum) + T-invariant (transition-sequence). State the §12.2 "unverified firing lift" closure. Non-goals: no full P/T coverability, no CTL/LTL model checking in v1.
**D2.** Create package `src/packages/petri`:

- `src/net.ts`: `PetriNet` (reuse the structural type from `pnmlExporter` — import, don't duplicate, per "跨包类型须继承/组合 core 已有字段，禁止平行实体类型"), `Marking`, `buildNetFromSchema(schema): PetriNet`.
- `src/firing.ts`: `enabledTransitions(net, marking)`, `fire(net, marking, transitionId, bindings): Result<Marking>`.
- `src/reachability.ts`: `reachable(net, marking, goal): { reachable, trace }`.
- `src/invariants.ts`: `sInvariants(net)`, `tInvariants(net)`.
- `package.json` deps `@cantilune/core` (reuse `OrchestrationSchema`, `MatchBinding`, `ContentDigest`), `@cantilune/runtime` (schema type only — type import, no runtime dep cycle).
- Coverage gate config; full unit tests for build/fire/reach/invariants.
  **D3.** Add `@cantilune/petri` to `cli/package.json` dependencies; wire `PetriView`:
- `petri`: `buildNetFromSchema` + current marking from runtime snapshot → real marking table.
- `petri-transitions`: `enabledTransitions(net, marking)`.
- `petri-fire`: `fire(...)` → real "after" marking (label `After (fired):`); render before/after `DiffView`.
- `petri-reach`: `reachable(net, marking, goal)`.
- `petri-invariants`: `sInvariants` + `tInvariants` → real rows.
  **D4.** Update tests: `petriView.test.ts` — retarget all 4 (place names from schema object types, token counts, real after-marking, label `After (fired):`); `viewOutputs.test.ts`/`viewOutputsExtended.test.ts` petri branches. Keep coverage gate green.

### Phase E — finalize

**E1.** Run full CLI coverage gate (`pnpm --filter @cantilune/cli test:coverage`); ensure 90/88/90/90. Run new `petri` package gate.
**E2.** Update `docs/qa/0012-agent-execution-continuity-qa.md` CLI #4 entry from "not started — unverified" to per-sub-item completed-work record (mark genuinely-executed vs. any unverified bits honestly).
**E3.** Update memory `qa-0012-release-gates.md` CLI line.
**E4.** Note Owner C2 (independent Architecture + Security review, _unassigned_) **and** the A23–A26 / A45–A53 residuals in §6. Do not treat this plan as fully closed.

---

## 4. Honest status & unverified markers

- Nothing will be marked "verified" unless the actual test/coverage run executed. The pre-existing `anthropicAdapter.test.ts` 401 failure (real network call when `ANTHROPIC_API_KEY` set) is **out of scope** and reported separately; it needs network-access authorization to investigate.
- The eval `CandidateRunner`/`BaselineRunner`/`ConformanceCertificateResolver` adapters are **new CLI-local shims**, not the production fleet resolver; documented as such.

## 5. Sequence summary

content → cluster → eval/schema → petri(+ADR-0017) → coverage + QA-0012 update.
Each phase lands green (tests + gate) before the next, matching "按四个子项依次全做".

## 6. A23–A26 / A45–A53 residuals (2026-08-15)

The original four sub-items are not the whole CLI honesty surface. Status is
mixed: some items were engineered after this plan; some still lie.

| ID | Surface | Honest status (2026-08-15) |
| -- | ------- | -------------------------- |
| A23 | `/observe*` `/graph*` `/trace*` `/replay*` `/world diff` | **Done (impl).** Observability / replay / worldDiff wired. Graph edges are beforeRef/afterRef, not a changeLog chain. |
| A24 | `/eval` local C9 shim | **Done (impl).** TUI `createEvalController` uses fail-closed C9. Shim remains test-only behind `allowLocalShim: true`. |
| A25 | `/schema` vs live file world | **Done (impl).** Default `FileControlPlaneStore` at `{storagePath}/control-plane`; memory only when ephemeral. |
| A26 | TUI tools / MCP | **Done (impl).** `createCliToolSet` injected at boot; MCP lists `CliConfig.mcpServers`. |
| A45 | `/content search` | **Done (impl).** Body/ref filter; empty query fail-closed. |
| A46 | `/content gc` reference closure | **Done (impl).** Closure is auditTail.payloadRef ∪ artifacts.contentRef ∪ session refs. |
| A47 | `/schema diff` `/schema validate` | **Done (impl).** Resolves `epochA`/`epochB` and runs `computeMonotoneExtensionPlan`. |
| A48 | `/schema ops` | **Done (impl).** Rows read `requiredRoles` / `defaultVisibility` / `mayCreateSessions`. |
| A49 | `/export *` | **Done (impl).** Same projections as `/graph`/`/petri`/`/observe`; atomic write to `storagePath/exports/`. |
| A50 | `/eval run` suite / `/eval compare` | **Done (impl).** Suite honored; compare uses `compareEvaluationRuns`. |
| A51 | `/compact` | **Done (impl).** LLM summary only with contract/judge; otherwise honest omit (not “summarize”). |
| A52 | `/tools test` | **Done (impl).** Schema/dry-run only; injected tools refuse execute. |
| A53 | `CliConfig` mcp/tools/contract/judge + `/mcp connect` | **Done (impl).** Persist + epoch-bound attach; HTTP and stdio MCP allowed (ADR-0026). |

Owner C2 (independent Architecture + Security, _unassigned_) still applies to
this packet. Do not treat §6 as Acceptance.
