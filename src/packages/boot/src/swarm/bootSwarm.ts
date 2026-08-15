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
 * agent on `startAgent`/`signal_done`/`retire`. With ADR-0018 this can be a real
 * `FileTransport`/`NetTransport`; the supervisor's `SharedResources` already
 * carries a `MeshTransportRouter`. This module adds no new comms authority.
 */
import type { ActorId, AgentManifest } from "@cantilune/core";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
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
}

/** Snapshot of the swarm's live state for the CLI view. */
export interface SwarmStatus {
  readonly running: boolean;
  readonly agents: ReadonlyMap<string, { readonly status: string; readonly heartbeat: unknown }>;
  readonly events: readonly ClusterEvent[];
}

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
  const shared = createSharedResources({
    runtime: deps.runtime,
    contentStore: deps.contentStore,
    storagePath: deps.storagePath,
    ...(deps.humanInterface !== undefined ? { humanInterface: deps.humanInterface } : {}),
    ...(deps.eventListener !== undefined ? { eventListener: deps.eventListener } : {}),
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
      );
    },
  };

  const supervisor = new ClusterSupervisor({
    shared,
    conditionRegistry: deps.conditionRegistry,
    llmAdapterFactory: deps.llmAdapterFactory,
    ...(deps.humanInterface !== undefined ? { humanInterface: deps.humanInterface } : {}),
    ...(deps.eventListener !== undefined ? { eventListener: deps.eventListener } : {}),
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

  const swarmEvents: ClusterEvent[] = [];
  return {
    supervisor,
    start(): void {
      supervisor.start();
    },
    stop(): void {
      supervisor.stop();
    },
    status(): SwarmStatus {
      const status = supervisor.getStatus();
      return {
        running: true,
        agents: status.agents,
        events: [...swarmEvents],
      };
    },
    async waitForCompletion(): Promise<ClusterResult> {
      return supervisor.waitForCompletion();
    },
    async shutdown(): Promise<void> {
      supervisor.stop();
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
  const os = bootCantilune({
    runtime,
    contentStore,
    llmAdapter,
    config: {
      durable: "memory",
      contentStore: "memory",
      llm: llmConfig,
      principalId: agentId as string,
      principalKind: manifest.kind,
      systemPrompt: manifest.systemPrompt,
      ...(manifest.maxTurns !== undefined ? { maxTurns: manifest.maxTurns } : {}),
      ...(manifest.maxTimeMs !== undefined ? { maxTimeMs: manifest.maxTimeMs } : {}),
      ...(sensors.contractLlm !== undefined ? { contractLlm: sensors.contractLlm } : {}),
      ...(sensors.judgeLlm !== undefined ? { judgeLlm: sensors.judgeLlm } : {}),
    },
  });

  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let runPromise: Promise<RunResult> | undefined;
  let aborted = false;

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
  const heartbeatSyscall = createSyscall({
    runtime,
    contentStore,
    principal: { actorId: agentId as string, kind: manifest.kind },
    schemaProvider: createStaticSchemaProvider(DEFAULT_TEMPLATES),
  });

  return {
    get isRunning(): boolean {
      return runPromise !== undefined && !aborted;
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
      runPromise = os.run(manifest.assignedTask).finally(stopHeartbeat);
      return runPromise;
    },
    abort(): void {
      aborted = true;
      stopHeartbeat();
      void os.shutdown();
    },
  };
}
