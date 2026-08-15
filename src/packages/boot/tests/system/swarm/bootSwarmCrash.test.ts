/**
 * L7 system test: cross-process crash-and-restart of a `bootSwarm` (ADR-0019)
 * against a FILE-BACKED durable world. Parallel to `closedLoopSwarmCrash.test.ts`
 * (which drives the raw `ClusterSupervisor`); this variant boots the multi-agent
 * swarm via `bootSwarm`, so the pluggable per-agent `CantilunOS` factory is
 * exercised across a real process kill/restart — not just the raw supervisor.
 *
 * Crash window under test (ADR-0019 §5 / ADR-0015 §4): `bootSwarm` starts the
 * supervisor, the supervisor starts the worker (`startAgent` — which boots a
 * per-agent `CantilunOS` via the pluggable `AgentFactory`), and the agent
 * process is then killed BEFORE `signal_done` commits. On restart a FRESH
 * `bootSwarm` re-reads the durable head; its cursor is past
 * `activate_participant`, so `drainFeed` sees no trigger and never re-starts the
 * worker. The orphaned `active` participant is reconciled already-expired and
 * retired via `retire_participant` (ADR-0015 §5). The world converges to
 * `retired` with NO duplicate `startAgent` / `signal_done`.
 *
 * The no-duplicate property is proved by the shared side-effect log: across the
 * whole kill/restart lifecycle `startAgent` was recorded exactly once (in the
 * crashed process) and ZERO times on restart; `signal_done` was recorded zero
 * times (the crash preceded it).
 *
 * `describeOrSkip` gates the suite on the built dist (the child imports from
 * `dist/`); run `pnpm --filter @cantilune/boot build` first. Same convention as
 * `file-transport-cross-process.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const childScript = join(here, "..", "..", "..", "support", "bootSwarmChild.mjs");
const bootDist = join(here, "..", "..", "..", "..", "dist");
const distBuilt = existsSync(join(bootDist, "swarm", "bootSwarm.js"));

const describeOrSkip = distBuilt ? describe : describe.skip;

function runChild(worldDir: string, mode: string, logFile: string) {
  return spawnSync(process.execPath, [childScript, worldDir, mode, logFile], {
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "" },
    timeout: 30_000,
  });
}

/** Parse the side-effect log the child appends to (one JSON object per line). */
function readLog(logFile: string): Array<Record<string, unknown>> {
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describeOrSkip("L7 — cross-process bootSwarm crash-and-restart (ADR-0019 §5)", () => {
  let dir: string;
  let logFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cantilune-bootswarm-crash-"));
    logFile = join(dir, "events.log");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("the seed run converges the full closed loop to `done` via bootSwarm (clean baseline)", () => {
    const seed = runChild(dir, "seed", logFile);
    expect(seed.status).toBe(0);
    expect(seed.stderr).toBe("");

    const log = readLog(logFile);
    const summary = log.find((l) => l.summary === "seed") as
      { converged: boolean; workerStatus: string } | undefined;
    expect(summary).toBeDefined();
    expect(summary!.converged).toBe(true);
    expect(summary!.workerStatus).toBe("done");
    // Exactly one startAgent (the worker), exactly one activate committed.
    expect(log.filter((l) => l.sideEffect === "startAgent")).toHaveLength(1);
    expect(log.filter((l) => l.sideEffect === "activate_committed")).toHaveLength(1);
    // The clean baseline retires nothing.
    expect(log.filter((l) => l.sideEffect === "retire_participant")).toHaveLength(0);
  });

  it("a crash before signal_done leaves the worker `active`, and a fresh bootSwarm restart converges to `retired` with NO duplicate startAgent/signal_done", () => {
    // Phase 1: crash. bootSwarm starts the worker (one startAgent → per-agent
    // CantilunOS booted via the AgentFactory) and the agent process is killed
    // before signal_done commits.
    const crash = runChild(dir, "crash-pre-done", logFile);
    expect(crash.status).not.toBe(0); // crashed
    const crashLog = readLog(logFile);
    const crashSummary = crashLog.find((l) => l.summary === "crash-pre-done") as
      { workerStatus: string; signalDoneCount: number } | undefined;
    expect(crashSummary).toBeDefined();
    expect(crashSummary!.workerStatus).toBe("active");
    expect(crashSummary!.signalDoneCount).toBe(0);
    // The crash recorded exactly one startAgent (bootSwarm's supervisor did
    // start the worker before the agent process was killed).
    expect(crashLog.filter((l) => l.sideEffect === "startAgent")).toHaveLength(1);
    // No signal_done side effect landed.
    expect(crashLog.filter((l) => l.event === "agent_done")).toHaveLength(0);

    // Phase 2: restart a FRESH bootSwarm process against the same file-backed
    // world. NO seed — the world already exists on disk.
    const restart = runChild(dir, "recover", logFile);
    expect(restart.status).toBe(0);
    expect(restart.stderr).toBe("");

    const fullLog = readLog(logFile);
    const recoverSummary = fullLog.find((l) => l.summary === "recover") as
      { converged: boolean; workerStatus: string; activateCount: number } | undefined;
    expect(recoverSummary).toBeDefined();
    expect(recoverSummary!.converged).toBe(true);
    expect(recoverSummary!.workerStatus).toBe("retired");

    // THE NO-DUPLICATE LIFT ASSERTION:
    //  - startAgent was recorded exactly ONCE across the WHOLE lifecycle (in the
    //    crashed process). The restart recorded ZERO startAgent events — the
    //    durable cursor was past the activate_participant change, so drainFeed
    //    saw no trigger and bootSwarm never re-started the worker.
    //  - signal_done was recorded ZERO times (the crash preceded it; the
    //    restart converged via retire_participant, not signal_done).
    const startAgentCount = fullLog.filter((l) => l.sideEffect === "startAgent").length;
    expect(startAgentCount).toBe(1);
    const agentDoneCount = fullLog.filter((l) => l.event === "agent_done").length;
    expect(agentDoneCount).toBe(0);
    // The restart DID retire the orphaned worker (the §5 convergence path).
    expect(fullLog.some((l) => l.event === "agent_stale")).toBe(true);
  });

  it("a restart with nothing to do (post-done) does not re-process the already-converged world", () => {
    // Run the full clean loop first (worker → done) via bootSwarm.
    const seed = runChild(dir, "seed", logFile);
    expect(seed.status).toBe(0);

    // Restart a fresh bootSwarm process. The cursor is past signal_done; the
    // worker is already `done`. The restart should converge immediately (already
    // done) and record NO additional startAgent or retire.
    const restart = runChild(dir, "recover", logFile);
    expect(restart.status).toBe(0);

    const fullLog = readLog(logFile);
    // Still exactly one startAgent (from seed); none added on restart.
    expect(fullLog.filter((l) => l.sideEffect === "startAgent").length).toBe(1);
    // No retire in the clean baseline (worker finished via signal_done).
    expect(fullLog.filter((l) => l.sideEffect === "retire_participant").length).toBe(0);
  });
});
