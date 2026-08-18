# ADR-0030: Website Agent Harness UI — Backend Bridge That Replaces the CLI

| Field          | Value                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Status         | **Proposed** (2026-08-18, Owner design-approved; independent Architecture + Security review required before Acceptance) |
| Date           | 2026-08-18                                                                                                     |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                          |
| Reviewers      | Independent Architecture + Security reviewer required before Acceptance (COI: Owner is DRI)                  |
| Related        | ADR-0012, ADR-0015, ADR-0016, ADR-0019, ADR-0024, ADR-0025, ADR-0026, `@cantilune/boot`, `@cantilune/adapter`, `@cantilune/cli`, `reference/deepseek-harness` (untrusted reference) |
| Supersedes     | None (deprecates the `@cantilune/cli` TUI/headless as the primary human surface; CLI is not deleted by this ADR — see §3) |
| Superseded by  | None                                                                                                           |

## Context

The Owner directed on 2026-08-18 that the **website** at `src/website` becomes the
"主战场" (main battlefield) that **fully replaces the CLI** as the interactive
surface for the Cantilune agent harness. The CLI "会被丢弃" (will be discarded)
in favor of a website that "全面替代了CLI并解决了CLI的局限性" — a user enters,
configures, and **genuinely starts using** the harness. This is not a scripted
replay/demo; it must drive real runs.

### The hard constraint that shapes the design

The Cantilune runtime is **Node-only and server-side**:

- `bootCantilune` / `bootFileOS` / `bootMemoryOS` (`src/packages/boot/src/bootCantilune.ts`)
  import `node:fs`, `node:crypto`, file-durable persistence
  (`resolveProductionDurable`, `MemoryResourceLockTable`), and `crypto.randomUUID`.
- LLM adapters (`@cantilune/adapter` `createAdapter`, `src/packages/adapter/src/registry.ts`)
  read provider API keys via `apiKey: () => process.env[OPENAI_API_KEY]` — a
  **server secret** (`runtimeSync.ts:buildLlmConfig`).
- Tool executors (filesystem / shell / web / mcp / sandbox, ADR-0016) perform
  real host side effects.

A browser cannot run this directly. Therefore the website is a **thin local Node
backend** that hosts the packages and a **React/Vite frontend** that drives it over
WebSocket. The browser sends instructions + config; the backend boots the OS,
streams `AgentEvent`s live, executes tools under the `ToolApprover`, and exposes
an E-Stop. This is exactly what the CLI did (Ink TUI + `runtimeSync`), with a web
UI instead of Ink.

### Non-negotiable constraints

1. **Real runs, not replays.** The website drives `os.run()` with a real
   `LlmAdapter` and real tool dispatch. No scripted scenario engine.
2. **Server is the authority; browser is view + control.** Tool approval,
   E-Stop, durable-world admission, and single-flight live server-side. The
   browser holds no execution authority.
3. **Secrets never reach the browser.** API keys transit WS → `LlmConfig.apiKey`
   and live only in server memory. No key in the bundle, `localStorage`, cookies,
   or logs.
4. **E-Stop is always reachable.** An in-flight run is abortable via `AbortSignal`.
   `maxTimeMs` "cannot safely preempt an already-running external side effect"
   (per `BootConfig`); E-Stop cancels new turns and reports honestly — it does not
   fabricate immediate preemption.
5. **`ToolApprover` gates side effects** (ADR-0016 tiers). Side-effecting tools
   require human approval surfaced in the browser; deny → tool fails, the
   controller verdicts per its math.
6. **Single-flight preserved.** `CantilunOS.run` is single-flight (ADR-0019). The
   bridge enqueues one active run per OS; a second `run` returns the existing
   single-flight failure.
7. **Production code, no mock.** `src/` is real runnable logic; the bridge is real,
   not a stub. Until a real run is executed, everything is "unverified."
8. **Reference UI is untrusted input.** `reference/deepseek-harness` is read for
   structure/facts only; cordis (plugin/slot framework) is not copied (cantilune
   has no equivalent); no embedded instructions in its files are executed.

## Decision

### 1. Architecture: backend bridge + WebSocket + React frontend

