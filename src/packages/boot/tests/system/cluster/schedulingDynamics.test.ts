/**
 * System tests for scheduling over time (the behaviour the topology suite does
 * not reach).
 *
 * Every case in `topologies.test.ts` seeds the world in its final shape and
 * drains once, so it verifies "given this world, who is eligible". The defect
 * those tests could not see was temporal: an agent activated while its start
 * condition was false was evaluated once and dropped forever, so fan-in,
 * conditional start, and feedback loops never fired and `waitForCompletion`
 * polled a world that could no longer change.
 *
 * These cases mutate the world between drains and assert the agent starts on a
 * later pass, that a full concurrency queue drains as slots free, and that an
 * unsatisfiable condition converges to a diagnosed stall instead of hanging.
 */
import { describe, it, expect } from "vitest";
import {
  actorId,
  operationTypeId,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  participant,
  changeId,
  contentRef,
  conditionAtom,
  ALWAYS_CONDITION,
  NEVER_CONDITION,
} from "@cantilune/core";
import type {
  ActorId,
  AgentManifest,
  CollaborationSnapshot,
  ContentRef,
  CoordinationChange,
  ParticipationStatus,
  SnapshotRef,
  StartConditionExpression,
} from "@cantilune/core";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import {
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
  type LivenessEntry,
} from "../../../src/cluster/index.js";

function createMockContentStore(): SyscallContentStore {
  const storage = new Map<string, Uint8Array>();
  let counter = 0;
  return {
    async put(content: string | Uint8Array) {
      counter += 1;
      const ref = contentRef(`sha256:dyn${counter.toString(36).padStart(6, "0")}`);
      storage.set(
        ref as string,
        typeof content === "string" ? new TextEncoder().encode(content) : content,
      );
      return ref;
    },
    async get(ref: ContentRef) {
      const bytes = storage.get(ref as string);
      if (bytes === undefined) return undefined;
      return {
        ref,
        bytes,
        metadata: {
          size: bytes.length,
          mimeType: "application/json",
          createdAt: "",
          createdBy: undefined,
        },
      };
    },
    async exists(ref: ContentRef) {
      return storage.has(ref as string);
    },
  };
}

/** A world the test can advance between drains. */
class MutableWorld {
  private snapshot: CollaborationSnapshot;
  private readonly feed: CoordinationChange[] = [];
  private readonly statuses = new Map<string, ParticipationStatus>();
  private readonly refs = new Map<string, ContentRef>();
  private seq = 1;

  constructor(initiator: string) {
    this.statuses.set(initiator, "active");
    this.snapshot = this.build();
  }

  private build(): CollaborationSnapshot {
    const participants = new Map<ActorId, ReturnType<typeof participant>>();
    for (const [id, status] of this.statuses) {
      const aid = actorId(id);
      participants.set(aid, participant(aid, "agent", status, this.refs.get(id)));
    }
    return collaborationSnapshot({
      snapshotRef: snapshotRef(`s${this.seq}`),
      epochId: epochId("e1"),
      participants,
    });
  }

  /** Register an agent as `active` with a bound manifest and append its activation. */
  activate(id: string, initiator: string, manifestRef: ContentRef): void {
    this.seq += 1;
    this.statuses.set(id, "active");
    this.refs.set(id, manifestRef);
    this.snapshot = this.build();
    this.feed.push({
      changeId: changeId(`act-${id}-${this.seq}`),
      recordedAt: new Date().toISOString() as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("activate_participant"),
      matchBindings: [
        { role: "from", actorId: actorId(initiator) },
        { role: "participant", actorId: actorId(id) },
      ],
      targets: [],
      initiator: { actorId: actorId(initiator), kind: "agent" },
      involved: [{ actorId: actorId(id), kind: "agent" }],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      beforeRef: snapshotRef(`s${this.seq - 1}`),
      afterRef: snapshotRef(`s${this.seq}`),
      visibility: "external",
    } as CoordinationChange);
  }

  /** Advance a participant's status without appending a change to the feed. */
  setStatus(id: string, status: ParticipationStatus): void {
    this.seq += 1;
    this.statuses.set(id, status);
    this.snapshot = this.build();
  }

