# ADR-0019: Multi-Agent CLI Boot — Supervisor Entry, Shared-World Swarm, and Single-Agent Back-Compat

| Field          | Value                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Status         | **Proposed** (Owner-approval pending; implementation not started)                                              |
| Date           | 2026-08-14                                                                                                     |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                          |
| Reviewers      | Independent Architecture + Security reviewer required before Acceptance (COI: Owner is DRI)                    |
| Related        | RFC-0001 §8, ADR-0012, ADR-0015, ADR-0014, ADR-0018, `@cantilune/boot`, `@cantilune/cli`, `@cantilune/runtime` |
| Supersedes     | None (extends ADR-0015 swarm lifecycle to the CLI boot surface)                                                |
| Superseded by  | None                                                                                                           |

## Context

The whole-project audit (finding **D2**) recorded that **the CLI still boots a single Agent** via `bootCantilune`. `bootCantilune` (`src/packages/boot/src/bootCantilune.ts:394`) constructs one `CantilunOS` that owns "one ordered private history" and is **single-flight** (`singleFlightFailure`, `:266`: _"CantilunOS.run is single-flight because one OS owns one ordered private history"_). The CLI calls `bootCantilune` exactly once (`runtimeSync.ts:367`).

ADR-0015 made the production swarm real at the runtime/supervisor layer: `activate_participant`, `Participant.manifestRef`, the commit-feed-cursor `ClusterSupervisor`, durable `signal_done`, heartbeat-scheduled liveness-expiry retirement, and liveness reconciliation on restart. But ADR-0015's `ClusterSupervisor` is not yet a **CLI entry point**: there is no `bootSwarm` (or equivalent) that a user invokes to start multiple agents against one shared durable world. The swarm lifecycle exists as a runtime capability the CLI does not expose.

This ADR closes that gap: it specifies the CLI/boot surface that starts and supervises a multi-agent swarm against a single shared durable `CollaborationSnapshot`, while preserving the single-Agent `bootCantilune` path for the observer/developer case.

### Non-negotiable constraints

1. **One world, one ordered history per agent.** Each agent owns its own private history (single-flight per `CantilunOS`); the collaboration world is the shared authority. No agent reads another's private transcript.
2. **No new authority role.** Activation uses the active-initiator rule already fixed by ADR-0015 §1; the supervisor's `from` authority is the configured `supervisorPrincipal` or the head's first `active` participant (ADR-0015 §4).
3. **Committed-feed is the only trusted signal path.** The supervisor consumes `runtime.since(cursor)`; no push injection (ADR-0015 §3).
4. **Crash-safe.** A supervisor restart resumes from the durable `lastObservedHead` cursor; an orphaned `active` participant converges via liveness reconciliation (ADR-0015 §4) and `retire_participant`.
5. **Production code, no mock.** Per AGENTS.md, `src/` must be real runnable logic; no mock/placeholder/hardcoded bypass on the production path.
6. **Coverage gate.** All new code under L2–L7 thresholds (statements/functions/lines ≥90%, branches ≥88%).

## Decision

### 1. Add `bootSwarm` beside `bootCantilune`, not in place of it

- `bootCantilune` stays the **single-Agent** entry (observer mode, developer REPL, one agent + one human). Unchanged.
- `bootSwarm(deps): CantiluneSwarm` is a **new** boot entry that constructs a `ClusterSupervisor` (ADR-0015) bound to one shared durable world plus a **pool of `CantilunOS` agent instances**, one per `active` participant admitted via `activate_participant`.
- `CantiluneSwarm` is **not** a second collaboration mutator. The runtime remains the sole mutator; the swarm boots agent OS instances that submit `CoordinationIntent`s through the runtime ports, exactly as the single-Agent path does.

### 2. Shared durable world, per-agent private history

- The swarm boots against a **single** `createFileRuntimePersistence` world (ADR-0014 durable epoch journal). All participants share the one `CollaborationSnapshot`.
- Each agent OS instance is constructed by `bootCantilune` with the **same shared runtime/content/syscall stores** but a **distinct private history** (distinct `principal` / durable-path binding per ADR-0012 session-world isolation). No agent hydrates another's private transcript.
- This reuses the existing ADR-0012 isolation invariant verbatim: _"only an exact durable/path/principal binding can hydrate a private transcript."_

