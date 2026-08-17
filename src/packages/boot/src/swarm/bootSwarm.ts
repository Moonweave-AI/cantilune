/**
 * bootSwarm (ADR-0019 D2) — the multi-Agent boot entry beside `bootCantilune`.
 *
 * `bootCantilune` boots ONE `CantilunOS` (single-Agent: observer/developer REPL,
 * one private history, single-flight). `bootSwarm` boots a `ClusterSupervisor`
 * (ADR-0015) bound to ONE shared durable world plus a pool of `CantilunOS`
 * agent instances — one per `active` participant admitted via
 * `activate_participant`. Each agent keeps its own private history (ADR-0012
 * isolation: only an exact durable/path/principal binding hydrates a private
 * transcript); the collaboration world is the shared authority.
 *
 * `CantiluneSwarm` is NOT a second collaboration mutator. The runtime remains
 * the sole mutator; the swarm boots agent OS instances that submit
 * `CoordinationIntent`s through the runtime ports, exactly as the single-Agent
 * path does (ADR-0019 §1).
 *
 * Crash/restart (ADR-0019 §5): a supervisor process crash leaves the durable
 * world intact (ADR-0014) and the `lastObservedHead` cursor in the durable
 * bundle. On restart, `bootSwarm` re-reads the cursor and head, the supervisor
 * reconciles liveness from the world (ADR-0015 §4), and re-drives: participants
 * still `active` with a live agent process are not double-started (cursor past
 * their `activate_participant`); participants whose agent process died are
 * seeded already-expired and retired on the first staleness tick.
 *
 * Comms (ADR-0019 §6): the supervisor allocates/deallocates a mesh transport per
 * agent on `startAgent`/`signal_done`/`retire`. Same-host production uses
 * `createFileMeshRouter` (`FileTransport`). Cross-host uses `createNetMeshRouter`
 * (`NetTransport`, ADR-0018 T3) injected via {@link BootSwarmDeps.meshTransport}.
 * This module adds no new comms authority.
 */
import type { ActorId, AgentManifest } from "@cantilune/core";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import type { SyscallRuntime, SyscallContentStore, ToolExecutor } from "@cantilune/syscall";
import {
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
  type ClusterEventListener,
  type ClusterResult,
  type HumanInterface,
  type LlmAdapterFactory,
  type AgentFactory,
  type SwarmAgentHandle,
  type SchedulerSnapshot,
  type SwarmSchedulerPolicyInput,
  type MeshTransportRouter,
} from "../cluster/index.js";
import type { ConditionEvaluatorRegistry } from "@cantilune/runtime";
import { bootCantilune, DEFAULT_TEMPLATES } from "../bootCantilune.js";
import type { LlmAdapter, LlmConfig, RunResult } from "../types.js";

/**
 * Dependencies for {@link bootSwarm}. The runtime and content store are the
 * shared durable world; every agent `CantilunOS` instance is booted against
 * the same `runtime`/`contentStore` with a distinct `principalId`.
 */
