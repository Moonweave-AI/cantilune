/**
 * L6 system test: real-runtime closed-loop swarm lifecycle (ADR-0015 §7).
 *
 * This is the QA-0012 SS-01 lift gate: a swarm driven by a REAL
 * `CoordinationRuntime` (memory persistence), NOT a mock SyscallRuntime with a
 * hand-built fixed feed. The closed-loop property under test is that the
 * supervisor's own lifecycle commitments round-trip through the durable
 * commit-feed: `proposeAndCommit` appends the change, `changes(since)` returns
 * it, `drainFeed` observes it, and the committed world (the only authority) is
 * what `isClusterComplete` reads. No mock signal injection.
 *
 * Production ordering: the supervisor `start()`s and seeds its feed cursor from
 * the durable head; THEN coordination commits (`activate_participant`) drive
 * the swarm. The supervisor only observes changes committed *after* its cursor.
 *
 * Flow:
 * 1. Seed a real runtime with an active initiator + a registered worker, and
 *    put the worker manifest in a real content store.
 * 2. `supervisor.start()` seeds `lastObservedHead` from the t0 head.
 * 3. Commit `activate_participant` (initiator → worker, manifest ref) through
 *    the real runtime — it appends to the commit feed AFTER the cursor.
 * 4. The supervisor's feed drain observes the `activate_participant` change and
 *    calls the real `startAgent` (a scripted LLM that calls `done` immediately).
 * 5. The agent loop completes → `onAgentComplete` commits `signal_done` for the
 *    completing participant → the feed carries it.
 * 6. The supervisor re-drains and observes its own `signal_done` change.
 * 7. The committed world shows the worker as `done`; `isClusterComplete` derives
 *    completion from that world; the supervisor's live set is empty.
 */
import { describe, it, expect } from "vitest";
import {
  actorId,
  actorRef,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  participant,
  operationTypeId,
  coordinationIntent,
  matchBinding,
  ALWAYS_CONDITION,
} from "@cantilune/core";
import type { ActorId, AgentManifest, ContentRef, SnapshotRef } from "@cantilune/core";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  createDefaultConditionRegistry,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { wrapCoordinationRuntime } from "../../../src/runtimeAdapter.js";
import { uuidIdGenerator } from "../../../src/bootCantilune.js";
import {
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
} from "../../../src/cluster/index.js";
import type { LlmAdapter, LlmChatResponse } from "../../../src/types.js";
import { BOOT_EPOCH_ID } from "../../../src/index.js";

