#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../../..");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sha256File(path) {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

function gitHead() {
  return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim(); // NOSONAR — CI script, PATH is trusted
}

function requireFormalGateEnv() {
  if (process.env.FORMAL_PROVED_GATE !== "passed") {
    fail("FORMAL_PROVED_GATE must be 'passed' — run the reusable formal.yml job with gate=proved first");
  }
}

function loadManifest() {
  const manifestPath = resolve(repoRoot, "formal/proof-obligations.json");
  if (!existsSync(manifestPath)) {
    fail("formal/proof-obligations.json missing");
  }
  return { manifestPath, manifest: JSON.parse(readFileSync(manifestPath, "utf8")) };
}

async function loadManifestValidator() {
  const distValidator = resolve(packageRoot, "dist/manifest/formalProofManifestBinding.js");
  if (!existsSync(distValidator)) {
    fail("build @cantilune/conformance before verify:release-gate");
  }
  const { validateProofObligationsManifest } = await import(pathToFileURL(distValidator).href);
  return validateProofObligationsManifest;
}

function validateManifestStructure(validateProofObligationsManifest, manifest) {
  const violations = validateProofObligationsManifest(manifest);
  if (violations.length > 0) {
    fail(`proof-obligations.json invalid: ${violations.map((v) => v.message).join("; ")}`);
  }
  if (manifest.requiredGate !== "proved") {
    fail(`requiredGate must be proved; got ${manifest.requiredGate}`);
  }
}

function validateObligationEvidence(manifest) {
  for (const entry of manifest.obligations) {
    if (entry.status !== "proved") {
      fail(`obligation ${entry.id} status is ${entry.status}, expected proved`);
    }
    const evidencePath = resolve(repoRoot, entry.buildEvidence);
    if (!existsSync(evidencePath)) {
      fail(`build evidence missing: ${entry.buildEvidence}`);
    }
    if (sha256File(evidencePath) !== entry.buildEvidenceSha256) {
      fail(`build evidence digest mismatch for ${entry.buildEvidence}`);
    }
  }
}

function validateProvenance(head, formalManifestDigest) {
  const provenancePath = resolve(packageRoot, "artifacts/provenance/conformance-provenance.json");
  if (!existsSync(provenancePath)) {
    fail("conformance-provenance.json missing — run pnpm provenance");
  }
  const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
  if (provenance.gitCommit !== head) {
    fail(`provenance gitCommit ${provenance.gitCommit} does not match HEAD ${head}`);
  }
  if (provenance.formalManifestDigest !== undefined && provenance.formalManifestDigest !== formalManifestDigest) {
    fail("provenance formalManifestDigest does not match proof-obligations.json");
  }
}

function validateSbom() {
  const sbomPath = resolve(packageRoot, "artifacts/sbom/conformance.cyclonedx.json");
  if (!existsSync(sbomPath)) {
    fail("conformance SBOM missing — run pnpm sbom");
  }
}

requireFormalGateEnv();
const { manifestPath, manifest } = loadManifest();
const validateProofObligationsManifest = await loadManifestValidator();
validateManifestStructure(validateProofObligationsManifest, manifest);
validateObligationEvidence(manifest);

const head = gitHead();
validateProvenance(head, sha256File(manifestPath));
validateSbom();

console.log(
  `Release gate passed: formal proved, ${manifest.obligations.length} obligations, git ${head.slice(0, 8)}`,
);
