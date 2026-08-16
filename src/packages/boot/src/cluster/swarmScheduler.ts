/**
 * Swarm scheduler — admission, fairness, budget, and stall detection for the
 * agent pool a {@link ClusterSupervisor} drives.
 *
 * Before this module the supervisor dispatched straight from the feed: an
 * `activate_participant` change evaluated the manifest's start condition once
 * and either started the agent immediately or dropped it forever. That made
 * three whole topology families unreachable — fan-in (wait for N agents to
 * finish), conditional start (wait for an artifact), and feedback loops (wait
 * for a later revision) — because their conditions are false at activation time
 * by construction, and nothing ever re-asked. It also meant an activated
 * participant that never started still counted as incomplete, so
 * `waitForCompletion` polled forever.
 *
 * The scheduler closes both holes. An activated participant is *admitted* into
 * a pending queue and its start condition is re-evaluated against the committed
 * world on every tick, so it starts as soon as the world satisfies it. Agents
 * that stay unsatisfiable are visible as blocked, and a swarm that can make no
 * further progress is reported as stalled rather than waited on.
 *
 * The scheduler decides *whether and when*; the supervisor still decides *how*
 * (manifest resolution, principal binding, syscall construction) and remains
 * the only component that touches the runtime.
 */
import type { ActorId, AgentManifest, CollaborationSnapshot } from "@cantilune/core";
import { manifestPriority } from "@cantilune/core";
import type { ConditionEvaluatorRegistry } from "@cantilune/runtime";
import type { SwarmSchedulerPolicy, SwarmSchedulerPolicyInput } from "./schedulerPolicy.js";
import { resolveSchedulerPolicy } from "./schedulerPolicy.js";

/** Why a pending agent did not dispatch on the most recent evaluation. */
export type PendingBlockReason =
  /** Its `startCondition` is not satisfied by the committed world yet. */
  | "condition_unmet"
  /** Eligible, but the concurrency ceiling is full. */
  | "slot_unavailable"
  /** Eligible, but a swarm budget is exhausted so nothing more may start. */
  | "budget_exhausted";

/** One agent admitted to the queue but not yet running. */
export interface PendingAgent {
  readonly agentId: ActorId;
  readonly manifest: AgentManifest;
  /** When the activation was admitted, the anchor for anti-starvation aging. */
  readonly enqueuedAt: number;
  /** Priority declared by the manifest, before aging. */
  readonly basePriority: number;
  /** `basePriority` plus one step per completed aging interval spent waiting. */
  readonly effectivePriority: number;
  readonly blockedBy: PendingBlockReason;
  /** Evaluations this entry has been through; useful for diagnosing a stall. */
  readonly evaluations: number;
}

/** Which budget, if any, forbids starting further agents. */
export type SwarmBudgetVerdict =
  | { readonly kind: "within_budget" }
  | {
      readonly kind: "exhausted";
      readonly limit: "agents" | "turns" | "wallClock";
      readonly detail: string;
    };

/** Read-only projection of scheduler state, for the CLI and for diagnostics. */
export interface SchedulerSnapshot {
  readonly running: number;
  readonly pending: readonly PendingAgent[];
  readonly startedTotal: number;
  readonly completedTotal: number;
  readonly consumedTurns: number;
  readonly elapsedMs: number;
  readonly policy: SwarmSchedulerPolicy;
  /** Every concurrency slot is occupied. */
  readonly saturated: boolean;
  /** Consecutive ticks the swarm has been unable to make progress. */
  readonly stallTicks: number;
  readonly budget: SwarmBudgetVerdict;
}

/** Verdict of one stall observation. */
export interface StallVerdict {
  readonly stalled: boolean;
  /** Pending agents whose conditions the current world cannot satisfy. */
  readonly blocked: readonly PendingAgent[];
  readonly detail: string;
}

/** One agent the scheduler cleared to start. */
export interface DispatchDecision {
  readonly agentId: ActorId;
  readonly manifest: AgentManifest;
}

export interface SwarmSchedulerDeps {
  readonly conditionRegistry: ConditionEvaluatorRegistry;
  readonly policy?: SwarmSchedulerPolicyInput;
  /** Injectable clock; tests drive aging and wall-clock budgets deterministically. */
  readonly now?: () => number;
}

interface MutablePending {
  readonly agentId: ActorId;
  readonly manifest: AgentManifest;
  readonly enqueuedAt: number;
  readonly basePriority: number;
  /** Admission sequence, the tiebreak that makes equal priorities FIFO. */
  readonly sequence: number;
  blockedBy: PendingBlockReason;
  evaluations: number;
}

export class SwarmScheduler {
  private readonly conditionRegistry: ConditionEvaluatorRegistry;
  private readonly now: () => number;
  private readonly pending = new Map<string, MutablePending>();
  private readonly running = new Set<string>();
  /** Every agent ever admitted, so a replayed feed cannot double-admit. */
  private readonly known = new Set<string>();

