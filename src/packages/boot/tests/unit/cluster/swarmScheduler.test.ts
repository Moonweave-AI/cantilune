/**
 * Unit tests for the swarm scheduler: admission, re-evaluation, the concurrency
 * ceiling, priority + anti-starvation aging, budgets, and stall detection.
 *
 * The scheduler is pure with respect to the world — it takes a snapshot and a
 * condition registry — so these tests drive it directly with an injected clock
 * rather than through a supervisor.
 */
import { describe, it, expect } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  participant,
  conditionAtom,
  ALWAYS_CONDITION,
  NEVER_CONDITION,
} from "@cantilune/core";
import type {
  ActorId,
  AgentManifest,
  CollaborationSnapshot,
  ParticipationStatus,
  StartConditionExpression,
} from "@cantilune/core";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import { SwarmScheduler } from "../../../src/cluster/swarmScheduler.js";
import { DEFAULT_SCHEDULER_POLICY } from "../../../src/cluster/schedulerPolicy.js";
import type { SwarmSchedulerPolicyInput } from "../../../src/cluster/schedulerPolicy.js";

function manifest(
  id: string,
  opts?: { startCondition?: StartConditionExpression; priority?: number },
): AgentManifest {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "test",
    assignedTask: "task-" + id,
    startCondition: opts?.startCondition ?? ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
    ...(opts?.priority !== undefined ? { priority: opts.priority } : {}),
  };
}

function worldWith(statuses: Record<string, ParticipationStatus>): CollaborationSnapshot {
  const participants = new Map<ActorId, ReturnType<typeof participant>>();
  for (const [id, status] of Object.entries(statuses)) {
    const aid = actorId(id);
    participants.set(aid, participant(aid, "agent", status));
  }
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s1"),
    epochId: epochId("e1"),
    participants,
  });
}

/** Scheduler with a clock the test advances explicitly. */
function schedulerAt(clock: { value: number }, policy?: SwarmSchedulerPolicyInput): SwarmScheduler {
  return new SwarmScheduler({
    conditionRegistry: createDefaultConditionRegistry(),
    now: () => clock.value,
    ...(policy !== undefined ? { policy } : {}),
  });
}

describe("SwarmScheduler admission", () => {
  it("admits an agent once; a replayed activation is ignored", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    expect(scheduler.admit(actorId("a"), manifest("a"))).toBe(true);
    expect(scheduler.admit(actorId("a"), manifest("a"))).toBe(false);
    expect(scheduler.snapshot().pending).toHaveLength(1);
  });

  it("does not resurrect an agent discarded after admission", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.discard(actorId("a"));
    expect(scheduler.snapshot().pending).toHaveLength(0);
    // The world already retired it; a replayed activate must not re-queue it.
    expect(scheduler.admit(actorId("a"), manifest("a"))).toBe(false);
    expect(scheduler.snapshot().pending).toHaveLength(0);
  });
});

describe("SwarmScheduler condition re-evaluation", () => {
  it("keeps an unmet agent queued and dispatches it once the world satisfies it", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    const waitsForA = conditionAtom("agentsDone", { agents: ["a"] });
    scheduler.admit(actorId("b"), manifest("b", { startCondition: waitsForA }));

    // The regression this guards: activation-time evaluation dropped `b`
    // permanently because `a` was still active.
    expect(scheduler.selectDispatchable(worldWith({ a: "active" }))).toHaveLength(0);
    expect(scheduler.snapshot().pending[0]?.blockedBy).toBe("condition_unmet");

    const dispatched = scheduler.selectDispatchable(worldWith({ a: "done" }));
    expect(dispatched.map((d) => d.agentId as string)).toEqual(["b"]);
  });

  it("re-evaluates on every pass, counting evaluations for stall diagnosis", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    scheduler.admit(actorId("b"), manifest("b", { startCondition: NEVER_CONDITION }));
    const world = worldWith({ a: "active" });
    scheduler.selectDispatchable(world);
    scheduler.selectDispatchable(world);
    scheduler.selectDispatchable(world);
    expect(scheduler.snapshot().pending[0]?.evaluations).toBe(3);
  });

  it("dispatches nothing when the world has no head yet", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    scheduler.admit(actorId("a"), manifest("a"));
    expect(scheduler.selectDispatchable(undefined)).toHaveLength(0);
  });
});

