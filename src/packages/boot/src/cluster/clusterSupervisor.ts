/**
 * ClusterSupervisor — trusted committed-change feed lifecycle manager for
 * multi-agent clusters (ADR-0015).
 *
 * Design principles:
 * - The trusted path is the committed-change feed (`runtime.changes(cursor)`),
 *   not a snapshot poll. `start()` drains the feed on a schedule; it does not
 *   read `getHead()` to decide dispatch.
 * - An `activate_participant` change (with its bound manifest ref) is the
 *   trigger for `startAgent` — not `register_participant`, which is now
 *   read-only on this side.
 * - Local agent completion is written back to the collaboration world: the
 *   supervisor submits a `signal_done` intent through `proposeAndCommit`
 *   before retiring the participant from its live set.
 * - A silent agent is retired, not leaked: the liveness tick submits
 *   `retire_participant` when a participant exceeds its heartbeat grace window.
 * - The manifest is content-addressed and bound on the participant at
 *   activation. `resolveManifest` reads `participant.manifestRef` and verifies
 *   the stored bytes against that ref; it never scans the audit tail.
 *
 * Authority: activation and retirement are admitted by the runtime's own
 * admission gateway (the active-initiator rule for `activate_participant` is
 * in the handler, ADR-0015 §1). The supervisor commits intents as the
 * initiator principal it is configured with (default: the already-active
 * participant that registered the agent).
 */
import type {
  ActorId,
  AgentManifest,
  CollaborationSnapshot,
  ContentRef,
  CoordinationChange,
  SnapshotRef,
} from "@cantilune/core";
import { actorRef, coordinationIntent, matchBinding, operationTypeId } from "@cantilune/core";
import type { ConditionEvaluatorRegistry } from "@cantilune/runtime";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import type { RunResult } from "../types.js";
import { DEFAULT_TEMPLATES } from "../bootCantilune.js";
import { AgentInstance } from "./agentInstance.js";
import type {
  ClusterEvent,
  ClusterEventListener,
  ClusterResult,
  ClusterTerminationReason,
  AgentRunResult,
  LivenessEntry,
  HumanInterface,
  LlmAdapterFactory,
  AgentFactory,
  SwarmAgentHandle,
} from "./clusterTypes.js";
import type { SharedResources } from "./sharedResources.js";
import { deserializeManifest, manifestPriority } from "@cantilune/core";
import { SwarmScheduler, type SchedulerSnapshot } from "./swarmScheduler.js";
import type { SwarmSchedulerPolicyInput } from "./schedulerPolicy.js";
import { SignalHandlerRegistry } from "./signalHandlerRegistry.js";
import { createAgentCommsServices, type AgentCommsHandle } from "./commsRuntimeBridge.js";
import { startAgentCommsPump, type AgentCommsPump } from "./agentCommsPump.js";
import { RemoteAgentHandle } from "./remoteAgentHandle.js";
import { createRemoteRuntimeProxy } from "./remoteRuntimeProxy.js";

const DEFAULT_FEED_DRAIN_MS = 500;
const DEFAULT_COMPLETION_POLL_MS = 1000;

/** One-line summary for each way a cluster run can end. */
function summarizeTermination(reason: ClusterTerminationReason, agentCount: number): string {
  if (reason === "completed") return `Cluster execution completed (${agentCount} agents)`;
  if (reason === "stalled") return "Cluster stalled: no agent can make further progress";
  if (reason === "budget_exhausted") return "Cluster stopped: swarm budget exhausted";
  return "Cluster stopped before completion";
}
const DEFAULT_HEARTBEAT_CHECK_MS = 15_000;
const DEFAULT_STALE_MULTIPLIER = 2;
const DEFAULT_GRACE_FACTOR = 2;