  private readonly startedAt: number;
  private sequenceCounter = 0;
  private startedTotal = 0;
  private completedTotal = 0;
  private consumedTurns = 0;
  private stallTicks = 0;
  private worldMoved = false;

  readonly policy: SwarmSchedulerPolicy;

  constructor(deps: SwarmSchedulerDeps) {
    this.conditionRegistry = deps.conditionRegistry;
    this.policy = resolveSchedulerPolicy(deps.policy);
    this.now = deps.now ?? (() => Date.now());
    this.startedAt = this.now();
  }

  /**
   * Admit an activated participant into the pending queue.
   *
   * Returns `false` when the agent is already known — running, queued, or
   * finished. The feed can replay an `activate_participant` change after a
   * restart, and admission must be idempotent for the same reason `startAgent`
   * is guarded: one activation is one agent.
   */
  admit(agentId: ActorId, manifest: AgentManifest): boolean {
    const key = agentId as string;
    if (this.known.has(key)) return false;
    this.known.add(key);
    this.pending.set(key, {
      agentId,
      manifest,
      enqueuedAt: this.now(),
      basePriority: manifestPriority(manifest),
      sequence: this.sequenceCounter++,
      blockedBy: "condition_unmet",
      evaluations: 0,
    });
    // A new admission is world movement: the stall counter must restart, or a
    // swarm that was idle while waiting for a registration would be reported
    // as deadlocked the moment its next agent arrives.
    this.worldMoved = true;
    return true;
  }

  /**
   * Drop a pending agent that the world retired before it ever started.
   *
   * The agent stays in `known`, so a later replay of its activation does not
   * resurrect a participant the world has already retired.
   */
  discard(agentId: ActorId): void {
    if (this.pending.delete(agentId as string)) {
      this.worldMoved = true;
    }
  }

  /**
   * Claim the concurrency slot for an agent that is about to start.
   *
   * Idempotent: the dispatch pass claims the slot before calling `startAgent`
   * so a concurrent pass cannot oversubscribe the ceiling, and `startAgent`
   * claims it again to cover callers that start an agent directly. Counting the
   * second call would inflate `startedTotal` against the spawn budget, so a
   * repeat is a no-op.
   */
  onStarted(agentId: ActorId): void {
    const key = agentId as string;
    this.pending.delete(key);
    if (this.running.has(key)) return;
    this.running.add(key);
    this.startedTotal += 1;
    this.worldMoved = true;
  }

  /** Release a slot claimed for an agent whose start failed before it ran. */
  releaseSlot(agentId: ActorId): void {
    if (this.running.delete(agentId as string)) {
      this.startedTotal -= 1;
    }
  }

  /** Record an agent's completion and the turns it consumed. */
  onCompleted(agentId: ActorId, turns: number): void {
    const key = agentId as string;
    if (this.running.delete(key)) {
      this.completedTotal += 1;
    }
    this.consumedTurns += Number.isFinite(turns) && turns > 0 ? turns : 0;
    this.worldMoved = true;
  }

  /**
   * Note that the committed world advanced.
   *
   * The supervisor calls this for every change it drains. Stall detection needs
   * it because "no agent running and none dispatchable" is only a deadlock when
   * the world is also standing still — otherwise the swarm is simply between
   * commits.
   */
  noteWorldMovement(): void {
    this.worldMoved = true;
  }

  /**
   * Re-evaluate every pending start condition against the committed world and
   * return the agents that may start now, highest effective priority first.
   *
   * This is the method that makes fan-in, conditional start, and feedback loops
   * work: a condition that was false at activation is asked again on every
   * tick, against the world as it now stands.
   */
  selectDispatchable(snapshot: CollaborationSnapshot | undefined): readonly DispatchDecision[] {
    if (snapshot === undefined) return [];

    const budget = this.budget();
    const eligible: MutablePending[] = [];
    for (const entry of this.pending.values()) {
      entry.evaluations += 1;
      const satisfied = this.conditionRegistry.evaluate(entry.manifest.startCondition, {
        snapshot,
        targetAgent: entry.agentId,
      });
      if (!satisfied) {
        entry.blockedBy = "condition_unmet";
        continue;
      }
      // Eligible by the world; the remaining gates are swarm-level resources.
      entry.blockedBy = budget.kind === "exhausted" ? "budget_exhausted" : "slot_unavailable";
      if (budget.kind === "within_budget") eligible.push(entry);
    }
    if (eligible.length === 0) return [];

    // The batch is bounded by BOTH free slots and the remaining spawn budget.
    // Bounding by slots alone would let one pass start more agents than
    // `maxTotalAgents` allows, because the budget was checked once before the
    // batch rather than per agent.
    const batchSize = Math.min(this.availableSlots(), this.remainingSpawns());
    if (batchSize <= 0) {
      for (const entry of eligible) {
        entry.blockedBy = this.remainingSpawns() <= 0 ? "budget_exhausted" : "slot_unavailable";
      }
      return [];
    }

    const at = this.now();
    eligible.sort((a, b) => this.compareForDispatch(a, b, at));
    return eligible.slice(0, batchSize).map((entry) => ({
      agentId: entry.agentId,
      manifest: entry.manifest,
    }));
  }

