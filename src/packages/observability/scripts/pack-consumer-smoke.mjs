#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const observabilityRoot = join(scriptDir, "..");
const monorepoRoot = join(observabilityRoot, "..", "..", "..");
const coreRoot = join(monorepoRoot, "src", "packages", "core");
const packDir = mkdtempSync(join(tmpdir(), "cantilune-obs-pack-"));
const consumerDir = mkdtempSync(join(tmpdir(), "cantilune-obs-consumer-"));

function run(command, cwd) {
  execSync(command, { cwd, stdio: "inherit" });
}

function findPack(prefix) {
  const match = readdirSync(packDir).find((name) => name.startsWith(prefix) && name.endsWith(".tgz"));
  if (match === undefined) {
    throw new Error(`missing pack file with prefix ${prefix} in ${packDir}`);
  }
  return match;
}

try {
  run("pnpm build", coreRoot);
  run("pnpm build", observabilityRoot);

  run(`pnpm pack --pack-destination "${packDir}"`, coreRoot);
  run(`pnpm pack --pack-destination "${packDir}"`, observabilityRoot);

  const coreTgz = findPack("cantilune-core-");
  const observabilityTgz = findPack("cantilune-observability-");

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "observability-pack-consumer-smoke",
        private: true,
        type: "module",
        dependencies: {
          "@cantilune/core": `file:${join(packDir, coreTgz).replaceAll("\\", "/")}`,
          "@cantilune/observability": `file:${join(packDir, observabilityTgz).replaceAll("\\", "/")}`,
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDir, "smoke.mjs"),
    `import {
  createObservationIndex,
  CrossViewInvariants,
} from "@cantilune/observability";
import {
  collaborationSnapshot,
  epochId,
  emptyRunHistory,
  snapshotRef,
  validateRunHistory,
} from "@cantilune/core";

const index = createObservationIndex();
const snapshot = collaborationSnapshot({
  snapshotRef: snapshotRef("snap-S0"),
  epochId: epochId("42"),
});
const bundle = index.fromWorld({
  snapshotRef: snapshot.snapshotRef,
  snapshot,
  sinceRef: snapshot.snapshotRef,
  validatedHistory: validateRunHistory(emptyRunHistory()),
  orderedChanges: [],
  changeIndex: new Map(),
});
if (typeof CrossViewInvariants.validate !== "function") {
  throw new Error("dist consumer smoke failed: CrossViewInvariants missing");
}
if (bundle.spine.events.length !== 0) {
  throw new Error("dist consumer smoke failed: expected empty spine");
}
console.log("observability pack consumer smoke ok");
`,
  );

  run("npm install", consumerDir);
  run("node smoke.mjs", consumerDir);
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(consumerDir, { recursive: true, force: true });
}
