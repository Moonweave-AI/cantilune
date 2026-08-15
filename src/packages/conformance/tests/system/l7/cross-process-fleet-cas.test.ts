import { describe, expect, it, beforeAll } from "vitest";
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createFileEvidenceStore } from "../../../src/adapters/file/fileEvidenceStore.js";
import { createFileDecisionLog } from "../../../src/adapters/file/fileDecisionLog.js";
import { canonicalJsonBytes } from "../../../src/canonical/canonicalEncoding.js";
import { computeEvidenceDigest } from "../../../src/canonical/evidenceDigest.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const childScript = join(packageRoot, "tests", "support", "fleetCasChild.mjs");
const fileLockWorkerScript = join(packageRoot, "tests", "support", "fileLockHoldChild.mjs");
const fileLockModule = join(packageRoot, "dist", "adapters", "file", "fileLock.js");
const repoRoot = join(packageRoot, "..", "..", "..");

function spawnFleetWorker(
  dir: string,
  workerLabel: string,
  taskIndex: number,
  raceKey?: string,
): Promise<{
  readonly outcome: "ok" | "lost";
  readonly sequence?: number;
  readonly exitCode: number;
}> {
  const args = [childScript, dir, workerLabel, String(taskIndex)];
  if (raceKey !== undefined) {
    args.push(raceKey);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({
          outcome: "ok",
          sequence: Number(stdout.trim()),
          exitCode: 0,
        });
        return;
      }
      if (code === 2) {
        resolve({ outcome: "lost", exitCode: 2 });
        return;
      }
      reject(new Error(`child ${workerLabel} exit ${code}: ${stderr}`));
    });
  });
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

describe("L7 fleet multi-process durable CAS", () => {
  beforeAll(() => {
    execSync("pnpm build", { cwd: join(packageRoot, "..", "core"), stdio: "ignore" });
    execSync("pnpm build", { cwd: packageRoot, stdio: "ignore" });
  });

  it("parallel fleet workers persist disjoint evidence and monotonic decision log", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-fleet-cas-"));
    try {
      const workers = [
        { label: "worker-a", taskIndex: 1 },
        { label: "worker-b", taskIndex: 2 },
        { label: "worker-c", taskIndex: 3 },
        { label: "worker-d", taskIndex: 4 },
      ];

      const results = await Promise.all(
        workers.map((worker) => spawnFleetWorker(dir, worker.label, worker.taskIndex)),
      );
      expect(results.every((result) => result.outcome === "ok")).toBe(true);

      const sequences = results
        .map((result) => result.sequence)
        .filter((value): value is number => value !== undefined)
        .sort((a, b) => a - b);
      expect(sequences).toEqual([1, 2, 3, 4]);

      const store = createFileEvidenceStore({ dir });
      for (const worker of workers) {
        const payload = {
          workerLabel: worker.label,
          taskIndex: worker.taskIndex,
          content: `evidence-${worker.label}-${worker.taskIndex}`,
        };
        const digest = computeEvidenceDigest(payload) as string;
        expect(await store.has(digest)).toBe(true);
        const got = await store.get(digest);
        expect(got.ok).toBe(true);
        if (got.ok) {
          expect(Buffer.from(got.value).equals(Buffer.from(canonicalJsonBytes(payload)))).toBe(
            true,
          );
        }
      }

      const log = createFileDecisionLog({ dir });
      const all = await log.readAll();
      expect(all.ok).toBe(true);
      if (all.ok) {
        expect(all.value).toHaveLength(4);
        expect(all.value.map((entry) => entry.sequence).sort((a, b) => a - b)).toEqual([
          1, 2, 3, 4,
        ]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("allows exactly one winner when two processes race on the same content digest", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-fleet-race-"));
    const raceKey = "shared-race-key";
    try {
      const results = await Promise.all([
        spawnFleetWorker(dir, "worker-a", 99, raceKey),
        spawnFleetWorker(dir, "worker-b", 99, raceKey),
      ]);

      const winners = results.filter((result) => result.outcome === "ok");
      const losers = results.filter((result) => result.outcome === "lost");
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const payload = { raceKey, content: "shared-evidence" };
      const digest = computeEvidenceDigest(payload) as string;
      const store = createFileEvidenceStore({ dir });
      expect(await store.has(digest)).toBe(true);
      const got = await store.get(digest);
      expect(got.ok).toBe(true);

      const log = createFileDecisionLog({ dir });
      const all = await log.readAll();
      expect(all.ok).toBe(true);
      if (all.ok) {
        expect(all.value).toHaveLength(1);
        expect(all.value[0]?.decisionDigest).toBe(digest);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("fails closed on a dead record and never overlaps an immediate reacquirer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-lock-race-"));
    const lockPath = join(dir, ".conformance.lock");
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
