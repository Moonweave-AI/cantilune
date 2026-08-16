import { describe, expect, it, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sessionId } from "@cantilune/core";
import { MemoryCommsStore } from "../../../src/memory/memoryCommsStore.js";
import { createFileCommsStore } from "../../../src/file/fileCommsStore.js";
import { channelGeneration, channelId, descriptorRef } from "../../../src/foundation/messageId.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const childScript = join(packageRoot, "tests", "support", "casSessionChild.mjs");
const fileLockWorkerScript = join(packageRoot, "tests", "support", "fileLockHoldChild.mjs");
const fileLockModule = join(packageRoot, "dist", "file", "fileLock.js");
const repoRoot = join(packageRoot, "..", "..", "..");

function spawnCasWorker(
  dir: string,
  workerLabel: string,
  sessionKey: string,
  expectedGeneration: number,
): Promise<{ readonly outcome: "won" | "lost" }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [childScript, dir, workerLabel, sessionKey, String(expectedGeneration)],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ outcome: "won" });
        return;
      }
      if (code === 2) {
        resolve({ outcome: "lost" });
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

describe("L7 OS process comms session CAS", () => {
  // dist/ is guaranteed by the `pretest`/`pretest:coverage` hooks. Building
  // from inside the suite spawned a nested `pnpm build` that raced the
  // workspace build already running under `pnpm test`.
  beforeAll(() => {
    if (!existsSync(fileLockModule)) {
      throw new Error(
        `L7 comms session CAS evidence requires a built package: ${fileLockModule} is missing. ` +
          `Run \`pnpm --filter @cantilune/comms... build\` first.`,
      );
    }
  });

  it("allows exactly one child process to win parallel session generation CAS", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-comms-os-cas-"));
    const sid = sessionId("session-os-cas-001");
    try {
      const memory = new MemoryCommsStore();
      memory.casSessionBinding({
        sessionId: sid,
        expectedGeneration: channelGeneration(0),
        next: {
          sessionId: sid,
          authoritativeSnapshotRef: "snap-S0" as never,
          localRuntimeInstanceId: "runtime-a" as never,
          remoteRuntimeInstanceId: "runtime-b" as never,
          channelId: channelId("channel-os-001"),
          channelGeneration: channelGeneration(1),
          localEndpoint: descriptorRef("endpoint-local"),
          remoteEndpoint: descriptorRef("endpoint-remote"),
          negotiated: {
            wireVersion: 1 as never,
            transport: "loopback",
            codecRef: "comms/wire-v1",
            protocolVersion: "comms/1",
            a2aProfile: "a2a/0.1",
            features: [],
          },
          schemaEpochId: "42",
          status: "active",
          outboundSequence: 0,
          inboundSequence: 0,
          establishedAt: "2026-08-11T16:00:00Z",
          updatedAt: "2026-08-11T16:00:00Z",
        },
      });
      const fileStore = createFileCommsStore(dir, memory);
      fileStore.persist();

      const results = await Promise.all([
        spawnCasWorker(dir, "worker-a", sid as string, 1),
        spawnCasWorker(dir, "worker-b", sid as string, 1),
      ]);

      expect(results.filter((r) => r.outcome === "won")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "lost")).toHaveLength(1);

      const reloaded = createFileCommsStore(dir, new MemoryCommsStore());
      reloaded.recover();
      const binding = reloaded.getSessionBinding(sid);
      expect(binding?.channelGeneration as number).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("fails closed on a dead record and never overlaps an immediate reacquirer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-comms-lock-race-"));
    const lockPath = join(dir, ".comms.lock");
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
