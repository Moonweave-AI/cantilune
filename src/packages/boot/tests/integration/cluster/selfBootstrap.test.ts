/**
 * Agent self-bootstrapping: an agent grows the cluster with its own tools.
 *
 * `register_participant` records a participant but launches nothing; ADR-0015
 * moved the launch trigger to `activate_participant`. For a while only the CLI
 * could issue that operation, because it was absent from `DEFAULT_TEMPLATES` —
 * the tool surface the agent loop sees. An agent could therefore design a peer
 * and register it, but never start it, which left the peer-to-peer contract
 * ("any active participant may register and activate others") closed only to
 * external callers.
 *
 * These cases drive the whole chain through the same syscall an agent uses:
 * write the manifest, register the peer, activate it with that ref, and see the
 * supervisor pick it up off the committed feed.
 */
import { describe, expect, it } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  epochId,
  participant,
  serializeManifest,
  snapshotRef,
  ALWAYS_CONDITION,
} from "@cantilune/core";
import type { ActorId, AgentManifest } from "@cantilune/core";
import {
  createCoordinationRuntime,
  createDefaultConditionRegistry,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import { wrapCoordinationRuntime } from "../../../src/runtimeAdapter.js";
import { BOOT_EPOCH_ID, DEFAULT_TEMPLATES, uuidIdGenerator } from "../../../src/bootCantilune.js";
import {
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
} from "../../../src/cluster/index.js";

const INITIATOR = actorId("initiator");
const PEER = actorId("designed-peer");

function manifestFor(agent: ActorId, overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    agentId: agent as string,
    kind: "agent",
    systemPrompt: "designed by a peer",
    assignedTask: "do the delegated work",
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: 60_000,
    designedBy: INITIATOR,
    ...overrides,
  };
}

/** A world with one active initiator; the peer does not exist yet. */
function seedWorld(): {
  runtime: ReturnType<typeof createCoordinationRuntime>;
  contentStore: ReturnType<typeof createMemoryContentStore>;
} {
  const t0 = collaborationSnapshot({
    snapshotRef: snapshotRef("t0"),
    epochId: epochId(BOOT_EPOCH_ID),
    participants: new Map<ActorId, ReturnType<typeof participant>>([
      [INITIATOR, participant(INITIATOR, "agent", "active")],
    ]),
  });
  const persistence = createMemoryRuntimePersistence({ initial: t0 });
  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: { now: () => "2026-08-15T00:00:00Z" },
      idGen: uuidIdGenerator(),
      schema: createDefaultSchema(),
      activeEpochId: epochId(BOOT_EPOCH_ID),
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: new MemoryResourceLockTable(),
      contentRefAuthority: { isAvailable: () => true },
    }),
  );
  return { runtime, contentStore: createMemoryContentStore() };
}

/** The syscall an agent loop is given, bound to the initiator principal. */
function agentSyscall(
  runtime: ReturnType<typeof wrapCoordinationRuntime>,
  contentStore: ReturnType<typeof createMemoryContentStore>,
) {
  return createSyscall({
    runtime,
    contentStore,
    principal: { actorId: INITIATOR as string, kind: "agent" },
    schemaProvider: createStaticSchemaProvider(DEFAULT_TEMPLATES),
  });
}

describe("the agent tool surface exposes the whole growth chain", () => {
  it("offers register_participant and activate_participant together", async () => {
    const { runtime, contentStore } = seedWorld();
    const syscall = agentSyscall(wrapCoordinationRuntime(runtime), contentStore);

    // Registering without being able to activate is the gap this closes: both
    // coordination operations must be on the surface the agent loop sees.
    // (`write_content` is a boot-level built-in tool rather than a coordination
    // operation, so it is not part of this list; the end-to-end case below
    // exercises it.)
    const names = (await syscall.availableActions()).map((action) => action.name);
    expect(names).toContain("register_participant");
    expect(names).toContain("activate_participant");
  });

  it("declares the manifest ref activate_participant requires", async () => {
    const { runtime, contentStore } = seedWorld();
    const syscall = agentSyscall(wrapCoordinationRuntime(runtime), contentStore);

    const activate = (await syscall.availableActions()).find(
      (action) => action.name === "activate_participant",
    );
    expect(activate).toBeDefined();
    expect(JSON.stringify(activate?.parameters)).toContain("manifestRef");
  });
});

