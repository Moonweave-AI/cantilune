import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFileRuntimePersistence } from "../../../src/memory/fileDurablePersistence.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const repoRoot = join(packageRoot, "..", "..", "..");
const workerScript = join(packageRoot, "tests", "support", "fileInitializeChild.mjs");
const fileLockWorkerScript = join(packageRoot, "tests", "support", "fileLockHoldChild.mjs");
const fileLockModule = join(packageRoot, "dist", "memory", "fileLock.js");

interface WorkerResult {
  readonly candidate: string;
  readonly genesisRef: string;
  readonly active: readonly string[];
}

function initializeInChild(
  dir: string,
  candidate: string,
  barrierPath: string,
): { readonly ready: Promise<void>; readonly completed: Promise<WorkerResult> } {
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const completed = new Promise<WorkerResult>((resolve, reject) => {
    const child = spawn(process.execPath, [workerScript, dir, candidate, barrierPath], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.includes(`READY ${candidate}\n`)) readyResolve();
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      readyReject(error);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        readyReject(new Error(`initializer ${candidate} exited before ready: ${stderr}`));
        reject(new Error(`initializer ${candidate} exit ${String(code)}: ${stderr}`));
        return;
      }
      const resultLine = stdout
        .trim()
        .split(/\r?\n/u)
        .find((line) => line.startsWith("{"));
      if (resultLine === undefined) {
        reject(new Error(`initializer ${candidate} produced no result: ${stdout}`));
        return;
      }
      resolve(JSON.parse(resultLine) as WorkerResult);
    });
  });
  void completed.catch(() => undefined);
  return { ready, completed };
}

function runLockWorker(
  dir: string,
  mode: "hold" | "try",
  label: string,
  readyPath: string,
  releasePath: string,
  eventsPath: string,
  timeoutMs: number,
): Promise<{ readonly code: number; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileLockWorkerScript,
        fileLockModule,
        dir,
        mode,
        label,
        readyPath,
        releasePath,
        eventsPath,
        String(timeoutMs),
      ],
      { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? -1, stderr });
    });
  });
}

async function waitForFile(path: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (existsSync(path)) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`timed out waiting for ${path}`);
}

describe("L7 concurrent first initialization", () => {
  beforeAll(() => {
    const executable = process.platform === "win32" ? "cmd.exe" : "pnpm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "pnpm --filter @cantilune/runtime... build"]
        : ["--filter", "@cantilune/runtime...", "build"];
    execFileSync(executable, args, { cwd: repoRoot, stdio: "ignore" });
  }, 60_000);

  it("returns the disk winner to every concurrent creator", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-runtime-init-"));
    try {
      const barrierPath = join(dir, "start.barrier");
      const workers = [
        initializeInChild(dir, "candidate-a", barrierPath),
        initializeInChild(dir, "candidate-b", barrierPath),
      ];
      await Promise.all(workers.map((worker) => worker.ready));
      writeFileSync(barrierPath, "go", "utf8");
      const results = await Promise.all(workers.map((worker) => worker.completed));
      expect(results).toHaveLength(2);
      expect(new Set(results.map((result) => result.genesisRef)).size).toBe(1);
      expect(new Set(results.map((result) => result.active.join(","))).size).toBe(1);

      const reopened = createFileRuntimePersistence({ dir });
      expect(String(reopened.t0Ref)).toBe(results[0]!.genesisRef);
      const headRef = reopened.durable.head();
      const head = headRef === undefined ? undefined : reopened.durable.get(headRef);
      const active = [...(head?.participants.values() ?? [])]
        .filter((entry) => entry.kind === "agent" && entry.status === "active")
        .map((entry) => String(entry.actorId));
      expect(active).toEqual(results[0]!.active);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("fails closed on a dead record and never overlaps an immediate reacquirer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-runtime-lock-race-"));
    const lockPath = join(dir, ".durable.lock");
    const readyPath = join(dir, "holder.ready");
    const releasePath = join(dir, "holder.release");
    const eventsPath = join(dir, "events.log");
    let holder: Promise<{ readonly code: number; readonly stderr: string }> | undefined;
    try {
      const stale = "2147483646:dead-owner:0";
      writeFileSync(lockPath, stale, "utf8");
      const staleAttempts = await Promise.all([
        runLockWorker(dir, "try", "stale-a", readyPath, releasePath, eventsPath, 150),
        runLockWorker(dir, "try", "stale-b", readyPath, releasePath, eventsPath, 150),
      ]);
      expect(staleAttempts.map((attempt) => attempt.code)).toEqual([2, 2]);
      expect(readFileSync(lockPath, "utf8")).toBe(stale);

      unlinkSync(lockPath);
      holder = runLockWorker(dir, "hold", "holder", readyPath, releasePath, eventsPath, 2_000);
      await waitForFile(readyPath);
      const blocked = await runLockWorker(
        dir,
        "try",
        "contender",
        readyPath,
        releasePath,
        eventsPath,
        150,
      );
      expect(blocked.code).toBe(2);

      writeFileSync(releasePath, "release", "utf8");
      expect((await holder).code).toBe(0);
      const next = await runLockWorker(
        dir,
        "try",
        "next",
        readyPath,
        releasePath,
        eventsPath,
        2_000,
      );
      expect(next.code).toBe(0);
      expect(readFileSync(eventsPath, "utf8").trim().split(/\r?\n/u)).toEqual([
        "enter:holder",
        "exit:holder",
        "enter:next",
        "exit:next",
      ]);
    } finally {
      if (holder !== undefined && !existsSync(releasePath)) {
        writeFileSync(releasePath, "release", "utf8");
      }
      await holder?.catch(() => undefined);
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