### 3. Supervisor lifecycle wiring (CLI surface)

- `bootSwarm` calls `ClusterSupervisor.start()`, which seeds `lastObservedHead` from `runtime.getHead()` and runs `reconcileLivenessFromWorld(head)` (ADR-0015 §4) so orphaned `active` participants from a crashed supervisor converge.
- The drain loop consumes `runtime.since(lastObservedHead)`. An `activate_participant` change (with its bound `manifestRef`) is the trigger for `startAgent()`: the supervisor resolves the manifest (content-addressed, ADR-0015 §2), boots a `CantilunOS` for that participant, and runs its agent loop.
- `signal_done` retires the participant; `retire_participant` (liveness-expiry) retires silent participants. Both are committed changes on the same feed.

### 4. CLI command surface

- A new CLI command (e.g. `/swarm start` / `/swarm status` / `/swarm retire`) exposes the supervisor, mirroring the existing `/cluster` family but **writable** (the `/cluster` family remains read-only projection per its `CLUSTER_PROJECTION_NOTICE`).
- The swarm command boots via `bootSwarm`; the single-Agent TUI continues to boot via `bootCantilune`. The two are mutually exclusive within one CLI process (one runtime authority per process), selected by an explicit flag/command, never by implicit fallback.
- Headless runner gains a `--swarm` mode that starts the supervisor, admits the configured participants, and runs until cluster completion (every non-retired participant is `done`) or E-Stop.

### 5. Crash and restart semantics

- A supervisor process crash leaves the durable world intact (ADR-0014) and the `lastObservedHead` cursor in the durable bundle (ADR-0015 §3).
- On restart, `bootSwarm` re-reads the cursor and the head, reconciles liveness, and re-drives: participants still `active` with a live agent process are not double-started (the cursor is past their `activate_participant` change); participants whose agent process died are seeded already-expired and retired on the first staleness tick (ADR-0015 §4).
- An **L7 cross-process crash test** (parallel to the existing `closedLoopSwarmCrash.test.ts`, ADR-0015) kills the supervisor process mid-lifecycle and verifies a fresh `bootSwarm` against the same world converges without duplicate `startAgent`/`signal_done` and retires the orphaned `active` participant.

### 6. Comms transport per agent

