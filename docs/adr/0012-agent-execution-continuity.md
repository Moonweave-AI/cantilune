# ADR-0012: Agent Execution Continuity and Evidence Integrity

| Field              | Value                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Status             | **Proposed** (Owner review requested)                                                                    |
| Created            | 2026-08-13                                                                                               |
| Updated            | 2026-08-13                                                                                               |
| Last reviewed      | 2026-08-13                                                                                               |
| Decision Owner     | Joker-of-Gotham                                                                                          |
| Implementation DRI | Codex implementation team                                                                                |
| Reviewers          | Independent Architecture and Security review pending                                                     |
| Summary            | Keep conversation state private, make artifact content reachable, and verify completion against evidence |
| Canonical          | This ADR; RFC-0001 remains the architectural authority                                                   |
| Related            | RFC-0001, ADR-0002, ADR-0003, ADR-0006, `@cantilune/boot`, `@cantilune/syscall`, `@cantilune/runtime`    |
| Supersedes         | None                                                                                                     |
| Superseded by      | None                                                                                                     |

## Context

A field run exposed four failures that reinforced one another:

1. a file-backed world could resume under a different runtime epoch or a newly generated local
   principal, leaving the coordination plane unable to admit operations;
2. each `CantilunOS.run()` invocation created a fresh LLM transcript even though the CLI displayed
   one continuous conversation;
3. `write_content` produced a valid SHA-256 `ContentRef`, while `introduce_artifact` silently created
   a different `content://<artifactId>` reference that no configured content store could resolve;
4. `done` treated the model's summary as success even when content reads or coordination operations
   had unresolved failures.

These are boundary violations rather than prompt-quality problems. `CollaborationSnapshot` is the
shared coordination world, an Agent's message history is private execution state, the content store
is the authority for blob existence, and a model summary is a claim rather than evidence.

The preserved field transcript also disproves the later assistant explanation. The exact 1,097-byte
UTF-8 Markdown body written after `introduce_artifact("financial-ecosystem-overview")` recomputes to
`sha256:dd24a81fe31e4a810ec178acd7597ac3fa994f14aa10749e9c27ef13273cb8ed`, exactly matching the
`write_content` result. The later run passed the ArtifactId `financial-ecosystem-overview`, rather
than that `ContentRef`, to `read_content` twice. The claim that the body had never been written was
therefore false. The old runtime/content bundle is absent, so this evidence recovers source bytes
but does not itself repair the historical artifact mapping.

## Decision

### 1. Private conversation continuity

- A booted Agent owns a private, reusable `LlmMessage` history across user submissions.
- Private history MUST NOT be written to `CollaborationSnapshot`, `CoordinationChange`, or the shared
  audit tail.
- Boot exposes a detached, strictly validated snapshot of the `AgentLoopHistory` it actually uses.
  A file-backed CLI stores that exact history with the visible session in a versioned, revision-CAS
  envelope; it MUST NOT reconstruct executed tool evidence from display-only system rows, errors,
  or tool cards.
- After each complete LLM response/tool-result group, Boot synchronizes the private history and
  awaits the host checkpoint before another LLM turn. A checkpoint failure terminates the run with
  a typed error and poisons that OS instance: later runs fail before content, observation, or LLM
  work until the OS is rebuilt from the last verified durable history. This boundary preserves exact
  `ContentRef` results and pending observation receipts across a graceful process restart.
- If a run terminates partway through a received multi-tool group, every unexecuted sibling gets an
  explicit `SKIPPED: NOT EXECUTED` result. The complete group is checkpointed, skipped calls count as
  failed requests without pretending a side effect occurred, and the terminal result retains the
  exact aggregate tally.
- A legacy v2 CLI envelope migrates only non-empty user/assistant text. It does not promote legacy
  UI tool cards into trusted history.
- A persisted transcript is bound to its durability mode, canonical storage path, and principal.
  Legacy or mismatched session files remain unbound and MUST NOT seed a different world.
