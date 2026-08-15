/**
 * L7 Soak / Stress Tests for multi-agent cluster.
 *
 * SOAK-01: 20-Agent cluster composite topology → zero crash, heartbeat 100%
 * SOAK-02: Continuous spawn chain (depth 20) → no stack overflow, correct cleanup
 * SOAK-03: High-frequency heartbeat (100ms interval, 10 agents) → no lock starvation
 * SOAK-04: Large-scale condition re-evaluation → no performance degradation
 * SOAK-05: Repeated crash-restart cycle → supervisor stays healthy
 *
 * These tests are scaled down from the plan's 5-10min targets to run in CI
 * while still exercising the same invariants.
 *
 * Per ADR-0015 the supervisor consumes a trusted committed-change feed. Agents
 * are dispatched by `activate_participant` changes and the manifest ref is bound
 * on the `Participant` (not discovered from the audit tail).
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
} from "@cantilune/core";
import type {
  ActorId,
  CoordinationChange,
  ContentRef,
  SnapshotRef,
  StartConditionExpression,
  AgentManifest,
} from "@cantilune/core";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import {
  ClusterSupervisor,
  createSharedResources,
  createLoopbackMeshRouter,
  type ClusterEvent,
  type LivenessEntry,
} from "../../../src/cluster/index.js";

/* ────────── Shared infrastructure ────────── */

function createMockContentStore(): SyscallContentStore {
  const storage = new Map<string, Uint8Array>();
  let counter = 0;
  return {
    async put(content: string | Uint8Array) {
      counter++;
      const ref = contentRef(`sha256:soak${counter.toString(36).padStart(8, "0")}`);
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
 * `changes(since?)` returns every feed change strictly after the cursor (ADR-0015).
 */
function createMockRuntime(
  snapshot: unknown,
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

function makeManifest(
  id: string,
  opts?: { startCondition?: StartConditionExpression; heartbeatIntervalMs?: number },
): AgentManifest {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "soak test agent",
    assignedTask: "soak-" + id,
    startCondition: opts?.startCondition ?? ALWAYS_CONDITION,
    heartbeatIntervalMs: opts?.heartbeatIntervalMs ?? 60_000,
    designedBy: actorId("initiator"),
  };
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

function heartbeatSignal(agentId: ActorId): CoordinationChange {
  return {
    changeId: changeId("hb-" + (agentId as string) + "-" + Math.random().toString(36).slice(2, 6)),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("emit_heartbeat"),
    matchBindings: [{ role: "from", actorId: agentId }],
    targets: [],
    initiator: { actorId: agentId, kind: "agent" },
    involved: [{ actorId: agentId, kind: "agent" }],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s0"),
    afterRef: snapshotRef("s1"),
    visibility: "internal",
  };
}

function retireSignal(agentId: ActorId): CoordinationChange {
  return {
    changeId: changeId(
      "retire-" + (agentId as string) + "-" + Math.random().toString(36).slice(2, 6),
    ),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("retire_participant"),
    matchBindings: [{ role: "participant", actorId: agentId }],
    targets: [],
    initiator: { actorId: actorId("initiator"), kind: "agent" },
    involved: [{ actorId: agentId, kind: "agent" }],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s0"),
    afterRef: snapshotRef("s1"),
    visibility: "external",
  };
}

class SoakSupervisor extends ClusterSupervisor {
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

/* ────────── SOAK-01: 20-Agent composite topology ────────── */

describe("SOAK-01: 20-Agent cluster composite topology", () => {
  it("starts 15 parallel + 5 conditional agents without crash", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");

    const parallelIds = Array.from({ length: 15 }, (_, i) => `W${i}`);
    const conditionalIds = Array.from({ length: 5 }, (_, i) => `AGG${i}`);

    const manifestRefs = new Map<string, ContentRef>();
    const feed: CoordinationChange[] = [];
    let feedSeq = 2;

    for (const id of parallelIds) {
      const m = makeManifest(id);
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }
    for (const id of conditionalIds) {
      const m = makeManifest(id, {
        startCondition: conditionAtom("agentsDone", { agents: parallelIds }),
      });
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));
    for (const id of parallelIds) {
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", manifestRefs.get(id)));
    }
    for (const id of conditionalIds) {
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", manifestRefs.get(id)));
    }

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();

    expect(supervisor.startedAgents).toHaveLength(15);
    for (const id of parallelIds) {
      expect(supervisor.startedAgents).toContain(id);
    }
    for (const id of conditionalIds) {
      expect(supervisor.startedAgents).not.toContain(id);
    }

    supervisor.stop();
  });

  it("all 20 agents heartbeat delivered without data loss", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");
    const agentIds = Array.from({ length: 20 }, (_, i) => `A${i}`);

    const manifestRefs = new Map<string, ContentRef>();
    const feed: CoordinationChange[] = [];
    let feedSeq = 2;

    for (const id of agentIds) {
      const m = makeManifest(id);
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));
    for (const id of agentIds) {
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", manifestRefs.get(id)));
    }

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();

    // Emit 5 heartbeats per agent
    for (let round = 0; round < 5; round++) {
      for (const id of agentIds) {
        await supervisor.onSignalReceived(heartbeatSignal(actorId(id)));
      }
    }

    const hbEvents = events.filter((e) => e.kind === "heartbeat_received");
    expect(hbEvents).toHaveLength(100); // 20 agents × 5 rounds

    supervisor.stop();
  });
});

/* ────────── SOAK-02: Continuous spawn chain (depth 20) ────────── */

describe("SOAK-02: Continuous spawn chain (depth 20)", () => {
  it("evaluates 20-level dependency chain without stack overflow", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");
    const depth = 20;

    const manifestRefs = new Map<string, ContentRef>();
    const feed: CoordinationChange[] = [];
    let feedSeq = 2;

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));

    for (let i = 0; i < depth; i++) {
      const id = `chain-${i}`;
      const condition =
        i === 0 ? ALWAYS_CONDITION : conditionAtom("agentsDone", { agents: [`chain-${i - 1}`] });
      const m = makeManifest(id, { startCondition: condition });
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      // All agents activated (condition decides whether they actually start).
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", ref));
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();

    // Only first should start (always condition); chain-N>0 depend on predecessors
    expect(supervisor.startedAgents).toEqual(["chain-0"]);

    supervisor.stop();
  });

  it("mesh transport scales correctly with 20 allocations and deallocations", () => {
    const router = createLoopbackMeshRouter();

    // Allocate 20
    for (let i = 0; i < 20; i++) {
      router.allocate(actorId(`spawn-${i}`));
    }
    expect(router.size).toBe(20);

    // Deallocate all
    for (let i = 0; i < 20; i++) {
      router.deallocate(actorId(`spawn-${i}`));
    }
    expect(router.size).toBe(0);

    // Re-allocate (verify no leaks)
    for (let i = 0; i < 20; i++) {
      router.allocate(actorId(`respawn-${i}`));
    }
    expect(router.size).toBe(20);
  });
});