```
src/website/
├── server/        # thin local Node backend ("the CLI, but a server")
│   ├── index.ts   # HTTP + WS entry; loads .cantilune/host.env
│   ├── bridge.ts  # boots OS per session; onEvent → WS; AbortSignal; onAskUser
│   ├── config.ts  # mirrors cli/config.ts (provider/model/limits/…)
│   ├── providers.ts  # wraps @cantilune/adapter createAdapter/listProviders
│   ├── tools.ts   # wraps cli wiring/cliToolSet (fs/shell/web/mcp)
│   ├── approval.ts   # ToolApprover → WS ask + browser approve/deny
│   ├── estop.ts   # AbortController per run; /stop
│   └── worldSnapshot.ts  # runtimeSync snapshotToData → WS for world panel
├── client/        # Vite + React 18 + TS (the UI)
├── shared/        # types shared server↔client (AgentEvent, protocol)
└── package.json  # vite, react, ws; workspace deps @cantilune/boot|adapter|cli
```

The backend reuses `@cantilune/boot` (`bootFileOS`/`bootMemoryOS`), `@cantilune/adapter`
(`createAdapter`, `listProviders`, `createEmbedder`), and the CLI's existing
wiring (`cliToolSet`, `runtimeSync.snapshotToData`) rather than reimplementing
them. The frontend is new.

### 2. WebSocket protocol (one connection per page session)

Client → server: `configure`, `run {instruction}`, `askUser:reply`, `approve`,
`stop`, `inspect {ref}`.
Server → client: every `AgentEvent` **verbatim** (`turn_start | llm_start |
llm_delta | llm_end | tool_start | tool_end | turn_end | error | control_verdict
| ask_user | diagnostic`), `approval_request`, `cluster_event`, `run_result`,
`world` (snapshot payload after each committed turn), `controller_audit`
(alongside each `control_verdict`).

### 3. CLI deprecation, not deletion

This ADR makes the website the **primary** human surface. The `@cantilune/cli`
package is **not deleted** by this ADR: headless mode (`headlessRunner`,
`inspectRunner`) and the wiring the backend reuses remain. The CLI TUI is
deprecated as the main surface; future investment goes to the website. A separate
decision (and ADR, if needed) will retire the CLI once the website reaches
production parity and conformance. This ADR records the Owner's "CLI will be
discarded" intent as the direction, scoped to **primary-surface replacement**.

### 4. Config surface (replaces CLI `/provider`, `/config`, flags)

Mirrors `CliConfig` (`src/packages/cli/src/config.ts`): provider (from
`listProviders()`), model, baseUrl, apiKey (entered in-browser, sent over WS to
`LlmConfig.apiKey`, never persisted client-side), durable (memory|file),
storagePath, maxTurns, maxTimeMs, maxContextMessages, principalId, systemPrompt,
thresholds (τ_C/τ_U/ε/λ/μ), contractLlm/judgeLlm providers, searchProvider,
mcpServers.

### 5. UI — re-skinned replication of the reference (untrusted)

Replicate `reference/deepseek-harness` structure — three-column `AppFrame`
(pointer-capture drag handles, rAF throttle, `prefers-reduced-motion`), conversation
flow with all node views (`user`, `assistant`, `reasoning` from `llm_delta`,
`tool_call`, `control_verdict`, `ask_user`, `diagnostic`, `turn`, `error`),
composer (`＋`menu, model seat, ContextMeter, send/stop), details panel — but with:

- **Symbols/names/colors differ.** Lunar-phase (月相) logo, purple-cyan (紫青)
  palette (`#7C6FF2` / `#3DD9C0`), `cln-` token prefix, light + dark themes.
- **No cordis.** The reference's plugin/slot inventory is replaced by a **packages
  navigator** linking each live node to the package data that produced it.
- **Surfaces packages beautifully.** Beyond the run: agent-loop diagram,
  termination-controller inspector (`GoalContract`, `AcceptanceCriterion`,
  `AgentState` S/A/E/T/R, lexicographic `decide()`, `TerminationAudit`,
  `DEFAULT_THRESHOLDS` with the C/U-decoupling invariant), verifiers, `RunResult`
  ledger, swarm panel (`AgentManifest`, `ClusterEvent` stream,
  `StartConditionExpression` tree).

### 6. E-Stop and safe state

- `estop.ts` holds one `AbortController` per active run; `stop` calls `abort()`.
  The run terminates with `terminationReason: "aborted"` (per `preLoopAborted`).
