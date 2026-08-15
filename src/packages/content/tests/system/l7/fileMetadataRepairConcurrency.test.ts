import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentMetadata } from "../../../src/contentStore.js";
import { createFileContentStore } from "../../../src/adapters/file/index.js";
import { extractHex } from "../../../src/contentHasher.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const repoRoot = join(packageRoot, "..", "..", "..");
const workerScript = join(packageRoot, "tests", "support", "fileMetadataRepairChild.mjs");

interface WorkerResult {
  readonly candidate: string;
  readonly ref: string;
  readonly metadata: ContentMetadata;
}

interface RunningWorker {
  readonly child: ChildProcessWithoutNullStreams;
  readonly ready: Promise<void>;
  readonly completed: Promise<WorkerResult>;
}

function startWorker(
  rootDir: string,
  body: string,
  candidate: string,
  mimeType: string,
  barrierPath: string,
): RunningWorker {
  const child = spawn(
    process.execPath,
    [workerScript, rootDir, body, candidate, mimeType, barrierPath],
    { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const completed = new Promise<WorkerResult>((resolve, reject) => {
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
        readyReject(new Error(`metadata repairer ${candidate} exited before ready: ${stderr}`));
        reject(new Error(`metadata repairer ${candidate} exit ${String(code)}: ${stderr}`));
        return;
      }
      const resultLine = stdout
        .trim()
        .split(/\r?\n/u)
        .find((line) => line.startsWith("{"));
      if (resultLine === undefined) {
        reject(new Error(`metadata repairer ${candidate} produced no result: ${stdout}`));
        return;
      }
      resolve(JSON.parse(resultLine) as WorkerResult);
    });
  });
  void completed.catch(() => undefined);
  return { child, ready, completed };
}

describe("L7 cross-process metadata repair", () => {
  beforeAll(() => {
    const executable = process.platform === "win32" ? "cmd.exe" : "pnpm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "pnpm --filter @cantilune/content... build"]
        : ["--filter", "@cantilune/content...", "build"];
    execFileSync(executable, args, { cwd: repoRoot, stdio: "ignore" });
  }, 60_000);

  it("elects one provenance winner and never overwrites it", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "cantilune-content-repair-"));
    const body = "cross-process-metadata-repair";
    const store = createFileContentStore(rootDir);
    const ref = await store.put(body, { createdBy: "legacy", mimeType: "text/legacy" });
    const hex = extractHex(ref)!;
    const prefixDir = join(rootDir, hex.slice(0, 2));
    const metaPath = join(prefixDir, `${hex}.meta.json`);
    const barrierPath = join(rootDir, "repair.barrier");
    const workers = [
      startWorker(rootDir, body, "repair-a", "application/repair-a", barrierPath),
      startWorker(rootDir, body, "repair-b", "application/repair-b", barrierPath),
    ];

    try {
      // Reproduce the unreadable target left by the former empty-file
      // publication protocol, then release two real processes together.
      writeFileSync(metaPath, "", "utf8");
      await Promise.all(workers.map((worker) => worker.ready));
      writeFileSync(barrierPath, "go", "utf8");
      const results = await Promise.all(workers.map((worker) => worker.completed));
      const finalMetadata = await store.metadata(ref);

      expect(results.map((result) => result.ref)).toEqual([String(ref), String(ref)]);
      expect(
        results.every(
          (result) => JSON.stringify(result.metadata) === JSON.stringify(finalMetadata),
        ),
      ).toBe(true);
      expect(finalMetadata?.createdBy).toMatch(/^repair-[ab]$/u);
      expect(finalMetadata?.mimeType).toBe(`application/${finalMetadata?.createdBy}`);
      expect(store.isAvailable(ref)).toBe(true);
      expect(readFileSync(metaPath, "utf8").length).toBeGreaterThan(0);
      expect(readdirSync(prefixDir)).not.toContain(`${hex}.meta.json.repair.claim`);

      const established = { ...finalMetadata };
      await store.put(body, { createdBy: "late-writer", mimeType: "application/late" });
      expect(await store.metadata(ref)).toEqual(established);
    } finally {
      for (const worker of workers) {
        if (worker.child.exitCode === null) worker.child.kill();
      }
      rmSync(rootDir, { recursive: true, force: true });
    }
  }, 30_000);
});
