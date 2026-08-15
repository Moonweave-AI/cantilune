import { describe, expect, it } from "vitest";
import { verifyEvidenceEnvelope } from "../../src/verifier/envelopeVerifier.js";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { VersionedEvidenceEnvelope } from "../../src/foundation/versionedEvidenceEnvelope.js";
import { CANONICAL_ENCODING_VERSION } from "../../src/foundation/conformanceId.js";

function envelope(partial: Partial<VersionedEvidenceEnvelope> = {}): VersionedEvidenceEnvelope {
  const digest = computeEvidenceDigest({ sample: true });
  return {
    envelopeSchemaVersion: 1,
    canonicalEncodingVersion: CANONICAL_ENCODING_VERSION,
    signatureAlgorithm: "ed25519",
    digestAlgorithm: "sha256",
    profile: "engineeringAdmission",
    claimScope: "reference",
    subjectDigest: digest,
    evidenceRootDigest: digest,
    payloadRef: "evidence://payload/1",
    issuedAt: "2026-01-01T00:00:00.000Z",
    notBefore: "2020-01-01T00:00:00.000Z",
    expiresAt: "2099-12-31T23:59:59.999Z",
    ...partial,
  };
}

describe("envelopeVerifier", () => {
  it("accepts signed envelope within validity window", () => {
    expect(verifyEvidenceEnvelope(envelope(), "2026-01-01T00:00:00.000Z")).toEqual([]);
  });

  it("rejects signatureAlgorithm none", () => {
    const violations = verifyEvidenceEnvelope(
      envelope({ signatureAlgorithm: "none" }),
      "2026-01-01T00:00:00.000Z",
    );
    expect(violations.some((v) => v.code === "trust_invalid")).toBe(true);
  });

  it("rejects envelope not yet valid", () => {
    const violations = verifyEvidenceEnvelope(
      envelope({ notBefore: "2099-01-01T00:00:00.000Z" }),
      "2026-01-01T00:00:00.000Z",
    );
    expect(violations.some((v) => v.code === "envelope_invalid")).toBe(true);
  });
});