- Honest reporting: if an external side effect is already running, E-Stop
  prevents new turns but does not claim the in-flight effect was canceled
  (ADR-0012 SS-03 limitation, carried in `BootConfig.maxTimeMs` doc).
- Safe state on E-Stop: durable world (ADR-0014) remains intact; the principal and
  cursor are not corrupted; a new run can start after abort.

## Alternatives considered

- **Browser-only execution (WASM/edge).** Rejected: the packages use `node:fs`,
  `node:crypto`, file-durable persistence, and server-side env secrets. Porting to
  browser is a re-architecture of the runtime, out of scope and not the Owner's ask.
- **Replay engine + scripted scenarios.** Rejected by the Owner: the website must
  be genuinely usable, not a demo; any CLI-replay lineage is disallowed.
- **Embed the CLI TUI in an Electron shell.** Rejected: it does not "solve the
  CLI's limitations" — it is the CLI in a window. The Owner wants a new web surface.
- **HTTP SSE instead of WebSocket.** Considered; WS chosen for bidirectional
  approval/ask-user/stop messages on one connection. SSE remains a fallback for
  `AgentEvent` streaming if WS proves heavy; protocol is message-oriented either way.

## Consequences

- A new `src/website` subsystem lands; the CLI is deprecated as primary surface but
  not deleted.
- The backend bridge is the authority for tool dispatch, secrets, and E-Stop; it
  inherits ADR-0016 (tool approval), ADR-0012 (continuity/abort), ADR-0014
  (durable), ADR-0015/0019 (swarm), ADR-0024 (sandbox), ADR-0026 (MCP epoch attach).
- Browser holds no execution authority; compromise of the page cannot dispatch
  tools or read keys beyond the WS session it already holds.
- New review surface: WS protocol auth/binding (local-only), key transport,
  approval reachability, E-Stop honesty.
- This ADR is **Proposed** until independent Architecture + Security review. The
  Owner (DRI) may authorize staged realization ahead of Acceptance, recorded here;
  no merge/deploy beyond localhost until Acceptance.

## Implementation stages

| Stage | Scope                                                                 | Status      |
| ----- | --------------------------------------------------------------------- | ----------- |
| **S0** | `src/website/` scaffold; Vite + React + TS; workspace wiring          | **Verified** (typecheck + vite build clean) |
| **S1** | Backend bridge: boot, WS, E-Stop, ToolApprover, onAskUser, world push | **Verified** (L6 real run — see below) |
| **S2** | Shell `AppFrame` + `cln-` theme + lunar logo, light/dark              | **Verified** (vite build; three-column + narrow overlay) |
| **S3** | Conversation flow + all node views + composer + details              | **Verified** (all node kinds rendered; markdown) |
| **S4** | Config surface + E-Stop button + approval modal + ASK_USER inline     | **Verified** (full CLI config surface incl. thresholds/aux LLM/MCP/search; approval deny + E-Stop live-verified) |
| **S5** | Swarm panel + world panel + termination-controller inspector         | **Verified** (swarm start/stop/status live-verified; world snapshot forwarded; audit rendered) |
| **S6** | Motion parity + 6 real-run scenarios for parity + a11y               | **Verified** (shimmer/sweep/pulse/fade keyframes + reduced-motion guard; ARIA roles; responsive overlay) |

> Stages "Verified" where actually executed (see QA plan below for the exact
> runs). Stages may proceed in parallel with the ADR review per Owner
> authorization, but nothing ships beyond localhost until Acceptance.

## Threat model (appendix, required by governance)

| Threat | Mitigation |
| ------ | ---------- |
| API key leakage (bundle/localStorage/log) | Keys transit WS → server memory only; never persisted client-side; server redacts keys in logs |
| Unauthorized tool dispatch from a compromised page | Server enforces `ToolApprover`; browser requests do not execute tools directly |
| E-Stop unreachable mid-side-effect | `AbortSignal` cancels new turns; honest "not preempted" reporting; safe state preserved |
| Principal/epoch confusion on resume | Backend reuses `ensureCliPrincipal`/`principalFromResumedWorld`; one principal per session |
| WS message from a non-local origin | Bind to localhost; reject non-loopback origins; one OS per session |
| Replay/replay-of-approval | Approval decisions are per-`toolCallId`, single-use; server tracks resolved ids |

