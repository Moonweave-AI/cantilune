#!/usr/bin/env node
/**
 * Copy a sanitized 8h soak summary into docs/qa/ (Owner 2026-08-16).
 * Does not copy cycle logs or command output.
 *
 *   node scripts/publish-soak-summary.mjs
 *   node scripts/publish-soak-summary.mjs 2026-08-15T19-04-39-535Z
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const soakRoot = resolve(repoRoot, ".cantilune/soak");
const requested = process.argv[2];

function latestRunId() {
  const names = readdirSync(soakRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) {
    throw new Error("no soak runs under .cantilune/soak/");
  }
  return names[names.length - 1];
}

const runId = requested ?? latestRunId();
const summaryPath = resolve(soakRoot, runId, "summary.json");
const startPath = resolve(soakRoot, runId, "start.json");
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const start = JSON.parse(readFileSync(startPath, "utf8"));

if (summary.ok !== true) {
  throw new Error(`soak ${runId} is not ok; refusing to publish`);
}

const publishedAt = new Date().toISOString();
const markdown = `# 8h soak evidence (sanitized)

| Field | Value |
| --- | --- |
| Status | **ok** (local unattended run; not a release certificate) |
| Run id | \`${summary.runId}\` |
| Started | ${summary.startedAt} |
| Ended | ${summary.endedAt} |
| Elapsed ms | ${summary.elapsedMs} |
| Cycles | ${summary.cycles} |
| Duration requested ms | ${start.durationMs} |
| Published | ${publishedAt} |

This file is a sanitized copy of \`.cantilune/soak/${runId}/summary.json\`.
Cycle logs stay local and gitignored. PR CI still runs a shortened soak.
`;

const dest = resolve(repoRoot, "docs/qa", `soak-24h-evidence-${runId.slice(0, 10)}.md`);
writeFileSync(dest, markdown, "utf8");
process.stdout.write(`${dest}\n`);
