import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  sampleInventory,
  sampleLeanAttestationWire,
  sampleManifest,
  SAMPLE_OBSERVED,
  FIXTURE_ARTIFACT_DIGESTS,
} from "../support/conformanceFixtures.js";
import { requireCliBuilt, runCli } from "../support/runCli.js";

describe("L5 conformance CLI exit codes", () => {
  beforeAll(requireCliBuilt);

  it("returns 0 for help", () => {
    const result = runCli(["help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("conformance-cli");
  });

  it("returns 2 for unknown command", () => {
    const result = runCli(["not-a-command"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown command");
  });

  it("returns 2 for missing required flags", () => {
    expect(runCli(["inspect"]).exitCode).toBe(2);
    expect(runCli(["verify-rule"]).exitCode).toBe(2);
    expect(runCli(["verify-package"]).exitCode).toBe(2);
    expect(runCli(["verify-lean-attestation"]).exitCode).toBe(2);
    expect(runCli(["list-missing"]).exitCode).toBe(2);
    expect(runCli(["explain"]).exitCode).toBe(2);
  });

  it("returns 3 for unreadable JSON path", () => {
    const result = runCli(["inspect", "--manifest", join(tmpdir(), "missing-manifest.json")]);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("failed to read JSON");
  });

  it("returns 0 for inspect on allowed manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      const result = runCli(["inspect", "--manifest", manifestPath]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("engineeringAdmission");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 1 for inspect on disallowed product scope", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify(sampleManifest({ claimScope: "product" })),
        "utf8",
      );
      const result = runCli(["inspect", "--manifest", manifestPath]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("scope_escalation");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 1 for verify-rule inventory violations", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([]), "utf8");
      const result = runCli([
        "verify-rule",
        "--inventory",
        inventoryPath,
        "--observed",
        observedPath,
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("inventory_incomplete");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 0 for verify-rule complete inventory", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([...SAMPLE_OBSERVED]), "utf8");
      const result = runCli([
        "verify-rule",
        "--inventory",
        inventoryPath,
        "--observed",
        observedPath,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("rule inventory complete");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 0 for verify-package on reference manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      const artifactsPath = join(dir, "artifacts.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([...SAMPLE_OBSERVED]), "utf8");
      writeFileSync(artifactsPath, JSON.stringify([...FIXTURE_ARTIFACT_DIGESTS]), "utf8");
      const result = runCli([
        "verify-package",
        "--manifest",
        manifestPath,
        "--inventory",
        inventoryPath,
        "--observed",
        observedPath,
        "--artifacts",
        artifactsPath,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("engineeringAdmission");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 1 for verify-lean-attestation digest mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const attestationPath = join(dir, "attestation.json");
      writeFileSync(attestationPath, JSON.stringify(sampleLeanAttestationWire()), "utf8");
      const result = runCli([
        "verify-lean-attestation",
        "--attestation",
        attestationPath,
        "--payload-digest",
        "f".repeat(64),
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("admission_invalid");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 0 for list-missing and explain", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-"));
    try {
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([]), "utf8");
      const missing = runCli([
        "list-missing",
        "--inventory",
        inventoryPath,
        "--observed",
        observedPath,
      ]);
      expect(missing.exitCode).toBe(0);
      expect(missing.stdout).toContain("rule-native-1");

      const manifestPath = join(dir, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      const inspect = runCli(["inspect", "--manifest", manifestPath]);
      expect(inspect.exitCode).toBe(0);
      const decisionPath = join(dir, "decision.json");
      writeFileSync(decisionPath, inspect.stdout, "utf8");
      const explain = runCli(["explain", "--decision", decisionPath]);
      expect(explain.exitCode).toBe(0);
      expect(explain.stdout).toContain("profile=engineeringAdmission");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