export interface ClusterSupervisorDeps {
  readonly shared: SharedResources;
  readonly conditionRegistry: ConditionEvaluatorRegistry;
  readonly llmAdapterFactory: LlmAdapterFactory;
  readonly humanInterface?: HumanInterface;
  readonly heartbeatCheckIntervalMs?: number;
  readonly staleThresholdMultiplier?: number;
  readonly feedDrainIntervalMs?: number;
  readonly livenessGraceFactor?: number;
  readonly eventListener?: ClusterEventListener;
  /**
   * Principal the supervisor acts as when submitting `signal_done` /
   * `retire_participant` intents. Defaults to the runtime head's first active
   * participant (the active-initiator authority of ADR-0015).
   */
  readonly supervisorPrincipal?: () => { actorId: ActorId; kind: string } | undefined;
  /**
   * Pluggable agent constructor (ADR-0019 §1). When undefined the supervisor
   * builds the default `AgentInstance` (the original cluster agent loop —
   * byte-identical to the pre-ADR-0019 behavior, so single-Agent `/cluster`
   * tests regress nothing). When supplied (by `bootSwarm`) the factory builds a
   * `CantilunOS` per agent, reusing the full boot stack (private-history
   * checkpointing, contract/judge LLM wiring, single-flight) plus a heartbeat
   * adapter for the swarm's liveness contract.
   */
  readonly agentFactory?: AgentFactory;
  /**
   * Admission, fairness, and budget limits for the agent pool. Anything omitted
   * keeps its bounded default (see `DEFAULT_SCHEDULER_POLICY`).
   */
  readonly schedulerPolicy?: SwarmSchedulerPolicyInput;
  /** Injectable clock for the scheduler; tests drive aging deterministically. */
  readonly now?: () => number;
  /**
   * Poll interval for `waitForCompletion`. Kept small in tests so a completion
   * or stall verdict is observed promptly.
   */
  readonly completionPollMs?: number;
}

/**
 * Production trusted-feed swarm supervisor (ADR-0015).
 *
 * It consumes the committed-change feed as its only trigger for dispatch, binds
 * agent launch to the content-addressed manifest on the participant, writes
 * local completion back as a durable `signal_done`, and retires silent
 * participants through a committed `retire_participant`. It does not accept
 * out-of-band signals on the production path; `onSignalReceived` is retained
 * only for test harnesses that drive the feed manually.
 */
export class ClusterSupervisor {
  private readonly agents = new Map<string, SwarmAgentHandle>();
  private readonly agentResults = new Map<string, AgentRunResult>();
  private readonly livenessTable = new Map<string, LivenessEntry>();
  private readonly agentComms = new Map<string, { handle: AgentCommsHandle; pump: AgentCommsPump }>();
  private readonly shared: SharedResources;
  private readonly llmAdapterFactory: LlmAdapterFactory;
  private readonly humanInterface: HumanInterface | undefined;
  private readonly staleMultiplier: number;
  private readonly heartbeatCheckMs: number;
  private readonly feedDrainMs: number;
  private readonly livenessGraceFactor: number;
  private readonly eventListener: ClusterEventListener | undefined;
  private readonly supervisorPrincipal:
    (() => { actorId: ActorId; kind: string } | undefined) | undefined;
  private readonly agentFactory: AgentFactory | undefined;
  private readonly scheduler: SwarmScheduler;
  private readonly completionPollMs: number;
  private readonly signals = new SignalHandlerRegistry();

  private feedDrainTimer: ReturnType<typeof setInterval> | undefined;
  private staleDetectorTimer: ReturnType<typeof setInterval> | undefined;
  private lastObservedHead: SnapshotRef | undefined;
  private running = false;
  private draining = false;
  private dispatching = false;
  /** Set once a stall or budget verdict has ended the run; drives the result. */
  private terminal: { reason: ClusterTerminationReason; detail: string } | undefined;

  constructor(deps: ClusterSupervisorDeps) {
    this.shared = deps.shared;
    this.llmAdapterFactory = deps.llmAdapterFactory;
    this.humanInterface = deps.humanInterface;
    this.staleMultiplier = deps.staleThresholdMultiplier ?? DEFAULT_STALE_MULTIPLIER;
    this.heartbeatCheckMs = deps.heartbeatCheckIntervalMs ?? DEFAULT_HEARTBEAT_CHECK_MS;
    this.feedDrainMs = deps.feedDrainIntervalMs ?? DEFAULT_FEED_DRAIN_MS;
    this.livenessGraceFactor = deps.livenessGraceFactor ?? DEFAULT_GRACE_FACTOR;
    this.eventListener = deps.eventListener;
    this.supervisorPrincipal = deps.supervisorPrincipal;
    this.agentFactory = deps.agentFactory;
    this.completionPollMs = deps.completionPollMs ?? DEFAULT_COMPLETION_POLL_MS;
    this.scheduler = new SwarmScheduler({
      conditionRegistry: deps.conditionRegistry,
      ...(deps.schedulerPolicy !== undefined ? { policy: deps.schedulerPolicy } : {}),
      ...(deps.now !== undefined ? { now: deps.now } : {}),
    });
    this.signals.register(operationTypeId("activate_participant"), (change) =>
      this.onParticipantActivated(change),
    );
    this.signals.register(operationTypeId("emit_heartbeat"), async (change) => {
      this.onHeartbeatChange(change);
    });
    this.signals.register(operationTypeId("signal_done"), async (change) => {
      this.onSignalDoneChange(change);
    });
    this.signals.register(operationTypeId("retire_participant"), async (change) => {
      this.onRetireChange(change);
    });
  }