- Memory-mode worlds are process-local and therefore never restore or persist a cross-process
  transcript, even when the CLI principal string happens to be stable.
- Replacing a memory-mode runtime/content world for a provider, model, or endpoint change clears
  both private and visible history after awaiting shutdown. File mode may preserve exact history only
  while the durable-world generation remains identical.
- Exact checkpoint history is independent from the bounded provider context. Context compaction
  preserves the current goal and complete assistant-tool/result groups, emits at most one marker,
  and respects the configured message budget. If the newest complete group cannot fit the next
  provider request, Boot checkpoints it and fails closed rather than hiding its evidence.

### 2. Reachable artifact content

- Every normal `WorkArtifact.contentRef` MUST identify content that exists in the configured content
  store when the artifact is committed.
- The public runtime commit boundary, not only syscall, enforces this invariant. Any handler that
  creates an artifact or changes an artifact's `contentRef` MUST be rejected when the referenced
  bytes are unavailable.
- Runtime uses the synchronous `ContentRefAuthority.isAvailable(ContentRef)` port for this final
  check. A missing authority, a negative answer, or an authority exception fails closed with
  `content_ref_unavailable`; asynchronous `ContentStore.exists()` is not commit evidence.
- The same literal-true check runs before observation ingest publishes a new audit-tail head, so
  direct runtime callers cannot persist an unreachable `ObservationEntry.payloadRef` either.
- `bootMemoryOS`, `bootFileOS`, and CLI runtime construction MUST inject the same `ContentStore`
  instance into syscall and into the runtime authority port. Low-level callers constructing a
  `CoordinationRuntime` directly must supply an authoritative implementation before committing any
  content-bearing artifact.
- Content inputs are explicit `CoordinationIntent.inputContentRefs`; they are not authorization or
  external evidence and therefore are not encoded as `EvidenceRef`.
- `introduce_artifact` requires a real content input. It MUST NOT synthesize `content://<artifactId>`.
- Perception exposes the exact `contentRef` and uses the public tool name `read_content`, so the
  instruction it gives an Agent is executable.
- This is a forward integrity rule, not a reconstruction algorithm. A previously persisted
  `content://<artifactId>` pointer cannot be repaired without the original bytes or another
  authoritative mapping; migration must fail closed or use explicitly reviewed source evidence.
- The synchronous availability check assumes the configured content store is trusted and
  append-only for the duration of a runtime commit. It is not a transaction across an arbitrary
  mutable filesystem or a hostile custom authority.

### 3. Evidence-aware completion

- `done` remains the explicit loop termination request, but it is not sufficient evidence of
  success.
- The loop records every tool result, not only coordination admission outcomes.
- Within the current run, a failed tool/target remains unresolved until a semantically equivalent
  recovery succeeds. A `done` request with unresolved failures returns a failed `RunResult`, and its
  `tool_end` event is also failed. A new user instruction starts a new ordinary business-failure
  ledger; prior results remain in private history for the model to inspect. Only an unresolved
  external-side-effect observation receipt is restored across runs because its safety ambiguity is
  still live.
- Absence of a known execution failure is not a domain success predicate. A task that requires a
  particular artifact, approval, or shared-world state MUST verify that postcondition separately;
  `done.summary` remains a claim and cannot prove an omitted operation occurred.
- Exceptions from perception, action discovery, or tool execution are converted to structured
  terminal errors and closed lifecycle events; they do not escape as an untyped rejected promise.
- An external-tool call carries its original LLM tool-call id. After execution, syscall stores the
  output and a content-addressed recovery receipt binding principal, tool name, call id, canonical
  argument digest, and output ref before attempting audit observation.
- If only audit observation fails, recovery MUST verify that exact receipt and retry only
  `runtime.observe`; it MUST NOT invoke the external executor again. A different call id, output ref,
  receipt ref, principal, or argument digest cannot clear the original failure.
