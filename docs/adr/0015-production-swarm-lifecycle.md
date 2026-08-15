# ADR-0015: Production Swarm Lifecycle, Manifest Binding, and Trusted Commit-Feed

| Field              | Value                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status             | **Proposed** (Owner review requested; lifts SS-01 of QA-0012)                                                                                                                                                                                                                                                             |
| Created            | 2026-08-14                                                                                                                                                                                                                                                                                                                |
| Updated            | 2026-08-14                                                                                                                                                                                                                                                                                                                |
| Decision Owner     | Joker-of-Gotham                                                                                                                                                                                                                                                                                                           |
| Implementation DRI | Codex implementation team                                                                                                                                                                                                                                                                                                 |
| Reviewers          | Independent Architecture and Security review pending (QA-L5 exit gate)                                                                                                                                                                                                                                                    |
| Summary            | Make the production swarm real: an `activate_participant` operation that an active initiator admits, a content-addressed Manifest bound at activation, a `ChangeLog.since` commit-feed cursor the supervisor subscribes to, durable `signal_done` on agent completion, and heartbeat-scheduled liveness-expiry retirement |
| Canonical          | This ADR; RFC-0001 remains the architectural authority                                                                                                                                                                                                                                                                    |
| Related            | ADR-0006, ADR-0007, ADR-0012, ADR-0014, `@cantilune/core`, `@cantilune/runtime`, `@cantilune/comms`, `@cantilune/boot`, `@cantilune/control-plane`                                                                                                                                                                        |
| Supersedes         | None (extends ADR-0007 activation authority and ADR-0012 completion semantics)                                                                                                                                                                                                                                            |
| Superseded by      | None                                                                                                                                                                                                                                                                                                                      |

## Context

`docs/qa/0012-agent-execution-continuity-qa.md` (SS-01) records five concrete defects that together mean the production swarm is never actually formed. An exact read of the current code confirms each one:

1. **No trusted committed-change subscription.** `ClusterSupervisor.start()` (`src/packages/boot/src/cluster/clusterSupervisor.ts:86`) only starts a stale-detector `setInterval`; it never subscribes to a change feed. `evaluateConditions()` (`:112`) reads a one-shot snapshot via `this.shared.runtime.getHead()` rather than consuming committed changes. The cursor API exists on the durable port — `DurableCoordinator.since(fromRef: SnapshotRef)` (`src/packages/runtime/src/ports/durableCoordinator.ts:44`) — but the supervisor never calls it. The CLI data path confirms this: `runtimeSync.ts:359` dumps `durable.changes()` wholesale, and `ClusterView.tsx` renders a read-only projection prefixed by the literal `CLUSTER_PROJECTION_NOTICE`.

2. **No participant activation.** The lifecycle transition `registered → active` is registered in `src/packages/runtime/src/cluster/lifecycleTransitions.ts:12`, but there is **no `activate_participant` operation template, no handler, and no emitting code anywhere in the repository**. `register_participant` (`src/packages/runtime/src/execution/handlers/registerParticipant.ts:38`) creates participants with status `"registered"` and leaves them there. `ClusterSupervisor.startAgent()` then runs the agent loop without ever committing the `registered → active` transition.

3. **No authoritative Manifest binding.** `Participant` (`src/packages/core/src/nodes/participant.ts:39`) carries only `{ actorId, kind, status }` — no manifest reference. The `AgentManifest` doc-comment (`src/packages/core/src/coordination/agentManifest.ts:5`) states the _intent_ that "a participant holds a `manifestRef: ContentRef` linking to its serialized manifest," but the field was never added. `ClusterSupervisor.resolveManifest()` (`clusterSupervisor.ts:327`) instead scans `head.auditTail`, fetches each `payloadRef` from the content store, `JSON.parse`s it, and returns the first whose `agentId` matches by string equality — no content-addressed digest check, no `SchemaEpochBinding.handlerManifestRef` consultation, no manifest-id resolution.

4. **No durable completion.** `onAgentComplete()` (`clusterSupervisor.ts:234`) records results in an in-memory `agentResults` map and re-evaluates conditions, but **never submits a `signal_done` `CoordinationIntent` to the runtime**. The `signalDoneHandler` (`src/packages/runtime/src/execution/handlers/signalDone.ts:9`) exists and is fully tested, but is only ever triggered by hand-injected changes in tests (`clusterSupervisor.test.ts:122`, `topologies.test.ts:99`). A local agent completion is therefore never reflected durably in the collaboration world.

5. **No liveness policy with expiry.** The supervisor keeps a `liveness` map but has no scheduled heartbeat verification that retires a silent participant. `emit_heartbeat` exists as a template/handler but nothing consumes heartbeats against a deadline to drive `retire_participant`.

