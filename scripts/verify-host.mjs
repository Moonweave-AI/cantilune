#!/usr/bin/env node
/**
 * Cross-OS host capability probe (ADR-0023 / ADR-0024 / ADR-0029).
 *
 * Reports Postgres HA, etcd Raft, and Windows Hyper-V / Linux gVisor isolation.
 * Daily use is report-only. `--require` or CANTILUNE_HOST_MODE=multi /
 * CANTILUNE_REQUIRE_* fail-closed.
 *
 *   node scripts/verify-host.mjs
 *   node scripts/verify-host.mjs --require
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadHostEnv } from "./host/hostEnv.mjs";

loadHostEnv(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

const modulePath = resolve("src/packages/cli/dist/wiring/hostCapabilities.js");
if (!existsSync(modulePath)) {
  throw new Error("cli dist missing; run pnpm --filter @cantilune/cli... build before verify-host");
}

const { probeHostCapabilities, assertHostCapabilities, formatHostCapabilityReport } = await import(
  pathToFileURL(modulePath).href
);

const report = await probeHostCapabilities();
process.stdout.write(`${formatHostCapabilityReport(report)}\n`);

const requireReady =
  process.argv.includes("--require") ||
  process.env.CANTILUNE_HOST_MODE === "multi" ||
  process.env.CANTILUNE_REQUIRE_POSTGRES_HA === "1" ||
  process.env.CANTILUNE_REQUIRE_RAFT === "1" ||
  process.env.CANTILUNE_REQUIRE_SANDBOX === "1";

if (requireReady) {
  assertHostCapabilities(report);
}

process.exitCode = requireReady && !report.ok ? 1 : 0;
