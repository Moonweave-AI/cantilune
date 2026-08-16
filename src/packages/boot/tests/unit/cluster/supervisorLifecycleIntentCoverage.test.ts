/**
 * Branch coverage for the split `submitLifecycleIntent` / `resolveSupervisorPrincipal`
 * retire path introduced by the ADR-0015 §4 signal_done binding-semantics fix.
 *
 * Before the fix, `submitLifecycleIntent` called `resolveSupervisorPrincipal` for
 * BOTH `signal_done` and `retire_participant`; the existing "no active principal"
 * and "uses custom supervisorPrincipal" tests therefore covered the
 * `resolveSupervisorPrincipal` branches through the `signal_done` path. After the
 * fix, `signal_done` transitions the `from` binding directly (it returns before
 * `resolveSupervisorPrincipal`), so those branches are reachable ONLY through
 * the `retire_participant` path. The stale detector is the single retire trigger,
 * so these tests drive `checkStaleAgents()` directly with a controlled liveness
 * table and head snapshot to exercise each `resolveSupervisorPrincipal` branch:
 *
 * - supervisorPrincipal callback present  → returns the callback result (L396 true)
 * - head undefined, no callback            → returns undefined      (L400 true)
 * - head set, no active participant, no cb → loop falls through      (L405 true)
 * - principal undefined (from either above) → retire returns early   (L383 true)
 *
 * The L227 real-`startAgent` duplicate-guard return is also covered here, because
 * `TestableSupervisor` overrides `startAgent` and so never reaches the production
 * guard. We seed the live `agents` map and call the real public `startAgent` to
 * hit the `if (this.agents.has(agentKey)) return;` branch with zero side effects.
 */
import { describe, it, expect } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  participant,
  contentRef,
  ALWAYS_CONDITION,
} from "@cantilune/core";
import type {
  ActorId,
  AgentManifest,
  ContentRef,
  CoordinationChange,
  SnapshotRef,
} from "@cantilune/core";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import {
  ClusterSupervisor,
  createSharedResources,
  type LivenessEntry,
} from "../../../src/cluster/index.js";