  /** Scheduler projection for the CLI swarm view and for result diagnostics. */
  getSchedulerSnapshot(): SchedulerSnapshot {
    return this.scheduler.snapshot();
  }

  /**
   * Start consuming the trusted committed-change feed and the liveness tick.
   * The cursor is seeded from the current durable head so a restart resumes
   * without reprocessing history the supervisor already observed.
   *
   * On (re)start, liveness is reconciled from the committed world: every
   * `active` participant with a bound `manifestRef` (an activation that
   * committed before this process started, ADR-0015 §4 crash ordering) is
   * re-seeded into the liveness table if it is not already tracked. This is
   * what makes a crashed-and-restarted supervisor converge without
   * re-dispatching `startAgent` — the feed cursor is past the
   * `activate_participant` change (no duplicate `startAgent`), but the
   * participant is still `active` with a dead agent process, so the
   * liveness-expiry tick (§5) retires it via `retire_participant`. Without
   * this reconciliation the stale detector would never see the orphaned
   * participant and the world would not converge. The reconciliation is
   * fire-and-forget because `start()` is synchronous; the staleness tick
   * tolerates a not-yet-reconciled participant for one interval.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    const head = this.shared.runtime.getHead();
    this.lastObservedHead = head === undefined ? undefined : (head.snapshotRef as SnapshotRef);
    // Reconcile liveness from the SAME head read the cursor was seeded from,
    // so reconciliation adds no getHead() calls (some test runtimes count
    // getHead invocations) and never observes a newer world than the cursor.
    void this.reconcileLivenessFromWorld(head as CollaborationSnapshot | undefined);
    this.startFeedDrain();
    this.startStaleDetector();
  }

  /**
   * Re-seed the liveness table from the committed world (ADR-0015 §4/§5).
   *
   * A participant is eligible for reconciliation when it is `active` (not
   * `done`/`retired`), has a bound `manifestRef` (so it was admitted by
   * `activate_participant`, distinguishing a real worker from the initiator
   * who is `active` but was never activated), and is not already in the
   * liveness table (so an in-flight agent is never reset). The
   * `heartbeatIntervalMs` is read from the bound manifest so the grace
   * window matches the agent's own contract.
   *
   * The head is supplied by the caller (`start` seeds it from the same read
   * the cursor uses) so this method performs no getHead() of its own.
   */
  async reconcileLivenessFromWorld(head: CollaborationSnapshot | undefined): Promise<void> {
    if (head === undefined) return;
    const candidates: Array<{ id: ActorId; manifestRef: ContentRef }> = [];
    for (const [id, p] of head.participants as ReadonlyMap<
      ActorId,
      { status: string; manifestRef?: ContentRef }
    >) {
      if (p.status !== "active") continue;
      if (p.manifestRef === undefined) continue;
      if (this.livenessTable.has(id as string)) continue;
      candidates.push({ id, manifestRef: p.manifestRef });
    }
    for (const { id, manifestRef } of candidates) {
      const manifest = await this.resolveManifest(id, manifestRef);
      if (manifest === undefined) continue;
      // Re-check the liveness table after the await: a concurrent drain may
      // have started the agent (seeding liveness) while we were resolving the
      // manifest. Do not clobber the live entry.
      if (this.livenessTable.has(id as string)) continue;
      // Seed the orphan already-expired: the agent process that this
      // `active` participant belonged to died with the previous process (the
      // feed cursor is past its `activate_participant`, so this restart will
      // not re-start it). Its last heartbeat is in the past, so the first
      // staleness tick retires it via `retire_participant` — the ADR-0015 §4
      // convergence path. (A genuinely live agent would never reach here:
      // it would be in the liveness table already, seeded by its own
      // `startAgent`, not by reconciliation.)
      const threshold =
        manifest.heartbeatIntervalMs * this.livenessGraceFactor * this.staleMultiplier;
      this.livenessTable.set(id as string, {
        lastHeartbeatTime: Date.now() - threshold - 1,
        sequenceNo: 0,
        heartbeatIntervalMs: manifest.heartbeatIntervalMs,
      });
    }
  }

