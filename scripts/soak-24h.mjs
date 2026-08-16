#!/usr/bin/env node
/**
 * 8h unattended soak (Owner 2026-08-16: 8h is sufficient).
 * Not a PR CI gate. Writes cycle evidence under .cantilune/soak/.
 *
 *   node scripts/soak-24h.mjs
 *   CANTILUNE_SOAK_MS=60000 node scripts/soak-24h.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const durationMs = Number(process.env.CANTILUNE_SOAK_MS ?? 8 * 60 * 60 * 1000);
const started = Date.now();
const runId = new Date(started).toISOString().replace(/[:.]/g, "-");
const evidenceDir = resolve(repoRoot, ".cantilune/soak", runId);

mkdirSync(evidenceDir, { recursive: true });

function writeEvidence(name, payload) {
  writeFileSync(resolve(evidenceDir, name), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

writeEvidence("start.json", {
  runId,
  startedAt: new Date(started).toISOString(),
  durationMs,
  command: "scripts/soak-24h.mjs",
  note: "Full 8h evidence; PR CI uses CANTILUNE_SOAK_MS shortened. Not a release certificate.",
});

function run(name, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("pnpm", args, { stdio: "inherit", shell: true, cwd: repoRoot });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(undefined);
      else reject(new Error(`${name} exited ${code}`));
    });
  });
}

async function cycle() {
  await run("boot soak", [
    "--filter",
    "@cantilune/boot",
    "exec",
    "vitest",
    "run",
    "tests/system/soak/cluster-soak.test.ts",
  ]);
  await run("comms storm", [
    "--filter",
    "@cantilune/comms",
    "exec",
    "vitest",
    "run",
    "tests/system/l7/reconnect-storm-soak.test.ts",
  ]);
}

async function prepare() {
  await run("build boot graph", ["--filter", "@cantilune/boot...", "build"]);
  await run("build comms graph", ["--filter", "@cantilune/comms...", "build"]);
}

async function main() {
  process.stdout.write(`cantilune 8h soak starting; durationMs=${durationMs}\nevidence=${evidenceDir}\n`);
  await prepare();
  let cycles = 0;
  const cycleLog = [];
  try {
    while (Date.now() - started < durationMs) {
      cycles += 1;
      const cycleStarted = Date.now();
      process.stdout.write(`soak cycle ${cycles}\n`);
      await cycle();
      const row = {
        cycle: cycles,
        startedAt: new Date(cycleStarted).toISOString(),
        endedAt: new Date().toISOString(),
        ok: true,
      };
      cycleLog.push(row);
      writeEvidence("cycles.json", cycleLog);
    }
    writeEvidence("summary.json", {
      runId,
      ok: true,
      cycles,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
    });
    process.stdout.write(`soak complete after ${cycles} cycles\n`);
  } catch (error) {
    writeEvidence("summary.json", {
      runId,
      ok: false,
      cycles,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
