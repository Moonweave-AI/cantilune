/**
 * L6 system test: real-runtime closed-loop swarm lifecycle through `bootSwarm`
 * (ADR-0019 §3), parallel to `closedLoopSwarm.test.ts` which drives the raw
 * `ClusterSupervisor`.
 *
 * The closed-loop property under test is that `bootSwarm`'s pluggable
 * `CantilunOS`-per-agent factory reuses the full single-Agent boot stack: an
 * `activate_participant` change on the real commit feed drives `startAgent`,
 * the per-agent `CantilunOS.run` (scripted `done` LLM) completes, `onAgentComplete`
 * commits `signal_done` on the real feed, and the committed world shows the
 * worker `done`. No mock signal injection; the runtime is the sole mutator.
 *
 * Production ordering: `swarm.start()` seeds the supervisor cursor from the t0
 * head; THEN `activate_participant` commits drive the swarm. The supervisor
 * only observes changes committed *after* its cursor.
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
import type { ActorId, AgentManifest, ContentRef } from "@cantilune/core";
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
import { bootSwarm } from "../../../src/swarm/bootSwarm.js";
import type { LlmAdapter, LlmChatResponse } from "../../../src/types.js";
import { BOOT_EPOCH_ID } from "../../../src/index.js";

/** Scripted LLM: immediately calls `done`, so the real agent loop resolves fast. */
function immediateDoneLlm(): LlmAdapter {
  return {
    async chat(): Promise<LlmChatResponse> {
      return {
        text: undefined,
        toolCalls: [
          { id: "d", name: "done", arguments: { summary: "bootSwarm closed-loop done" } },
        ],
        finishReason: "tool_calls",
      };
    },
  };
}

function makeManifest(id: ActorId): AgentManifest {
  return {
    agentId: id as string,
    kind: "agent",
    systemPrompt: "bootSwarm worker",
    assignedTask: "close the loop via bootSwarm",
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: actorId("initiator"),
  };
}

async function seedRealCluster(): Promise<{
  runtime: ReturnType<typeof createCoordinationRuntime>;
  contentStore: ReturnType<typeof createMemoryContentStore>;
  initiator: ActorId;
  worker: ActorId;
  manifestRef: ContentRef;
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

  return { runtime, contentStore, initiator, worker, manifestRef };
}

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

describe("L6 — bootSwarm closed loop (ADR-0019 §3)", () => {
  it("bootSwarm drives activate → CantilunOS.run → signal_done → done through the real feed", async () => {
    const { runtime, contentStore, initiator, worker, manifestRef } = await seedRealCluster();
    const syscallRuntime = wrapCoordinationRuntime(runtime);

    const swarm = bootSwarm({
      runtime: syscallRuntime,
      contentStore,
      storagePath: "/tmp/bootswarm-closed-loop",
      llmAdapterFactory: () => immediateDoneLlm(),
      conditionRegistry: createDefaultConditionRegistry(),
      feedDrainIntervalMs: 50,
      heartbeatCheckIntervalMs: 60_000,
    });

    // Production ordering: start() seeds the cursor from the t0 head FIRST,
    // then the activate_participant commit drives the swarm.
    swarm.start();
    commitActivate(runtime, initiator, worker, manifestRef);

    // Drain the activate_participant change → the supervisor resolves the
    // manifest and starts the agent, which builds a CantilunOS (via the
    // agentFactory) for the worker. The scripted LLM calls `done` immediately.
    await swarm.supervisor.drainFeed();

    // Poll until onAgentComplete has committed signal_done on the real feed.
    let observedSignalDone = false;
    let deadline = 300;
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
    await swarm.supervisor.drainFeed();

    // The committed world shows the worker as `done` — derived from the real
    // runtime head, the only authority.
    const finalHead = runtime.getHead();
    expect(finalHead!.participants.get(worker)!.status).toBe("done");
    // The initiator is NOT done — it was not the completing participant.
    expect(finalHead!.participants.get(initiator)!.status).toBe("active");

    await swarm.shutdown();
  });

  it("stop() aborts in-flight CantilunOS agents and halts the swarm without completing the loop", async () => {
    const { runtime, contentStore, initiator, worker, manifestRef } = await seedRealCluster();
    const syscallRuntime = wrapCoordinationRuntime(runtime);

    // A hanging LLM keeps the agent loop alive so stop() aborts a live agent.
    const hangingLlm: LlmAdapter = {
      async chat(): Promise<LlmChatResponse> {
        return new Promise(() => {
          // Never resolves — the agent loop stays mid-turn.
        });
      },
    };

    const swarm = bootSwarm({
      runtime: syscallRuntime,
      contentStore,
      storagePath: "/tmp/bootswarm-stop",
      llmAdapterFactory: () => hangingLlm,
      conditionRegistry: createDefaultConditionRegistry(),
      feedDrainIntervalMs: 50,
      heartbeatCheckIntervalMs: 60_000,
    });

    swarm.start();
    commitActivate(runtime, initiator, worker, manifestRef);
    await swarm.supervisor.drainFeed();

    // Governed E-Stop: stop() cancels timers + aborts the in-flight CantilunOS.
    swarm.stop();

    // No signal_done committed (the agent was aborted before completing).
    const signalDone = runtime
      .changes()
      .some((c) => c.operationTypeId === operationTypeId("signal_done"));
    expect(signalDone).toBe(false);

    await swarm.shutdown();
  });
});
