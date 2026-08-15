/**
 * Child process entry: drive a `bootSwarm` (ADR-0019) against a FILE-BACKED
 * durable world that survives process death. Parallel to
 * `swarmSupervisorChild.mjs` (which drives the raw `ClusterSupervisor`); this
 * variant boots the multi-agent swarm via `bootSwarm` so the pluggable
 * `CantilunOS`-per-agent factory is exercised across a real crash/restart.
 *
 * Usage:
 *   node bootSwarmChild.mjs <dir> <mode> <outFile>
 *
 * mode:
 *   "seed"        — create the file-backed world (initiator active, worker
 *                   registered, worker manifest in the file content store),
 *                   commit `activate_participant`, start the swarm, and run the
 *                   full closed loop to the worker's `signal_done`. Exit 0.
 *   "crash-pre-done" — seed + commit `activate_participant`, start the swarm,
 *                   drain the feed once (which calls `startAgent` and boots the
 *                   per-agent CantilunOS with a hanging LLM), then exit 1 BEFORE
 *                   the agent's `signal_done` commits.
 *   "recover"     — load the existing file-backed world (NO seed), start a
 *                   FRESH swarm. Its cursor is seeded from the durable head
 *                   (past `activate_participant`), so `drainFeed` sees NO trigger
 *                   and never re-starts the worker. The orphaned `active`
 *                   participant is reconciled already-expired and retired via
 *                   `retire_participant` (ADR-0015 §5). The world converges to
 *                   `retired`. Exit 0.
 *
 * Records every lifecycle event as one JSON line to <outFile>.
 *
 * Requires: pnpm build (core, content, runtime, syscall, boot — imports from dist).
 */
import { appendFileSync } from "node:fs";
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
} from "../../../core/dist/index.js";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  createDefaultConditionRegistry,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
} from "../../../runtime/dist/index.js";
import {
  createFileRuntimePersistence,
  MemoryResourceLockTable,
} from "../../../runtime/dist/memory/index.js";
import { createFileContentStore } from "../../../content/dist/adapters/file/index.js";
import { bootSwarm } from "../../dist/swarm/bootSwarm.js";
import { wrapCoordinationRuntime } from "../../dist/runtimeAdapter.js";
import { BOOT_EPOCH_ID } from "../../dist/index.js";

const dir = process.argv[2];
const mode = process.argv[3];
const outFile = process.argv[4];
if (dir === undefined || mode === undefined || outFile === undefined) {
  console.error("usage: bootSwarmChild.mjs <dir> <mode> <outFile>");
  process.exit(2);
}

const INITIATOR = actorId("initiator");
const WORKER = actorId("worker");
const HEARTBEAT_MS = 5000;

function makeManifest(id) {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "bootSwarm l7 worker",
    assignedTask: "close the loop across a crash via bootSwarm",
    startCondition: ALWAYS_CONDITION,
    heartbeatIntervalMs: HEARTBEAT_MS,
    designedBy: INITIATOR,
  };
}