export interface BootSwarmDeps {
  /** Shared coordination runtime (the single collaboration world authority). */
  readonly runtime: SyscallRuntime;
  /** Shared content store (agent manifests + artifacts + private checkpoints). */
  readonly contentStore: SyscallContentStore;
  /** On-disk path backing the swarm's per-agent comms store. */
  readonly storagePath: string;
  /** Factory that builds an `LlmAdapter` per agent from its manifest. */
  readonly llmAdapterFactory: LlmAdapterFactory;
  /** Condition evaluators for `activate_participant` start conditions. */
  readonly conditionRegistry: ConditionEvaluatorRegistry;
  readonly humanInterface?: HumanInterface;
  readonly eventListener?: ClusterEventListener;
  readonly supervisorPrincipal?: () => { actorId: ActorId; kind: string } | undefined;
  readonly heartbeatCheckIntervalMs?: number;
  readonly feedDrainIntervalMs?: number;
  readonly staleThresholdMultiplier?: number;
  readonly livenessGraceFactor?: number;
  /**
   * Admission, fairness, and budget limits for the agent pool. Anything omitted
   * keeps its bounded default, so an unconfigured swarm cannot spawn without
   * limit or wait forever on an unsatisfiable start condition.
   */
  readonly schedulerPolicy?: SwarmSchedulerPolicyInput;
  /** Poll interval for `waitForCompletion`; kept small in tests. */
  readonly completionPollMs?: number;
  /**
   * Dedicated LLM adapter for goal-contract compilation per agent. Mirrors
   * `BootConfig.contractLlm`: when absent each agent's controller compiles the
   * default system contract with no LLM call. Must not share the loop adapter.
   */
  readonly contractLlm?: LlmAdapter;
  /**
   * Dedicated LLM adapter for the soft-criterion LLM judge per agent
   * (ADR-0020). When absent each agent keeps the structured_rubric placeholder
   * (ρ=0.3, fail-closed) and makes no judge LLM call.
   */
  readonly judgeLlm?: LlmAdapter;
  /**
   * Mesh used when the supervisor starts an agent. Defaults to in-process
   * loopback. Pass `createFileMeshRouter(dir)` or `createNetMeshRouter()`.
   */
  readonly meshTransport?: MeshTransportRouter;
  /** Multi-host directory (ADR-0019 S4). */
  readonly meshHostDirectory?: import("../cluster/meshHostDirectory.js").MeshHostDirectory;
  readonly swarmRole?: "supervisor" | "worker";
  /**
   * External tools (filesystem/shell/web/mcp) made available to every agent
   * `CantilunOS` booted by the swarm. Without this, agents can only use
   * syscall operations (write_content/register_participant/…) and cannot
   * write files to the workspace — so checkpoint artifacts that must exist
   * on disk (artifacts/**) are never produced. The initiator's tool set is
   * typically passed here so peers share the same workspace access.
   */
  readonly tools?: readonly ToolExecutor[];
}

/** Snapshot of the swarm's live state for the CLI view. */
export interface SwarmStatus {
  /** Whether the supervisor is started and its timers are live. */
  readonly running: boolean;
  readonly agents: ReadonlyMap<string, { readonly status: string; readonly heartbeat: unknown }>;
  /** Supervisor events observed since boot, oldest first. */
  readonly events: readonly ClusterEvent[];
  /** Queue, concurrency, and budget state driving dispatch decisions. */
  readonly scheduler: SchedulerSnapshot;
}

/**
 * Cap on the retained event log.
 *
 * The log feeds a scrollback view, not an audit trail — the durable feed is the
 * audit trail — so a long-running swarm keeps the most recent window rather
 * than growing without bound.
 */
const MAX_RETAINED_EVENTS = 500;

/**
 * A booted multi-agent swarm: a `ClusterSupervisor` (ADR-0015) bound to one
 * shared durable world plus a pool of `CantilunOS` agent instances. The
 * supervisor owns the trusted committed-change feed; `CantiluneSwarm` exposes
 * lifecycle to the CLI/headless runner.
 */
export interface CantiluneSwarm {
  /** The underlying supervisor (for direct feed access in tests). */
  readonly supervisor: ClusterSupervisor;
  /** Start the supervisor (seed cursor + reconcile liveness + drain loop). */
  start(): void;
  /** Stop the supervisor (governed E-Stop: cancel timers + abort in-flight agents). */
  stop(): void;
  /** Current swarm status projected from the supervisor. */
  status(): SwarmStatus;
  /** Wait until every non-retired participant is `done`, then return the cluster result. */
  waitForCompletion(): Promise<ClusterResult>;
  /** Shut down the swarm (stop + release the per-agent OS pool). */
  shutdown(): Promise<void>;
}

/**
 * Boot a multi-agent swarm against one shared durable world (ADR-0019).
 *
 * The returned `CantiluneSwarm` wraps a `ClusterSupervisor` whose `agentFactory`
 * builds a full `CantilunOS` per `active` participant — reusing the entire
 * single-Agent boot stack (private-history checkpointing, contract/judge LLM
 * wiring, single-flight) plus a heartbeat adapter for the swarm's liveness
 * contract. The single-Agent `bootCantilune` path is unchanged.
 */