  /** Stop the supervisor — cancel timers and abort in-flight agents. */
  stop(): void {
    this.running = false;
    if (this.feedDrainTimer !== undefined) {
      clearInterval(this.feedDrainTimer);
      this.feedDrainTimer = undefined;
    }
    if (this.staleDetectorTimer !== undefined) {
      clearInterval(this.staleDetectorTimer);
      this.staleDetectorTimer = undefined;
    }
    for (const agent of this.agents.values()) {
      agent.abort();
    }
  }

  /**
   * Test-only entry point for driving the supervisor from an injected change.
   * The production path consumes the feed via `drainFeed`; this method is
   * retained so existing test harnesses that push changes directly still
   * compile, but it dispatches into the same per-change processor.
   */
  async onSignalReceived(change: CoordinationChange): Promise<void> {
    if (!this.running) return;
    await this.processChange(change);
  }

  /**
   * Drain the committed-change feed since the last observed head, then give the
   * scheduler a chance to dispatch.
   *
   * The dispatch pass runs on every drain, including drains that found no
   * changes. That is deliberate: a pending agent's start condition is a
   * predicate over the committed world, and re-asking it each tick is what
   * makes fan-in, conditional start, and feedback loops fire at all.
   */
  async drainFeed(): Promise<void> {
    if (!this.running || this.draining) return;
    this.draining = true;
    try {
      const changes = this.shared.runtime.changes(this.lastObservedHead);
      for (const change of changes) {
        await this.processChange(change);
        this.lastObservedHead = change.afterRef;
        this.scheduler.noteWorldMovement();
      }
    } finally {
      this.draining = false;
    }
    await this.dispatchPending();
  }

  /**
   * Start every pending agent the scheduler clears against the current world.
   *
   * Re-entrancy is guarded because `startAgent` is async and a drain may be
   * triggered from inside agent completion; without the guard the same cleared
   * agent could be started twice before `onStarted` moved it out of pending.
   */
  async dispatchPending(): Promise<void> {
    if (!this.running || this.dispatching) return;
    this.dispatching = true;
    try {
      const head = this.shared.runtime.getHead() as CollaborationSnapshot | undefined;
      for (const decision of this.scheduler.selectDispatchable(head)) {
        // Claim the slot here, not inside startAgent: the claim must happen at
        // the dispatch site so it holds even when startAgent is overridden, and
        // so an await inside startAgent cannot let a second pass reuse the slot.
        this.scheduler.onStarted(decision.agentId);
        try {
          await this.startAgent(decision.agentId, decision.manifest);
        } catch (error) {
          this.scheduler.releaseSlot(decision.agentId);
          throw error;
        }
        this.emitEvent({ kind: "condition_met", actorId: decision.agentId });
      }
      this.reportBudgetIfExhausted();
    } finally {
      this.dispatching = false;
    }
  }

  /** Emit a one-shot budget event and record the terminal verdict. */
  private reportBudgetIfExhausted(): void {
    if (this.terminal !== undefined) return;
    const budget = this.scheduler.budget();
    if (budget.kind !== "exhausted") return;
    this.terminal = { reason: "budget_exhausted", detail: budget.detail };
    this.emitEvent({
      kind: "budget_exhausted",
      limit: budget.limit,
      detail: budget.detail,
    });
  }

  /** Process one committed change from the feed. */
  private async processChange(change: CoordinationChange): Promise<void> {
    await this.signals.dispatch(change.operationTypeId, change);
  }

  /**
   * An `activate_participant` change: admit the agent to the scheduler queue.
   *
   * Activation no longer decides whether the agent starts. It used to evaluate
   * `startCondition` once, here, and drop the agent forever if the condition
   * was false — which silently broke every topology whose condition is false at
   * activation time by construction (fan-in, conditional start, feedback
   * loops). Admission records the agent; `dispatchPending` re-asks the
   * condition against the committed world on every tick until it holds.
   */
  private async onParticipantActivated(change: CoordinationChange): Promise<void> {
    const participantBinding = change.matchBindings.find((b) => b.role === "participant");
    if (participantBinding?.role !== "participant") return;
    const agentId = participantBinding.actorId;
    if (this.agents.has(agentId as string)) return;

    const head = this.shared.runtime.getHead() as CollaborationSnapshot | undefined;
    if (head === undefined) return;
    const participantEntry = head.participants.get(agentId);
    if (participantEntry === undefined) return;

    const manifest = await this.resolveManifest(agentId, participantEntry.manifestRef);
    if (manifest === undefined) {
      this.onManifestUnresolved(agentId);
      return;
    }

    if (this.scheduler.admit(agentId, manifest)) {
      this.emitEvent({
        kind: "agent_queued",
        actorId: agentId,
        priority: manifestPriority(manifest),
      });
    }
  }