describe("an agent grows the cluster end to end", () => {
  it("writes a manifest, registers a peer, activates it, and the supervisor starts it", async () => {
    const { runtime, contentStore } = seedWorld();
    const syscallRuntime = wrapCoordinationRuntime(runtime);
    const syscall = agentSyscall(syscallRuntime, contentStore);

    const events: ClusterEvent[] = [];
    const started: string[] = [];
    const supervisor = new ClusterSupervisor({
      shared: createSharedResources({
        runtime: syscallRuntime,
        contentStore,
        storagePath: "/tmp/self-bootstrap",
      }),
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: undefined, toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (event) => events.push(event),
      agentFactory: {
        create(agentId) {
          started.push(agentId as string);
          return {
            isRunning: false,
            start: async () => ({ ok: true, summary: "done", turns: 1 }) as never,
            abort() {},
          };
        },
      },
    });

    // Start first so the cursor precedes the changes the agent is about to make.
    supervisor.start();

    // Step 1: the agent authors the peer's manifest.
    const manifestRef = await syscall.writeContent(serializeManifest(manifestFor(PEER)));

    // Step 2: record the peer.
    const registered = await syscall.act({
      operation: "register_participant",
      args: { from: INITIATOR as string, participant: PEER as string },
    });
    expect(registered.ok).toBe(true);

    // Step 3: admit it, binding the manifest.
    const activated = await syscall.act({
      operation: "activate_participant",
      args: { from: INITIATOR as string, participant: PEER as string, manifestRef },
    });
    expect(activated.ok).toBe(true);

    await supervisor.drainFeed();

    expect(started).toEqual([PEER as string]);
    expect(events.map((e) => e.kind)).toContain("agent_queued");
    supervisor.stop();
  });

  it("rejects activation of a participant that was never registered", async () => {
    const { runtime, contentStore } = seedWorld();
    const syscall = agentSyscall(wrapCoordinationRuntime(runtime), contentStore);
    const manifestRef = await syscall.writeContent(serializeManifest(manifestFor(PEER)));

    const result = await syscall.act({
      operation: "activate_participant",
      args: { from: INITIATOR as string, participant: PEER as string, manifestRef },
    });
    expect(result.ok).toBe(false);
  });
});

describe("an unresolvable manifest converges instead of hanging", () => {
  /**
   * A manifest naming a different agent cannot launch: `resolveManifest`
   * verifies `agentId` against the participant. Before this path existed the
   * participant sat `active` with no agent, no queue entry, and no liveness
   * entry — so neither the stall detector (which needs something pending) nor
   * the liveness tick (which needs an entry) could ever fire, and the swarm
   * hung with no diagnosis.
   */
  it("reports the failure and seeds retirement through the liveness path", async () => {
    const { runtime, contentStore } = seedWorld();
    const syscallRuntime = wrapCoordinationRuntime(runtime);
    const syscall = agentSyscall(syscallRuntime, contentStore);

    const events: ClusterEvent[] = [];
    const supervisor = new ClusterSupervisor({
      shared: createSharedResources({
        runtime: syscallRuntime,
        contentStore,
        storagePath: "/tmp/self-bootstrap-bad",
      }),
      conditionRegistry: createDefaultConditionRegistry(),
      llmAdapterFactory: () => ({
        async chat() {
          return { text: undefined, toolCalls: [], finishReason: "stop" as const };
        },
      }),
      eventListener: (event) => events.push(event),
    });
    supervisor.start();

    // The manifest names someone else, so it can never launch this participant.
    const wrongRef = await syscall.writeContent(
      serializeManifest(manifestFor(actorId("someone-else"))),
    );
    await syscall.act({
      operation: "register_participant",
      args: { from: INITIATOR as string, participant: PEER as string },
    });
    await syscall.act({
      operation: "activate_participant",
      args: { from: INITIATOR as string, participant: PEER as string, manifestRef: wrongRef },
    });
    await supervisor.drainFeed();

    const unresolved = events.find((e) => e.kind === "manifest_unresolved");
    expect(unresolved).toBeDefined();
    expect(supervisor.getSchedulerSnapshot().pending).toHaveLength(0);

    // The liveness entry is seeded already-expired, so the first staleness tick
    // retires the participant rather than leaving it active forever.
    const internals = supervisor as unknown as { checkStaleAgents(): void };
    internals.checkStaleAgents();
    expect(events.some((e) => e.kind === "agent_stale")).toBe(true);
    supervisor.stop();
  });
});