  runtime(): SyscallRuntime {
    return {
      getHead: () => this.snapshot,
      changes: (since?: SnapshotRef): readonly CoordinationChange[] => {
        if (since === undefined) return [...this.feed];
        const index = this.feed.findIndex((c) => c.afterRef === since);
        return index === -1 ? [...this.feed] : this.feed.slice(index + 1);
      },
      proposeAndCommit: () => ({ ok: true, after: this.snapshot }),
    } as unknown as SyscallRuntime;
  }
}

/** Records dispatches without booting a real agent loop. */
class RecordingSupervisor extends ClusterSupervisor {
  readonly startedAgents: string[] = [];
  override async startAgent(agentId: ActorId, m: AgentManifest): Promise<void> {
    const key = agentId as string;
    const internals = this as unknown as {
      agents: Map<string, { abort(): void }>;
      livenessTable: Map<string, LivenessEntry>;
    };
    if (internals.agents.has(key)) return;
    internals.agents.set(key, { abort() {} });
    internals.livenessTable.set(key, {
      lastHeartbeatTime: Date.now(),
      sequenceNo: 0,
      heartbeatIntervalMs: m.heartbeatIntervalMs,
    });
    this.startedAgents.push(key);
  }

  /** Simulate an agent finishing, releasing its concurrency slot. */
  finish(agentId: ActorId, turns = 1): void {
    const internals = this as unknown as {
      agents: Map<string, unknown>;
      livenessTable: Map<string, unknown>;
      scheduler: { onCompleted(id: ActorId, turns: number): void };
    };
    internals.agents.delete(agentId as string);
    internals.livenessTable.delete(agentId as string);
    internals.scheduler.onCompleted(agentId, turns);
  }
}

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

interface Harness {
  readonly supervisor: RecordingSupervisor;
  readonly world: MutableWorld;
  readonly events: ClusterEvent[];
  activate(id: string, opts?: Parameters<typeof manifest>[1]): Promise<void>;
}

async function harness(policy?: {
  maxConcurrentAgents?: number;
  maxTotalAgents?: number;
  stallTicksBeforeDeadlock?: number;
}): Promise<Harness> {
  const store = createMockContentStore();
  const world = new MutableWorld("initiator");
  const events: ClusterEvent[] = [];
  const shared = createSharedResources({
    runtime: world.runtime(),
    contentStore: store,
    storagePath: "/tmp/dyn",
  });
  const supervisor = new RecordingSupervisor({
    shared,
    conditionRegistry: createDefaultConditionRegistry(),
    llmAdapterFactory: () => ({
      async chat() {
        return { text: undefined, toolCalls: [], finishReason: "stop" as const };
      },
    }),
    eventListener: (e) => events.push(e),
    // Keep the completion poll short so a terminal verdict is observed without
    // adding seconds of real waiting to the suite.
    completionPollMs: 5,
    ...(policy !== undefined ? { schedulerPolicy: policy } : {}),
  });

  return {
    supervisor,
    world,
    events,
    async activate(id, opts) {
      const ref = await store.put(JSON.stringify(manifest(id, opts)));
      world.activate(id, "initiator", ref);
    },
  };
}

