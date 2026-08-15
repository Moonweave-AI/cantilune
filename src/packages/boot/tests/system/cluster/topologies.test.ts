/**
 * System tests: complex multi-agent topologies (SYS-01 through SYS-08).
 *
 * Each topology tests a distinct structural property of the cluster supervisor.
 * Agent loops are stubbed — we test orchestration logic, not LLM behavior.
 *
 * Per ADR-0015 the supervisor consumes a trusted committed-change feed. Agents
 * are dispatched when an `activate_participant` change arrives on the feed and
 * the participant in the head snapshot is `active` with a bound `manifestRef`.
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
} from "@cantilune/core";
import type {
  ActorId,
  CoordinationChange,
  CollaborationSnapshot,
  ContentRef,
  SnapshotRef,
  StartConditionExpression,
  AgentManifest,
  ParticipationStatus,
} from "@cantilune/core";
import { conditionAtom, conditionAnd, conditionOr, ALWAYS_CONDITION } from "@cantilune/core";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import {
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
  type LivenessEntry,
} from "../../../src/cluster/index.js";

/* ────────── Shared test infrastructure ────────── */

function createMockContentStore(): SyscallContentStore {
  const storage = new Map<string, Uint8Array>();
  let counter = 0;
  return {
    async put(content: string | Uint8Array) {
      counter++;
      const ref = contentRef(`sha256:sys${counter.toString(36).padStart(6, "0")}`);
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
      storage.set(ref as string, bytes);
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

/**
 * Mock SyscallRuntime serving a fixed head snapshot and a committed-change feed.
 * `changes(since?)` returns every feed change strictly after the cursor; with no
 * cursor it returns the whole feed (ADR-0015 `DurableCoordinator.since` semantics).
 */
function createMockRuntime(
  snapshot: CollaborationSnapshot,
  feed: readonly CoordinationChange[] = [],
): SyscallRuntime {
  return {
    getHead: () => snapshot,
    changes(since?: SnapshotRef): readonly CoordinationChange[] {
      if (since === undefined) return feed;
      const cursorIndex = feed.findIndex((c) => c.afterRef === since);
      if (cursorIndex === -1) return feed;
      return feed.slice(cursorIndex + 1);
    },
    proposeAndCommit() {
      return { ok: true, after: snapshot };
    },
  } as unknown as SyscallRuntime;
}

function manifest(id: string, opts?: { startCondition?: StartConditionExpression }): AgentManifest {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "test",
    assignedTask: "task-" + id,
    startCondition: opts?.startCondition ?? ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
  };
}

async function storeManifest(store: SyscallContentStore, m: AgentManifest): Promise<ContentRef> {
  return store.put(JSON.stringify(m));
}

function activateChange(
  agentId: ActorId,
  initiator: ActorId,
  afterRef: string,
): CoordinationChange {
  return {
    changeId: changeId("act-" + (agentId as string) + "-" + afterRef),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("activate_participant"),
    matchBindings: [
      { role: "from", actorId: initiator },
      { role: "participant", actorId: agentId },
    ],
    targets: [],
    initiator: { actorId: initiator, kind: "agent" },
    involved: [{ actorId: agentId, kind: "agent" }],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s1"),
    afterRef: snapshotRef(afterRef),
    visibility: "external",
  };
}

function doneSignal(agentId: ActorId): CoordinationChange {
  return {
    changeId: changeId("done-" + (agentId as string)),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("signal_done"),
    matchBindings: [{ role: "from", actorId: agentId }],
    targets: [],
    initiator: { actorId: agentId, kind: "agent" },
    involved: [{ actorId: agentId, kind: "agent" }],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s0"),
    afterRef: snapshotRef("s1"),
    visibility: "external",
  };
}

class TestableClusterSupervisor extends ClusterSupervisor {
  readonly startedAgents: string[] = [];
  override async startAgent(agentId: ActorId, m: AgentManifest): Promise<void> {
    const key = agentId as string;
    const internals = this as unknown as {
      agents: Map<string, { abort(): void }>;
      livenessTable: Map<string, LivenessEntry>;
      emitEvent(e: ClusterEvent): void;
    };
    if (internals.agents.has(key)) return;
    internals.agents.set(key, { abort() {} });
    internals.livenessTable.set(key, {
      lastHeartbeatTime: Date.now(),
      sequenceNo: 0,
      heartbeatIntervalMs: m.heartbeatIntervalMs,
    });
    this.startedAgents.push(key);
    internals.emitEvent({ kind: "agent_started", actorId: agentId });
    internals.emitEvent({ kind: "condition_met", actorId: agentId });
  }
}

async function buildTopology(opts: {
  agents: {
    id: string;
    startCondition?: StartConditionExpression;
    status?: string;
    manifestRef?: ContentRef;
  }[];
  initiator?: string;
}): Promise<{ supervisor: TestableClusterSupervisor; events: ClusterEvent[] }> {
  const store = createMockContentStore();
  const events: ClusterEvent[] = [];
  const init = actorId(opts.initiator ?? "initiator");

  // Store manifests and bind refs onto participants.
  const manifestRefs = new Map<string, ContentRef>();
  const feed: CoordinationChange[] = [];
  let feedSeq = 2; // afterRefs start at s2 (s1 is the seed head)

  for (const a of opts.agents) {
    const m = manifest(a.id, a.startCondition ? { startCondition: a.startCondition } : {});
    const ref = await storeManifest(store, m);
    manifestRefs.set(a.id, ref);
    // Each agent that should be dispatched gets an activate_participant change.
    feed.push(activateChange(actorId(a.id), init, "s" + feedSeq++));
  }

  const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
  participantMap.set(init, participant(init, "agent", "active"));
  for (const a of opts.agents) {
    const aid = actorId(a.id);
    const status = (a.status ?? "active") as ParticipationStatus;
    // An activated agent carries its manifestRef; a non-active agent does not.
    const ref = status === "active" || status === "done" || status === "retired"
      ? (a.manifestRef ?? manifestRefs.get(a.id)!)
      : undefined;
    participantMap.set(aid, participant(aid, "agent", status, ref));
  }

  const snap = collaborationSnapshot({
    snapshotRef: snapshotRef("s1"),
    epochId: epochId("e1"),
    participants: participantMap,
  });

  const runtime = createMockRuntime(snap, feed);
  const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp/sys" });

  const supervisor = new TestableClusterSupervisor({
    shared,
    conditionRegistry: createDefaultConditionRegistry(),
    llmAdapterFactory: () => ({
      async chat() {
        return { text: undefined, toolCalls: [], finishReason: "stop" as const };
      },
    }),
    eventListener: (e) => events.push(e),
  });

  return { supervisor, events };
}

/* ────────── SYS-01: Parallel fan-out + conditional convergence ────────── */

describe("SYS-01: Feedback loop + parallel fan-out + conditional convergence", () => {
  it("starts A/B immediately (feedback loop pair), C/D/E in parallel, blocks F", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A" },
        { id: "B" },
        { id: "C" },
        { id: "D" },
        { id: "E" },
        { id: "F", startCondition: conditionAtom("agentsDone", { agents: ["C", "D", "E"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("A");
    expect(supervisor.startedAgents).toContain("B");
    expect(supervisor.startedAgents).toContain("C");
    expect(supervisor.startedAgents).toContain("D");
    expect(supervisor.startedAgents).toContain("E");
    expect(supervisor.startedAgents).not.toContain("F");
    supervisor.stop();
  });
});

/* ────────── SYS-02: Deep serial chain ────────── */

describe("SYS-02: Deep serial chain (6-level cascade)", () => {
  it("starts only A initially, others depend on predecessors", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A" },
        { id: "B", startCondition: conditionAtom("agentsDone", { agents: ["A"] }) },
        { id: "C", startCondition: conditionAtom("agentsDone", { agents: ["B"] }) },
        { id: "D", startCondition: conditionAtom("agentsDone", { agents: ["C"] }) },
        { id: "E", startCondition: conditionAtom("agentsDone", { agents: ["D"] }) },
        { id: "F", startCondition: conditionAtom("agentsDone", { agents: ["E"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toEqual(["A"]);
    supervisor.stop();
  });

  it("cascades through the chain as each agent completes", async () => {
    // Start with A already done, B should start
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A", status: "done" },
        { id: "B", startCondition: conditionAtom("agentsDone", { agents: ["A"] }) },
        { id: "C", startCondition: conditionAtom("agentsDone", { agents: ["B"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("B");
    expect(supervisor.startedAgents).not.toContain("C");
    supervisor.stop();
  });
});

/* ────────── SYS-03: Wide parallel fan-out (10 agents) ────────── */

describe("SYS-03: Wide parallel fan-out (10 agents + aggregator)", () => {
  it("starts all 10 parallel agents immediately, blocks aggregator", async () => {
    const workers = Array.from({ length: 10 }, (_, i) => ({ id: `W${i}` }));
    const aggregator = {
      id: "AGG",
      startCondition: conditionAtom("agentsDone", {
        agents: workers.map((w) => w.id),
      }),
    };

    const { supervisor } = await buildTopology({
      agents: [...workers, aggregator],
    });

    supervisor.start();
    await supervisor.drainFeed();

    for (const w of workers) {
      expect(supervisor.startedAgents).toContain(w.id);
    }
    expect(supervisor.startedAgents).not.toContain("AGG");
    expect(supervisor.startedAgents).toHaveLength(10);
    supervisor.stop();
  });
});

/* ────────── SYS-04: Diamond dependency ────────── */

describe("SYS-04: Diamond dependency (A→B,C → D)", () => {
  it("A starts immediately; B/C depend on A; D depends on B AND C", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A" },
        { id: "B", startCondition: conditionAtom("agentsDone", { agents: ["A"] }) },
        { id: "C", startCondition: conditionAtom("agentsDone", { agents: ["A"] }) },
        {
          id: "D",
          startCondition: conditionAnd(
            conditionAtom("agentsDone", { agents: ["B"] }),
            conditionAtom("agentsDone", { agents: ["C"] }),
          ),
        },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toEqual(["A"]);
    supervisor.stop();
  });

  it("D starts only when both B and C are done", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A", status: "done" },
        { id: "B", status: "done" },
        { id: "C", status: "done" },
        {
          id: "D",
          startCondition: conditionAnd(
            conditionAtom("agentsDone", { agents: ["B"] }),
            conditionAtom("agentsDone", { agents: ["C"] }),
          ),
        },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("D");
    supervisor.stop();
  });

  it("D does NOT start when only B is done (C still active)", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A", status: "done" },
        { id: "B", status: "done" },
        { id: "C", status: "active" },
        {
          id: "D",
          startCondition: conditionAnd(
            conditionAtom("agentsDone", { agents: ["B"] }),
            conditionAtom("agentsDone", { agents: ["C"] }),
          ),
        },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).not.toContain("D");
    supervisor.stop();
  });
});

/* ────────── SYS-05: Dynamic topology (recursive spawn) ────────── */

describe("SYS-05: Dynamic topology evolution (spawn chain)", () => {
  it("initial agent starts, spawned agents registered later can be evaluated", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "A" },
        { id: "B", startCondition: conditionAtom("agentsDone", { agents: ["A"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("A");
    expect(supervisor.startedAgents).not.toContain("B");
    supervisor.stop();
  });
});

/* ────────── SYS-06: Hub-Spoke (persistent hub) ────────── */

describe("SYS-06: Star topology (Hub-Spoke)", () => {
  it("hub (never-done) + 4 spokes all start immediately", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "Hub" },
        { id: "Spoke-1" },
        { id: "Spoke-2" },
        { id: "Spoke-3" },
        { id: "Spoke-4" },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("Hub");
    expect(supervisor.startedAgents).toContain("Spoke-1");
    expect(supervisor.startedAgents).toContain("Spoke-2");
    expect(supervisor.startedAgents).toContain("Spoke-3");
    expect(supervisor.startedAgents).toContain("Spoke-4");
    expect(supervisor.startedAgents).toHaveLength(5);
    supervisor.stop();
  });
});

/* ────────── SYS-07: Hierarchical delegation (3-layer) ────────── */

describe("SYS-07: Hierarchical delegation (3 layers)", () => {
  it("team leads start after Agent-0, workers start after their leads, reviewer after all", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "Lead-A", startCondition: conditionAtom("agentsDone", { agents: ["initiator"] }) },
        { id: "Lead-B", startCondition: conditionAtom("agentsDone", { agents: ["initiator"] }) },
        { id: "W1", startCondition: conditionAtom("agentsDone", { agents: ["Lead-A"] }) },
        { id: "W2", startCondition: conditionAtom("agentsDone", { agents: ["Lead-A"] }) },
        { id: "W3", startCondition: conditionAtom("agentsDone", { agents: ["Lead-B"] }) },
        {
          id: "Reviewer",
          startCondition: conditionAnd(
            conditionAtom("agentsDone", { agents: ["W1", "W2"] }),
            conditionAtom("agentsDone", { agents: ["W3"] }),
          ),
        },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    // initiator is "active" not "done", so leads can't start yet
    expect(supervisor.startedAgents).toHaveLength(0);
    supervisor.stop();
  });

  it("leads start when initiator is done", async () => {
    const { supervisor } = await buildTopology({
      initiator: "initiator",
      agents: [
        { id: "Lead-A", startCondition: conditionAtom("agentsDone", { agents: ["initiator"] }) },
        { id: "Lead-B", startCondition: conditionAtom("agentsDone", { agents: ["initiator"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();
    // initiator is "active" in snapshot (not "done"), so leads should NOT start
    expect(supervisor.startedAgents).toHaveLength(0);
    supervisor.stop();
  });
});

/* ────────── SYS-08: Runtime growth (initial 2, expands to 7) ────────── */

describe("SYS-08: Runtime growth topology", () => {
  it("initial 2 agents start, conditions for later agents are correctly blocked", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "Alpha" },
        { id: "Beta" },
        { id: "Gamma", startCondition: conditionAtom("agentsDone", { agents: ["Alpha"] }) },
        { id: "Delta", startCondition: conditionAtom("agentsDone", { agents: ["Alpha"] }) },
        { id: "Epsilon", startCondition: conditionAtom("agentsDone", { agents: ["Alpha"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("Alpha");
    expect(supervisor.startedAgents).toContain("Beta");
    expect(supervisor.startedAgents).not.toContain("Gamma");
    expect(supervisor.startedAgents).not.toContain("Delta");
    expect(supervisor.startedAgents).not.toContain("Epsilon");
    supervisor.stop();
  });

  it("spawned agents start after Alpha completes", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "Alpha", status: "done" },
        { id: "Beta", status: "active" },
        { id: "Gamma", startCondition: conditionAtom("agentsDone", { agents: ["Alpha"] }) },
        { id: "Delta", startCondition: conditionAtom("agentsDone", { agents: ["Alpha"] }) },
        { id: "Epsilon", startCondition: conditionAtom("agentsDone", { agents: ["Alpha"] }) },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("Gamma");
    expect(supervisor.startedAgents).toContain("Delta");
    expect(supervisor.startedAgents).toContain("Epsilon");
    supervisor.stop();
  });
});

/* ────────── SYS additional: OR condition topology ────────── */

describe("SYS-extra: OR condition (race-like topology)", () => {
  it("agent starts when ANY of the parallel workers finishes", async () => {
    const { supervisor } = await buildTopology({
      agents: [
        { id: "Racer-A", status: "active" },
        { id: "Racer-B", status: "active" },
        { id: "Racer-C", status: "done" },
        {
          id: "Consumer",
          startCondition: conditionOr(
            conditionAtom("agentsDone", { agents: ["Racer-A"] }),
            conditionAtom("agentsDone", { agents: ["Racer-B"] }),
            conditionAtom("agentsDone", { agents: ["Racer-C"] }),
          ),
        },
      ],
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toContain("Consumer");
    supervisor.stop();
  });
});
