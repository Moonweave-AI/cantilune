/**
 * Cluster-specific types extending boot for multi-agent orchestration.
 */
import type { ActorId, AgentManifest } from "@cantilune/core";
import type { Syscall } from "@cantilune/syscall";
import type { RunResult, LlmAdapter } from "../types.js";
import type { SharedResources } from "./sharedResources.js";

/** Result of an entire cluster run (all agents). */
export interface ClusterResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly agentResults: ReadonlyMap<ActorId, AgentRunResult>;
  readonly totalElapsedMs: number;
  readonly totalTurns: number;
}

export interface AgentRunResult {
  readonly actorId: ActorId;
  readonly result: RunResult;
  readonly heartbeatCount: number;
  readonly manifest: AgentManifest;
}

/** Configuration for creating a cluster-enabled OS. */
export interface ClusterConfig {
  readonly storagePath: string;
  readonly llmAdapterFactory: LlmAdapterFactory;
  readonly humanInterface?: HumanInterface;
  readonly heartbeatCheckIntervalMs?: number;
  readonly staleThresholdMultiplier?: number;
}

/** Factory that creates LlmAdapter for a given provider/model from manifest. */
export type LlmAdapterFactory = (manifest: AgentManifest) => LlmAdapter;

/** Interface for asking humans questions (injected by CLI). */
export interface HumanInterface {
  askHuman(question: string, options?: readonly string[]): Promise<string>;
}

/** Signals emitted by ClusterSupervisor for observability. */
export type ClusterEvent =
  | { readonly kind: "agent_started"; readonly actorId: ActorId }
  | { readonly kind: "agent_done"; readonly actorId: ActorId; readonly summary: string }
  | { readonly kind: "agent_stale"; readonly actorId: ActorId; readonly lastHeartbeatMs: number }
  | { readonly kind: "agent_restarted"; readonly actorId: ActorId }
  | { readonly kind: "agent_retired"; readonly actorId: ActorId }
  | { readonly kind: "condition_met"; readonly actorId: ActorId }
  | { readonly kind: "heartbeat_received"; readonly actorId: ActorId; readonly seq: number }
  | { readonly kind: "cluster_complete" };

export type ClusterEventListener = (event: ClusterEvent) => void;

/** Liveness record for a single agent. */
export interface LivenessEntry {
  lastHeartbeatTime: number;
  sequenceNo: number;
  heartbeatIntervalMs: number;
}

/**
 * Handle the supervisor holds for one running agent (ADR-0019 §1).
 *
 * `AgentInstance` (the default cluster agent loop) satisfies this structurally,
 * and `bootSwarm` supplies an adapter that wraps a full `CantilunOS` (with
 * private-history checkpointing, contract/judge LLM wiring, single-flight)
 * plus the heartbeat timer the swarm's liveness contract needs. The supervisor
 * only calls `start()` (fires the run, resolves to the agent's `RunResult`),
 * `abort()` (governed E-Stop), and reads `isRunning` — it is agnostic to
 * whether the handle is an `AgentInstance` or a `CantilunOS` adapter.
 */
export interface SwarmAgentHandle {
  /** Start the agent loop. Resolves with the agent's final `RunResult`. */
  start(): Promise<RunResult>;
  /** Abort the agent loop (governed E-Stop). */
  abort(): void;
  /** Whether the agent loop is still running. */
  readonly isRunning: boolean;
}

/**
 * Pluggable agent constructor (ADR-0019 §1). The default (undefined) keeps the
 * original `AgentInstance` path byte-identical, so single-Agent `/cluster`
 * tests and the L7 crash test regress nothing. `bootSwarm` supplies a factory
 * that builds a `CantilunOS` per agent, reusing the full boot stack.
 *
 * The factory receives the supervisor's already-constructed `syscall` (bound to
 * the agent principal) and the resolved `llmAdapter` (from
 * `llmAdapterFactory(manifest)`), so the factory does not reconstruct the
 * syscall/adapter — it only wraps them in the OS/heartbeat lifecycle.
 */
export interface AgentFactory {
  create(
    agentId: ActorId,
    manifest: AgentManifest,
    shared: SharedResources,
    llmAdapter: LlmAdapter,
    syscall: Syscall,
  ): SwarmAgentHandle;
}