describe("SwarmScheduler concurrency ceiling", () => {
  it("dispatches at most the ceiling and queues the surplus as slot_unavailable", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxConcurrentAgents: 2 });
    for (const id of ["a", "b", "c", "d"]) {
      scheduler.admit(actorId(id), manifest(id));
    }
    const world = worldWith({ initiator: "active" });

    const first = scheduler.selectDispatchable(world);
    expect(first).toHaveLength(2);
    for (const decision of first) scheduler.onStarted(decision.agentId);

    expect(scheduler.selectDispatchable(world)).toHaveLength(0);
    const snapshot = scheduler.snapshot();
    expect(snapshot.saturated).toBe(true);
    expect(snapshot.pending.map((p) => p.blockedBy)).toEqual([
      "slot_unavailable",
      "slot_unavailable",
    ]);
  });

  it("releases a slot on completion so a queued agent starts", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxConcurrentAgents: 1 });
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.admit(actorId("b"), manifest("b"));
    const world = worldWith({ initiator: "active" });

    const first = scheduler.selectDispatchable(world);
    expect(first.map((d) => d.agentId as string)).toEqual(["a"]);
    scheduler.onStarted(actorId("a"));
    expect(scheduler.selectDispatchable(world)).toHaveLength(0);

    scheduler.onCompleted(actorId("a"), 3);
    expect(scheduler.selectDispatchable(world).map((d) => d.agentId as string)).toEqual(["b"]);
    expect(scheduler.snapshot().consumedTurns).toBe(3);
  });

  it("claiming a slot twice does not double-charge the spawn budget", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.onStarted(actorId("a"));
    scheduler.onStarted(actorId("a"));
    const snapshot = scheduler.snapshot();
    expect(snapshot.running).toBe(1);
    expect(snapshot.startedTotal).toBe(1);
  });

  it("releaseSlot undoes a claim whose start failed", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.onStarted(actorId("a"));
    scheduler.releaseSlot(actorId("a"));
    const snapshot = scheduler.snapshot();
    expect(snapshot.running).toBe(0);
    expect(snapshot.startedTotal).toBe(0);
  });
});

describe("SwarmScheduler fairness", () => {
  it("dispatches higher priority first and breaks ties by admission order", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxConcurrentAgents: 3 });
    scheduler.admit(actorId("low"), manifest("low", { priority: 0 }));
    scheduler.admit(actorId("high"), manifest("high", { priority: 5 }));
    scheduler.admit(actorId("also-low"), manifest("also-low", { priority: 0 }));

    const order = scheduler
      .selectDispatchable(worldWith({ initiator: "active" }))
      .map((d) => d.agentId as string);
    expect(order).toEqual(["high", "low", "also-low"]);
  });

  it("ages a long-waiting agent past a newer higher-priority one", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxConcurrentAgents: 1, agingIntervalMs: 1000 });
    scheduler.admit(actorId("starved"), manifest("starved", { priority: 0 }));

    // Ten aging intervals later the starved agent is worth 10 priority steps,
    // so a freshly admitted priority-5 agent no longer preempts it.
    clock.value = 10_000;
    scheduler.admit(actorId("fresh"), manifest("fresh", { priority: 5 }));

    const order = scheduler
      .selectDispatchable(worldWith({ initiator: "active" }))
      .map((d) => d.agentId as string);
    expect(order).toEqual(["starved"]);
  });
});