function createMockContentStore(): SyscallContentStore {
  const storage = new Map<string, Uint8Array>();
  let counter = 0;
  return {
    async put(content: string | Uint8Array) {
      counter++;
      const ref = contentRef(`sha256:lc${counter.toString(36).padStart(8, "0")}`);
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
  proposeAndCommitImpl?: () => { ok: boolean; after: unknown },
): SyscallRuntime {
  return {
    getHead: () => snapshot,
    changes(since?: SnapshotRef): readonly CoordinationChange[] {
      if (since === undefined) return feed;
      const idx = feed.findIndex((c) => c.afterRef === since);
      if (idx === -1) return feed;
      return feed.slice(idx + 1);
    },
    proposeAndCommit: proposeAndCommitImpl ?? (() => ({ ok: true, after: snapshot })),
  } as unknown as SyscallRuntime;
}

function makeManifest(id: string, opts?: Partial<AgentManifest>): AgentManifest {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "lifecycle-intent",
    assignedTask: "task-" + id,
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
    ...opts,
  };
}

type SupervisorInternals = {
  agents: Map<string, { abort(): void }>;
  livenessTable: Map<string, LivenessEntry>;
  checkStaleAgents(): void;
};

function seedStaleAgent(supervisor: ClusterSupervisor, agentKey: string): void {
  const internals = supervisor as unknown as SupervisorInternals;
  internals.agents.set(agentKey, { abort() {} });
  // lastHeartbeatTime = 0 guarantees elapsed (now - 0) exceeds the tiny threshold,
  // and agents.has(agentKey) is true → checkStaleAgents submits a retire intent.
  internals.livenessTable.set(agentKey, {
    lastHeartbeatTime: 0,
    sequenceNo: 0,
    heartbeatIntervalMs: 1,
  });
}

describe("ClusterSupervisor — submitLifecycleIntent retire / resolveSupervisorPrincipal branches", () => {
  it("retire uses the configured supervisorPrincipal callback when present (L396 true branch)", () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
    });

    let proposeCalls = 0;
    let lastIntentOperation: string | undefined;
    let lastPrincipalActor: ActorId | undefined;
    const runtime = createMockRuntime(snap, [], () => {
      proposeCalls++;
      return { ok: true, after: snap };
    });
    // Wrap to inspect the committed intent + principal the retire path used.
    const base = runtime.proposeAndCommit.bind(runtime);
    (runtime as unknown as { proposeAndCommit: typeof runtime.proposeAndCommit }).proposeAndCommit =
      (intent: unknown, options?: { principal?: { actorId: ActorId } }) => {
        const op = (intent as { operationTypeId?: string }).operationTypeId;
        lastIntentOperation = op;
        lastPrincipalActor = options?.principal?.actorId;
        return base(intent, options);
      };

    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      // The callback path: resolveSupervisorPrincipal returns this principal.
      supervisorPrincipal: () => ({ actorId: actorId("custom-supervisor"), kind: "agent" }),
    });
    supervisor.start();
    seedStaleAgent(supervisor, "stale-agent");

    (supervisor as unknown as SupervisorInternals).checkStaleAgents();

    // retire_participant committed as the custom-supervisor principal.
    expect(proposeCalls).toBe(1);
    expect(lastIntentOperation).toBe("retire_participant");
    expect(lastPrincipalActor).toEqual(actorId("custom-supervisor"));
    supervisor.stop();
  });

  it("retire returns early when head is undefined and no supervisorPrincipal is configured (L400 + L383)", () => {
    const store = createMockContentStore();
    let proposeCalls = 0;
    // head is undefined.
    const runtime = createMockRuntime(undefined, [], () => {
      proposeCalls++;
      return { ok: true, after: undefined };
    });

    const shared = createSharedResources({ runtime, contentStore: store, storagePath: "/tmp" });
    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: "", toolCalls: [], finishReason: "stop" as const };
        },
      }),
      // No supervisorPrincipal callback → resolveSupervisorPrincipal reads getHead(),
      // which is undefined → returns undefined → submitLifecycleIntent returns early.
    });
    supervisor.start();
    seedStaleAgent(supervisor, "stale-no-head");

    (supervisor as unknown as SupervisorInternals).checkStaleAgents();

    // agent_stale is still emitted, but no retire intent is committed (principal undefined).
    expect(proposeCalls).toBe(0);
    supervisor.stop();
  });

  it("retire returns early when no participant is active and no supervisorPrincipal is configured (L405 + L383)", () => {
    const store = createMockContentStore();
    // Head exists but every participant is "done" — the active-loop falls through.
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("done-a"), participant(actorId("done-a"), "agent", "done")],
        [actorId("done-b"), participant(actorId("done-b"), "agent", "retired")],
      ]),
    });
    let proposeCalls = 0;
    const runtime = createMockRuntime(snap, [], () => {
      proposeCalls++;
      return { ok: true, after: snap };
    });

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
    seedStaleAgent(supervisor, "stale-no-active");

    (supervisor as unknown as SupervisorInternals).checkStaleAgents();

    // Loop found no active participant → resolveSupervisorPrincipal undefined → no retire commit.
    expect(proposeCalls).toBe(0);
    supervisor.stop();
  });

  it("retire commits through the head's first active participant when no supervisorPrincipal is configured (happy path)", () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([
        [actorId("init"), participant(actorId("init"), "agent", "active")],
        [actorId("stale-target"), participant(actorId("stale-target"), "agent", "active")],
      ]),
    });

    let proposeCalls = 0;
    let lastPrincipalActor: ActorId | undefined;
    const runtime = createMockRuntime(snap, [], () => {
      proposeCalls++;
      return { ok: true, after: snap };
    });
    const base = runtime.proposeAndCommit.bind(runtime);
    (runtime as unknown as { proposeAndCommit: typeof runtime.proposeAndCommit }).proposeAndCommit =
      (intent: unknown, options?: { principal?: { actorId: ActorId } }) => {
        lastPrincipalActor = options?.principal?.actorId;
        return base(intent, options);
      };

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
    seedStaleAgent(supervisor, "stale-target");

    (supervisor as unknown as SupervisorInternals).checkStaleAgents();

    // The head's first active participant ("init") is used as the retire principal.
    expect(proposeCalls).toBe(1);
    expect(lastPrincipalActor).toEqual(actorId("init"));
    supervisor.stop();
  });

  it("the real startAgent duplicate-guard returns immediately when the agent is already running (L227)", async () => {
    const store = createMockContentStore();
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s1"),
      epochId: epochId("e1"),
      participants: new Map([[actorId("init"), participant(actorId("init"), "agent", "active")]]),
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
    supervisor.start();

    const internals = supervisor as unknown as SupervisorInternals;
    // Pre-seed the live agents map so the production guard's `has(agentKey)` is true.
    // This makes `startAgent` hit `if (this.agents.has(agentKey)) return;` and bail out
    // BEFORE allocating mesh transport, building a syscall, or starting an AgentInstance.
    internals.agents.set("dup-agent", { abort() {} });

    const manifest = makeManifest("dup-agent");
    // The guard returns before livenessTable.set(agentKey, ...). Because we did NOT
    // pre-seed liveness for "dup-agent", a guarded return leaves it absent — whereas a
    // fall-through would set it. This is the meaningful side-effect-free assertion.
    expect(internals.livenessTable.has("dup-agent")).toBe(false);
    const beforeSize = internals.agents.size;

    await supervisor.startAgent(actorId("dup-agent"), manifest);

    // No new agent entry, and liveness still absent → the duplicate guard fired.
    expect(internals.agents.size).toBe(beforeSize);
    expect(internals.livenessTable.has("dup-agent")).toBe(false);
    supervisor.stop();
  });
});
