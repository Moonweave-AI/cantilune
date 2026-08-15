#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../../..");
const manifestPath = resolve(repoRoot, "formal/proof-obligations.json");

function sha256File(path) {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

if (!existsSync(manifestPath)) {
  console.error("proof-obligations.json missing");
  process.exit(1);
}

const raw = readFileSync(manifestPath, "utf8");
const parsed = JSON.parse(raw);

const distValidator = resolve(
  packageRoot,
  "dist/manifest/formalProofManifestBinding.js",
);
if (!existsSync(distValidator)) {
  console.error("build @cantilune/conformance before verify:formal-manifest");
  process.exit(1);
}

const { validateProofObligationsManifest } = await import(
  pathToFileURL(distValidator).href
);
const violations = validateProofObligationsManifest(parsed);
if (violations.length > 0) {
  console.error("proof-obligations.json structure invalid:");
  for (const v of violations) {
    console.error(`  ${v.code}: ${v.message}`);
  }
  process.exit(1);
}

if (parsed.requiredGate !== "proved") {
  console.error(`requiredGate must be proved; got ${parsed.requiredGate}`);
  process.exit(1);
}

const evidencePaths = new Map();
for (const entry of parsed.obligations) {
  if (entry.status !== "proved") {
    console.error(`obligation ${entry.id} status is ${entry.status}, expected proved`);
    process.exit(1);
  }
  evidencePaths.set(entry.buildEvidence, entry.buildEvidenceSha256);
}

for (const [relativePath, expectedSha] of evidencePaths) {
  const absolute = resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) {
    console.error(`build evidence missing: ${relativePath}`);
    process.exit(1);
  }
  const actualSha = sha256File(absolute);
  if (actualSha !== expectedSha) {
    console.error(
      `build evidence digest mismatch for ${relativePath}: expected ${expectedSha}, got ${actualSha}`,
    );
    process.exit(1);
  }
}

console.log(
  `Formal manifest gate passed: ${parsed.obligations.length} obligations, ${evidencePaths.size} evidence file(s)`,
);
