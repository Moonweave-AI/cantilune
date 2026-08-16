/**
 * Swarm scheduling policy — the admission, fairness, and budget limits the
 * {@link SwarmScheduler} enforces before an activated participant is allowed to
 * consume an agent slot.
 *
 * The policy is deliberately separate from `ClusterSupervisor`: the supervisor
 * owns the trusted committed-change feed and the liveness contract (ADR-0015),
 * while the policy answers "may this eligible agent run right now, and for how
 * long may the swarm keep trying". Keeping them apart means a scheduling change
 * never touches the feed/authority path.
 *
 * Every limit is opt-out by setting it to `Number.POSITIVE_INFINITY`; the
 * defaults are chosen so an unconfigured swarm is bounded rather than able to
 * spawn without limit.
 */

/** Limits applied to one swarm's dispatch decisions. */
export interface SwarmSchedulerPolicy {
  /**
   * Most agents allowed to run concurrently. An eligible agent beyond this
   * ceiling waits in the pending queue instead of starting, which is what keeps
   * a self-registering swarm from opening hundreds of LLM loops at once.
   */
  readonly maxConcurrentAgents: number;
  /**
   * Most agents the swarm may ever start, across the whole run. This bounds
   * runaway self-registration: agents that register agents that register
   * agents. Reaching it is a terminal budget condition, not a wait.
   */
  readonly maxTotalAgents: number;
  /**
   * Most turns the swarm may consume in total, summed over completed agents.
   * Reaching it is a terminal budget condition.
   */
  readonly maxTotalTurns: number;
  /**
   * Wall-clock ceiling for `waitForCompletion`. Reaching it ends the wait with
   * a `budget_exhausted` verdict rather than blocking forever.
   */
  readonly maxWallClockMs: number;
  /**
   * How long a pending agent may wait before its effective priority is raised
   * one step. This is the anti-starvation rule: without it a steady stream of
   * high-priority agents could keep a low-priority one queued indefinitely.
   */
  readonly agingIntervalMs: number;
  /**
   * Consecutive scheduler ticks with no running agent, no dispatchable pending
   * agent, and no world movement before the swarm is declared stalled. A stall
   * is how an unsatisfiable start condition (a fan-in waiting on an agent that
   * will never finish) converges instead of hanging.
   */
  readonly stallTicksBeforeDeadlock: number;
}

/**
 * Bounded defaults.
 *
 * `maxConcurrentAgents` is 8 because each agent slot is an independent LLM
 * conversation: the ceiling is about provider rate limits and local memory, not
 * about coordination semantics. The total/turn/wall-clock budgets are generous
 * enough not to interrupt ordinary work while still terminating a runaway
 * swarm. `stallTicksBeforeDeadlock` of 3 requires the stall to persist across
 * three observations, so a single tick that races a commit is not misread as a
 * deadlock.
 */
export const DEFAULT_SCHEDULER_POLICY: SwarmSchedulerPolicy = Object.freeze({
  maxConcurrentAgents: 8,
  maxTotalAgents: 256,
  maxTotalTurns: 10_000,
  maxWallClockMs: 3_600_000,
  agingIntervalMs: 30_000,
  stallTicksBeforeDeadlock: 3,
});

/** Caller-supplied overrides; anything omitted keeps its default. */
export type SwarmSchedulerPolicyInput = Partial<SwarmSchedulerPolicy>;

/**
 * Merge overrides onto the defaults, rejecting values that would disable a
 * limit by accident.
 *
 * A non-positive ceiling would deadlock the swarm (no agent could ever be
 * admitted), and a negative budget would make every run start already
 * exhausted, so both fail closed onto the default rather than being honored.
 */
export function resolveSchedulerPolicy(
  input: SwarmSchedulerPolicyInput | undefined,
): SwarmSchedulerPolicy {
  if (input === undefined) return DEFAULT_SCHEDULER_POLICY;
  return Object.freeze({
    maxConcurrentAgents: positiveOr(
      input.maxConcurrentAgents,
      DEFAULT_SCHEDULER_POLICY.maxConcurrentAgents,
    ),
    maxTotalAgents: positiveOr(input.maxTotalAgents, DEFAULT_SCHEDULER_POLICY.maxTotalAgents),
    maxTotalTurns: positiveOr(input.maxTotalTurns, DEFAULT_SCHEDULER_POLICY.maxTotalTurns),
    maxWallClockMs: positiveOr(input.maxWallClockMs, DEFAULT_SCHEDULER_POLICY.maxWallClockMs),
    agingIntervalMs: positiveOr(input.agingIntervalMs, DEFAULT_SCHEDULER_POLICY.agingIntervalMs),
    stallTicksBeforeDeadlock: positiveOr(
      input.stallTicksBeforeDeadlock,
      DEFAULT_SCHEDULER_POLICY.stallTicksBeforeDeadlock,
    ),
  });
}

/** Accept a positive value (including `Infinity`, the documented opt-out). */
function positiveOr(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (Number.isNaN(value) || value <= 0) return fallback;
  return value;
}