The Owner's prior decision (this conversation) set the **activation authority** to **"已 active 的发起方激活"**: a participant that is already `active` admits a `registered` participant to `active`. This mirrors the existing `register_participant` precondition (`registerParticipant.ts:27`: `fromParticipant.status !== "active"` ⇒ reject), so activation follows the same trusted-initiator rule as registration, with no new authority role.

## Decision

The production swarm is formed by five changes that close the five defects as one coordinated lifecycle. None introduces a parallel entity type or a mock path; each extends an existing core/runtime structure.

### 1. `activate_participant` operation and handler (closes defect 2)

Add a new operation `activate_participant` that transitions a `registered` participant to `active`, admitted by an already-`active` initiator.

- **Template** (`src/packages/runtime/src/schema/defaultSchema.ts`): a new `ACTIVATE_PARTICIPANT` entry with `requiredRoles: ["from", "participant"]`, `requires: [{ kind: "participant.registered", bindings: { participant: "participant" } }]`, `ensures: [{ kind: "participant.registered", bindings: { participant: "participant" } }]`, `defaultVisibility: "external"`, `mayCreateSessions: false`, `templateRef: operationTemplateRef("activate_participant", "1")`. It is appended to `DEFAULT_TEMPLATES` after `REGISTER_PARTICIPANT`.
- **Handler** (`src/packages/runtime/src/execution/handlers/activateParticipant.ts`): mirrors `register_participant` and `signal_done`. It (a) requires a `from` binding and a `participant` binding; (b) resolves the `from` participant and rejects unless `from.status === "active"` (the Owner-decided authority — the active initiator admits); (c) resolves the target participant and rejects unless `validateTransition(current.status, "active")` passes (i.e. `registered → active` or `waiting → active` or `blocked → active`); (d) on the activation path it also **binds the manifest** (§3); (e) produces the after-snapshot with `participant(...)` set to `"active"`, carrying the bound manifest ref.
- **Registration** (`src/packages/runtime/src/execution/handlers/index.ts`): `registry.register(operationTypeId("activate_participant"), activateParticipantHandler, "1")` and re-export.
- **Transition table**: `registered → active` already exists (`lifecycleTransitions.ts:12`); `waiting → active` (`:13`) and `blocked → active` (`:19`) also exist. No new transition is needed.

This makes the `registered → active` transition _reachable through a committed change_, which it currently is not. The operation is admitted by the same authority as `register_participant` (the active initiator), so it introduces no new permission role and keeps the admission boundary in ADR-0007's scope.

### 2. Bind the Manifest at activation, content-addressed (closes defect 3)

Add the field the `AgentManifest` doc-comment already promises, and bind it atomically with the activation transition.

- **`Participant` gains `manifestRef?: ContentRef`** (`src/packages/core/src/nodes/participant.ts`). It is optional only because pre-activation participants and non-agent participants (humans, runtime) have no manifest; an `agent` participant **must** carry a `manifestRef` once `active`. The `participant(...)` factory and `cloneParticipant` (`collaborationSnapshot.ts:63`) are extended to carry the field. This is composition of an existing core type, not a parallel entity.
- **Content-addressed integrity is verified in two layers, matching the runtime's existing content boundary** (ADR-0003: the runtime has no content store; content authority is a separate concern):
  - **At activation (runtime handler, apply-time)**: the `activate_participant` handler carries the manifest ref as `recipe.inputContentRefs[0]` (the same channel `introduce_artifact` uses for its content ref, `recipe.ts:43`). The handler rejects if the binding is absent for an `agent` participant — an agent cannot be activated without a manifest ref. It does **not** touch the content store, because the runtime has none; the ref's content-addressed validity was established when the manifest was written. This mirrors how `introduce_artifact` trusts the ref on the recipe.
  - **At launch (supervisor, `resolveManifest`)**: `ClusterSupervisor.resolveManifest()` is replaced. It no longer scans `auditTail` and JSON-parses by string match. It reads `participant.manifestRef` (the authoritative ref bound at activation), fetches it from `this.shared.contentStore`, recomputes the digest and rejects on mismatch, deserializes, and rejects if `AgentManifest.agentId` does not equal the target `participant` actorId. If the field is absent the participant was never activated and must not be started. This is where the content store lives, so the digest and `agentId` checks belong here. This removes the "scans arbitrary observations" defect entirely.
