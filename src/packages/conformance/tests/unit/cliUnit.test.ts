import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs, requireFlag, readJsonFile } from "../../src/cli/cliArgs.js";
import {
  cliExitCode,
  EXIT_OK,
  EXIT_TOOL_FAILURE,
  EXIT_USAGE,
  EXIT_VIOLATIONS,
} from "../../src/cli/exitCodes.js";
import { inspectCommand, inspectUsage } from "../../src/cli/inspectCommand.js";
import { explainCommand, explainUsage } from "../../src/cli/explainCommand.js";
import { listMissingCommand, listMissingUsage } from "../../src/cli/listMissingCommand.js";
import { verifyRuleCommand, verifyRuleUsage } from "../../src/cli/verifyRuleCommand.js";
import { verifyPackageCommand, verifyPackageUsage } from "../../src/cli/verifyPackageCommand.js";
import {
  verifyLeanAttestationCommand,
  verifyLeanAttestationUsage,
} from "../../src/cli/verifyLeanAttestationCommand.js";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
  sampleLeanAttestationWire,
} from "../support/conformanceFixtures.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import { initialConformanceStatus } from "../../src/foundation/conformanceStatus.js";

describe("cli unit modules", () => {
  it("parseArgs and requireFlag branches", () => {
    const parsed = parseArgs(["--manifest", "m.json", "extra"]);
    expect(parsed.flags.get("manifest")).toBe("m.json");
    expect(parsed.positional).toEqual([]);
    const missing = requireFlag(parsed.flags, "missing");
    expect("kind" in missing && missing.kind).toBe("usage");
    const flagTrue = requireFlag(new Map([["flag", true]]), "flag");
    expect("kind" in flagTrue && flagTrue.kind).toBe("usage");
    expect(requireFlag(new Map([["flag", "value"]]), "flag")).toEqual({ value: "value" });
  });

  it("readJsonFile success and failure", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-json-"));
    try {
      const path = join(dir, "ok.json");
      writeFileSync(path, JSON.stringify({ ok: true }), "utf8");
      expect(readJsonFile(path)).toEqual({ value: { ok: true } });
      const missingJson = readJsonFile(join(dir, "missing.json"));
      expect("kind" in missingJson && missingJson.kind).toBe("tool_failure");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cliExitCode maps all result kinds", () => {
    expect(cliExitCode({ kind: "ok" })).toBe(EXIT_OK);
    expect(cliExitCode({ kind: "violations", violations: [] })).toBe(EXIT_VIOLATIONS);
    expect(cliExitCode({ kind: "usage", message: "usage" })).toBe(EXIT_USAGE);
    expect(cliExitCode({ kind: "tool_failure", message: "fail" })).toBe(EXIT_TOOL_FAILURE);
  });

  it("usage strings are non-empty", () => {
    expect(inspectUsage()).toContain("manifest");
    expect(explainUsage()).toContain("decision");
    expect(listMissingUsage()).toContain("inventory");
    expect(verifyRuleUsage()).toContain("inventory");
    expect(verifyPackageUsage()).toContain("manifest");
    expect(verifyLeanAttestationUsage()).toContain("attestation");
  });

  it("inspectCommand violations and success", () => {
    expect(inspectCommand([]).kind).toBe("usage");
    const dir = mkdtempSync(join(tmpdir(), "cli-inspect-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      writeFileSync(
        manifestPath,
        JSON.stringify(sampleManifest({ claimScope: "product" })),
        "utf8",
      );
      expect(inspectCommand(["--manifest", manifestPath]).kind).toBe("violations");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      const ok = inspectCommand(["--manifest", manifestPath]);
      expect(ok.kind).toBe("ok");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verifyRuleCommand and listMissingCommand", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-rule-"));
    try {
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([]), "utf8");
      expect(
        verifyRuleCommand(["--inventory", inventoryPath, "--observed", observedPath]).kind,
      ).toBe("violations");
      writeFileSync(observedPath, JSON.stringify([...SAMPLE_OBSERVED]), "utf8");
      expect(
        verifyRuleCommand(["--inventory", inventoryPath, "--observed", observedPath]).kind,
      ).toBe("ok");
      expect(listMissingCommand(["--inventory", inventoryPath, "--observed", "[]"]).kind).toBe(
        "tool_failure",
      );
      writeFileSync(observedPath, JSON.stringify([]), "utf8");
      expect(
        listMissingCommand(["--inventory", inventoryPath, "--observed", observedPath]).kind,
      ).toBe("ok");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verifyPackageCommand", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-pkg-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      const artifactsPath = join(dir, "artifacts.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([...SAMPLE_OBSERVED]), "utf8");
      writeFileSync(artifactsPath, JSON.stringify([]), "utf8");
      expect(
        (
          await verifyPackageCommand([
            "--manifest",
            manifestPath,
            "--inventory",
            inventoryPath,
            "--observed",
            observedPath,
            "--artifacts",
            artifactsPath,
          ])
        ).kind,
      ).toBe("violations");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verifyLeanAttestationCommand and explainCommand", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-lean-"));
    try {
      const attestationPath = join(dir, "attestation.json");
      writeFileSync(attestationPath, JSON.stringify(sampleLeanAttestationWire()), "utf8");
      expect(
        (
          await verifyLeanAttestationCommand([
            "--attestation",
            attestationPath,
            "--payload-digest",
            "f".repeat(64),
          ])
        ).kind,
      ).toBe("violations");

      const decisionPath = join(dir, "decision.json");
      writeFileSync(
        decisionPath,
        JSON.stringify({
          runId: "run-cli",
          profile: "engineeringAdmission",
          status: initialConformanceStatus(),
          violations: [],
          evidenceRootDigest: computeEvidenceDigest({ cli: true }),
          decidedAt: "2026-01-01T00:00:00.000Z",
        }),
        "utf8",
      );
      expect(explainCommand(["--decision", decisionPath]).kind).toBe("ok");
      expect(explainCommand([]).kind).toBe("usage");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