export function bootSwarm(deps: BootSwarmDeps): CantiluneSwarm {
  const swarmEvents: ClusterEvent[] = [];
  // Tee the supervisor's event stream into the retained log before forwarding
  // it to the caller's listener, so `status().events` reflects what actually
  // happened instead of the empty array it used to return.
  const eventListener: ClusterEventListener = (event) => {
    swarmEvents.push(event);
    if (swarmEvents.length > MAX_RETAINED_EVENTS) {
      swarmEvents.splice(0, swarmEvents.length - MAX_RETAINED_EVENTS);
    }
    deps.eventListener?.(event);
  };

  const shared = createSharedResources({
    runtime: deps.runtime,
    contentStore: deps.contentStore,
    storagePath: deps.storagePath,
    ...(deps.humanInterface !== undefined ? { humanInterface: deps.humanInterface } : {}),
    eventListener,
    ...(deps.meshTransport !== undefined ? { meshTransport: deps.meshTransport } : {}),
    ...(deps.meshHostDirectory !== undefined
      ? { meshHostDirectory: deps.meshHostDirectory }
      : {}),
    ...(deps.swarmRole !== undefined ? { swarmRole: deps.swarmRole } : {}),
  });

  const agentFactory: AgentFactory = {
    create(agentId, manifest, _shared, llmAdapter, _syscall): SwarmAgentHandle {
      return createCantiluneOsAgent(
        agentId,
        manifest,
        deps.runtime,
        deps.contentStore,
        llmAdapter,
        {
          ...(deps.contractLlm !== undefined ? { contractLlm: deps.contractLlm } : {}),
          ...(deps.judgeLlm !== undefined ? { judgeLlm: deps.judgeLlm } : {}),
        },
        deps.tools,
      );
    },
  };

  const supervisor = new ClusterSupervisor({
    shared,
    conditionRegistry: deps.conditionRegistry,
    llmAdapterFactory: deps.llmAdapterFactory,
    ...(deps.humanInterface !== undefined ? { humanInterface: deps.humanInterface } : {}),
    eventListener,
    ...(deps.schedulerPolicy !== undefined ? { schedulerPolicy: deps.schedulerPolicy } : {}),
    ...(deps.completionPollMs !== undefined ? { completionPollMs: deps.completionPollMs } : {}),
    ...(deps.supervisorPrincipal !== undefined
      ? { supervisorPrincipal: deps.supervisorPrincipal }
      : {}),
    ...(deps.heartbeatCheckIntervalMs !== undefined
      ? { heartbeatCheckIntervalMs: deps.heartbeatCheckIntervalMs }
      : {}),
    ...(deps.feedDrainIntervalMs !== undefined
      ? { feedDrainIntervalMs: deps.feedDrainIntervalMs }
      : {}),
    ...(deps.staleThresholdMultiplier !== undefined
      ? { staleThresholdMultiplier: deps.staleThresholdMultiplier }
      : {}),
    ...(deps.livenessGraceFactor !== undefined
      ? { livenessGraceFactor: deps.livenessGraceFactor }
      : {}),
    agentFactory,
  });

  let started = false;
  return {
    supervisor,
    start(): void {
      supervisor.start();
      started = true;
    },
    stop(): void {
      supervisor.stop();
      started = false;
    },
    status(): SwarmStatus {
      const status = supervisor.getStatus();
      return {
        running: started,
        agents: status.agents,
        events: [...swarmEvents],
        scheduler: supervisor.getSchedulerSnapshot(),
      };
    },
    async waitForCompletion(): Promise<ClusterResult> {
      return supervisor.waitForCompletion();
    },
    async shutdown(): Promise<void> {
      // `stop()` aborts every in-flight agent handle, which is what releases
      // the per-agent OS pool: each handle's abort() shuts down its CantilunOS
      // and clears its heartbeat timer.
      supervisor.stop();
      started = false;
      await Promise.resolve();
    },
  };
}

/**
 * Build a `SwarmAgentHandle` that runs a full `CantilunOS` per agent (ADR-0019
 * §1/§2). Each OS instance is booted with the SAME shared `runtime`/
 * `contentStore` (the collaboration world) but a DISTINCT `principalId` (the
 * agent's `ActorId`) and its own private history — so no agent hydrates
 * another's private transcript (ADR-0012 isolation, preserved by construction).
 *
 * The `CantilunOS` has no built-in heartbeat timer (that lives in
 * `AgentInstance`), so this adapter starts a heartbeat timer that emits
 * `emit_heartbeat` through a syscall bound to the agent principal, keeping the
 * supervisor's liveness model satisfied. The timer stops when `run` resolves
 * or `abort` is called.
 */