- **Epoch binding relationship**: the active `SchemaEpochBinding.handlerManifestRef` (`schemaAdmissionReceipt.ts:27`) remains the epoch-level authority for _which handler manifest_ governs operations. A participant's `manifestRef` is the per-agent _configuration_ manifest (system prompt, task, start condition, heartbeat interval). These are distinct refs on distinct objects; both are content-addressed. The handler manifest governs operation admission; the agent manifest governs agent launch. No conflation.

### 3. Trusted commit-feed cursor on the supervisor (closes defect 1)

`ClusterSupervisor` stops polling a snapshot and starts consuming the committed-change feed.

- **Cursor**: the cursor is a `SnapshotRef` (the last head the supervisor observed), matching the existing `DurableCoordinator.since(fromRef: SnapshotRef)` API (`durableCoordinator.ts:44`). The supervisor holds its own `lastObservedHead: SnapshotRef`, initialized to the head at `start()`.
- **Drain loop**: `start()` schedules a drain that calls `runtime.since(lastObservedHead)`, processes each `CoordinationChange` in order, and advances `lastObservedHead` to the change's `afterRef`. Processing is deterministic: a `register_participant` change records a candidate; an `activate_participant` change (with its bound `manifestRef`) moves a participant to `active` and is the trigger for `startAgent()` — not the registration. An `emit_heartbeat` change refreshes liveness. A `signal_done` change retires the participant from the supervisor's live set.
- **No push injection**: `onSignalReceived(change)` (the manual push path) is removed or restricted to tests. The trusted path is the feed; the supervisor does not accept signals out of band. This is the "no mock signal injection" lift condition, applied to the production path.
- **Crash-safe cursor**: `lastObservedHead` is a snapshot ref that survives in the durable bundle (it is a head the runtime committed). On supervisor restart the cursor resumes from the durable head; no in-memory cursor state is trusted. This is consistent with ADR-0014's bundle-authority principle.

### 4. Durable `signal_done` on completion (closes defect 4)

Local agent completion is written back to the collaboration world.

- **`onAgentComplete()`** submits a `signal_done` `CoordinationIntent` to the runtime for the completing participant, **before** recording the local result and re-evaluating conditions. The runtime admits it through the existing `signalDoneHandler`, which validates `active → done` and publishes the change on the same commit feed the supervisor consumes (§3).
- **Binding semantics (clarified 2026-08-14)**: `signalDoneHandler` transitions the **`from`** binding, and `retireParticipantHandler` transitions the **`participant`** binding. The supervisor therefore submits the two lifecycle intents with different `from` authorities:
  - `signal_done` is the completing agent's own "I am done" signal, round-tripped through the feed: `from` = the completing participant's id, committed under that participant's own principal. (If the supervisor submitted `signal_done` under its own principal with `from` = supervisor, the handler would transition the _supervisor_ to `done`, not the worker — a defect the real-runtime L6 test surfaced.)
  - `retire_participant` is a supervisor action: `from` = the resolved supervisor principal, `participant` = the target being retired. The resolved principal is the configured `supervisorPrincipal` callback if provided, else the runtime head's first `active` participant (the active-initiator authority of §1).
- **Crash ordering**: the durable `signal_done` change is committed before the supervisor treats the participant as retired. If the supervisor crashes after the agent loop returns but before `signal_done` commits, on restart the feed still shows the participant as `active`; the supervisor does not double-start it (the feed cursor is past its `activate_participant` change, so `drainFeed` re-observes no trigger for `startAgent`) — or, if the agent process is gone, the liveness-expiry path (§5) retires it. Either way the world converges; the participant is never silently lost.
- **Liveness reconciliation on (re)start (clarified 2026-08-14, L7)**: the §5 liveness table is an in-process Map; a fresh supervisor process starts with an empty table, so an `active` participant left over from a crashed process has no liveness entry and the stale detector would never see it. `start()` therefore calls `reconcileLivenessFromWorld(head)` with the SAME head read the cursor was seeded from (no extra `getHead()` call). It re-seeds a liveness entry for every `active` participant that has a bound `manifestRef` (the signature of a participant admitted by `activate_participant`, distinguishing a real worker from the `active` initiator who was never activated) and is not already tracked, reading `heartbeatIntervalMs` from the bound manifest. A participant whose agent process died with the previous process is seeded **already-expired** (`lastHeartbeatTime = now − threshold − 1`), so the first staleness tick retires it via `retire_participant` — the documented convergence path when "the agent process is gone." A genuinely live agent is never reconciled: it is seeded by its own `startAgent` (at activation time, ahead of the cursor), not by reconciliation, so reconciliation never clobbers a live entry. The `checkStaleAgents` retire decision is gated only on `elapsed > threshold` (no `this.agents.has()` guard), so the orphan-with-no-`AgentInstance` case retires; a running healthy agent refreshes its heartbeat via `emit_heartbeat` and never reaches the threshold.
- **Completion vs. vacuous success**: the supervisor no longer reports "cluster complete" from an in-memory `agentResults` map alone. Cluster completion is derived from the committed world: every non-retired participant is `done`. This is the same authority `ClusterView` already projects, so the CLI and the supervisor agree by construction.