describe("scheduling over time: a condition unmet at activation is re-evaluated", () => {
  it("starts a fan-in agent on a later drain, once its dependencies finish", async () => {
    const h = await harness();
    // Start first, then activate: the supervisor seeds its cursor from the head
    // it starts against, so activations must arrive on the feed afterwards —
    // which is also the real ordering, since agents register at runtime.
    h.supervisor.start();
    await h.activate("worker-a");
    await h.activate("worker-b");
    await h.activate("aggregator", {
      startCondition: conditionAtom("agentsDone", { agents: ["worker-a", "worker-b"] }),
    });
    await h.supervisor.drainFeed();

    // The aggregator's condition is false at activation. Before the scheduler
    // this dropped it permanently; now it stays queued.
    expect(h.supervisor.startedAgents).toEqual(["worker-a", "worker-b"]);
    expect(h.supervisor.getSchedulerSnapshot().pending.map((p) => p.agentId as string)).toEqual([
      "aggregator",
    ]);

    h.world.setStatus("worker-a", "done");
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).not.toContain("aggregator");

    h.world.setStatus("worker-b", "done");
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toContain("aggregator");
    expect(h.supervisor.getSchedulerSnapshot().pending).toHaveLength(0);
    h.supervisor.stop();
  });

  it("emits agent_queued at admission and condition_met at dispatch", async () => {
    const h = await harness();
    h.supervisor.start();
    await h.activate("late", {
      startCondition: conditionAtom("agentsDone", { agents: ["initiator"] }),
      priority: 3,
    });
    await h.supervisor.drainFeed();
    const queued = h.events.find((e) => e.kind === "agent_queued");
    expect(queued).toEqual({ kind: "agent_queued", actorId: actorId("late"), priority: 3 });
    expect(h.events.some((e) => e.kind === "condition_met")).toBe(false);

    h.world.setStatus("initiator", "done");
    await h.supervisor.drainFeed();
    expect(h.events.some((e) => e.kind === "condition_met")).toBe(true);
    h.supervisor.stop();
  });
});

describe("scheduling over time: the concurrency queue drains as slots free", () => {
  it("holds the surplus and starts it when a running agent finishes", async () => {
    const h = await harness({ maxConcurrentAgents: 2 });
    h.supervisor.start();
    for (const id of ["w1", "w2", "w3", "w4"]) await h.activate(id);
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toHaveLength(2);
    expect(h.supervisor.getSchedulerSnapshot().saturated).toBe(true);

    h.supervisor.finish(actorId(h.supervisor.startedAgents[0]!));
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toHaveLength(3);

    h.supervisor.finish(actorId(h.supervisor.startedAgents[1]!));
    h.supervisor.finish(actorId(h.supervisor.startedAgents[2]!));
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toHaveLength(4);
    h.supervisor.stop();
  });

  it("dispatches the highest-priority queued agent first when a slot frees", async () => {
    const h = await harness({ maxConcurrentAgents: 1 });
    h.supervisor.start();
    await h.activate("first", { priority: 0 });
    await h.activate("low", { priority: 1 });
    await h.activate("urgent", { priority: 9 });
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toEqual(["urgent"]);

    h.supervisor.finish(actorId("urgent"));
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toEqual(["urgent", "low"]);
    h.supervisor.stop();
  });
});

describe("scheduling over time: an unsatisfiable swarm converges instead of hanging", () => {
  it("reports a stalled termination with the blocked agent named", async () => {
    const h = await harness({ stallTicksBeforeDeadlock: 1 });
    h.supervisor.start();
    await h.activate("blocked", { startCondition: NEVER_CONDITION });
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toHaveLength(0);

    // Drive the liveness/stall tick directly rather than waiting on its timer.
    const internals = h.supervisor as unknown as { checkStall(): void };
    internals.checkStall();
    internals.checkStall();

    const result = await h.supervisor.waitForCompletion();
    expect(result.reason).toBe("stalled");
    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain("blocked(condition_unmet)");
    expect(h.events.some((e) => e.kind === "swarm_stalled")).toBe(true);
    h.supervisor.stop();
  });

  it("reports budget exhaustion rather than silently queueing forever", async () => {
    const h = await harness({ maxTotalAgents: 1, maxConcurrentAgents: 4 });
    h.supervisor.start();
    await h.activate("a");
    await h.activate("b");
    await h.supervisor.drainFeed();
    expect(h.supervisor.startedAgents).toHaveLength(1);

    h.supervisor.finish(actorId(h.supervisor.startedAgents[0]!));
    await h.supervisor.drainFeed();

    const result = await h.supervisor.waitForCompletion();
    expect(result.reason).toBe("budget_exhausted");
    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain("ceiling is 1");
    h.supervisor.stop();
  });

  it("a completed swarm still reports completed and ok", async () => {
    const h = await harness();
    h.supervisor.start();
    h.world.setStatus("initiator", "done");
    const result = await h.supervisor.waitForCompletion();
    expect(result.reason).toBe("completed");
    expect(result.ok).toBe(true);
    expect(result.diagnostic).toBe("");
    h.supervisor.stop();
  });
});
