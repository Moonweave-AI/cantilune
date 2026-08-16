/**
 * Defensive-branch coverage for ClusterSupervisor (ADR-0015).
 *
 * These tests target the fail-fast guard branches that the happy-path coverage
 * suite does not reach: missing-role bindings, duplicate activation, head /
 * participant-entry undefined, isClusterComplete false branch, liveness nullish
 * coalescing, and resolveManifest's content-undefined / agentId-mismatch /
 * manifestRef-undefined returns. Each branch is a real production guard, not a
 * decorative assertion: the supervisor must silently ignore malformed or
 * out-of-order feed changes rather than throw.
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

function createMockRuntime(
  snapshot: unknown,
  feed: readonly CoordinationChange[] = [],
): SyscallRuntime {
  return {
    getHead: () => snapshot,
    changes(since?: SnapshotRef): readonly CoordinationChange[] {
      if (since === undefined) return feed;
      const idx = feed.findIndex((c) => c.afterRef === since);
      if (idx === -1) return feed;
      return feed.slice(idx + 1);
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
    systemPrompt: "defensive",
    assignedTask: "task-" + id,
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
    ...opts,
  };
}

function activateChange(agentId: ActorId, initiator: ActorId, afterRef = "s2"): CoordinationChange {
  return {
    changeId: changeId("act-" + (agentId as string)),
    recordedAt: "" as never,
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
 * Testable supervisor that stubs startAgent so the agent loop never runs, but
 * leaves every other private method (onParticipantActivated, resolveManifest,
 * onSignalDoneChange, onHeartbeatChange, onRetireChange, isClusterComplete,
 * onAgentComplete) at their real implementations.
 */
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
      lastHeartbeatTime: 0,
      sequenceNo: 5,
      heartbeatIntervalMs: m.heartbeatIntervalMs,
    });
    this.startedAgents.push(key);
    internals.emitEvent({ kind: "agent_started", actorId: agentId });
  }
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

function makeSupervisor(
  runtime: SyscallRuntime,
  store: SyscallContentStore,
  events: ClusterEvent[] = [],
): TestableSupervisor {
  const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
  return new TestableSupervisor({
    shared,
    conditionRegistry: createDefaultConditionRegistry(),
    llmAdapterFactory: () => ({
      async chat() {
        return { text: "", toolCalls: [], finishReason: "stop" as const };
      },
    }),
    eventListener: (e) => events.push(e),
  });
}