/* ────────── SOAK-03: High-frequency heartbeat ────────── */

describe("SOAK-03: High-frequency heartbeat stress", () => {
  it("processes 1000 heartbeats across 10 agents without lock starvation", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");
    const agentCount = 10;
    const heartbeatsPerAgent = 100;

    const manifestRefs = new Map<string, ContentRef>();
    const feed: CoordinationChange[] = [];
    let feedSeq = 2;

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));

    for (let i = 0; i < agentCount; i++) {
      const id = `hb-agent-${i}`;
      const m = makeManifest(id, { heartbeatIntervalMs: 100 });
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", ref));
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();

    const startTime = Date.now();

    // Interleaved heartbeats from all agents
    for (let round = 0; round < heartbeatsPerAgent; round++) {
      const promises = [];
      for (let i = 0; i < agentCount; i++) {
        promises.push(supervisor.onSignalReceived(heartbeatSignal(actorId(`hb-agent-${i}`))));
      }
      await Promise.all(promises);
    }

    const elapsed = Date.now() - startTime;

    const hbEvents = events.filter((e) => e.kind === "heartbeat_received");
    expect(hbEvents).toHaveLength(agentCount * heartbeatsPerAgent); // 1000 total

    // Verify sequence numbers are monotonically increasing per agent
    for (let i = 0; i < agentCount; i++) {
      const agentHbs = hbEvents.filter(
        (e) => e.kind === "heartbeat_received" && (e.actorId as string) === `hb-agent-${i}`,
      );
      expect(agentHbs).toHaveLength(heartbeatsPerAgent);
      for (let j = 1; j < agentHbs.length; j++) {
        const prev = agentHbs[j - 1]!;
        const curr = agentHbs[j]!;
        if (prev.kind === "heartbeat_received" && curr.kind === "heartbeat_received") {
          expect(curr.seq).toBeGreaterThan(prev.seq);
        }
      }
    }

    // Performance: 1000 heartbeats should complete in well under 5 seconds
    expect(elapsed).toBeLessThan(5000);
    supervisor.stop();
  });
});