### 5. Heartbeat-scheduled liveness with expiry retirement (closes defect 5)

The `heartbeatIntervalMs` already in `AgentManifest` (`agentManifest.ts:31`) becomes a live contract.

- **Per-participant deadline**: when `activate_participant` commits, the supervisor records `lastHeartbeatAt` for the participant (the commit timestamp) and `heartbeatIntervalMs` from the bound manifest. The `emit_heartbeat` feed change refreshes `lastHeartbeatAt`.
- **Expiry**: the drain loop's tick checks each `active` participant against `now - lastHeartbeatAt > heartbeatIntervalMs * graceFactor`. An expired participant is submitted for `retire_participant` (the existing `* → retired` transition and handler), not silently dropped. Retirement is a committed change, so it is durable and visible on the feed.
- **Grace factor**: a small, fixed multiplier (default 2×) chosen to tolerate commit-feed latency without admitting indefinite silence. It is a supervisor policy, not a per-agent override, so a compromised manifest cannot extend its own liveness window.

### Comms / human permission boundary

The lift conditions name "comms/human permission boundaries." This ADR keeps them where they already are:

- A `human` participant cannot be `activate_participant`-activated to run an agent loop — the handler only activates `agent`-kind participants (the manifest binding requires an `AgentManifest`, which a human has none). Humans enter the world through `register_participant` and act through their own submitted coordination intents, exactly as today.
- Comms (`@cantilune/comms`) remains a peer transport layer: `MeshTransportRouter` allocates a transport per agent on `startAgent` and deallocates on completion/retire, unchanged. This ADR adds no new comms authority; it only makes the _trigger_ for allocation (the `active` transition) and the _trigger_ for deallocation (`signal_done`/`retire`) come from committed changes instead of in-memory supervisor state.

## Alternatives considered

- **Control-plane-issued activation** (the active binding's `activatedBy` admits participants): rejected. It couples participant activation to epoch admission, which is the wrong granularity — a swarm may activate many participants under one epoch, and epoch admission already requires the full ADR-0007 four-view evidence. Participant activation is a runtime coordination concern, not a control-plane administration concern. The Owner chose the active-initiator rule.
- **Manifest ref stored in `auditTail`, discovered by scan** (status quo): rejected. It is not content-addressed-authoritative (no digest check), not bound to the participant (string match by `agentId`), and not durable across a world reload that compacts the tail. Binding at activation makes the ref a field of the participant, surviving in the snapshot.
- **Push-based signals** (`onSignalReceived`): rejected for the production path. A pushed signal is not on the committed feed, so it is not durable, not ordered, and not visible to other supervisors or the CLI. Only the feed is trusted.
- **Per-tool heartbeat override**: rejected. The manifest already sets `heartbeatIntervalMs`; allowing a tool to extend the liveness window would let a compromised agent silence its own expiry. The grace factor is supervisor policy.

## Migration and verification

This ADR adds an operation template to the default schema, which changes the default schema digest. Per ADR-0014, the schema digest is part of the durable epoch binding. Implications:

1. **Existing worlds**: a world seeded under the old default schema carries an epoch binding whose `schemaRef.digest` predates `activate_participant`. On load, the old binding remains valid for its epoch; a new epoch must be admitted (through the normal ADR-0006/0007 admission workflow) to activate the new schema. No in-place rewrite of existing epochs.
2. **New worlds**: seeded under the updated default schema carry `activate_participant` from the first epoch. The boot seed is updated to construct the default schema with the new template; no migration of historical data.
3. **Coverage gate**: all new code lands under the repository L2–L7 thresholds (statements/functions/lines ≥90%, branches ≥88%). New tests: a unit suite for `activateParticipant` handler (admit-by-active, reject-inactive-initiator, reject-non-registered-target, manifest-missing/invalid-digest/agentId-mismatch branches); a unit suite for the new `Participant.manifestRef` field round-trip; an integration test for the commit-feed drain loop; and the real-runtime L6/L7 closed-loop test below.

### Real-runtime L6/L7 closed-loop test (the lift gate)

A test that drives the full lifecycle through the real runtime with no mock signal injection:

1. Seed a world with one `active` initiator and N `registered` agents, each with a real manifest in a real (file or memory) content store.
2. The initiator submits `activate_participant` for each agent (admitted by the active-initiator rule), binding each manifest.
3. The supervisor's feed drain observes each `activate_participant` change and calls the real `startAgent` (the loop is real; in the test the agent's "work" is a deterministic function that submits `signal_done` through the runtime when it finishes).
4. Each agent's `signal_done` commits on the feed; the supervisor observes it and does **not** re-start the participant.
5. One agent is configured to go silent (no heartbeat). The liveness-expiry tick submits `retire_participant` for it.
6. The test asserts the committed world's final state: activated agents are `done`, the silent agent is `retired`, and the supervisor's in-memory view matches the committed world (no drift).
7. A crash variant: the supervisor process is killed and restarted mid-drain; it resumes from the durable head cursor, observes the already-committed transitions, and does not duplicate `startAgent` or `signal_done`.

