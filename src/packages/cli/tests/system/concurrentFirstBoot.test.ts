import { describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actorId } from "@cantilune/core";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";
import { parseConfig } from "../../src/config.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = join(packageRoot, "..", "..", "..");
const workerScript = join(packageRoot, "tests", "support", "concurrentFirstBootChild.mjs");

interface WorkerResult {
  readonly candidate: string;
  readonly principalId: string | null;
  readonly genesisRef: string | null;
  readonly activeAgents: readonly string[];
  readonly openedRuntime: boolean;
  readonly lostConfigRace: boolean;
  readonly rejected: boolean;
}

interface RunningWorker {
  readonly child: ChildProcessWithoutNullStreams;
  readonly ready: Promise<void>;
  readonly completed: Promise<WorkerResult>;
}

function startWorker(
  configPath: string,
  storagePath: string,
  candidate: string,
  barrierPath: string,
  identityMode: "generated" | "explicit" = "generated",
): RunningWorker {
  const child = spawn(
    process.execPath,
    [workerScript, configPath, storagePath, candidate, barrierPath, identityMode],
    {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let completedResolve!: (value: WorkerResult) => void;
  let completedReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const completed = new Promise<WorkerResult>((resolve, reject) => {
    completedResolve = resolve;
    completedReject = reject;
  });
  // The READY barrier is awaited before completion. Attach a rejection handler
  // immediately so a child that dies early cannot become an unhandled promise
  // while the parent is still resolving the other worker's READY state.
  void completed.catch(() => undefined);
  let announcedReady = false;

  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    if (!announcedReady && stdout.includes(`READY ${candidate}\n`)) {
      announcedReady = true;
      readyResolve();
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  child.on("error", (error) => {
    readyReject(error);
    completedReject(error);
  });
  child.on("exit", (code) => {
    if (!announcedReady) {
      readyReject(
        new Error(`worker ${candidate} exited before READY (${String(code)}): ${stderr}`),
      );
    }
    if (code !== 0) {
      completedReject(new Error(`worker ${candidate} exit ${String(code)}: ${stderr}`));
      return;
    }
    const resultLine = stdout
      .trim()
      .split(/\r?\n/u)
      .find((line) => line.startsWith("{"));
    if (resultLine === undefined) {
      completedReject(new Error(`worker ${candidate} produced no result: ${stdout}`));
      return;
    }
    completedResolve(JSON.parse(resultLine) as WorkerResult);
  });

  return { child, ready, completed };
}

describe("concurrent CLI first boot", () => {
  it("converges two real processes on one durable genesis and principal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-concurrent-first-boot-"));
    const storagePath = join(dir, "world");
    const configPath = join(dir, "config.json");
    const barrierPath = join(dir, "start.barrier");
    const candidates = ["candidate-a", "candidate-b"] as const;
    const workers = candidates.map((candidate) =>
      startWorker(configPath, storagePath, candidate, barrierPath),
    );

    try {
      await Promise.all(workers.map((worker) => worker.ready));
      writeFileSync(barrierPath, "go", "utf8");
      const results = await Promise.all(workers.map((worker) => worker.completed));

      expect(results).toHaveLength(2);
      expect(results.map((result) => result.candidate).sort()).toEqual([...candidates].sort());
      expect(results.every((result) => result.openedRuntime)).toBe(true);
      expect(results.every((result) => !result.rejected)).toBe(true);
      expect(results.filter((result) => result.lostConfigRace).length).toBeLessThanOrEqual(1);
      expect(new Set(results.map((result) => result.principalId)).size).toBe(1);
      expect(new Set(results.map((result) => result.genesisRef)).size).toBe(1);
      const winner = results[0]!.principalId!;
      expect(winner).toMatch(/^cli-[0-9a-f]{8}$/u);
      expect(results.every((result) => result.activeAgents.join(",") === winner)).toBe(true);

      const finalConfig = parseConfig(JSON.parse(readFileSync(configPath, "utf8")) as unknown);
      expect(finalConfig.principalId).toBe(winner);
      const persistence = createFileRuntimePersistence({ dir: join(storagePath, "runtime") });
      const headRef = persistence.durable.head();
      const head = headRef === undefined ? undefined : persistence.durable.get(headRef);
      const activeAgents = [...(head?.participants.values() ?? [])].filter(
        (entry) => entry.kind === "agent" && entry.status === "active",
      );
      expect(activeAgents).toHaveLength(1);
      expect(activeAgents[0]?.actorId).toBe(actorId(winner));
      expect(String(persistence.t0Ref)).toBe(results[0]!.genesisRef);
    } finally {
      for (const worker of workers) {
        if (worker.child.exitCode === null) worker.child.kill();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects rather than silently adopting a different explicit first-boot principal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-explicit-first-boot-"));
    const storagePath = join(dir, "world");
    const configPath = join(dir, "config.json");
    const barrierPath = join(dir, "start.barrier");
    const candidates = ["explicit-a", "explicit-b"] as const;
    const workers = candidates.map((candidate) =>
      startWorker(configPath, storagePath, candidate, barrierPath, "explicit"),
    );

    try {
      await Promise.all(workers.map((worker) => worker.ready));
      writeFileSync(barrierPath, "go", "utf8");
      const results = await Promise.all(workers.map((worker) => worker.completed));

      const winners = results.filter((result) => result.openedRuntime && !result.rejected);
      const losers = results.filter((result) => result.rejected);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(winners[0]?.principalId).toBe(winners[0]?.candidate);
      expect(losers[0]?.principalId).toBeNull();

      const finalConfig = parseConfig(JSON.parse(readFileSync(configPath, "utf8")) as unknown);
      expect(finalConfig.principalId).toBe(winners[0]?.candidate);
      const persistence = createFileRuntimePersistence({ dir: join(storagePath, "runtime") });
      const headRef = persistence.durable.head();
      const head = headRef === undefined ? undefined : persistence.durable.get(headRef);
      const activeAgents = [...(head?.participants.values() ?? [])].filter(
        (entry) => entry.kind === "agent" && entry.status === "active",
      );
      expect(activeAgents.map((entry) => String(entry.actorId))).toEqual([winners[0]?.candidate]);
    } finally {
      for (const worker of workers) {
        if (worker.child.exitCode === null) worker.child.kill();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