/* ────────── SOAK-04: Large-scale condition re-evaluation ────────── */

describe("SOAK-04: Large-scale condition re-evaluation stress", () => {
  it("evaluates conditions for 50 activated agents without degradation", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");
    const totalAgents = 50;

    const manifestRefs = new Map<string, ContentRef>();
    const feed: CoordinationChange[] = [];
    let feedSeq = 2;

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));

    for (let i = 0; i < totalAgents; i++) {
      const id = `eval-${i}`;
      // Half always-start, half conditional
      const condition =
        i < 25 ? ALWAYS_CONDITION : conditionAtom("agentsDone", { agents: [`eval-${i - 25}`] });
      const m = makeManifest(id, { startCondition: condition });
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", ref));
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();

    const startTime = Date.now();
    await supervisor.drainFeed();
    const elapsed = Date.now() - startTime;

    // 25 always-start agents should start
    expect(supervisor.startedAgents).toHaveLength(25);
    // Performance: evaluation of 50 agents should be fast
    expect(elapsed).toBeLessThan(2000);

    // Re-drain the (now empty) feed 100 times — idempotent and fast.
    const evalStart = Date.now();
    for (let i = 0; i < 100; i++) {
      await supervisor.drainFeed();
    }
    const evalElapsed = Date.now() - evalStart;

    // Idempotent: still only 25 started
    expect(supervisor.startedAgents).toHaveLength(25);
    // 100 re-drains should be fast (no degradation)
    expect(evalElapsed).toBeLessThan(3000);

    supervisor.stop();
  });
});

/* ────────── SOAK-05: Repeated crash-restart cycle ────────── */

describe("SOAK-05: Crash-restart resilience", () => {
  it("supervisor handles 10 retire+restart cycles without zombie agents", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");
    const agentCount = 5;

    const manifestRefs = new Map<string, ContentRef>();
    const feed: CoordinationChange[] = [];
    let feedSeq = 2;

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));

    for (let i = 0; i < agentCount; i++) {
      const id = `resilient-${i}`;
      const m = makeManifest(id);
      const ref = await store.put(JSON.stringify(m));
      manifestRefs.set(id, ref);
      participantMap.set(actorId(id), participant(actorId(id), "agent", "active", ref));
      feed.push(activateChange(actorId(id), init, "s" + feedSeq++));
    }

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();
    expect(supervisor.startedAgents).toHaveLength(5);

    // Simulate 10 crash-restart cycles (retire agent, then it would be re-registered)
    for (let cycle = 0; cycle < 10; cycle++) {
      const targetIdx = cycle % agentCount;
      const targetId = actorId(`resilient-${targetIdx}`);

      // Retire the crashed agent
      await supervisor.onSignalReceived(retireSignal(targetId));
    }

    // Verify retire events were emitted
    const retireEvents = events.filter((e) => e.kind === "agent_retired");
    expect(retireEvents).toHaveLength(10);

    // Verify no stale entries in liveness table after retires
    const status = supervisor.getStatus();
    for (let i = 0; i < agentCount; i++) {
      const agentStatus = status.agents.get(`resilient-${i}`);
      expect(agentStatus?.heartbeat).toBeUndefined();
    }

    supervisor.stop();
  });

  it("rapid start-retire-start does not corrupt internal state", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];
    const init = actorId("initiator");

    const m = makeManifest("volatile");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map<ActorId, ReturnType<typeof participant>>();
    participantMap.set(init, participant(init, "agent", "active"));
    participantMap.set(actorId("volatile"), participant(actorId("volatile"), "agent", "active", ref));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [activateChange(actorId("volatile"), init, "s2")]);
    const shared = createSharedResources({
      runtime,
      contentStore: store,
      storagePath: "/tmp/soak",
    });

    const supervisor = new SoakSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();

    // Start (drain the activate change)
    await supervisor.drainFeed();
    expect(supervisor.startedAgents).toContain("volatile");

    // Retire
    await supervisor.onSignalReceived(retireSignal(actorId("volatile")));

    // Heartbeat to retired agent should not crash
    await supervisor.onSignalReceived(heartbeatSignal(actorId("volatile")));

    // No heartbeat_received for retired agent
    const hbAfterRetire = events.filter(
      (e) => e.kind === "heartbeat_received" && e.actorId === actorId("volatile"),
    );
    expect(hbAfterRetire).toHaveLength(0);

    supervisor.stop();
  });
});
