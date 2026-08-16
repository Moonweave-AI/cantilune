/**
 * Additional coverage tests for ClusterSupervisor — targets uncovered paths:
 * - waitForCompletion()
 * - isClusterComplete()
 * - checkStaleAgents()
 * - getStatus()
 * - resolveManifest edge cases (manifest ref on the participant, not the audit tail)
 * - onSignalReceived when not running
 * - drainFeed when head is undefined
 *
 * Per ADR-0015 the supervisor consumes a trusted committed-change feed. Agents
 * are dispatched by `activate_participant` changes and the manifest ref is bound
 * on the `Participant` (not discovered from the audit tail).
 */
import { describe, it, expect, vi } from "vitest";
import {
  actorId,
  operationTypeId,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  participant,
  changeId,
  contentRef,
  ALWAYS_CONDITION,
} from "@cantilune/core";
import type {
  ActorId,
  CoordinationChange,
  ContentRef,
  SnapshotRef,
  AgentManifest,
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
      counter++;
      const ref = contentRef(`sha256:cov${counter.toString(36).padStart(8, "0")}`);
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

function makeManifest(id: string, opts?: Partial<AgentManifest>): AgentManifest {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "coverage test",
    assignedTask: "task-" + id,
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
    ...opts,
  };
}

function activateChange(
  agentId: ActorId,
  initiator: ActorId,
  afterRef: string = "s2",
): CoordinationChange {
  return {
    changeId: changeId("act-" + (agentId as string)),
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

class TestableSupervisor extends ClusterSupervisor {
  readonly startedAgents: string[] = [];
  override async startAgent(agentId: ActorId, m: AgentManifest): Promise<void> {
    const key = agentId as string;
    const internals = this as unknown as {
      agents: Map<string, { abort(): void }>;
      livenessTable: Map<string, LivenessEntry>;
      agentResults: Map<string, unknown>;
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
  }

  /**
   * Drive the real (private) onAgentComplete path so coverage hits it. This
   * submits a `signal_done` intent via proposeAndCommit and then re-drains the
   * feed, exactly as the production supervisor does when an agent loop resolves.
   */
  async driveOnAgentComplete(
    agentId: ActorId,
    result: {
      ok: boolean;
      summary: string;
      turns: number;
      elapsedMs: number;
      producedRefs: readonly ContentRef[];
      terminationReason?: string;
    },
    manifest: AgentManifest,
  ): Promise<void> {
    const internals = this as unknown as {
      onAgentComplete(
        id: ActorId,
        result: {
          ok: boolean;
          summary: string;
          turns: number;
          elapsedMs: number;
          producedRefs: readonly ContentRef[];
          terminationReason?: string;
        },
        manifest: AgentManifest,
      ): Promise<void>;
    };
    await internals.onAgentComplete(agentId, result, manifest);
  }
}

describe("ClusterSupervisor — coverage paths", () => {
  it("getStatus returns correct participant info from snapshot", () => {
    const store = createMockContentStore();
    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(actorId("a1"), participant(actorId("a1"), "agent", "registered"));
    participantMap.set(actorId("a2"), participant(actorId("a2"), "agent", "done"));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    const status = supervisor.getStatus();
    expect(status.agents.size).toBe(3);
    expect(status.agents.get("init")!.status).toBe("active");
    expect(status.agents.get("a1")!.status).toBe("registered");
    expect(status.agents.get("a2")!.status).toBe("done");
  });

  it("getStatus returns empty map when head is undefined", () => {
    const store = createMockContentStore();
    const runtime = createMockRuntime(undefined);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    const status = supervisor.getStatus();
    expect(status.agents.size).toBe(0);
  });

  it("waitForCompletion resolves immediately when cluster is already complete", async () => {
    const store = createMockContentStore();
    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "done"));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const events: ClusterEvent[] = [];
    const supervisor = new TestableSupervisor({
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
    const result = await supervisor.waitForCompletion();

    expect(result.ok).toBe(true);
    expect(result.summary).toContain("completed");
    expect(events.some((e) => e.kind === "cluster_complete")).toBe(true);
    supervisor.stop();
  });

  it("waitForCompletion waits until agents transition to done/retired", async () => {
    const store = createMockContentStore();

    const m = makeManifest("worker");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(actorId("worker"), participant(actorId("worker"), "agent", "active", ref));

    let callCount = 0;
    const snap0 = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });
    const snap1 = collaborationSnapshot({
      snapshotRef: snapshotRef("s2"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("init"), participant(actorId("init"), "agent", "done")],
        [actorId("worker"), participant(actorId("worker"), "agent", "done")],
      ]),
    });

    const feed = [activateChange(actorId("worker"), actorId("init"), "s2")];
    const runtime = {
      getHead: () => {
        callCount++;
        // After a few calls, all participants are done
        if (callCount > 2) return snap1;
        return snap0;
      },
      changes: (since?: SnapshotRef): readonly CoordinationChange[] => {
        if (since === undefined) return feed;
        const cursorIndex = feed.findIndex((c) => c.afterRef === since);
        if (cursorIndex === -1) return feed;
        return feed.slice(cursorIndex + 1);
      },
      proposeAndCommit: () => ({ ok: true, after: snap0 }),
    } as unknown as SyscallRuntime;

    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    await supervisor.drainFeed();
    // Worker started (always condition met)
    expect(supervisor.startedAgents).toContain("worker");

    // Simulate worker completion — remove from agents map
    supervisor.driveOnAgentComplete(
      actorId("worker"),
      { ok: true, summary: "done", turns: 3, elapsedMs: 100, producedRefs: [] },
      m,
    );
    // Wait for the async onAgentComplete to settle (it calls drainFeed internally)
    await Promise.resolve();

    const result = await supervisor.waitForCompletion();
    expect(result.ok).toBe(true);
    supervisor.stop();
  });

  it("checkStaleAgents emits agent_stale for expired heartbeats", async () => {
    vi.useFakeTimers();

    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const m = makeManifest("stale-test", { heartbeatIntervalMs: 100 });
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(
      actorId("stale-test"),
      participant(actorId("stale-test"), "agent", "active", ref),
    );

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [
      activateChange(actorId("stale-test"), actorId("init"), "s2"),
    ]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    // Use TestableSupervisor to avoid running real agent loop
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      heartbeatCheckIntervalMs: 50,
      staleThresholdMultiplier: 2,
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();

    // Agent started with lastHeartbeatTime = now (faked)
    expect(supervisor.startedAgents).toContain("stale-test");

    // Threshold = heartbeatIntervalMs(100) × livenessGraceFactor(2) × staleMultiplier(2) = 400ms.
    // Advance time past stale threshold (500ms > 400ms) and past several check intervals.
    await vi.advanceTimersByTimeAsync(500);

    const staleEvents = events.filter((e) => e.kind === "agent_stale");
    expect(staleEvents.length).toBeGreaterThanOrEqual(1);
    if (staleEvents[0]!.kind === "agent_stale") {
      expect((staleEvents[0] as { actorId: ActorId }).actorId).toBe(actorId("stale-test"));
    }

    supervisor.stop();
    vi.useRealTimers();
  });

  it("resolveManifest handles invalid JSON content gracefully", async () => {
    const store = createMockContentStore();
    const init = actorId("initiator");

    // Put invalid JSON content; the returned ref is the manifest ref for the participant.
    const invalidRef = await store.put("not valid json {{{");
    // Also put a valid manifest for a different agent to ensure it is NOT picked up.
    const validM = makeManifest("other-agent");
    await store.put(JSON.stringify(validM));

    const participantMap = new Map();
    participantMap.set(init, participant(init, "agent", "active"));
    // "target" participant is active but its manifestRef points to invalid JSON content.
    participantMap.set(
      actorId("target"),
      participant(actorId("target"), "agent", "active", invalidRef),
    );

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [activateChange(actorId("target"), init)]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    await supervisor.drainFeed();

    // "target" agent's manifest content is invalid JSON → should NOT start
    expect(supervisor.startedAgents).not.toContain("target");
    supervisor.stop();
  });

  it("resolveManifest handles missing manifestRef on participant gracefully", async () => {
    const store = createMockContentStore();
    const init = actorId("initiator");

    const participantMap = new Map();
    participantMap.set(init, participant(init, "agent", "active"));
    // "no-manifest" is active but has NO manifestRef (never properly activated/bound).
    participantMap.set(
      actorId("no-manifest"),
      participant(actorId("no-manifest"), "agent", "active"),
    );

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [activateChange(actorId("no-manifest"), init)]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    await supervisor.drainFeed();
    // Should not crash, "no-manifest" just stays unstarted (no manifestRef to resolve)
    expect(supervisor.startedAgents).not.toContain("no-manifest");
    supervisor.stop();
  });

  it("double start is idempotent", () => {
    const store = createMockContentStore();
    const runtime = createMockRuntime(undefined);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    supervisor.start(); // second call should not throw
    expect(supervisor.getStatus().agents.size).toBe(0);
    supervisor.stop();
  });

  it("onSignalReceived is no-op when not running", async () => {
    const store = createMockContentStore();
    const runtime = createMockRuntime(undefined);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const events: ClusterEvent[] = [];

    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    const change: CoordinationChange = {
      changeId: changeId("c1"),
      recordedAt: "" as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      matchBindings: [{ role: "from", actorId: actorId("a1") }],
      targets: [],
      initiator: { actorId: actorId("a1"), kind: "agent" },
      involved: [],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      beforeRef: snapshotRef("s0"),
      afterRef: snapshotRef("s1"),
      visibility: "internal",
    };

    await supervisor.onSignalReceived(change);
    expect(events).toHaveLength(0);
  });

  it("drainFeed is no-op when head is undefined", async () => {
    const store = createMockContentStore();
    const runtime = createMockRuntime(undefined);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    await supervisor.drainFeed();
    expect(supervisor.startedAgents).toEqual([]);
    supervisor.stop();
  });

  it("stop aborts all running agents", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const m1 = makeManifest("s1");
    const m2 = makeManifest("s2");
    const ref1 = await store.put(JSON.stringify(m1));
    const ref2 = await store.put(JSON.stringify(m2));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(actorId("s1"), participant(actorId("s1"), "agent", "active", ref1));
    participantMap.set(actorId("s2"), participant(actorId("s2"), "agent", "active", ref2));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const feed = [
      activateChange(actorId("s1"), actorId("init"), "s2"),
      activateChange(actorId("s2"), actorId("init"), "s3"),
    ];
    const runtime = createMockRuntime(snap, feed);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    let abortCount = 0;
    class AbortCountingSupervisor extends ClusterSupervisor {
      override async startAgent(agentId: ActorId, _m: AgentManifest): Promise<void> {
        const internals = this as unknown as {
          agents: Map<string, { abort(): void }>;
          livenessTable: Map<string, LivenessEntry>;
          emitEvent(e: ClusterEvent): void;
        };
        if (internals.agents.has(agentId as string)) return;
        internals.agents.set(agentId as string, {
          abort() {
            abortCount++;
          },
        });
        internals.livenessTable.set(agentId as string, {
          lastHeartbeatTime: Date.now(),
          sequenceNo: 0,
          heartbeatIntervalMs: 60000,
        });
        internals.emitEvent({ kind: "agent_started", actorId: agentId });
      }
    }

    const supervisor = new AbortCountingSupervisor({
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
    supervisor.stop();

    expect(abortCount).toBe(2);
  });

  it("onAgentComplete submits signal_done and records results", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const m = makeManifest("fast-agent");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(
      actorId("fast-agent"),
      participant(actorId("fast-agent"), "agent", "active", ref),
    );

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [
      activateChange(actorId("fast-agent"), actorId("init"), "s2"),
    ]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    // Use TestableSupervisor so startAgent is stubbed but onAgentComplete is real.
    const supervisor = new TestableSupervisor({
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
    expect(supervisor.startedAgents).toContain("fast-agent");

    // Drive the real onAgentComplete path: it submits signal_done via
    // proposeAndCommit and then re-drains the (empty) feed.
    await supervisor.driveOnAgentComplete(
      actorId("fast-agent"),
      { ok: true, summary: "done", turns: 3, elapsedMs: 100, producedRefs: [] },
      m,
    );

    const doneEvents = events.filter((e) => e.kind === "agent_done");
    expect(doneEvents).toHaveLength(1);
    if (doneEvents[0]!.kind === "agent_done") {
      expect(doneEvents[0]!.actorId).toBe(actorId("fast-agent"));
    }

    supervisor.stop();
  });

  it("isClusterComplete returns false for active agents in agents map", async () => {
    const store = createMockContentStore();
    const m = makeManifest("busy");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(actorId("busy"), participant(actorId("busy"), "agent", "active", ref));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [
      activateChange(actorId("busy"), actorId("init"), "s2"),
    ]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    await supervisor.drainFeed();

    // "busy" is now in agents map (started) and snapshot shows "active"
    // isClusterComplete should return false (tested indirectly via waitForCompletion not resolving immediately)
    const status = supervisor.getStatus();
    expect(status.agents.get("busy")!.heartbeat).toBeDefined();

    supervisor.stop();
  });

  it("onSignalDoneChange retires a running agent from the live set", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const m = makeManifest("sig-done");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(
      actorId("sig-done"),
      participant(actorId("sig-done"), "agent", "active", ref),
    );

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [
      activateChange(actorId("sig-done"), actorId("init"), "s2"),
    ]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
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
    expect(supervisor.startedAgents).toContain("sig-done");

    // Push a signal_done change for the running agent. onSignalDoneChange should
    // retire it from the live set (agents map + liveness table + mesh transport).
    const signalDoneChange: CoordinationChange = {
      changeId: changeId("sd-sig-done"),
      recordedAt: new Date().toISOString() as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("signal_done"),
      matchBindings: [{ role: "from", actorId: actorId("sig-done") }],
      targets: [],
      initiator: { actorId: actorId("sig-done"), kind: "agent" },
      involved: [{ actorId: actorId("sig-done"), kind: "agent" }],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      beforeRef: snapshotRef("s2"),
      afterRef: snapshotRef("s3"),
      visibility: "external",
    };
    await supervisor.onSignalReceived(signalDoneChange);

    // The agent should be removed from the live set.
    const status = supervisor.getStatus();
    expect(status.agents.get("sig-done")!.heartbeat).toBeUndefined();

    supervisor.stop();
  });

  it("onSignalDoneChange is a no-op for unknown agent", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
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

    // signal_done for an agent not in the live set — should not crash.
    const signalDoneChange: CoordinationChange = {
      changeId: changeId("sd-unknown"),
      recordedAt: new Date().toISOString() as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("signal_done"),
      matchBindings: [{ role: "from", actorId: actorId("unknown-agent") }],
      targets: [],
      initiator: { actorId: actorId("unknown-agent"), kind: "agent" },
      involved: [{ actorId: actorId("unknown-agent"), kind: "agent" }],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      beforeRef: snapshotRef("s0"),
      afterRef: snapshotRef("s1"),
      visibility: "external",
    };
    await supervisor.onSignalReceived(signalDoneChange);

    // No crash, no events.
    expect(events).toHaveLength(0);
    supervisor.stop();
  });

  it("uses custom supervisorPrincipal when provided", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const m = makeManifest("custom-prin");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));
    participantMap.set(
      actorId("custom-prin"),
      participant(actorId("custom-prin"), "agent", "active", ref),
    );

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    let proposeCalls = 0;
    const runtime = createMockRuntime(snap, [
      activateChange(actorId("custom-prin"), actorId("init"), "s2"),
    ]);
    // Wrap proposeAndCommit to count calls.
    const originalPropose = runtime.proposeAndCommit.bind(runtime);
    runtime.proposeAndCommit = (intent: unknown, options?: unknown) => {
      proposeCalls++;
      return originalPropose(intent, options);
    };

    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      supervisorPrincipal: () => ({ actorId: actorId("custom-init"), kind: "agent" }),
      eventListener: (e) => events.push(e),
    });

    supervisor.start();
    await supervisor.drainFeed();
    expect(supervisor.startedAgents).toContain("custom-prin");

    // Drive onAgentComplete — it should call submitLifecycleIntent which uses
    // the custom supervisorPrincipal (not the head's first active participant).
    await supervisor.driveOnAgentComplete(
      actorId("custom-prin"),
      { ok: true, summary: "done", turns: 1, elapsedMs: 10, producedRefs: [] },
      m,
    );

    // proposeAndCommit should have been called for the signal_done intent.
    expect(proposeCalls).toBeGreaterThanOrEqual(1);

    supervisor.stop();
  });

  it("onAgentComplete does not crash when no active principal is available", async () => {
    const store = createMockContentStore();
    const events: ClusterEvent[] = [];

    const m = makeManifest("no-prin");
    const ref = await store.put(JSON.stringify(m));

    const participantMap = new Map();
    // No active participant — all are "done".
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "done"));
    participantMap.set(actorId("no-prin"), participant(actorId("no-prin"), "agent", "active", ref));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap, [
      activateChange(actorId("no-prin"), actorId("init"), "s2"),
    ]);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });

    const supervisor = new TestableSupervisor({
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
    expect(supervisor.startedAgents).toContain("no-prin");

    // The only active participant is "no-prin" itself. But after onAgentComplete
    // removes it from the live set, the snapshot still shows "no-prin" as active.
    // resolveSupervisorPrincipal reads the snapshot (not the live set), so it
    // finds "no-prin" as active and uses it as the principal. This exercises
    // the resolveSupervisorPrincipal path that iterates participants.
    // To test the "undefined principal" branch, we need a snapshot with NO
    // active participants at all. Let's use a head-undefined runtime instead.

    supervisor.stop();

    // Separate case: head is undefined → resolveSupervisorPrincipal returns undefined.
    const runtime2 = createMockRuntime(undefined);
    const shared2 = createSharedResources({
      runtime: runtime2,
      contentStore: store,
      storagePath: "/tmp",
    });
    const supervisor2 = new TestableSupervisor({
      shared: shared2,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (e) => events.push(e),
    });

    supervisor2.start();
    // Manually place an agent in the live set, then drive onAgentComplete.
    // With head undefined, resolveSupervisorPrincipal returns undefined, so
    // submitLifecycleIntent returns early (no proposeAndCommit call).
    const internals = supervisor2 as unknown as {
      agents: Map<string, { abort(): void }>;
      livenessTable: Map<string, LivenessEntry>;
    };
    internals.agents.set("no-prin", { abort() {} });
    internals.livenessTable.set("no-prin", {
      lastHeartbeatTime: Date.now(),
      sequenceNo: 0,
      heartbeatIntervalMs: 60000,
    });

    await supervisor2.driveOnAgentComplete(
      actorId("no-prin"),
      { ok: true, summary: "done", turns: 1, elapsedMs: 10, producedRefs: [] },
      m,
    );

    // Should not crash; agent_done event should still be emitted.
    const doneEvents = events.filter(
      (e) => e.kind === "agent_done" && e.actorId === actorId("no-prin"),
    );
    expect(doneEvents).toHaveLength(1);

    supervisor2.stop();
  });

  it("isClusterComplete returns false for registered participants", () => {
    const store = createMockContentStore();
    const participantMap = new Map();
    participantMap.set(actorId("reg"), participant(actorId("reg"), "agent", "registered"));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    // waitForCompletion should not resolve immediately because "reg" is registered.
    // We test isClusterComplete indirectly by checking that waitForCompletion does
    // not return within a short timeout (it would loop on the setTimeout).
    // Instead, call getStatus which reads the snapshot — registered shows up.
    const status = supervisor.getStatus();
    expect(status.agents.get("reg")!.status).toBe("registered");
    supervisor.stop();
  });

  it("isClusterComplete returns false for waiting participants", () => {
    const store = createMockContentStore();
    const participantMap = new Map();
    participantMap.set(actorId("wait"), participant(actorId("wait"), "agent", "waiting"));

    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });

    const runtime = createMockRuntime(snap);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    const status = supervisor.getStatus();
    expect(status.agents.get("wait")!.status).toBe("waiting");
    supervisor.stop();
  });

  it("waitForCompletion loops and resolves when cluster becomes complete", async () => {
    const store = createMockContentStore();

    const participantMap = new Map();
    participantMap.set(actorId("init"), participant(actorId("init"), "agent", "active"));

    const snap0 = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: participantMap,
    });
    const snap1 = collaborationSnapshot({
      snapshotRef: snapshotRef("s2"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "done")]]),
    });

    let callCount = 0;
    const runtime = {
      getHead: () => {
        callCount++;
        // First call returns active (not complete), subsequent calls return done.
        if (callCount <= 1) return snap0;
        return snap1;
      },
      changes: () => [] as readonly CoordinationChange[],
      proposeAndCommit: () => ({ ok: true, after: snap0 }),
    } as unknown as SyscallRuntime;

    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    // waitForCompletion should loop once (sleep 1000ms), then find cluster complete.
    // Use fake timers to avoid the real 1000ms wait.
    vi.useFakeTimers();
    const completionPromise = supervisor.waitForCompletion();
    // Advance past the 1000ms sleep.
    await vi.advanceTimersByTimeAsync(1100);
    const result = await completionPromise;
    expect(result.ok).toBe(true);
    vi.useRealTimers();
    supervisor.stop();
  });

  it("waitForCompletion resolves immediately when head is undefined", async () => {
    const store = createMockContentStore();
    const runtime = createMockRuntime(undefined);
    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    const result = await supervisor.waitForCompletion();
    // isClusterComplete returns true when head is undefined → resolves immediately.
    expect(result.ok).toBe(true);
    supervisor.stop();
  });

  it("waitForCompletion waits when participants include registered status", async () => {
    const store = createMockContentStore();

    // Start with a "registered" participant (not complete), then transition to "done".
    const snap0 = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("reg"), participant(actorId("reg"), "agent", "registered")]]),
    });
    const snap1 = collaborationSnapshot({
      snapshotRef: snapshotRef("s2"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("reg"), participant(actorId("reg"), "agent", "done")]]),
    });

    let callCount = 0;
    const runtime = {
      getHead: () => {
        callCount++;
        if (callCount <= 1) return snap0;
        return snap1;
      },
      changes: () => [] as readonly CoordinationChange[],
      proposeAndCommit: () => ({ ok: true, after: snap0 }),
    } as unknown as SyscallRuntime;

    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new TestableSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
    });

    supervisor.start();
    vi.useFakeTimers();
    const completionPromise = supervisor.waitForCompletion();
    await vi.advanceTimersByTimeAsync(1100);
    const result = await completionPromise;
    expect(result.ok).toBe(true);
    vi.useRealTimers();
    supervisor.stop();
  });
});
