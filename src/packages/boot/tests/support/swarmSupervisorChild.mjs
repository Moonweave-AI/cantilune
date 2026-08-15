/**
 * Child process entry: drive a production swarm (ADR-0015) against a FILE-BACKED
 * durable world that survives process death. The parent test kills this child
 * mid-lifecycle and restarts a fresh child against the SAME directory; the
 * durable bundle carries the committed head cursor, so the restart resumes
 * without duplicating `startAgent` or `signal_done`. This is the SS-01 L7
 * cross-process crash variant (ADR-0015 §7 step 7).
 *
 * Usage:
 *   node swarmSupervisorChild.mjs <dir> <mode> <outFile>
 *
 * mode:
 *   "seed"        — create the file-backed world (initiator active, worker
 *                   registered, worker manifest in the file content store),
 *                   commit `activate_participant`, start the supervisor, and
 *                   run the full closed loop to the worker's `signal_done`.
 *                   Exit 0. The side-effect log records one `startAgent` and
 *                   one `signal_done` (the clean baseline).
 *   "crash-pre-done" — seed + commit `activate_participant`, start the
 *                   supervisor, drain the feed once (which calls `startAgent`
 *                   and starts the real agent loop), then exit 1 BEFORE the
 *                   agent's `signal_done` has committed. The durable head has
 *                   advanced past `activate_participant` only.
 *   "recover"     — load the existing file-backed world (NO seed), start a
 *                   FRESH supervisor. Its cursor is seeded from the durable
 *                   head, which is past `activate_participant`, so `drainFeed`
 *                   sees NO `activate_participant` change → no `startAgent` from
 *                   the feed. The worker is still `active` (the in-flight agent
 *                   died with the crashed process). The supervisor does NOT
 *                   re-start it (the feed carries no trigger); instead the
 *                   liveness-expiry path (ADR-0015 §5) retires the silent
 *                   worker via `retire_participant`. The world converges to
 *                   `retired`. Exit 0. The side-effect log records NO
 *                   `startAgent` on recovery and one `retire_participant`.
 *
 * The parent test asserts across the WHOLE lifecycle:
 *  - the crashed run recorded exactly one `startAgent` (the seed drain), and
 *  - the recovery run recorded ZERO `startAgent` and the worker converged
 *    (the no-duplicate property — the cursor protected the restart).
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
import {
  ClusterSupervisor,
  createSharedResources,
} from "../../dist/cluster/index.js";
import { wrapCoordinationRuntime } from "../../dist/runtimeAdapter.js";
import { BOOT_EPOCH_ID } from "../../dist/index.js";

const dir = process.argv[2];
const mode = process.argv[3];
const outFile = process.argv[4];
if (dir === undefined || mode === undefined || outFile === undefined) {
  console.error("usage: swarmSupervisorChild.mjs <dir> <mode> <outFile>");
  process.exit(2);
}

const INITIATOR = actorId("initiator");
const WORKER = actorId("worker");

// A realistic heartbeat for the running agent: long enough that the scripted
// agent loop (no real LLM call) completes well inside the grace window, so a
// healthy worker is NEVER retired by the stale detector — it finishes via
// `signal_done`. The recovery path does NOT rely on this interval being
// short: `reconcileLivenessFromWorld` seeds the orphan already-expired
// (`lastHeartbeatTime = now - threshold - 1`), so it converges on the FIRST
// staleness tick regardless of the interval.
const HEARTBEAT_MS = 5000;

function makeManifest(id) {
  return {
    agentId: id,
    kind: "agent",
    systemPrompt: "l7 worker",
    assignedTask: "close the loop across a crash",
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
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "l7 done" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

/**
 * Scripted LLM that NEVER returns `done`: its `chat` promise hangs forever. Used
 * by the crash-pre-done mode to simulate an agent process that dies mid-flight
 * (ADR-0015 §4: "if the agent process is gone, the liveness-expiry path (§5)
 * retires it"). The supervisor calls `startAgent` (recorded as `agent_started`),
 * the agent loop awaits the LLM forever, the process is killed before any
 * `signal_done` commits. On restart the worker is still `active` with no running
 * agent — exactly the orphan case the reconciliation + expiry path resolves.
 */
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
  // Deterministic-enough ids; collisions across processes are tolerable because
  // the durable bundle dedups by snapshot ref and the changelog is append-only
  // per process. Math.random is fine here (this is a test child, not the model
  // environment).
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

