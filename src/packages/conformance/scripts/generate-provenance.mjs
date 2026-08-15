#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(root, "../../..");
const outDir = resolve(root, "artifacts/provenance");
mkdirSync(outDir, { recursive: true });

const gitSha = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim(); // NOSONAR — CI script, PATH is trusted
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const distIndex = resolve(root, "dist/index.js");
let artifactDigest = "0000000000000000000000000000000000000000000000000000000000000000";
try {
  const bytes = readFileSync(distIndex);
  artifactDigest = createHash("sha256").update(bytes).digest("hex");
} catch {
  // build may not have run yet in some local flows
}

const attestation = {
  attestationSchemaVersion: 1,
  packageName: pkg.name,
  packageVersion: pkg.version,
  gitCommit: gitSha,
  nodeVersion: process.version,
  builtAt: new Date().toISOString(),
  artifactDigest,
  formalManifestDigest: (() => {
    const manifestPath = resolve(repoRoot, "formal/proof-obligations.json");
    try {
      return createHash("sha256").update(readFileSync(manifestPath)).digest("hex");
    } catch {
      return undefined;
    }
  })(),
  verifierBuild: "conformance/3.0-m3",
  builder: {
    id: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
    workflow: process.env.GITHUB_WORKFLOW ?? "manual",
  },
};

const outFile = resolve(outDir, "conformance-provenance.json");
writeFileSync(outFile, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
console.log(`Provenance attestation written to ${outFile}`);