describe("SwarmScheduler budgets", () => {
  it("stops dispatching once the spawn ceiling is reached", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxTotalAgents: 1, maxConcurrentAgents: 4 });
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.admit(actorId("b"), manifest("b"));
    const world = worldWith({ initiator: "active" });

    scheduler.onStarted(scheduler.selectDispatchable(world)[0]!.agentId);
    scheduler.onCompleted(actorId("a"), 1);

    expect(scheduler.selectDispatchable(world)).toHaveLength(0);
    const budget = scheduler.budget();
    expect(budget.kind).toBe("exhausted");
    if (budget.kind === "exhausted") expect(budget.limit).toBe("agents");
    expect(scheduler.snapshot().pending[0]?.blockedBy).toBe("budget_exhausted");
  });

  it("reports the turn ceiling", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxTotalTurns: 5 });
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.onStarted(actorId("a"));
    scheduler.onCompleted(actorId("a"), 5);
    const budget = scheduler.budget();
    expect(budget.kind).toBe("exhausted");
    if (budget.kind === "exhausted") expect(budget.limit).toBe("turns");
  });

  it("reports the wall-clock ceiling measured from swarm start", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxWallClockMs: 1000 });
    expect(scheduler.budget().kind).toBe("within_budget");
    clock.value = 1500;
    const budget = scheduler.budget();
    expect(budget.kind).toBe("exhausted");
    if (budget.kind === "exhausted") expect(budget.limit).toBe("wallClock");
  });

  it("ignores a negative turn report rather than crediting the budget", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock);
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.onStarted(actorId("a"));
    scheduler.onCompleted(actorId("a"), -10);
    expect(scheduler.snapshot().consumedTurns).toBe(0);
  });
});

describe("SwarmScheduler stall detection", () => {
  it("declares a stall only after the configured consecutive idle checks", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { stallTicksBeforeDeadlock: 3 });
    scheduler.admit(actorId("b"), manifest("b", { startCondition: NEVER_CONDITION }));
    scheduler.selectDispatchable(worldWith({ a: "active" }));

    // The admission itself counts as movement, so the first observation clears.
    expect(scheduler.observeStall().stalled).toBe(false);
    expect(scheduler.observeStall().stalled).toBe(false);
    expect(scheduler.observeStall().stalled).toBe(false);
    const verdict = scheduler.observeStall();
    expect(verdict.stalled).toBe(true);
    expect(verdict.blocked.map((p) => p.agentId as string)).toEqual(["b"]);
    expect(verdict.detail).toContain("b(condition_unmet)");
  });

  it("world movement resets the stall counter", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { stallTicksBeforeDeadlock: 2 });
    scheduler.admit(actorId("b"), manifest("b", { startCondition: NEVER_CONDITION }));
    scheduler.observeStall();
    scheduler.observeStall();
    scheduler.noteWorldMovement();
    expect(scheduler.observeStall().stalled).toBe(false);
    expect(scheduler.snapshot().stallTicks).toBe(0);
  });

  it("a running agent is never a stall, however long it runs", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { stallTicksBeforeDeadlock: 1 });
    scheduler.admit(actorId("a"), manifest("a"));
    scheduler.admit(actorId("b"), manifest("b", { startCondition: NEVER_CONDITION }));
    scheduler.onStarted(actorId("a"));
    scheduler.observeStall();
    expect(scheduler.observeStall().stalled).toBe(false);
  });

  it("an empty queue is not a stall", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { stallTicksBeforeDeadlock: 1 });
    scheduler.observeStall();
    expect(scheduler.observeStall().stalled).toBe(false);
  });
});

describe("SwarmScheduler policy resolution", () => {
  it("uses bounded defaults when unconfigured", () => {
    const clock = { value: 0 };
    expect(schedulerAt(clock).policy).toEqual(DEFAULT_SCHEDULER_POLICY);
  });

  it("falls back to the default for a limit that would deadlock the swarm", () => {
    const clock = { value: 0 };
    // Zero concurrency admits nothing forever; a negative budget starts already
    // exhausted. Both fail closed onto the default instead of being honored.
    const scheduler = schedulerAt(clock, { maxConcurrentAgents: 0, maxTotalAgents: -5 });
    expect(scheduler.policy.maxConcurrentAgents).toBe(DEFAULT_SCHEDULER_POLICY.maxConcurrentAgents);
    expect(scheduler.policy.maxTotalAgents).toBe(DEFAULT_SCHEDULER_POLICY.maxTotalAgents);
  });

  it("honors an explicit unbounded opt-out", () => {
    const clock = { value: 0 };
    const scheduler = schedulerAt(clock, { maxConcurrentAgents: Number.POSITIVE_INFINITY });
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]) {
      scheduler.admit(actorId(id), manifest(id));
    }
    expect(scheduler.selectDispatchable(worldWith({ initiator: "active" }))).toHaveLength(10);
  });
});
