import { describe, expect, it, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../../src/file/fileControlPlaneStore.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const childScript = join(packageRoot, "tests", "support", "casBindingChild.mjs");
const fileLockWorkerScript = join(packageRoot, "tests", "support", "fileLockHoldChild.mjs");
const fileLockModule = join(packageRoot, "dist", "file", "fileLock.js");
const repoRoot = join(packageRoot, "..", "..", "..");

function spawnCasWorker(
  dir: string,
  workerLabel: string,
  expectedGeneration: number,
  domainId: string,
): Promise<{ readonly outcome: "won" | "lost"; readonly exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [childScript, dir, workerLabel, String(expectedGeneration), domainId],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ outcome: "won", exitCode: 0 });
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

describe("L7 OS process control-plane CAS", () => {
  // The children import from dist/, which the `pretest`/`pretest:coverage`
  // hooks guarantee. Building from inside the suite (the previous approach)
  // spawned a nested `pnpm build` that raced the workspace build already in
  // flight during `pnpm test`, so this evidence failed for a reason unrelated
  // to control-plane CAS. Asserting the precondition keeps the failure honest.
  beforeAll(() => {
    if (!existsSync(fileLockModule)) {
      throw new Error(
        `L7 cross-process CAS evidence requires a built package: ${fileLockModule} is missing. ` +
          `Run \`pnpm --filter @cantilune/control-plane... build\` first.`,
      );
    }
  });

  it("allows exactly one child process to win a parallel binding CAS", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-os-cas-"));
    try {
      const harness = buildAdmissionHarness();
      const domainId = harness.genesisBinding.activationDomainId as string;
      const expectedGeneration = harness.genesisBinding.bindingGeneration as number;
      const fileStore = createFileControlPlaneStore(dir, harness.store);
      fileStore.persist();

      const results = await Promise.all([
        spawnCasWorker(dir, "worker-a", expectedGeneration, domainId),
        spawnCasWorker(dir, "worker-b", expectedGeneration, domainId),
      ]);

      const winners = results.filter((result) => result.outcome === "won");
      const losers = results.filter((result) => result.outcome === "lost");
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const reloadedMemory = new MemoryControlPlaneStore();
      const reloaded = createFileControlPlaneStore(dir, reloadedMemory);
      reloaded.recover();
      const active = reloadedMemory.getActiveBinding(harness.genesisBinding.activationDomainId);
      expect(active?.bindingGeneration as number).toBe(expectedGeneration + 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("fails closed on a dead record and never overlaps an immediate reacquirer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-cp-lock-race-"));
    const lockPath = join(dir, ".control-plane.lock");
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