  /**
   * An activated participant whose manifest cannot be resolved.
   *
   * Without this the participant sits `active` forever with no agent: it is not
   * in the scheduler queue (so the stall detector, which requires something
   * pending, never fires), not in the liveness table (so the expiry tick never
   * fires), and not `done` (so cluster completion never holds) — the swarm
   * hangs with no diagnosis. Seeding an already-expired liveness entry routes it
   * through the ADR-0015 §5 retirement path the orphan case already uses,
   * rather than inventing a second way to retire a participant.
   */
  private onManifestUnresolved(agentId: ActorId): void {
    const agentKey = agentId as string;
    if (this.livenessTable.has(agentKey)) return;
    this.emitEvent({
      kind: "manifest_unresolved",
      actorId: agentId,
      detail:
        "The bound manifest is missing, unparseable, or names a different agentId; " +
        "the participant will be retired by the liveness tick.",
    });
    this.livenessTable.set(agentKey, {
      lastHeartbeatTime: Number.NEGATIVE_INFINITY,
      sequenceNo: 0,
      heartbeatIntervalMs: this.heartbeatCheckMs,
    });
  }

  /** Start an agent instance. */
  async startAgent(agentId: ActorId, manifest: AgentManifest): Promise<void> {
    const agentKey = agentId as string;
    if (this.agents.has(agentKey)) return;

    const transport = this.shared.meshTransport.allocate(agentId);
    const commsHandle = createAgentCommsServices({
      shared: this.shared,
      agentId,
      transport,
    });
    const pump = startAgentCommsPump({
      shared: this.shared,
      agentId,
      handle: commsHandle,
    });
    this.agentComms.set(agentKey, { handle: commsHandle, pump });

    const remoteEntry = this.shared.meshHostDirectory?.get(agentId);
    const isRemoteWorker =
      remoteEntry !== undefined &&
      remoteEntry.role === "worker" &&
      this.shared.swarmRole === "supervisor";

    if (isRemoteWorker && remoteEntry !== undefined) {
      // S4: supervisor does not run the LLM loop. Proxy runtime ports for the
      // worker's saga commits; liveness comes from world heartbeats.
      createRemoteRuntimeProxy({
        actorId: agentId,
        runtime: this.shared.runtime as never,
      });
      const instance = new RemoteAgentHandle({
        actorId: agentId,
        hostEntry: remoteEntry,
        onAbort: () => {
          pump.stop();
        },
      });
      this.agents.set(agentKey, instance);
      this.scheduler.onStarted(agentId);
      this.livenessTable.set(agentKey, {
        lastHeartbeatTime: Date.now(),
        sequenceNo: 0,
        heartbeatIntervalMs: manifest.heartbeatIntervalMs,
      });
      this.emitEvent({ kind: "agent_started", actorId: agentId });
      const resultPromise = instance.start();
      void resultPromise.then((result) => this.onAgentComplete(agentId, result, manifest));
      return;
    }

    const llmAdapter = this.llmAdapterFactory(manifest);

    const schemaProvider = createStaticSchemaProvider(DEFAULT_TEMPLATES);
    // The registered participant's kind (from the durable snapshot) is the
    // authority for the collaboration world; the manifest's kind field may
    // carry a semantic role label that is not a valid ActorKind. Using the
    // snapshot's kind keeps the agent's observation source.kind consistent
    // with the participant entry the runtime admitted, so validateActorRef
    // in the auditTail integrity check does not reject the agent's own
    // observation.
    const registeredHead = this.shared.runtime.getHead() as CollaborationSnapshot | undefined;
    const registeredEntry = registeredHead?.participants.get(agentId);
    const principal = { actorId: agentId as string, kind: registeredEntry?.kind ?? manifest.kind };

    const syscall = createSyscall({
      runtime: this.shared.runtime,
      contentStore: this.shared.contentStore,
      principal,
      schemaProvider,
    });

    // ADR-0019 §1: the agent constructor is pluggable. The default (no
    // `agentFactory`) keeps the original `AgentInstance` path byte-identical —
    // single-Agent `/cluster` tests and the L7 crash test regress nothing.
    // When `bootSwarm` supplies a factory, each agent becomes a full
    // `CantilunOS` (private-history checkpointing, contract/judge LLM wiring,
    // single-flight) wrapped in a heartbeat adapter for the swarm liveness
    // contract. Both produce a `SwarmAgentHandle`; the rest is unchanged.
    const instance: SwarmAgentHandle =
      this.agentFactory === undefined
        ? new AgentInstance({
            actorId: agentId,
            manifest,
            llmAdapter,
            syscall,
            shared: this.shared,
          })
        : this.agentFactory.create(agentId, manifest, this.shared, llmAdapter, syscall);
    this.agents.set(agentKey, instance);
    // Claim the concurrency slot before the run starts, so a dispatch pass
    // triggered while this agent is booting cannot oversubscribe the ceiling.
    this.scheduler.onStarted(agentId);

    this.livenessTable.set(agentKey, {
      lastHeartbeatTime: Date.now(),
      sequenceNo: 0,
      heartbeatIntervalMs: manifest.heartbeatIntervalMs,
    });

    this.emitEvent({ kind: "agent_started", actorId: agentId });

    const resultPromise = instance.start();
    void resultPromise.then((result) => this.onAgentComplete(agentId, result, manifest));
  }

