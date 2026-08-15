#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = join(scriptDir, "..");
const monorepoRoot = join(runtimeRoot, "..", "..", "..");
const coreRoot = join(monorepoRoot, "src", "packages", "core");
const packDir = mkdtempSync(join(tmpdir(), "cantilune-pack-"));
const consumerDir = mkdtempSync(join(tmpdir(), "cantilune-consumer-"));

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
  run("pnpm build", runtimeRoot);

  run(`pnpm pack --pack-destination "${packDir}"`, coreRoot);
  run(`pnpm pack --pack-destination "${packDir}"`, runtimeRoot);

  const coreTgz = findPack("cantilune-core-");
  const runtimeTgz = findPack("cantilune-runtime-");

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "runtime-pack-consumer-smoke",
        private: true,
        type: "module",
        dependencies: {
          "@cantilune/core": `file:${join(packDir, coreTgz).replaceAll("\\", "/")}`,
          "@cantilune/runtime": `file:${join(packDir, runtimeTgz).replaceAll("\\", "/")}`,
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDir, "smoke.mjs"),
    `import { createCoordinationRuntime, createDefaultSchema, createDefaultHandlers, runtimeDependenciesWithStaticSchema } from "@cantilune/runtime";
import { createMemoryRuntimePersistence } from "@cantilune/runtime/memory";
import { collaborationSnapshot, epochId, snapshotRef } from "@cantilune/core";

const { durable } = createMemoryRuntimePersistence({
  initial: collaborationSnapshot({ snapshotRef: snapshotRef("snap-S0"), epochId: epochId("42") }),
});

const runtime = createCoordinationRuntime(
  runtimeDependenciesWithStaticSchema({
    durable,
  clock: { now: () => "2026-08-10T00:00:00Z" },
  idGen: {
    snapshotRef: () => snapshotRef("snap-S1"),
    changeId: () => "chg-smoke-1",
    sessionId: () => "session-smoke-1",
    linkId: () => "link-smoke-1",
    artifactId: () => "artifact-smoke-1",
    capabilityId: () => "cap-smoke-1",
    evidenceId: () => "ev-smoke-1",
  },
  schema: createDefaultSchema(),
  policy: { evaluate: () => ({ kind: "deny", reason: "smoke" }) },
  handlers: createDefaultHandlers(),
  locks: { acquire: () => true, release: () => {}, isHeld: () => false },
  }),
);

if (typeof runtime.getHead !== "function") {
  throw new Error("dist consumer smoke failed: getHead missing");
}
console.log("pack consumer smoke ok");
`,
  );

  run("npm install", consumerDir);
  run("node smoke.mjs", consumerDir);
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(consumerDir, { recursive: true, force: true });
}