This is the test the QA gate (line 146–147) requires: a real-runtime L6/L7 closed-loop swarm test with no mock signal injection.

**L7 implementation (2026-08-14, evidenced):**
`src/packages/boot/tests/system/cluster/closedLoopSwarmCrash.test.ts` (3 tests, cross-process). A child process (`tests/support/swarmSupervisorChild.mjs`) drives a `ClusterSupervisor` against a **file-backed** durable world (`createFileRuntimePersistence`) that survives process death. Modes:

- `seed` — the clean closed loop: `start()` (cursor seeded from T0) → `activate_participant` committed → `drainFeed` → `startAgent` → scripted-LLM `done` → `signal_done` committed → worker `done`. Side-effect log records one `startAgent`, one `activate_committed`, zero `retire_participant`.
- `crash-pre-done` — `start()` → `activate_participant` → `drainFeed` calls `startAgent` (one `startAgent` recorded) but the agent uses a **hanging** LLM that never returns `done`, so the agent process is killed (exit 1) before any `signal_done` commits. The durable head has advanced past `activate_participant`; the worker is `active` with `signalDoneCount = 0`.
- `recover` — a FRESH process loads the same file-backed world. `start()` seeds the cursor from the durable head (past `activate_participant`), so `drainFeed` observes **no** activate change and calls **no** `startAgent`. The orphaned `active` worker is reconciled into the liveness table already-expired (`reconcileLivenessFromWorld`, §4) and the staleness tick retires it via `retire_participant`. The world converges to `retired`.

The lift assertion (the "no duplicate" proof): across the whole kill/restart lifecycle the side-effect log records `startAgent` **exactly once** (in the crashed process) and **zero** times on restart; `signal_done` is recorded zero times; the restart converges via `retire_participant`. The third test confirms a restart after a clean `done` does not re-process the already-converged world (still one `startAgent`, zero `retire`). This is the ADR-0015 §7 step-7 cross-process crash variant with no mock signal injection.

## Consequences

- **Positive**: the swarm is formed by committed changes; the CLI projection and the supervisor share one authority (the commit feed); completion is durable; a silent agent is retired, not leaked; the manifest is content-addressed and bound to the participant, not scanned from observations.
- **Negative**: the default schema digest changes, so a new epoch admission is required for existing worlds to use `activate_participant` (this is the correct, reviewed path, not a silent rewrite). The supervisor's drain loop adds a feed-processing path that must be tested for backpressure under a large change log.
- **Neutral**: `ClusterView` stays a read-only projection — but it now projects a world that is actually being driven by a live swarm, so the "read-only" framing becomes a true projection of real state rather than a projection of a dormant snapshot.

## Lift mapping

| SS-01 defect                                                        | Closed by                                               | Section |
| ------------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| No trusted committed-change subscription                            | `DurableCoordinator.since` cursor + drain loop          | 3       |
| Runs `registered` participants without admitted `active` transition | `activate_participant` operation + handler              | 1       |
| Discovers Manifest by scanning arbitrary observations               | `Participant.manifestRef` bound at activation           | 2       |
| Does not bind local `done` to `signal_done`                         | `onAgentComplete` submits `signal_done`                 | 4       |
| Can wait forever or report vacuous success                          | committed-world completion + liveness-expiry retirement | 4, 5    |

All six lift-condition topics (participant activation authority, canonical Manifest binding, durable commit-feed cursor, cluster membership/completion semantics, heartbeat scheduling/liveness-expiry, comms/human permission boundaries) are addressed above and will be evidenced by the real-runtime closed-loop test before this ADR moves from Proposed to Accepted.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; implementation realized & green — L6 closed-loop + L7 cross-process crash tests pass)
**Status**: Proposed. Acceptance additionally requires independent Architecture + Security reviewer sign-off (QA-L5 exit gate). The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers.