- On `startAgent`, the swarm allocates a transport per agent (the `MeshTransportRouter` already in ADR-0015's comms boundary); on `signal_done`/`retire` it deallocates. With ADR-0018, this becomes a real `FileTransport`/`NetTransport` rather than loopback. This ADR adds no new comms authority; it only makes allocation/deallocation follow the committed feed.

### 7. Single-Agent back-compat and migration

- `bootCantilune` and the single-Agent TUI are unchanged. Worlds seeded under the single-Agent path carry their existing epoch binding; a swarm may admit new participants under a new epoch (ADR-0014 schema-digest migration), with no in-place rewrite of historical epochs.
- The `activate_participant` template is already in the default schema post-ADR-0015, so the schema digest already reflects it for new worlds.

## Alternatives considered

- **One `CantilunOS` that multiplexes many agents internally**: rejected. It would collapse the private-history isolation invariant (ADR-0012) — one OS owns one ordered private history; a multi-agent OS would require agents to share a private transcript or the OS to multiplex histories, both of which violate the single-flight/private-history boundary.
- **Control-plane-issued agent starts**: rejected. Agent start is a runtime coordination concern triggered by `activate_participant` on the committed feed (ADR-0015), not a control-plane administration concern. Coupling them reopens the granularity problem ADR-0015 §"Alternatives" already rejected.
- **Implicit single→multi fallback in the CLI**: rejected. The two paths are mutually exclusive and selected explicitly; implicit fallback would let a user accidentally run a swarm when they intended a single agent, or vice versa, with different authority semantics.

## Consequences

- The CLI gains a multi-agent boot surface; the single-Agent path is preserved for observer/developer use.
- The swarm shares one durable world; each agent keeps its private history (ADR-0012 isolation preserved).
- Crash/restart convergence relies on ADR-0015 §4 liveness reconciliation; this ADR adds the CLI surface that invokes it.
- This ADR depends on ADR-0018 (real transport) for cross-host swarms; `FileTransport` suffices for one-host swarms and can land first.
- Formal Lean coverage excludes boot/cli; production swarm boot requires Product Conformance evidence per the formal scope boundary.

## Implementation stages (S0–S4)

| Stage  | Scope                                                                                            | Status      |
| ------ | ------------------------------------------------------------------------------------------------ | ----------- |
| **S0** | `bootSwarm` entry; `CantiluneSwarm` type; supervisor wiring reusing ADR-0015 `ClusterSupervisor` | Done (impl) |
| **S1** | Per-agent `CantilunOS` construction with shared stores + distinct private history                | Done (impl) |
| **S2** | CLI `/swarm` command family + headless `--swarm` mode                                            | Done (impl) |
| **S3** | `FileTransport`-backed one-host swarm + L7 cross-process crash test                              | Done (impl) |
| **S4** | `NetTransport`-backed multi-host swarm (depends on ADR-0018 T3/T4)                               | Not started |

> "Done (impl)" denotes implementation + automated test/coverage gates green only. The ADR remains **Proposed** — Acceptance still requires Owner signature plus independent Architecture + Security review (COI: Owner is DRI). S0–S3 status reflects realized code/tests, not ADR Acceptance.

## Test / QA plan

| Tier  | Scope                                                                 | Status         |
| ----- | --------------------------------------------------------------------- | -------------- |
| L2–L4 | Unit/contract for `bootSwarm`, `CantiluneSwarm`, supervisor wiring    | Done (green)   |
| L5    | Independent Architecture + Security review                            | review-pending |
| L6    | Integration: `bootSwarm` → activate → startAgent → signal_done → done | Done (green)   |
| L7    | Cross-process supervisor crash; orphan retirement; no double-start    | Done (green)   |
| CI    | `pnpm test:coverage` across boot + cli + runtime                      | Done (green)   |

> Automated tiers (L2–L4, L6, L7, CI) are realized and green (boot: 456 tests, coverage gate EXIT=0 — stmt 94.27 / branch 88.31 / func 98.02 / line 94.27; cli: 584 tests, branch 88.11 EXIT=0). L5 is the remaining independent Architecture + Security review and cannot be self-attested by the DRI (COI). The ADR stays **Proposed** until that review and Owner signature.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; S0–S3 realized & green — L6 + L7 cross-process crash tests pass, coverage gates EXIT=0)
**Status**: Proposed. Acceptance requires: (1) Owner signature (design-approved above); (2) independent Architecture reviewer sign-off; (3) independent Security reviewer sign-off; (4) green L7 crash test. Per the governance baseline, chat/Agent summaries are not sources of truth; this ADR is the authority and remains Proposed until the independent Architecture + Security review (L5) is complete. The Owner (DRI) authorized a staged realization of S0–S3 ahead of Acceptance to unblock the QA-0012 release gate; the ADR records that authorization here. No merge/deploy proceeds until Acceptance. The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers. This ADR is sequenced after ADR-0015 (done) and may proceed in parallel with ADR-0018 (transport) for the `FileTransport` one-host case.

### Realized artifacts (S0–S3, unreviewed)

- `src/packages/boot/src/swarm/bootSwarm.ts` — `bootSwarm`, `CantiluneSwarm`, pluggable `AgentFactory` → per-agent `CantilunOS` (S0/S1).
- `src/packages/cli/src/wiring/swarmControl.ts`, `src/packages/cli/src/commands/swarmCommands.ts`, `src/packages/cli/src/views/SwarmView.tsx`, headless `--swarm` in `src/packages/cli/src/headless/headlessRunner.ts` (S2).
- `src/packages/boot/tests/unit/swarm/bootSwarm.test.ts` (10 tests), `src/packages/boot/tests/system/swarm/bootSwarmClosedLoop.test.ts` (L6, 2 tests), `src/packages/boot/tests/system/swarm/bootSwarmCrash.test.ts` + `src/packages/boot/tests/support/bootSwarmChild.mjs` (L7, 3 tests, the cross-process no-duplicate gate).
- Coverage gates green: boot EXIT=0 (stmt 94.27 / branch 88.31 / func 98.02 / line 94.27), cli EXIT=0 (branch 88.11). typecheck/lint/prettier/build green on touched files.
