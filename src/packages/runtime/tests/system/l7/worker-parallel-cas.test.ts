import { describe, expect, it, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { runtimeDependenciesWithStaticSchema } from "../../../src/engine/runtimeDependenciesCompat.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { createFileRuntimePersistence } from "../../../src/memory/fileDurablePersistence.js";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { buildRuntimeLargeWorld } from "../../support/scenario/largeWorld.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { allowAllPolicyEvaluator } from "../../support/testPolicy.js";
import { introduceIntent, proposeAndCommitOrThrow } from "../../support/scenario/scenarioRunner.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const childScript = join(packageRoot, "tests", "support", "fileCommitChild.mjs");
const repoRoot = join(packageRoot, "..", "..", "..");

function spawnCommit(dir: string, taskIndex: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [childScript, dir, String(taskIndex)], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`child ${taskIndex} exit ${code}: ${stderr}`));
    });
  });
}

describe("L7 worker parallel CAS", () => {
  // The children import from dist/, which the `pretest`/`pretest:coverage`
  // hooks guarantee. Building from inside the suite spawned a nested
  // `pnpm build` that raced the workspace build already running under
  // `pnpm test`, so this evidence timed out for reasons unrelated to CAS.
  beforeAll(() => {
    const distEntry = join(packageRoot, "dist", "index.js");
    if (!existsSync(distEntry)) {
      throw new Error(
        `L7 parallel CAS evidence requires a built package: ${distEntry} is missing. ` +
          `Run \`pnpm --filter @cantilune/runtime... build\` first.`,
      );
    }
  });

  it("parallel child processes commit disjoint tasks through file durable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-worker-cas-"));
    try {
      const world = buildRuntimeLargeWorld(8);
      const persistence = createFileRuntimePersistence({ dir, initial: world });

      const seed = createCoordinationRuntime(
        runtimeDependenciesWithStaticSchema({
          durable: persistence.durable,
          clock: createFixedClock(),
          idGen: createDeterministicIdGenerator({
            snapshotRefs: ["snap-seed"],
            changeIds: ["chg-seed"],
          }),
          schema: createDefaultSchema(),
          activeEpochId: world.epochId,
          policy: allowAllPolicyEvaluator(),
          handlers: createDefaultHandlers(),
          locks: persistence.locks,
          contentRefAuthority: { isAvailable: () => true },
        }),
      );
      proposeAndCommitOrThrow(seed, introduceIntent(0));

      const tasks = [101, 102, 103, 104];
      await Promise.all(tasks.map((taskIndex) => spawnCommit(dir, taskIndex)));

      const loaded = createFileRuntimePersistence({ dir, initial: world });
      expect(loaded.changelog.all()).toHaveLength(1 + tasks.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