/** Scripted LLM: immediately calls `done`. */
function immediateDoneLlm() {
  return {
    async chat() {
      return {
        text: undefined,
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "bootSwarm l7 done" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

/** Scripted LLM that NEVER returns `done`: simulates an agent that dies mid-flight. */
function hangingLlm() {
  return {
    async chat() {
      return new Promise(() => {
        // Never resolves.
      });
    },
  };
}

function logLine(obj) {
  appendFileSync(outFile, JSON.stringify(obj) + "\n");
}

function freshIdGen() {
  const r = () => Math.random().toString(36).slice(2);
  return {
    snapshotRef: () => `snap-${r()}`,
    changeId: () => `chg-${r()}`,
    sessionId: () => `session-${r()}`,
    linkId: () => `link-${r()}`,
    artifactId: () => `artifact-${r()}`,
    capabilityId: () => `cap-${r()}`,
    evidenceId: () => `ev-${r()}`,
  };
}

async function seedWorld(dir) {
  const contentStore = createFileContentStore(`${dir}/content`);
  const manifest = makeManifest(WORKER);
  const manifestRef = await contentStore.put(JSON.stringify(manifest));
  const t0 = collaborationSnapshot({
    snapshotRef: snapshotRef("t0"),
    epochId: epochId(BOOT_EPOCH_ID),
    participants: new Map([
      [INITIATOR, participant(INITIATOR, "agent", "active")],
      [WORKER, participant(WORKER, "agent", "registered")],
    ]),
  });
  const persistence = createFileRuntimePersistence({ dir: `${dir}/world`, initial: t0 });
  return { contentStore, manifestRef, persistence };
}

async function loadWorld(dir) {
  const contentStore = createFileContentStore(`${dir}/content`);
  const persistence = createFileRuntimePersistence({ dir: `${dir}/world` });
  return { contentStore, persistence };
}

function makeRuntime(persistence, contentStore) {
  const schema = createDefaultSchema();
  return createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable: persistence.durable,
      clock: { now: () => "2026-08-14T00:00:00Z" },
      idGen: freshIdGen(),
      schema,
      activeEpochId: epochId(BOOT_EPOCH_ID),
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks: new MemoryResourceLockTable(),
      contentRefAuthority: contentStore,
    }),
  );
}

function commitActivate(runtime, manifestRef) {
  runtime.proposeAndCommit(
    coordinationIntent(
      actorRef(INITIATOR, "agent"),
      operationTypeId("activate_participant"),
      [matchBinding("from", INITIATOR), matchBinding("participant", WORKER)],
      undefined,
      [manifestRef],
    ),
    { principal: actorRef(INITIATOR, "agent") },
  );
  logLine({ sideEffect: "activate_committed" });
}

function makeSwarm(dir, runtime, contentStore, llmFactory) {
  const logEventListener = (e) => {
    logLine({ event: e.kind, actor: e.actorId });
    if (e.kind === "agent_started") logLine({ sideEffect: "startAgent", actor: e.actorId });
    if (e.kind === "agent_retired") logLine({ sideEffect: "retire_participant", actor: e.actorId });
  };
  const syscallRuntime = wrapCoordinationRuntime(runtime);
  return bootSwarm({
    runtime: syscallRuntime,
    contentStore,
    storagePath: `${dir}/comms`,
    llmAdapterFactory: llmFactory ?? (() => immediateDoneLlm()),
    conditionRegistry: createDefaultConditionRegistry(),
    feedDrainIntervalMs: 20,
    heartbeatCheckIntervalMs: 20,
    staleThresholdMultiplier: 1,
    livenessGraceFactor: 1,
    eventListener: logEventListener,
  });
}

function workerStatus(runtime) {
  return runtime.getHead()?.participants.get(WORKER)?.status;
}

async function pollUntil(runtime, predicate, deadlineMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return predicate();
}

async function main() {
  if (mode === "seed") {
    const { contentStore, manifestRef } = await seedWorld(dir);
    const persistence = createFileRuntimePersistence({ dir: `${dir}/world` });
    const runtime = makeRuntime(persistence, contentStore);
    const swarm = makeSwarm(dir, runtime, contentStore);
    // Production ordering: start() seeds the cursor from the T0 head FIRST,
    // THEN the activate_participant commit drives the swarm.
    swarm.start();
    commitActivate(runtime, manifestRef);
    const converged = await pollUntil(runtime, () => workerStatus(runtime) === "done", 8000);
    await swarm.shutdown();
    logLine({ summary: "seed", converged, workerStatus: workerStatus(runtime) });
    if (!converged) process.exit(1);
    process.exit(0);
  }

  if (mode === "crash-pre-done") {
    const { contentStore, manifestRef } = await seedWorld(dir);
    const persistence = createFileRuntimePersistence({ dir: `${dir}/world` });
    const runtime = makeRuntime(persistence, contentStore);
    // hangingLlm: the CantilunOS boots and its agent loop never reaches `done`.
    const swarm = makeSwarm(dir, runtime, contentStore, () => hangingLlm());
    swarm.start();
    commitActivate(runtime, manifestRef);
    // Drain: startAgent fires (agent_started logged), the CantilunOS boots and
    // hangs on the LLM. The head has advanced past activate_participant.
    await swarm.supervisor.drainFeed();
    // Give the agent loop a moment to register, then "crash" (exit). The
    // hanging LLM guarantees no signal_done has committed.
    await new Promise((r) => setTimeout(r, 50));
    const sigs = runtime
      .changes()
      .filter((c) => c.operationTypeId === operationTypeId("signal_done")).length;
    logLine({
      summary: "crash-pre-done",
      workerStatus: workerStatus(runtime),
      signalDoneCount: sigs,
    });
    // Exit nonzero = crash. Do NOT call swarm.stop() — the process death is the point.
    process.exit(1);
  }

  if (mode === "recover") {
    const { contentStore } = await loadWorld(dir);
    const persistence = createFileRuntimePersistence({ dir: `${dir}/world` });
    const runtime = makeRuntime(persistence, contentStore);
    // NO commitActivate, NO manual start. The swarm's cursor is seeded from
    // the durable head (past activate_participant), so drainFeed sees no
    // activate change and calls no startAgent. The worker is active with a
    // dead agent process; liveness-expiry retires it.
    const swarm = makeSwarm(dir, runtime, contentStore);
    swarm.start();
    await swarm.supervisor.drainFeed();
    const converged = await pollUntil(
      runtime,
      () => {
        const s = workerStatus(runtime);
        return s === "retired" || s === "done";
      },
      5000,
    );
    await swarm.shutdown();
    const activateCount = runtime
      .changes()
      .filter((c) => c.operationTypeId === operationTypeId("activate_participant")).length;
    logLine({ summary: "recover", converged, workerStatus: workerStatus(runtime), activateCount });
    if (!converged) process.exit(1);
    process.exit(0);
  }

  console.error(`unknown mode: ${mode}`);
  process.exit(2);
}

main().catch((err) => {
  console.error(String(err?.stack ?? err));
  process.exit(1);
});