export function createCantiluneOsAgent(
  agentId: ActorId,
  manifest: AgentManifest,
  runtime: SyscallRuntime,
  contentStore: SyscallContentStore,
  llmAdapter: LlmAdapter,
  sensors: { readonly contractLlm?: LlmAdapter; readonly judgeLlm?: LlmAdapter },
  tools?: readonly ToolExecutor[],
): SwarmAgentHandle {
  // bootCantilune reads principalId/principalKind/systemPrompt/maxTurns/
  // maxTimeMs/contractLlm/judgeLlm from config; it ignores durable/
  // contentStore/llm (the runtime+contentStore are passed directly). Those
  // three required BootConfig fields are placeholders that satisfy the type
  // but are never used — same pattern as createCliRuntimeBoot (runtimeSync.ts).
  const llmConfig: LlmConfig = {
    provider: manifest.provider ?? "swarm",
    model: manifest.model ?? "swarm-agent",
  };
  // The registered participant's kind (from the durable snapshot) is the
  // authority; the manifest's kind may be a semantic role label rather than a
  // valid ActorKind. Using the snapshot's kind keeps the agent's observation
  // source.kind aligned with the participant entry the runtime admitted.
  const registeredHead = runtime.getHead() as
    | { participants: ReadonlyMap<string, { kind: string }> }
    | undefined;
  const registeredEntry = registeredHead?.participants.get(agentId as string);
  const principalKind = (registeredEntry?.kind ?? manifest.kind) as typeof manifest.kind;
  const os = bootCantilune({
    runtime,
    contentStore,
    llmAdapter,
    config: {
      durable: "memory",
      contentStore: "memory",
      llm: llmConfig,
      principalId: agentId as string,
      principalKind,
      systemPrompt: manifest.systemPrompt,
      ...(manifest.maxTurns !== undefined ? { maxTurns: manifest.maxTurns } : {}),
      // Cap per-agent wall clock at the bootCantilune default (10 min). The
      // manifest's maxTimeMs is advisory and can be unreasonably high (an LLM
      // that writes maxTimeMs=3600000 would let one agent consume the entire
      // 60-min engineering budget). The swarm's own maxWallClockMs is the real
      // budget authority; per-agent time is bounded here so a slow agent cannot
      // stall the whole round.
      ...{ maxTimeMs: Math.min(manifest.maxTimeMs ?? 600_000, 600_000) },
      ...(sensors.contractLlm !== undefined ? { contractLlm: sensors.contractLlm } : {}),
      ...(sensors.judgeLlm !== undefined ? { judgeLlm: sensors.judgeLlm } : {}),
      ...(tools !== undefined ? { tools: [...tools] } : {}),
    },
  });

  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let runPromise: Promise<RunResult> | undefined;
  let aborted = false;
  // The run must observe the E-Stop, not just be shut down behind it.
  // `os.shutdown()` alone tears down the OS while the in-flight `os.run()` keeps
  // going, so a stopped supervisor could still see a late turn commit. Passing
  // the signal matches AgentInstance, which has always cancelled this way.
  const abortController = new AbortController();

  function stopHeartbeat(): void {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  }

  // Build a syscall bound to this agent's principal solely for heartbeat
  // emission — the OS's own syscall drives the agent loop. This mirrors
  // AgentInstance.emitHeartbeat (agentInstance.ts) so the liveness contract is
  // identical across the two agent kinds (AgentInstance default vs CantilunOS).
  // Uses the same registered-kind resolution as the OS principal so heartbeat
  // emissions are not rejected by the admission principal validation.
  const heartbeatSyscall = createSyscall({
    runtime,
    contentStore,
    principal: { actorId: agentId as string, kind: principalKind },
    schemaProvider: createStaticSchemaProvider(DEFAULT_TEMPLATES),
  });

  return {
    get isRunning(): boolean {
      return runPromise !== undefined && !aborted && !abortController.signal.aborted;
    },
    start(): Promise<RunResult> {
      if (runPromise !== undefined) return runPromise;
      heartbeatTimer = setInterval(() => {
        void heartbeatSyscall
          .act({
            operation: "emit_heartbeat",
            args: { from: agentId as string, turnCount: "0", lastAction: "swarm" },
          })
          .catch(() => {
            // A heartbeat emission failure is transient (e.g. a transport blip
            // on the durable feed); the next tick retries. We must not let it
            // surface as an unhandled rejection — it would tear down the agent.
          });
      }, manifest.heartbeatIntervalMs);
      runPromise = os
        .run(manifest.assignedTask, { signal: abortController.signal })
        .finally(stopHeartbeat);
      return runPromise;
    },
    abort(): void {
      aborted = true;
      stopHeartbeat();
      // Cancel the run before tearing down the OS it runs on, so the loop stops
      // issuing turns rather than being shut down from under an in-flight one.
      abortController.abort();
      void os.shutdown();
    },
  };
}