  private stopAgentComms(agentId: ActorId): void {
    const key = agentId as string;
    const entry = this.agentComms.get(key);
    if (entry !== undefined) {
      entry.pump.stop();
      this.agentComms.delete(key);
    }
    this.shared.meshTransport.deallocate(agentId);
  }

  /** Get the current cluster status. */
  getStatus(): { agents: Map<string, { status: string; heartbeat: LivenessEntry | undefined }> } {
    const result = new Map<string, { status: string; heartbeat: LivenessEntry | undefined }>();
    const head = this.shared.runtime.getHead();
    if (head === undefined) return { agents: result };

    const participants = head.participants as ReadonlyMap<string, { status: string }>;
    for (const [id, p] of participants) {
      result.set(id, {
        status: p.status,
        heartbeat: this.livenessTable.get(id),
      });
    }
    return { agents: result };
  }

  /**
   * Wait until the swarm reaches a terminal state.
   *
   * There are four ways out and the caller can tell them apart from
   * `result.reason`: every participant finished, the swarm stalled (nothing
   * running, nothing startable, world standing still), a budget ran out, or the
   * supervisor was stopped. The previous implementation only recognised the
   * first and polled forever otherwise, so an unsatisfiable start condition
   * hung the process with no diagnosis.
   */
  async waitForCompletion(): Promise<ClusterResult> {
    const startTime = Date.now();

    while (this.running && this.terminal === undefined && !this.isClusterComplete()) {
      await new Promise((resolve) => setTimeout(resolve, this.completionPollMs));
      this.reportBudgetIfExhausted();
    }

    const reason = this.resolveTerminationReason();
    const totalTurns = [...this.agentResults.values()].reduce((sum, r) => sum + r.result.turns, 0);

    this.emitEvent({ kind: "cluster_complete" });

    const everyAgentOk = [...this.agentResults.values()].every((r) => r.result.ok);
    return {
      // Only a genuine completion can be ok: a stalled or budget-exhausted
      // swarm has unfinished participants, so reporting success would be the
      // vacuous-success defect the swarm gate exists to prevent.
      ok: reason.reason === "completed" && everyAgentOk,
      summary: summarizeTermination(reason.reason, this.agentResults.size),
      agentResults: new Map([...this.agentResults.entries()].map(([k, v]) => [k as ActorId, v])),
      totalElapsedMs: Date.now() - startTime,
      totalTurns,
      reason: reason.reason,
      diagnostic: reason.detail,
    };
  }

  /** Classify how the wait ended. */
  private resolveTerminationReason(): {
    reason: ClusterTerminationReason;
    detail: string;
  } {
    if (this.isClusterComplete()) return { reason: "completed", detail: "" };
    if (this.terminal !== undefined) return this.terminal;
    if (!this.running) {
      return {
        reason: "stopped",
        detail: "Supervisor stopped before every participant reached a terminal status.",
      };
    }
    // Reached only if the loop exits without a verdict, which the loop
    // condition forbids; classify as stalled rather than reporting success.
    return { reason: "stalled", detail: this.scheduler.observeStall().detail };
  }

  /**
   * Cluster completion is derived from the committed world: every non-retired
   * participant is `done`. This is the same authority `ClusterView` projects,
   * so the CLI and the supervisor agree by construction.
   */
  private isClusterComplete(): boolean {
    const head = this.shared.runtime.getHead();
    if (head === undefined) return true;

    const participants = head.participants as ReadonlyMap<string, { status: string }>;
    for (const [, p] of participants) {
      if (p.status === "active" || p.status === "registered" || p.status === "waiting") {
        return false;
      }
    }
    return true;
  }

