import { describe, expect, it } from "vitest";
import { validateProofObligationsManifest } from "../../src/manifest/formalProofManifestBinding.js";
import { createMemoryCryptoVerifier } from "../../src/adapters/memory/memoryCryptoVerifier.js";

describe("formalProofManifestBinding edge cases", () => {
  it("rejects non-object obligation entries and invalid field types", () => {
    const violations = validateProofObligationsManifest({
      schemaVersion: 1,
      requiredGate: "proved",
      obligations: [
        null,
        {
          id: "",
          theorem: "",
          status: "proved",
          leanSymbol: "",
          verifiedCommit: "x",
          buildEvidence: "",
          buildEvidenceSha256: "y",
        },
      ],
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("memory crypto verifier returns false for invalid public key", async () => {
    const crypto = createMemoryCryptoVerifier();
    const valid = await crypto.verifySignature(
      "attestation",
      new Uint8Array([1]),
      new Uint8Array([1]),
      new Uint8Array([1, 2, 3]),
    );
    expect(valid).toBe(false);
  });
});
