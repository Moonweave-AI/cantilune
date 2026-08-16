#!/usr/bin/env node
/**
 * Watch one soak run and write a sanitized docs/qa summary the moment it ends.
 * Does not git commit.
 *
 *   node scripts/watch-soak-and-publish.mjs 2026-08-15T19-04-39-535Z
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runId = process.argv[2];
if (!runId) {
  process.stderr.write("usage: node scripts/watch-soak-and-publish.mjs <runId>\n");
  process.exit(2);
}

const evidenceDir = resolve(repoRoot, ".cantilune/soak", runId);
const summaryPath = resolve(evidenceDir, "summary.json");
const startPath = resolve(evidenceDir, "start.json");
const cyclesPath = resolve(evidenceDir, "cycles.json");
const dest = resolve(repoRoot, "docs/qa/soak-24h-evidence-2026-08-16.md");
const stallMs = 15 * 60 * 1000;
const pollMs = 5000;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeDoc(summary, start, statusLine) {
  const publishedAt = new Date().toISOString();
  const markdown = `# 8h soak evidence (2026-08-16)

| Field | Value |
| --- | --- |
| Status | ${statusLine} |
| Run id | \`${summary.runId ?? runId}\` |
| Started | ${summary.startedAt ?? start.startedAt} |
| Ended | ${summary.endedAt ?? "—"} |
| Elapsed ms | ${summary.elapsedMs ?? "—"} |
| Cycles | ${summary.cycles ?? "—"} |
| Duration requested ms | ${start.durationMs} |
| Published | ${publishedAt} |
| Local evidence | \`.cantilune/soak/${runId}/\` (gitignore) |
| PR CI | shortened soak only (\`.github/workflows/soak.yml\`) |

This file is a sanitized copy of \`.cantilune/soak/${runId}/summary.json\`.
Cycle logs stay local and gitignored. Not a release certificate. Not committed
until the Owner orders a commit.
${summary.error !== undefined ? `\nError: ${summary.error}\n` : ""}`;
  writeFileSync(dest, markdown, "utf8");
  return dest;
}

function cycleStamp() {
  if (!existsSync(cyclesPath)) return { count: 0, mtimeMs: 0 };
  const stat = statSync(cyclesPath);
  let count = 0;
  try {
    const rows = readJson(cyclesPath);
    count = Array.isArray(rows) ? rows.length : 0;
  } catch {
    count = 0;
  }
  return { count, mtimeMs: stat.mtimeMs };
}

process.stdout.write(`watching soak ${runId}\n`);
let lastCycle = cycleStamp();
let lastStallLog = 0;

const timer = setInterval(() => {
  try {
    if (existsSync(summaryPath)) {
      clearInterval(timer);
      const start = readJson(startPath);
      const summary = readJson(summaryPath);
      const ok = summary.ok === true;
      const destPath = writeDoc(
        summary,
        start,
        ok
          ? "**ok** (local unattended run; not a release certificate)"
          : "**failed** (local unattended run; not a release certificate)",
      );
      process.stdout.write(
        ok
          ? `published sanitized soak summary ${destPath}\n`
          : `soak failed; wrote sanitized record ${destPath}\n`,
      );
      process.exit(ok ? 0 : 1);
    }

    const now = cycleStamp();
    if (now.count !== lastCycle.count) {
      lastCycle = now;
      process.stdout.write(`soak watch heartbeat cycles=${now.count}\n`);
      return;
    }
    if (now.mtimeMs > 0 && Date.now() - now.mtimeMs > stallMs && Date.now() - lastStallLog > stallMs) {
      lastStallLog = Date.now();
      process.stdout.write(
        `STALL: cycles.json unchanged for ${Math.round((Date.now() - now.mtimeMs) / 1000)}s at cycles=${now.count}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  }
}, pollMs);