  /**
   * Local agent completion is written back to the collaboration world as a
   * durable `signal_done` change (ADR-0015 §4). The intent is committed before
   * the supervisor treats the participant as retired from its live set.
   */
  private async onAgentComplete(
    agentId: ActorId,
    result: RunResult,
    manifest: AgentManifest,
  ): Promise<void> {
    const agentKey = agentId as string;
    const liveness = this.livenessTable.get(agentKey);

    await this.submitLifecycleIntent("signal_done", agentId);

    this.agentResults.set(agentKey, {
      actorId: agentId,
      result,
      heartbeatCount: liveness?.sequenceNo ?? 0,
      manifest,
    });

    this.agents.delete(agentKey);
    this.livenessTable.delete(agentKey);
    this.stopAgentComms(agentId);
    // Release the concurrency slot and charge the turns before the drain below,
    // so a pending agent waiting on this one can be dispatched in the same pass.
    this.scheduler.onCompleted(agentId, result.turns);

    this.emitEvent({
      kind: "agent_done",
      actorId: agentId,
      summary: result.summary,
    });

    await this.drainFeed();
  }

  /**
   * Submit a `signal_done` or `retire_participant` intent to the committed world
   * (ADR-0015 §4).
   *
   * The two operations have different binding semantics because their handlers
   * transition different bindings:
   * - `signal_done` transitions the `from` binding (the completing participant).
   *   So the supervisor submits it as the completing agent: `from` = target,
   *   committed as the target's own principal. This is the agent's own
   *   "I am done" signal, round-tripped through the feed.
   * - `retire_participant` transitions the `participant` binding (when present).
   *   Retirement is a supervisor action: `from` = supervisor principal,
   *   `participant` = target. The handler retires the named participant.
   */
  private submitLifecycleIntent(op: "signal_done" | "retire_participant", target: ActorId): void {
    if (op === "signal_done") {
      // The completing participant signals its own done transition.
      const intent = coordinationIntent(actorRef(target, "agent"), operationTypeId("signal_done"), [
        matchBinding("from", target as string),
      ]);
      this.shared.runtime.proposeAndCommit(intent, { principal: actorRef(target, "agent") });
      return;
    }
    // retire_participant: supervisor principal retires a silent participant.
    const principal = this.resolveSupervisorPrincipal();
    if (principal === undefined) return;
    const intent = coordinationIntent(
      actorRef(
        principal.actorId,
        principal.kind as "agent" | "human" | "tool" | "reviewer" | "runtime" | "environment",
      ),
      operationTypeId("retire_participant"),
      [
        matchBinding("from", principal.actorId as string),
        matchBinding("participant", target as string),
      ],
    );
    this.shared.runtime.proposeAndCommit(intent, {
      principal: actorRef(
        principal.actorId,
        principal.kind as "agent" | "human" | "tool" | "reviewer" | "runtime" | "environment",
      ),
    });
  }

  /** Resolve the principal the supervisor commits lifecycle intents as. @internal */
  private resolveSupervisorPrincipal(): { actorId: ActorId; kind: string } | undefined {
    if (this.supervisorPrincipal !== undefined) {
      return this.supervisorPrincipal();
    }
    const head = this.shared.runtime.getHead();
    if (head === undefined) return undefined;
    for (const [id, p] of head.participants as ReadonlyMap<
      ActorId,
      { status: string; kind: string }
    >) {
      if (p.status === "active") {
        return { actorId: id, kind: p.kind };
      }
    }
    return undefined;
  }

  /** A `signal_done` change on the feed: retire from the live set. */
  private onSignalDoneChange(change: CoordinationChange): void {
    const fromBinding = change.matchBindings.find((b) => b.role === "from");
    if (fromBinding?.role !== "from") return;
    const agentKey = fromBinding.actorId as string;
    if (this.agents.has(agentKey)) {
      this.agents.delete(agentKey);
      this.livenessTable.delete(agentKey);
      this.stopAgentComms(fromBinding.actorId);
      this.scheduler.onCompleted(fromBinding.actorId, 0);
    }
  }

  /** An `emit_heartbeat` change on the feed: refresh liveness. */
  private onHeartbeatChange(change: CoordinationChange): void {
    const fromBinding = change.matchBindings.find((b) => b.role === "from");
    if (fromBinding?.role !== "from") return;
    this.onHeartbeatReceived(fromBinding.actorId);
  }

