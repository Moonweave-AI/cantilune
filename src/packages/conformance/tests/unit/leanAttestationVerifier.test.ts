import { describe, expect, it } from "vitest";
import { verifyLeanBuildAttestation } from "../../src/verifier/leanAttestationVerifier.js";
import { parseLeanAttestationFixture } from "../../src/testing/leanAttestationFixture.js";
import {
  computeLeanBuildAttestationDigest,
  bindLeanAttestationToProofManifest,
  isProofManifestRef,
} from "../../src/evidence/leanBuildAttestation.js";
import {
  createMemoryCryptoVerifier,
  createMemoryTrustStore,
} from "../../src/adapters/memory/index.js";
import { sampleLeanAttestationWire } from "../support/conformanceFixtures.js";

describe("leanAttestationVerifier", () => {
  it("rejects payload digest mismatch", async () => {
    const attestation = parseLeanAttestationFixture(sampleLeanAttestationWire());
    expect(attestation).toBeDefined();
    if (attestation === undefined) {
      return;
    }
    const result = await verifyLeanBuildAttestation({
      attestation,
      proofManifestRef: `proof-manifest/${attestation.proofManifestDigest}`,
      payloadDigest: "f".repeat(64),
      trustStore: createMemoryTrustStore(),
      crypto: createMemoryCryptoVerifier(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((v) => v.code === "admission_invalid")).toBe(true);
    }
  });

  it("rejects proof manifest ref that does not bind to attestation", async () => {
    const attestation = parseLeanAttestationFixture(sampleLeanAttestationWire());
    expect(attestation).toBeDefined();
    if (attestation === undefined) {
      return;
    }
    const digest = computeLeanBuildAttestationDigest(attestation) as string;
    const result = await verifyLeanBuildAttestation({
      attestation,
      proofManifestRef: "proof-manifest/" + "c".repeat(64),
      payloadDigest: digest,
      trustStore: createMemoryTrustStore(),
      crypto: createMemoryCryptoVerifier(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((v) => v.code === "projection_invalid")).toBe(true);
    }
  });

  it("rejects attestation outside validity window", async () => {
    const attestation = parseLeanAttestationFixture(
      sampleLeanAttestationWire({ expiresAt: "2020-01-01T00:00:00.000Z" }),
    );
    expect(attestation).toBeDefined();
    if (attestation === undefined) {
      return;
    }
    const digest = computeLeanBuildAttestationDigest(attestation) as string;
    const result = await verifyLeanBuildAttestation({
      attestation,
      proofManifestRef: `proof-manifest/${attestation.proofManifestDigest}`,
      payloadDigest: digest,
      trustStore: createMemoryTrustStore(),
      crypto: createMemoryCryptoVerifier(),
      now: () => "2026-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.some((v) => v.code === "revoked")).toBe(true);
    }
  });

  it("bindLeanAttestationToProofManifest rejects invalid refs", () => {
    expect(isProofManifestRef("bad")).toBe(false);
    const attestation = parseLeanAttestationFixture(sampleLeanAttestationWire());
    expect(attestation).toBeDefined();
    if (attestation === undefined) {
      return;
    }
    expect(
      bindLeanAttestationToProofManifest(attestation, "proof-manifest/" + "c".repeat(64)),
    ).toBe(false);
  });
});