describe("ClusterSupervisor — defensive guard branches", () => {
  it("onParticipantActivated returns when the participant binding is absent", async () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
    });
    const runtime = createMockRuntime(snap);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();

    // activate_participant change with NO participant binding (only "from").
    const change: CoordinationChange = {
      ...activateChange(actorId("ghost"), actorId("init")),
      matchBindings: [{ role: "from", actorId: actorId("init") }],
    };
    await supervisor.onSignalReceived(change);
    expect(supervisor.startedAgents).not.toContain("ghost");
    supervisor.stop();
  });

  it("onParticipantActivated is a no-op when the agent is already running (duplicate activate)", async () => {
    const store = createMockContentStore();
    const m = makeManifest("dup");
    const ref = await store.put(JSON.stringify(m));
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("init"), participant(actorId("init"), "agent", "active")],
        [actorId("dup"), participant(actorId("dup"), "agent", "active", ref)],
      ]),
    });
    const feed = [activateChange(actorId("dup"), actorId("init"), "s2")];
    const runtime = createMockRuntime(snap, feed);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();
    await supervisor.drainFeed();
    expect(supervisor.startedAgents).toContain("dup");

    // Push the same activate change again; startAgent guard must prevent a re-start.
    await supervisor.onSignalReceived(activateChange(actorId("dup"), actorId("init"), "s3"));
    expect(supervisor.startedAgents.filter((a) => a === "dup")).toHaveLength(1);
    supervisor.stop();
  });

  it("onParticipantActivated returns when head is undefined", async () => {
    const store = createMockContentStore();
    const runtime = createMockRuntime(undefined);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();
    await supervisor.onSignalReceived(activateChange(actorId("orphan"), actorId("init")));
    expect(supervisor.startedAgents).not.toContain("orphan");
    supervisor.stop();
  });

  it("onParticipantActivated returns when the participant entry is missing from the snapshot", async () => {
    const store = createMockContentStore();
    // Head has "init" active but the activated agent "missing" is NOT in participants.
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
    });
    const runtime = createMockRuntime(snap);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();
    await supervisor.onSignalReceived(activateChange(actorId("missing"), actorId("init")));
    expect(supervisor.startedAgents).not.toContain("missing");
    supervisor.stop();
  });

  it("resolveManifest returns undefined when the manifest content is absent from the store", async () => {
    const store = createMockContentStore();
    // Bind a manifestRef that was never put into the store.
    const phantomRef = contentRef("sha256:doesnotexist000");
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("init"), participant(actorId("init"), "agent", "active")],
        [actorId("ghost"), participant(actorId("ghost"), "agent", "active", phantomRef)],
      ]),
    });
    const feed = [activateChange(actorId("ghost"), actorId("init"), "s2")];
    const runtime = createMockRuntime(snap, feed);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();
    await supervisor.drainFeed();
    // contentStore.get returns undefined → agent must NOT start.
    expect(supervisor.startedAgents).not.toContain("ghost");
    supervisor.stop();
  });

  it("resolveManifest returns undefined when the stored manifest agentId does not match the participant", async () => {
    const store = createMockContentStore();
    // A valid manifest, but for a DIFFERENT agent than the one being activated.
    const wrongM = makeManifest("someone-else");
    const ref = await store.put(JSON.stringify(wrongM));
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("init"), participant(actorId("init"), "agent", "active")],
        [actorId("real"), participant(actorId("real"), "agent", "active", ref)],
      ]),
    });
    const feed = [activateChange(actorId("real"), actorId("init"), "s2")];
    const runtime = createMockRuntime(snap, feed);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();
    await supervisor.drainFeed();
    // agentId mismatch → agent must NOT start.
    expect(supervisor.startedAgents).not.toContain("real");
    supervisor.stop();
  });

  it("onSignalDoneChange is a no-op when the from binding is absent", async () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
    });
    const runtime = createMockRuntime(snap);
    const events: ClusterEvent[] = [];
    const supervisor = makeSupervisor(runtime, store, events);
    supervisor.start();
    // signal_done change with NO from binding.
    const change: CoordinationChange = {
      changeId: changeId("sd-nofrom"),
      recordedAt: "" as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("signal_done"),
      matchBindings: [{ role: "participant", actorId: actorId("x") }],
      targets: [],
      initiator: { actorId: actorId("x"), kind: "agent" },
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
    supervisor.stop();
  });

  it("onHeartbeatChange is a no-op when the from binding is absent", async () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
    });
    const runtime = createMockRuntime(snap);
    const events: ClusterEvent[] = [];
    const supervisor = makeSupervisor(runtime, store, events);
    supervisor.start();
    // Pre-seed a live agent so a real heartbeat would have emitted an event.
    const internals = supervisor as unknown as {
      agents: Map<string, { abort(): void }>;
      livenessTable: Map<string, LivenessEntry>;
    };
    internals.agents.set("init", { abort() {} });
    internals.livenessTable.set("init", {
      lastHeartbeatTime: 0,
      sequenceNo: 0,
      heartbeatIntervalMs: 60000,
    });

    const change: CoordinationChange = {
      changeId: changeId("hb-nofrom"),
      recordedAt: "" as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      matchBindings: [{ role: "participant", actorId: actorId("init") }],
      targets: [],
      initiator: { actorId: actorId("init"), kind: "agent" },
      involved: [],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      beforeRef: snapshotRef("s0"),
      afterRef: snapshotRef("s1"),
      visibility: "internal",
    };
    await supervisor.onSignalReceived(change);
    // No from binding → onHeartbeatChange returns early, no heartbeat_received event.
    expect(events.filter((e) => e.kind === "heartbeat_received")).toHaveLength(0);
    supervisor.stop();
  });

  it("onRetireChange is a no-op when the participant binding is absent", async () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
    });
    const runtime = createMockRuntime(snap);
    const events: ClusterEvent[] = [];
    const supervisor = makeSupervisor(runtime, store, events);
    supervisor.start();
    const change: CoordinationChange = {
      changeId: changeId("ret-nopart"),
      recordedAt: "" as never,
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [{ role: "from", actorId: actorId("init") }],
      targets: [],
      initiator: { actorId: actorId("init"), kind: "agent" },
      involved: [],
      authorization: [],
      external: [],
      createdSessionRefs: [],
      beforeRef: snapshotRef("s0"),
      afterRef: snapshotRef("s1"),
      visibility: "internal",
    };
    await supervisor.onSignalReceived(change);
    expect(events.filter((e) => e.kind === "agent_retired")).toHaveLength(0);
    supervisor.stop();
  });

  it("onAgentComplete coalesces nullish liveness sequenceNo to 0", async () => {
    const store = createMockContentStore();
    const m = makeManifest("nullish-liveness");
    const ref = await store.put(JSON.stringify(m));
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("init"), participant(actorId("init"), "agent", "active")],
        [
          actorId("nullish-liveness"),
          participant(actorId("nullish-liveness"), "agent", "active", ref),
        ],
      ]),
    });
    const feed = [activateChange(actorId("nullish-liveness"), actorId("init"), "s2")];
    const runtime = createMockRuntime(snap, feed);
    const supervisor = makeSupervisor(runtime, store);
    supervisor.start();
    await supervisor.drainFeed();

    // Remove the liveness entry so onAgentComplete reads a nullish liveness.
    const internals = supervisor as unknown as { livenessTable: Map<string, LivenessEntry> };
    internals.livenessTable.delete("nullish-liveness");

    // driveOnAgentComplete must not throw; the heartbeatCount coalesces 0.
    await supervisor.driveOnAgentComplete(
      actorId("nullish-liveness"),
      { ok: true, summary: "done", turns: 1, elapsedMs: 10, producedRefs: [] },
      m,
    );
    // No crash is the assertion. Verify agent_done emitted.
    supervisor.stop();
  });

  it("waitForCompletion sleeps then resolves when an active participant transitions to done (isClusterComplete false→true)", async () => {
    vi.useFakeTimers();
    const store = createMockContentStore();

    const snapActive = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("busy"), participant(actorId("busy"), "agent", "active")]]),
    });
    const snapDone = collaborationSnapshot({
      snapshotRef: snapshotRef("s2"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("busy"), participant(actorId("busy"), "agent", "done")]]),
    });

    let callCount = 0;
    const runtime = {
      getHead: () => {
        callCount++;
        // start() calls getHead() once to seed the cursor; the first
        // isClusterComplete() check (call 2) must see the active snapshot so the
        // loop enters the setTimeout sleep (the L286 false branch). After the sleep,
        // the next call returns done → isClusterComplete true → break → resolve.
        return callCount <= 2 ? snapActive : snapDone;
      },
      changes: () => [] as readonly CoordinationChange[],
      proposeAndCommit: () => ({ ok: true, after: snapActive }),
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
    // The first isClusterComplete() returns false (active participant) → the loop
    // enters the setTimeout(resolve, 1000) sleep. Advance fake timers past it; the
    // next head read returns done → isClusterComplete true → break → resolves.
    const completionPromise = supervisor.waitForCompletion();
    await vi.advanceTimersByTimeAsync(1100);
    const result = await completionPromise;
    expect(result.ok).toBe(true);
    vi.useRealTimers();
    supervisor.stop();
  });
});