  /** A `retire_participant` change on the feed: abort and deallocate. */
  private onRetireChange(change: CoordinationChange): void {
    const participantBinding = change.matchBindings.find((b) => b.role === "participant");
    if (participantBinding?.role !== "participant") return;
    this.onAgentRetired(participantBinding.actorId);
  }

  private onHeartbeatReceived(agentId: ActorId): void {
    const entry = this.livenessTable.get(agentId as string);
    if (entry !== undefined) {
      entry.lastHeartbeatTime = Date.now();
      entry.sequenceNo++;
      this.emitEvent({ kind: "heartbeat_received", actorId: agentId, seq: entry.sequenceNo });
    }
  }

  private onAgentRetired(agentId: ActorId): void {
    const agentKey = agentId as string;
    const instance = this.agents.get(agentKey);
    if (instance !== undefined) {
      instance.abort();
      this.agents.delete(agentKey);
      this.scheduler.onCompleted(agentId, 0);
    }
    // A participant retired before it ever started must leave the queue, or the
    // scheduler would keep re-evaluating a condition for an agent the world has
    // already given up on and report the swarm as blocked on it.
    this.scheduler.discard(agentId);
    this.livenessTable.delete(agentKey);
    this.stopAgentComms(agentId);
    this.emitEvent({ kind: "agent_retired", actorId: agentId });
  }

  private startFeedDrain(): void {
    this.feedDrainTimer = setInterval(() => {
      void this.drainFeed();
    }, this.feedDrainMs);
  }

  private startStaleDetector(): void {
    this.staleDetectorTimer = setInterval(() => {
      this.checkStaleAgents();
      this.checkStall();
    }, this.heartbeatCheckMs);
  }

  /**
   * Deadlock convergence: when nothing runs, something is still queued, and the
   * world has stopped moving for several consecutive checks, the swarm can make
   * no further progress. Record it as terminal so `waitForCompletion` returns a
   * diagnosed failure instead of polling forever.
   */
  private checkStall(): void {
    if (this.terminal !== undefined) return;
    const verdict = this.scheduler.observeStall();
    if (!verdict.stalled) return;
    this.terminal = { reason: "stalled", detail: verdict.detail };
    this.emitEvent({ kind: "swarm_stalled", detail: verdict.detail });
  }

  /**
   * Liveness-expiry retirement (ADR-0015 §5). An active participant whose
   * heartbeat exceeds its interval times the grace factor is submitted for
   * `retire_participant` — a committed change, not a silent drop.
   */
  private checkStaleAgents(): void {
    const now = Date.now();
    for (const [agentKey, liveness] of this.livenessTable) {
      const elapsed = now - liveness.lastHeartbeatTime;
      const threshold =
        liveness.heartbeatIntervalMs * this.livenessGraceFactor * this.staleMultiplier;
      if (elapsed <= threshold) continue;
      // An expired liveness entry is retired (ADR-0015 §5). This covers both
      // the running-agent-gone-stale case (a live agent whose heartbeat has
      // stopped — the `emit_heartbeat` timer stalled) and the
      // crashed-and-restarted orphan case (a participant that is `active` in
      // the committed world but whose agent process died with the previous
      // process; its liveness was reconciled already-expired on restart). A
      // running, healthy agent refreshes its liveness on `emit_heartbeat`, so
      // it never reaches this branch. No `this.agents.has()` guard: that guard
      // would suppress the only convergence path for a restarted orphan
      // (which by construction has no AgentInstance in this process).
      this.emitEvent({
        kind: "agent_stale",
        actorId: agentKey as ActorId,
        lastHeartbeatMs: elapsed,
      });
      this.submitLifecycleIntent("retire_participant", agentKey as ActorId);
    }
  }

  /**
   * Resolve the manifest from the content-addressed ref bound on the
   * participant at activation (ADR-0015 §2). This replaces the audit-tail
   * scan: the ref is authoritative, the stored bytes are verified against it,
   * and the `agentId` must match the target participant.
   */
  private async resolveManifest(
    agentId: ActorId,
    manifestRef: ContentRef | undefined,
  ): Promise<AgentManifest | undefined> {
    if (manifestRef === undefined) return undefined;
    try {
      const content = await this.shared.contentStore.get(manifestRef);
      if (content === undefined) return undefined;
      const text = new TextDecoder().decode(content.bytes);
      const parsed = deserializeManifest(text);
      if (parsed.agentId !== (agentId as string)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private emitEvent(event: ClusterEvent): void {
    this.eventListener?.(event);
  }
}
