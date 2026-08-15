#!/usr/bin/env node
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(root, "../../..");

execSync("pnpm --filter @cantilune/conformance exec vitest run tests/system/l7/cache-invalidation.test.ts", { // NOSONAR — CI script, PATH is trusted
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("Trust rotation gate passed");
