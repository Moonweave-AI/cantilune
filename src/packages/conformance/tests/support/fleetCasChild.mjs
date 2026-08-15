/**
 * Child process entry: fleet worker puts evidence + appends decision log under shared CAS dir.
 * Usage: node fleetCasChild.mjs <dir> <workerLabel> <taskIndex> [raceKey]
 * Requires: pnpm build (imports from dist).
 * Exit 0 = success, 2 = CAS put lost race (raceKey mode only), 1 = fatal.
 */
import { createFileEvidenceStore, createFileDecisionLog } from "../../dist/adapters/file/index.js";
import { canonicalJsonBytes } from "../../dist/canonical/canonicalEncoding.js";
import { computeEvidenceDigest } from "../../dist/canonical/evidenceDigest.js";

const dir = process.argv[2];
const workerLabel = process.argv[3];
const taskIndex = Number(process.argv[4]);
const raceKey = process.argv[5];

if (dir === undefined || workerLabel === undefined || Number.isNaN(taskIndex)) {
  console.error("usage: fleetCasChild.mjs <dir> <workerLabel> <taskIndex> [raceKey]");
  process.exit(1);
}

const payload =
  raceKey !== undefined
    ? { raceKey, content: "shared-evidence" }
    : { workerLabel, taskIndex, content: `evidence-${workerLabel}-${taskIndex}` };

const bytes = canonicalJsonBytes(payload);
const digest = computeEvidenceDigest(payload);

const store = createFileEvidenceStore({ dir });
const put = await store.put(digest, bytes);

if (!put.ok) {
  if (raceKey !== undefined && (await store.has(digest))) {
    process.stdout.write("lost");
    process.exit(2);
  }
  console.error(`put failed for ${workerLabel}/${taskIndex}`);
  process.exit(1);
}

const log = createFileDecisionLog({ dir });
const recordedAt = `2026-08-11T12:00:${String(taskIndex).padStart(2, "0")}.000Z`;
const append = await log.append({
  runId: `run-${workerLabel}-${taskIndex}`,
  decisionDigest: digest,
  profile: "engineeringAdmission",
  recordedAt,
});

if (!append.ok) {
  console.error(`decision append failed for ${workerLabel}/${taskIndex}`);
  process.exit(1);
}

process.stdout.write(String(append.value.sequence));
process.exit(0);