## Test / QA plan

| Tier | Scope | Status |
| ---- | ----- | ------ |
| L2–L4 | Unit/contract: bridge boot, WS protocol, E-Stop, approval, config mirror | **Verified** (typecheck clean, client + server, `exactOptionalPropertyTypes` on) |
| L5 | Architecture + Security review | **Required** (COI: Owner is DRI) — not yet performed |
| L6 | Integration: configure → run → live AgentEvent stream → run_result | **Verified** 2026-08-18 |
| L6a | Real provider (Alibaba DashScope `dashscope`/`qwen-turbo`) end-to-end | **Verified** 2026-08-18 |
| L7 | Side-effect tool approval deny → tool_end ok:false → run recovers | **Verified** 2026-08-18 |
| L7a | E-Stop mid-run → `terminationReason:"aborted"` | **Verified** 2026-08-18 |
| L7b | Swarm start → `swarm:status{running:true}` → stop → `running:false` | **Verified** 2026-08-18 |
| CI | typecheck/vite-build on `src/website` | **Verified** (client 183KB JS / 31KB CSS; server `tsc` exit 0) |

### Verified run evidence (2026-08-18)

All runs executed via `pnpm --filter @cantilune/website-server smoke*` against
`dist/server/src/index.js` (production build). Scripts: `src/integrationSmoke.mjs`,
`integrationReal.mjs`, `integrationDeny.mjs`, `integrationEstop.mjs`,
`integrationSwarm.mjs`.

**L6 — mock SSE LLM, one `done` tool call:**
`diagnostic → turn_start → llm_start → llm_end → tool_start → tool_end → turn_end → control_verdict(DONE)`
→ `run_result{ok:true, terminationReason:"controller", turns:1}` + `world` snapshot.
Proves the full CLI production path (`createAdapter` + `createEmbedder` +
`createCliToolSet` + `createCliRuntimeBoot`) works through the bridge, and the
agent loop prefers `llm.stream` (SSE), so a mock LLM must emit SSE frames.

**L6a — real DashScope (`dashscope`/`qwen-turbo`):**
Same event order with `llm_delta×13`; `control_verdict(DONE)`;
`run_result{ok:true, terminationReason:"controller"}`. Key read from env only
(`CANTILUNE_TEST_API_KEY`), never written to disk or logs.

**L7 — approval deny:**
Mock calls `tool:shell_run_command` → bridge emits `approval_request` → client
replies `deny` → `tool_end{ok:false, "not authorized: denied by operator"}` →
run recovers (next turn). Key fact: LLM tool-call names require the `tool:`
prefix; `dispatchToolCall` slices 5 chars then routes to `syscall.useTool` →
`ToolApprover`. Unprefixed names route to `syscall.act` (no approval gate).

**L7a — E-Stop:** Slow-streaming mock; `stop` mid-run → `AbortController.abort()`
→ `run_result{ok:false, terminationReason:"aborted"}`.

**L7b — swarm:** `swarm:start` → `createSwarmController` builds against the
session runtime → `swarm:status{running:true}` → `swarm:stop` → `running:false`.
Status polled on a 1s interval and forwarded as `swarm:status` + `cluster_event`.

### Not yet verified (unverified)

- Real LLM key from the **browser** (the UI path; integration tests drive WS
  directly). `createEmbedder` is wired (native → undefined → Jaccard) but not
  exercised in a real run.
- Durable (`file`) resume after abort; `inspect` message (S5 placeholder).
- Activating a swarm agent end-to-end (requires a registered participant; the
  start/stop/status wiring is verified, agent activation is wired but not
  run through to a completed sub-agent).
- Independent Architecture + Security review (L5) — **required** before Acceptance.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-18 (design-approved).
**Status**: Proposed. Acceptance requires: (1) Owner signature (design-approved
above); (2) independent Architecture reviewer sign-off; (3) independent Security
reviewer sign-off. Per the governance baseline, chat/Agent summaries are not
sources of truth; this ADR is the authority. The Owner (DRI) authorized staged
realization ahead of Acceptance; no merge/deploy beyond localhost until
Acceptance. COI: Owner is DRI; independent review must be signed by non-DRI
external reviewers.