/** Scripted LLM: immediately calls `done`, so the real agent loop resolves fast. */
function immediateDoneLlm(): LlmAdapter {
  return {
    async chat(): Promise<LlmChatResponse> {
      return {
        text: undefined,
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "closed-loop done" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

function makeManifest(id: ActorId): AgentManifest {
  return {
    agentId: id as string,
    kind: "agent",
    systemPrompt: "closed-loop worker",
    assignedTask: "close the loop",
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
  };
}

/** Build a real CoordinationRuntime seeded with an active initiator and a
 *  registered worker, plus the content store holding the worker manifest. */
async function seedRealCluster(): Promise<{
  runtime: ReturnType<typeof createCoordinationRuntime>;
  contentStore: ReturnType<typeof createMemoryContentStore>;
  initiator: ActorId;
  worker: ActorId;
  manifestRef: ContentRef;
  t0Ref: SnapshotRef;
}> {
  const initiator = actorId("initiator");
  const worker = actorId("worker");
  const manifest = makeManifest(worker);

  const contentStore = createMemoryContentStore();
  const manifestRef = await contentStore.put(JSON.stringify(manifest));

  const t0 = collaborationSnapshot({
    snapshotRef: snapshotRef("t0"),
    epochId: epochId(BOOT_EPOCH_ID),
    participants: new Map<ActorId, ReturnType<typeof participant>>([
      [initiator, participant(initiator, "agent", "active")],
      [worker, participant(worker, "agent", "registered")],
    ]),
  });
  const persistence = createMemoryRuntimePersistence({ initial: t0 });

  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: { now: () => "2026-08-14T00:00:00Z" },
      idGen: uuidIdGenerator(),
      schema: createDefaultSchema(),
      activeEpochId: epochId(BOOT_EPOCH_ID),
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: new MemoryResourceLockTable(),
      contentRefAuthority: contentStore,
    }),
  );

  return { runtime, contentStore, initiator, worker, manifestRef, t0Ref: snapshotRef("t0") };
}

/** Commit `activate_participant` (initiator → worker, manifest ref) on the real runtime. */
function commitActivate(
  runtime: ReturnType<typeof createCoordinationRuntime>,
  initiator: ActorId,
  worker: ActorId,
  manifestRef: ContentRef,
): void {
  runtime.proposeAndCommit(
    coordinationIntent(
      actorRef(initiator, "agent"),
      operationTypeId("activate_participant"),
      [matchBinding("from", initiator as string), matchBinding("participant", worker as string)],
      undefined,
      [manifestRef],
    ),
    { principal: actorRef(initiator, "agent") },
  );
}

describe("L6 — real-runtime closed-loop swarm (ADR-0015 §7)", () => {
  it("activate_participant appends to the real commit feed and binds the manifest on the participant", async () => {
    const { runtime, initiator, worker, manifestRef } = await seedRealCluster();

    // Commit through the REAL runtime: the handler binds the manifest ref and
    // transitions the worker registered → active. This appends a real
    // CoordinationChange to the durable commit feed.
    commitActivate(runtime, initiator, worker, manifestRef);

    const feed = runtime.changes();
    const activateChange = feed.find(
      (c) => c.operationTypeId === operationTypeId("activate_participant"),
    );
    expect(activateChange).toBeDefined();
    expect(
      activateChange!.matchBindings.some((b) => b.role === "participant" && b.actorId === worker),
    ).toBe(true);

    const headAfterActivate = runtime.getHead();
    const workerParticipant = headAfterActivate!.participants.get(worker);
    expect(workerParticipant!.status).toBe("active");
    expect(workerParticipant!.manifestRef).toBe(manifestRef);
  });

  it("supervisor starts the worker from the real feed, commits signal_done, and the closed loop drains the live set", async () => {
    const { runtime, contentStore, initiator, worker, manifestRef } = await seedRealCluster();
    const syscallRuntime = wrapCoordinationRuntime(runtime);
    const events: ClusterEvent[] = [];

    const shared = createSharedResources({
      runtime: syscallRuntime,
      contentStore,
      storagePath: "/tmp/closed-loop",
      eventListener: (e) => events.push(e),
    });

    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => immediateDoneLlm(),
      feedDrainIntervalMs: 50,
      eventListener: (e) => events.push(e),
    });

    // Production ordering: the supervisor seeds its cursor from the t0 head FIRST,
    // then the activate_participant commit drives the swarm.
    supervisor.start();

    // Commit activate_participant AFTER the supervisor's cursor is seeded.
    commitActivate(runtime, initiator, worker, manifestRef);

    // Drain the activate_participant change → supervisor resolves the manifest
    // from the content store and starts the real agent loop.
    await supervisor.drainFeed();
    expect(events.some((e) => e.kind === "agent_started" && e.actorId === worker)).toBe(true);

    // The agent loop (immediateDoneLlm) resolves quickly. Poll until the
    // supervisor's onAgentComplete has committed signal_done. The closed-loop
    // property: signal_done is on the REAL feed, not injected.
    let observedSignalDone = false;
    let deadline = 200;
    while (deadline-- > 0) {
      const changeKinds = runtime.changes().map((c) => c.operationTypeId as string);
      if (changeKinds.includes("signal_done")) {
        observedSignalDone = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(observedSignalDone).toBe(true);

    // Drain once more so the supervisor observes its own signal_done change.
    await supervisor.drainFeed();

    // The committed world shows the WORKER as `done` — derived from the real
    // runtime head, the only authority. This is the SS-01 lift assertion: the
    // completing participant (not the supervisor principal / initiator) is the
    // one signal_done transitions.
    const finalHead = runtime.getHead();
    expect(finalHead!.participants.get(worker)!.status).toBe("done");
    // The initiator is NOT done — it was not the completing participant.
    expect(finalHead!.participants.get(initiator)!.status).toBe("active");

    // The feed carries the signal_done change with the WORKER as the `from`
    // binding (signal_done transitions the `from` participant).
    const signalDoneChange = runtime
      .changes()
      .find((c) => c.operationTypeId === operationTypeId("signal_done"));
    expect(signalDoneChange).toBeDefined();
    const fromBinding = signalDoneChange!.matchBindings.find((b) => b.role === "from");
    expect(fromBinding!.actorId).toBe(worker);

    // The live set is empty (the worker was retired from the in-memory set).
    const status = supervisor.getStatus();
    expect(status.agents.get(worker as string)!.heartbeat).toBeUndefined();

    supervisor.stop();
  });

  it("isClusterComplete derives completion from the committed world, not the in-memory live set", async () => {
    const { runtime, contentStore, initiator, worker, manifestRef } = await seedRealCluster();
    const syscallRuntime = wrapCoordinationRuntime(runtime);

    const shared = createSharedResources({
      runtime: syscallRuntime,
      contentStore,
      storagePath: "/tmp/closed-loop-2",
    });
    const supervisor = new ClusterSupervisor({
      shared,
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => immediateDoneLlm(),
      feedDrainIntervalMs: 50,
    });

    supervisor.start();
    commitActivate(runtime, initiator, worker, manifestRef);
    await supervisor.drainFeed();
    // Before completion: the committed world has the initiator active and the
    // worker active → NOT complete.
    let head = runtime.getHead();
    expect([...head!.participants.values()].some((p) => p.status === "active")).toBe(true);

    // Wait for the closed loop to commit signal_done for the worker and drain.
    let deadline = 200;
    while (deadline-- > 0) {
      head = runtime.getHead();
      if (head!.participants.get(worker)!.status === "done") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    await supervisor.drainFeed();

    // After the worker completes: the worker is `done` but the initiator is still
    // `active` → the cluster is NOT yet complete. The live set is empty (the
    // worker retired) but the world still has an active initiator — isClusterComplete
    // must read the real world, not the live set.
    const statuses = [...runtime.getHead()!.participants.values()].map((p) => p.status);
    expect(statuses).toContain("active"); // initiator still active
    expect(statuses).toContain("done"); // worker done

    const completionPromise = supervisor.waitForCompletion();
    // It will not resolve immediately because the initiator is still active.
    await new Promise((r) => setTimeout(r, 60));

    // Now signal the initiator done (it finishes its coordinating role) by
    // committing signal_done for it directly on the real runtime.
    runtime.proposeAndCommit(
      coordinationIntent(actorRef(initiator, "agent"), operationTypeId("signal_done"), [
        matchBinding("from", initiator as string),
      ]),
      { principal: actorRef(initiator, "agent") },
    );
    await supervisor.drainFeed();
    const result = await completionPromise;
    expect(result.ok).toBe(true);
    supervisor.stop();
  });
});