function makeSupervisor(dir, runtime, contentStore, listener, llmFactory) {
  const logEventListener = (e) => {
    logLine({ event: e.kind, actor: e.actorId });
    if (e.kind === "agent_started") logLine({ sideEffect: "startAgent", actor: e.actorId });
    if (e.kind === "agent_retired") logLine({ sideEffect: "retire_participant", actor: e.actorId });
  };
  const syscallRuntime = wrapCoordinationRuntime(runtime);
  const shared = createSharedResources({
    runtime: syscallRuntime,
    contentStore,
    storagePath: `${dir}/comms`,
    eventListener: logEventListener,
  });
  return new ClusterSupervisor({
    shared,
    conditionRegistry: createDefaultConditionRegistry(),
    llmAdapterFactory: llmFactory ?? (() => immediateDoneLlm()),
    feedDrainIntervalMs: 20,
    heartbeatCheckIntervalMs: 20,
    staleThresholdMultiplier: 1,
    livenessGraceFactor: 1,
    eventListener: listener ?? logEventListener,
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
    const supervisor = makeSupervisor(dir, runtime, contentStore);
    // Production ordering (ADR-0015 §7): start() seeds the cursor from the
    // T0 head FIRST, THEN the activate_participant commit drives the swarm.
    // If activate committed before start(), the cursor would land past it
    // and drainFeed would never see the activate change.
    supervisor.start();
    commitActivate(runtime, manifestRef);
    const converged = await pollUntil(
      runtime,
      () => workerStatus(runtime) === "done",
      8000,
    );
    supervisor.stop();
    logLine({ summary: "seed", converged, workerStatus: workerStatus(runtime) });
    if (!converged) process.exit(1);
    process.exit(0);
  }

  if (mode === "crash-pre-done") {
    const { contentStore, manifestRef } = await seedWorld(dir);
    const persistence = createFileRuntimePersistence({ dir: `${dir}/world` });
    const runtime = makeRuntime(persistence, contentStore);
    // hangingLlm: the agent loop starts but never reaches `done` — the agent
    // process is then killed (we exit 1), simulating a mid-flight process death
    // before `signal_done` commits (ADR-0015 §4 orphan case).
    const supervisor = makeSupervisor(dir, runtime, contentStore, undefined, () => hangingLlm());
    supervisor.start();
    // Commit AFTER start() so the cursor is at T0 and drainFeed sees the
    // activate change (mirrors seed ordering).
    commitActivate(runtime, manifestRef);
    // Drain: startAgent fires (agent_started logged), the agent loop begins
    // and hangs on the LLM. The head has advanced past activate_participant.
    await supervisor.drainFeed();
    // Give the agent loop a moment to register, then "crash" (exit). The
    // hanging LLM guarantees no signal_done has committed.
    await new Promise((r) => setTimeout(r, 50));
    const sigs = runtime
      .changes()
      .filter((c) => c.operationTypeId === operationTypeId("signal_done")).length;
    logLine({ summary: "crash-pre-done", workerStatus: workerStatus(runtime), signalDoneCount: sigs });
    // Exit nonzero = crash. Do NOT call supervisor.stop() — a crash leaves the
    // timers running; the process death is the point.
    process.exit(1);
  }

  if (mode === "recover") {
    const { contentStore } = await loadWorld(dir);
    const persistence = createFileRuntimePersistence({ dir: `${dir}/world` });
    const runtime = makeRuntime(persistence, contentStore);
    // NO commitActivate, NO manual start. The supervisor's cursor is seeded
    // from the durable head (past activate_participant), so drainFeed sees no
    // activate change and calls no startAgent. The worker is active with a
    // dead agent process; liveness-expiry retires it.
    const supervisor = makeSupervisor(dir, runtime, contentStore);
    supervisor.start();
    // Drain any residual feed (there should be nothing past the cursor).
    await supervisor.drainFeed();
    const converged = await pollUntil(
      runtime,
      () => {
        const s = workerStatus(runtime);
        return s === "retired" || s === "done";
      },
      5000,
    );
    supervisor.stop();
    const startAgentCalls = runtime
      .changes()
      .filter((c) => c.operationTypeId === operationTypeId("activate_participant")).length;
    logLine({ summary: "recover", converged, workerStatus: workerStatus(runtime), activateCount: startAgentCalls });
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