  /**
   * Whether any swarm budget forbids starting a further agent.
   *
   * The wall-clock limit is measured from scheduler construction, which is the
   * swarm's own start, not from the first dispatch — a swarm that spends its
   * whole budget waiting on an unsatisfiable condition must still terminate.
   */
  budget(): SwarmBudgetVerdict {
    if (this.startedTotal >= this.policy.maxTotalAgents) {
      return {
        kind: "exhausted",
        limit: "agents",
        detail: `started ${this.startedTotal} agents, ceiling is ${this.policy.maxTotalAgents}`,
      };
    }
    if (this.consumedTurns >= this.policy.maxTotalTurns) {
      return {
        kind: "exhausted",
        limit: "turns",
        detail: `consumed ${this.consumedTurns} turns, ceiling is ${this.policy.maxTotalTurns}`,
      };
    }
    const elapsed = this.elapsedMs();
    if (elapsed >= this.policy.maxWallClockMs) {
      return {
        kind: "exhausted",
        limit: "wallClock",
        detail: `elapsed ${elapsed}ms, ceiling is ${this.policy.maxWallClockMs}ms`,
      };
    }
    return { kind: "within_budget" };
  }

  /**
   * Observe one scheduler tick and report whether the swarm is stalled.
   *
   * A stall is: nothing running, something still pending, and no world movement
   * since the previous observation. It must persist for
   * `stallTicksBeforeDeadlock` consecutive observations, so a tick that merely
   * races an in-flight commit is not mistaken for a deadlock.
   */
  observeStall(): StallVerdict {
    const moved = this.worldMoved;
    this.worldMoved = false;

    const idle = this.running.size === 0;
    const hasPending = this.pending.size > 0;
    if (moved || !idle || !hasPending) {
      this.stallTicks = 0;
      return { stalled: false, blocked: [], detail: "" };
    }

    this.stallTicks += 1;
    const blocked = this.pendingSnapshot();
    if (this.stallTicks < this.policy.stallTicksBeforeDeadlock) {
      return { stalled: false, blocked, detail: "" };
    }
    const names = blocked.map((p) => `${p.agentId as string}(${p.blockedBy})`).join(", ");
    return {
      stalled: true,
      blocked,
      detail:
        `No agent is running and no pending agent can start after ` +
        `${this.stallTicks} consecutive checks: ${names}`,
    };
  }

  /** Read-only projection for the CLI swarm view and for result diagnostics. */
  snapshot(): SchedulerSnapshot {
    return {
      running: this.running.size,
      pending: this.pendingSnapshot(),
      startedTotal: this.startedTotal,
      completedTotal: this.completedTotal,
      consumedTurns: this.consumedTurns,
      elapsedMs: this.elapsedMs(),
      policy: this.policy,
      saturated: this.availableSlots() <= 0,
      stallTicks: this.stallTicks,
      budget: this.budget(),
    };
  }

  /** Free concurrency slots, floored at zero. */
  private availableSlots(): number {
    const free = this.policy.maxConcurrentAgents - this.running.size;
    return free > 0 ? free : 0;
  }

  /** Agents the spawn budget still permits, floored at zero. */
  private remainingSpawns(): number {
    const left = this.policy.maxTotalAgents - this.startedTotal;
    return left > 0 ? left : 0;
  }

  private elapsedMs(): number {
    return this.now() - this.startedAt;
  }

  /**
   * Order two eligible agents: higher effective priority first, then admission
   * order. Aging is applied here rather than stored, so a long-queued agent
   * climbs without the queue having to be rewritten on a timer.
   */
  private compareForDispatch(a: MutablePending, b: MutablePending, at: number): number {
    const byPriority = this.effectivePriority(b, at) - this.effectivePriority(a, at);
    return byPriority !== 0 ? byPriority : a.sequence - b.sequence;
  }

  private effectivePriority(entry: MutablePending, at: number): number {
    const waited = at - entry.enqueuedAt;
    if (waited <= 0 || !Number.isFinite(this.policy.agingIntervalMs)) return entry.basePriority;
    return entry.basePriority + Math.floor(waited / this.policy.agingIntervalMs);
  }

  private pendingSnapshot(): readonly PendingAgent[] {
    const at = this.now();
    return [...this.pending.values()]
      .sort((a, b) => this.compareForDispatch(a, b, at))
      .map((entry) => ({
        agentId: entry.agentId,
        manifest: entry.manifest,
        enqueuedAt: entry.enqueuedAt,
        basePriority: entry.basePriority,
        effectivePriority: this.effectivePriority(entry, at),
        blockedBy: entry.blockedBy,
        evaluations: entry.evaluations,
      }));
  }
}