- Generic `cantiluneRecoveryOf` replacement is limited to `read_content` and `write_content`.
  External tools use verified observation receipts, and coordination operations ignore the field;
  therefore a successful operation against target B cannot erase a rejected operation against A.
- Caller abort and the local LLM deadline are enforced independently of adapter cooperation. A late
  response or stream delta cannot dispatch tools after the race has settled.
- Small replay-relevant operands are explicit `CoordinationIntent.scalarInputs`; they are separate
  from entity bindings, content references, and evidence.
- `emit_heartbeat` requires a non-negative safe-integer `turnCount` and a non-empty `lastAction`.
  Missing or malformed values fail closed rather than defaulting to `0` / `unknown`.
- Runtime reads the clock once at commit, persists that value as `ReplayRecipe.emittedAt`, and
  requires synchronous, resolver-backed, and file-restart replay to reuse it.

### 4. Durable CLI identity and state

- CLI production runs default to file-backed runtime and content storage. Memory mode is explicit
  (`--ephemeral`) and is not presented as resumable.
- The local CLI principal id is stable across restarts and is validated against the resumed world
  before an LLM turn starts. A new identity is not silently self-registered.
- Static-schema admission requires an explicit schema/epoch binding. It MUST NOT relabel the
  caller's compiled schema with an arbitrary epoch read from the durable head. An epoch name or
  namespace is not schema evidence: every legacy alias must be listed individually in the
  Owner-reviewed `compatibleEpochIds` migration configuration. With no explicit list, every foreign
  epoch fails closed and requires a governed resolver or migration. Dynamic epoch activation
  remains governed by ADR-0006 and must preserve atomic head/schema-holder transitions.

### 5. Immutable authority boundaries

- `CollaborationSnapshot` deeply detaches and freezes every node and nested value. It exposes
  read-only collections with no mutator surface rather than relying on `Object.freeze(native Map)`.
- `MemoryCollaborationStore` re-snapshots constructor, put, put-if-absent, CAS, get, and list
  boundaries so a rejected handler or caller mutation cannot alter an authoritative head.
- `MemoryChangeLog` and `RecipeSidecar` likewise snapshot every ingress and return a fresh frozen
  copy on every query, so a caller cannot rewrite a committed change chain or heartbeat replay
  operands after admission.
- Runtime schema contexts and epoch bindings are detached; canonical schema content digests are
  recomputed before use. Control-plane schema and policy revisions are likewise detached and
  integrity-checked at authority boundaries.
- These rules close in-process alias and content-substitution drift. They do not make a sequence of
  durable head, holder, and journal writes into one cross-process transaction.
- File-backed exclusion publishes a complete fsynced owner token through a same-directory atomic
  hard link and releases only an exact owned token. Dead-owner records fail closed; operators must
  prove quiescence and use the recovery runbook rather than automatically deleting a stale PID.

### 6. Release gates discovered by root-system audit

- `ClusterSupervisor` remains experimental and MUST NOT be connected to the CLI production path
  until a trusted committed-change feed, explicit participant activation, canonical Manifest
  binding, durable completion semantics, and permission review are defined by RFC/ADR.
- CLI cluster views are read-only projections. They MUST state that registered participants are not
  automatically started.
- Heartbeat operand and timestamp fidelity are now deterministic. This does not supply the trusted
  commit feed, participant activation, Manifest authority, liveness policy, or durable shared-world
  completion required to lift the swarm gate.
- Cross-process epoch transition recovery remains Stop-Ship: the runtime receipt journal is
  currently process memory and cannot close the crash window after durable head CAS.
- External-tool exactly-once execution remains Stop-Ship. Observation-only recovery is safe only
  after both output and receipt are durable. A crash or storage failure after an external side
  effect but before those writes has no authoritative invocation outcome. Lifting this gate requires
  a durable pre-invocation journal plus an executor idempotency key/status contract.
