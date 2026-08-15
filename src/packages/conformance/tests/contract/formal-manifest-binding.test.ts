import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseProofObligationsManifest,
  validateProofObligationsManifest,
} from "../../src/manifest/formalProofManifestBinding.js";
import { PROOF_OBLIGATIONS_PATH } from "../support/repoPaths.js";

describe("L5 formal manifest binding", () => {
  it("accepts repository proof-obligations.json structure", () => {
    const raw = readFileSync(PROOF_OBLIGATIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const violations = validateProofObligationsManifest(parsed);
    expect(violations).toEqual([]);
    const manifest = parseProofObligationsManifest(parsed);
    expect(manifest).toBeDefined();
    if (manifest !== undefined) {
      expect(manifest.schemaVersion).toBeGreaterThanOrEqual(1);
      expect(manifest.requiredGate).toBe("proved");
      expect(manifest.obligations.length).toBeGreaterThan(0);
      for (const entry of manifest.obligations) {
        expect(entry.id).toMatch(/^CENTRAL-/);
        expect(entry.verifiedCommit).toMatch(/^[a-f0-9]{40}$/);
        expect(entry.buildEvidenceSha256).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });

  it("rejects tampered proof obligation entries", () => {
    const raw = readFileSync(PROOF_OBLIGATIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const obligations = [...(parsed.obligations as readonly Record<string, unknown>[])];
    obligations[0] = {
      ...obligations[0],
      verifiedCommit: "deadbeef",
      buildEvidenceSha256: "not-a-digest",
      status: "unknown-status",
    };
    const tampered = { ...parsed, obligations };
    const violations = validateProofObligationsManifest(tampered);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.code === "proof_manifest_invalid")).toBe(true);
    expect(parseProofObligationsManifest(tampered)).toBeUndefined();
  });

  it("rejects duplicate obligation ids", () => {
    const raw = readFileSync(PROOF_OBLIGATIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const obligations = parsed.obligations as Record<string, unknown>[];
    const duplicate = [...obligations, { ...obligations[0] }];
    const violations = validateProofObligationsManifest({ ...parsed, obligations: duplicate });
    expect(violations.some((v) => v.message.includes("duplicate obligation id"))).toBe(true);
  });
});
