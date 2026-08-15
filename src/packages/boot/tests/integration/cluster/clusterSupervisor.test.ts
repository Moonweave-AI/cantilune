/**
 * Integration test: ClusterSupervisor orchestration logic.
 *
 * Tests condition evaluation, feed-driven dispatch, heartbeat tracking, and lifecycle.
 * Agent loop execution is stubbed to prevent hanging — we're testing the supervisor, not the loop.
 *
 * Per ADR-0015 the supervisor consumes a trusted committed-change feed. Dispatch is
 * triggered by `activate_participant` changes (not `register_participant`), and the
 * manifest ref is bound on the `Participant` (not discovered by scanning auditTail).
 */
import { describe, it, expect, beforeEach } from "vitest";
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
} from "@cantilune/core";
import {
  conditionAtom,
  conditionAnd,
  conditionOr,
  ALWAYS_CONDITION,
  NEVER_CONDITION,
} from "@cantilune/core";
import type { AgentManifest } from "@cantilune/core";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import {
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
  type SharedResources,
  type LivenessEntry,
} from "../../../src/cluster/index.js";

/* ────────── Mock Helper ────────── */

function createMockContentStore(): SyscallContentStore {
  const storage = new Map<string, Uint8Array>();
  let counter = 0;

  return {
    async put(content: string | Uint8Array, _opts?: { mimeType?: string; createdBy?: string }) {
      counter++;
      const ref = contentRef(`sha256:test${counter.toString(36).padStart(6, "0")}`);
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
          createdAt: new Date().toISOString(),
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
 * Mock SyscallRuntime that serves a fixed head snapshot and a fixed committed-change
 * feed. The `changes(since?)` cursor returns every feed change whose `afterRef` is
 * strictly after the given cursor; with no cursor it returns the whole feed. This
 * matches ADR-0015's `DurableCoordinator.since(fromRef)` semantics: once the
 * supervisor advances its cursor to a change's `afterRef`, that change is not
 * re-delivered on the next drain.
 */
function createMockRuntime(
  snapshot: CollaborationSnapshot,
  feed: readonly CoordinationChange[] = [],
): SyscallRuntime {
  return {
    getHead() {
      return snapshot;
    },
    observe() {
      return { ok: true };
    },
    changes(since?: SnapshotRef): readonly CoordinationChange[] {
      if (since === undefined) return feed;
      // Return every change committed strictly after the cursor.
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
  agentId: string,
  opts?: {
    startCondition?: StartConditionExpression;
    heartbeatIntervalMs?: number;
  },
): AgentManifest {
  return {
    agentId,
    kind: "agent",
    systemPrompt: "You are a test agent.",
    assignedTask: "Test task for " + agentId,
    startCondition: opts?.startCondition ?? ALWAYS_CONDITION,
    heartbeatIntervalMs: opts?.heartbeatIntervalMs ?? 60_000,
    designedBy: actorId("initiator"),
  };
}

async function storeManifest(
  store: SyscallContentStore,
  manifest: AgentManifest,
): Promise<ContentRef> {
  return store.put(JSON.stringify(manifest));
}

function signalDoneChange(agentId: ActorId): CoordinationChange {
  return {
    changeId: changeId("ch-done-" + (agentId as string)),
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

function heartbeatChange(agentId: ActorId): CoordinationChange {
  return {
    changeId: changeId("hb-" + (agentId as string)),
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

function retireChange(agentId: ActorId, initiator: ActorId): CoordinationChange {
  return {
    changeId: changeId("retire-" + (agentId as string)),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("retire_participant"),
    matchBindings: [{ role: "participant", actorId: agentId }],
    targets: [],
    initiator: { actorId: initiator, kind: "agent" },
    involved: [{ actorId: agentId, kind: "agent" }],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s0"),
    afterRef: snapshotRef("s1"),
    visibility: "external",
  };
}

function registerChange(agentId: ActorId, initiator: ActorId): CoordinationChange {
  return {
    changeId: changeId("reg-" + (agentId as string)),
    recordedAt: new Date().toISOString() as never,
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("register_participant"),
    matchBindings: [{ role: "participant", actorId: agentId }],
    targets: [],
    initiator: { actorId: initiator, kind: "agent" },
    involved: [{ actorId: agentId, kind: "agent" }],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    beforeRef: snapshotRef("s0"),
    afterRef: snapshotRef("s1"),
    visibility: "external",
  };
}

/**
 * The ADR-0015 activation change. `activate_participant` is the trigger for
 * `startAgent`: the supervisor resolves the manifest from `participant.manifestRef`
 * (bound on the participant in the snapshot, NOT on the change) and, if the
 * start condition is met, starts the agent.
 */
function activateChange(agentId: ActorId, initiator: ActorId, afterRef: string = "s2"): CoordinationChange {
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

/**
 * Test-only ClusterSupervisor subclass that overrides startAgent to avoid
 * running actual loops. Records lifecycle events identically.
 */
class TestableClusterSupervisor extends ClusterSupervisor {
  readonly startedAgents: string[] = [];

  override async startAgent(agentId: ActorId, manifest: AgentManifest): Promise<void> {
    const agentKey = agentId as string;
    // Access internal agents map via the prototype chain
    const internals = this as unknown as {
      agents: Map<string, { abort(): void }>;
      livenessTable: Map<string, LivenessEntry>;
      emitEvent(event: ClusterEvent): void;
    };

    if (internals.agents.has(agentKey)) return;

    internals.agents.set(agentKey, { abort() {} });
    internals.livenessTable.set(agentKey, {
      lastHeartbeatTime: Date.now(),
      sequenceNo: 0,
      heartbeatIntervalMs: manifest.heartbeatIntervalMs,
    });

    this.startedAgents.push(agentKey);
    internals.emitEvent({ kind: "agent_started", actorId: agentId });
  }
}

function createTestSupervisor(opts: {
  shared: SharedResources;
  eventListener: (e: ClusterEvent) => void;
}): TestableClusterSupervisor {
  return new TestableClusterSupervisor({
    shared: opts.shared,
    conditionRegistry: createDefaultConditionRegistry(),
    llmAdapterFactory: () => ({
      async chat() {
        return {
          text: undefined,
          toolCalls: [{ id: "tc1", name: "done", arguments: { summary: "done" } }],
          finishReason: "tool_calls" as const,
        };
      },
    }),
    eventListener: opts.eventListener,
  });
}

/* ────────── Test Suites ────────── */

describe("ClusterSupervisor integration", () => {
  let contentStore: SyscallContentStore;
  let events: ClusterEvent[];

  beforeEach(() => {
    contentStore = createMockContentStore();
    events = [];
  });

  describe("condition evaluation — atom conditions", () => {
    it("starts agent with always-condition when activated", async () => {
      const manifest = makeManifest("agent-a");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-a");
      expect(events.some((e) => e.kind === "agent_started")).toBe(true);
      supervisor.stop();
    });

    it("blocks agent with never-condition even when activated", async () => {
      const manifest = makeManifest("agent-a", { startCondition: NEVER_CONDITION });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toHaveLength(0);
      supervisor.stop();
    });

    it("blocks agent when agentsDone dependencies are not satisfied", async () => {
      const manifest = makeManifest("agent-f", {
        startCondition: conditionAtom("agentsDone", { agents: ["agent-c", "agent-d"] }),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "active")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "active")],
          [actorId("agent-f"), participant(actorId("agent-f"), "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-f"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toHaveLength(0);
      supervisor.stop();
    });

    it("starts agent when agentsDone dependencies are all done or retired", async () => {
      const manifest = makeManifest("agent-f", {
        startCondition: conditionAtom("agentsDone", { agents: ["agent-c", "agent-d"] }),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "done")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "retired")],
          [actorId("agent-f"), participant(actorId("agent-f"), "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-f"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-f");
      supervisor.stop();
    });
  });

  describe("condition evaluation — composite conditions", () => {
    it("AND: blocks when one operand is false", async () => {
      const manifest = makeManifest("agent-f", {
        startCondition: conditionAnd(
          conditionAtom("agentsDone", { agents: ["agent-c"] }),
          conditionAtom("agentsDone", { agents: ["agent-d"] }),
        ),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "done")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "active")],
          [actorId("agent-f"), participant(actorId("agent-f"), "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-f"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toHaveLength(0);
      supervisor.stop();
    });

    it("AND: starts when all operands are true", async () => {
      const manifest = makeManifest("agent-f", {
        startCondition: conditionAnd(
          conditionAtom("agentsDone", { agents: ["agent-c"] }),
          conditionAtom("agentsDone", { agents: ["agent-d"] }),
        ),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "done")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "done")],
          [actorId("agent-f"), participant(actorId("agent-f"), "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-f"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-f");
      supervisor.stop();
    });

    it("OR: starts when at least one operand is true", async () => {
      const manifest = makeManifest("agent-g", {
        startCondition: conditionOr(
          conditionAtom("agentsDone", { agents: ["agent-c"] }),
          conditionAtom("agentsDone", { agents: ["agent-d"] }),
        ),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "done")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "active")],
          [actorId("agent-g"), participant(actorId("agent-g"), "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-g"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-g");
      supervisor.stop();
    });

    it("OR: blocks when all operands are false", async () => {
      const manifest = makeManifest("agent-g", {
        startCondition: conditionOr(
          conditionAtom("agentsDone", { agents: ["agent-c"] }),
          conditionAtom("agentsDone", { agents: ["agent-d"] }),
        ),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "active")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "active")],
          [actorId("agent-g"), participant(actorId("agent-g"), "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-g"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toHaveLength(0);
      supervisor.stop();
    });
  });

  describe("feed-driven dispatch", () => {
    it("starts dependent agent when activate arrives after dependency is done", async () => {
      // agent-f depends on agent-c. agent-c is already done in the snapshot.
      // An activate_participant for agent-f arrives on the feed.
      const manifest = makeManifest("agent-f", {
        startCondition: conditionAtom("agentsDone", { agents: ["agent-c"] }),
      });
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentC = actorId("agent-c");
      const agentF = actorId("agent-f");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentC, participant(agentC, "agent", "done")],
          [agentF, participant(agentF, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentF, initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-f");
      supervisor.stop();
    });

    it("register_participant is a no-op on the supervisor side", async () => {
      const manifest = makeManifest("agent-b");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentB = actorId("agent-b");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          // agent-b is only "registered" (not activated), so even if a register
          // change arrives, the supervisor must not start it.
          [agentB, participant(agentB, "agent", "registered")],
        ]),
      });

      const runtime = createMockRuntime(snap, [registerChange(agentB, initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toHaveLength(0);
      supervisor.stop();
    });

    it("does nothing when supervisor is stopped", async () => {
      const manifest = makeManifest("agent-a");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      // Don't call start() — supervisor is stopped. drainFeed is a no-op when not running.
      await supervisor.drainFeed();

      expect(events).toHaveLength(0);
      expect(supervisor.startedAgents).toHaveLength(0);
    });
  });

  describe("heartbeat tracking", () => {
    it("records heartbeat signals for running agents", async () => {
      const manifest = makeManifest("agent-a");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator, "s2")]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();
      await supervisor.onSignalReceived(heartbeatChange(agentA));

      const hbEvents = events.filter((e) => e.kind === "heartbeat_received");
      expect(hbEvents).toHaveLength(1);
      expect(hbEvents[0]!.kind === "heartbeat_received" && hbEvents[0]!.actorId).toBe(agentA);
      expect(hbEvents[0]!.kind === "heartbeat_received" && hbEvents[0]!.seq).toBe(1);
      supervisor.stop();
    });

    it("increments sequence on multiple heartbeats", async () => {
      const manifest = makeManifest("agent-a");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator, "s2")]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();
      await supervisor.onSignalReceived(heartbeatChange(agentA));
      await supervisor.onSignalReceived(heartbeatChange(agentA));
      await supervisor.onSignalReceived(heartbeatChange(agentA));

      const hbEvents = events.filter((e) => e.kind === "heartbeat_received");
      expect(hbEvents).toHaveLength(3);
      expect(hbEvents[2]!.kind === "heartbeat_received" && hbEvents[2]!.seq).toBe(3);
      supervisor.stop();
    });

    it("ignores heartbeat for unknown agent", async () => {
      const initiator = actorId("initiator");
      const agentX = actorId("agent-x");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([[initiator, participant(initiator, "agent", "active")]]),
      });

      const runtime = createMockRuntime(snap);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.onSignalReceived(heartbeatChange(agentX));

      expect(events.filter((e) => e.kind === "heartbeat_received")).toHaveLength(0);
      supervisor.stop();
    });
  });

  describe("retire signal handling", () => {
    it("emits agent_retired event and cleans up liveness", async () => {
      const manifest = makeManifest("agent-a");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator, "s2")]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();
      await supervisor.onSignalReceived(retireChange(agentA, initiator));

      const retired = events.filter((e) => e.kind === "agent_retired");
      expect(retired).toHaveLength(1);
      expect(retired[0]!.kind === "agent_retired" && retired[0]!.actorId).toBe(agentA);

      const status = supervisor.getStatus();
      expect(status.agents.get("agent-a")?.heartbeat).toBeUndefined();
      supervisor.stop();
    });
  });

  describe("complex topology: parallel fan-out + conditional convergence", () => {
    it("starts C/D/E immediately (always), blocks F (depends on all three)", async () => {
      const manifestC = makeManifest("agent-c");
      const manifestD = makeManifest("agent-d");
      const manifestE = makeManifest("agent-e");
      const manifestF = makeManifest("agent-f", {
        startCondition: conditionAtom("agentsDone", { agents: ["agent-c", "agent-d", "agent-e"] }),
      });

      const refC = await storeManifest(contentStore, manifestC);
      const refD = await storeManifest(contentStore, manifestD);
      const refE = await storeManifest(contentStore, manifestE);
      const refF = await storeManifest(contentStore, manifestF);

      const initiator = actorId("initiator");
      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "active", refC)],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "active", refD)],
          [actorId("agent-e"), participant(actorId("agent-e"), "agent", "active", refE)],
          [actorId("agent-f"), participant(actorId("agent-f"), "agent", "active", refF)],
        ]),
      });

      const feed = [
        activateChange(actorId("agent-c"), initiator, "s2"),
        activateChange(actorId("agent-d"), initiator, "s3"),
        activateChange(actorId("agent-e"), initiator, "s4"),
        activateChange(actorId("agent-f"), initiator, "s5"),
      ];
      const runtime = createMockRuntime(snap, feed);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-c");
      expect(supervisor.startedAgents).toContain("agent-d");
      expect(supervisor.startedAgents).toContain("agent-e");
      expect(supervisor.startedAgents).not.toContain("agent-f");
      expect(supervisor.startedAgents).toHaveLength(3);
      supervisor.stop();
    });

    it("starts F after C/D/E all complete", async () => {
      const manifestF = makeManifest("agent-f", {
        startCondition: conditionAtom("agentsDone", { agents: ["agent-c", "agent-d", "agent-e"] }),
      });
      const refF = await storeManifest(contentStore, manifestF);

      const initiator = actorId("initiator");
      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [actorId("agent-c"), participant(actorId("agent-c"), "agent", "done")],
          [actorId("agent-d"), participant(actorId("agent-d"), "agent", "done")],
          [actorId("agent-e"), participant(actorId("agent-e"), "agent", "done")],
          [actorId("agent-f"), participant(actorId("agent-f"), "agent", "active", refF)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(actorId("agent-f"), initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toContain("agent-f");
      supervisor.stop();
    });
  });

  describe("idempotency and guards", () => {
    it("does not start same agent twice on repeated drainFeed", async () => {
      const manifest = makeManifest("agent-a");
      const ref = await storeManifest(contentStore, manifest);
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          [agentA, participant(agentA, "agent", "active", ref)],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator, "s2")]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();
      // Subsequent drains return no new changes (cursor advanced to s2).
      await supervisor.drainFeed();
      await supervisor.drainFeed();

      const started = events.filter((e) => e.kind === "agent_started");
      expect(started).toHaveLength(1);
      supervisor.stop();
    });

    it("skips agents without a manifestRef on the participant", async () => {
      const initiator = actorId("initiator");
      const agentA = actorId("agent-a");

      const snap = collaborationSnapshot({
        snapshotRef: snapshotRef("s1"),
        epochId: epochId("e1"),
        participants: new Map([
          [initiator, participant(initiator, "agent", "active")],
          // agent-a is active but has NO manifestRef — was never properly activated.
          [agentA, participant(agentA, "agent", "active")],
        ]),
      });

      const runtime = createMockRuntime(snap, [activateChange(agentA, initiator)]);
      const shared = createSharedResources({ runtime, contentStore, storagePath: "/tmp/test" });
      const supervisor = createTestSupervisor({ shared, eventListener: (e) => events.push(e) });

      supervisor.start();
      await supervisor.drainFeed();

      expect(supervisor.startedAgents).toHaveLength(0);
      supervisor.stop();
    });
  });
});