- `AbortSignal` and `maxTimeMs` bound LLM waits and prevent later dispatch, but cannot safely race
  an already-running external/content/runtime operation: returning early could leave an
  unobserved late side effect. A cancellable executor contract plus idempotent outcome query is
  therefore part of the same Stop-Ship gate; `maxTimeMs` is not a hard wall-clock cap for those
  in-flight operations.
- The CLI restores exact private history only at a completed response/tool-group checkpoint. A hard
  crash between two tools in the same LLM response is not a completed checkpoint and remains outside
  the durability claim. Per-tool crash recovery would require a separate durable execution journal.
- Passing mock/manual-signal cluster tests or control-plane recovery tests MUST NOT be cited as
  evidence that either production swarm execution or cross-process epoch atomicity is complete.

## Consequences

### Positive

- Follow-up questions can use the actual prior conversation without leaking private Agent history
  into the shared world.
- An artifact id and a content reference can no longer drift into two unrelated objects.
- CLI success output and `RunResult.ok` reflect unresolved execution failures rather than model
  confidence.
- File recovery retains one principal, world, and content namespace.

### Negative

- `CoordinationIntent` and syscall action metadata gain an additive content-input contract.
- Direct runtime integrations that create content-bearing artifacts must wire a synchronous
  `ContentRefAuthority`; omission now rejects instead of persisting a dangling reference.
- CLI sessions now create durable local state unless ephemeral mode is explicitly selected.
- Conversation compaction must maintain tool-call group integrity and therefore cannot be a naive
  last-N slice.
- Existing tests that encoded hidden references or success-after-failure must change.

### Neutral

- This decision does not place LLM messages in `CollaborationSnapshot` and does not make UI
  transcripts an authorization source.
- It does not authorize networked production deployment. Stop-Ship gates include production
  `ClusterSupervisor`, cross-process epoch activation, and external-tool exactly-once execution;
  none is implied follow-up work or covered by the single-Agent closure.

## Alternatives considered

| Alternative                                       | Disposition | Rationale                                                                                       |
| ------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Fix only the system prompt                        | Rejected    | The model still lacks history and a usable content address; wording cannot repair missing data  |
| Store all LLM messages in `CollaborationSnapshot` | Rejected    | Violates Agent privacy/isolation and turns private reasoning into shared durable state          |
| Treat `ArtifactId` as a content-store key         | Rejected    | Breaks content addressing and allows mutable/ambiguous bodies                                   |
| Await `ContentStore.exists()` inside commit       | Rejected    | Runtime commit is synchronous; a Promise is not availability evidence and would split atomicity |
| Validate only in syscall                          | Rejected    | Public runtime callers can bypass syscall and persist a dangling content pointer                |
| Trust `done.summary` as the final result          | Rejected    | A free-text claim cannot prove that preceding operations succeeded                              |
| Generate a new principal and auto-register it     | Rejected    | Lets an unauthenticated new identity grant itself world membership                              |

## Migration and verification

1. Add deterministic regressions for cross-run history, real content binding, recoverable tool
   errors, strict compaction, file restart identity, and direct-runtime dangling-reference
   rejection.
2. Run affected package unit, integration, contract, system, lint, format, and type checks.
3. Keep CLI swarm execution labelled unavailable until the real supervisor subscription and
   participant lifecycle are wired and verified independently.
4. Keep cross-process epoch activation blocked until its receipt/request journal is durable in the
   same transaction as the head, or an authenticated recovery protocol is approved.
5. Keep externally mutating tools blocked from exactly-once claims until a pre-invocation journal
   and executor idempotency/outcome-query contract are approved and crash-tested.

## Approval

**DRI Signature**: Pending Owner confirmation  
**Date**: 2026-08-13  
**Decision Reference**: field defect investigation, RFC-0001 execution boundaries, ADR-0003 runtime
threat model
