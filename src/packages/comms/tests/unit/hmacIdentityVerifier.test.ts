import { describe, expect, it } from "vitest";
import {
  createHmacBindingMaterial,
  HmacIdentityVerifier,
} from "../../src/security/hmacIdentityVerifier.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";

describe("HmacIdentityVerifier success path", () => {
  it("verifies valid HMAC binding material", async () => {
    const secret = "test-secret-key";
    const descriptor = buildTestPeerDescriptor();
    const issuedAt = new Date().toISOString();
    const bindingMaterial = createHmacBindingMaterial(
      secret,
      descriptor.descriptorRef as string,
      "nonce-001",
      issuedAt,
    );
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: secret }) },
      clock: { now: () => issuedAt },
      ttlMs: 300_000,
    });
    const result = await verifier.verifyPeer({
      descriptor,
      credentialRef: "cred-001",
      channelBindingMaterial: bindingMaterial,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.authenticationMethod).toBe("hmac-sha256");
  });

  it("rejects malformed binding material", async () => {
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: "secret" }) },
      clock: { now: () => new Date().toISOString() },
    });
    const result = await verifier.verifyPeer({
      descriptor: buildTestPeerDescriptor(),
      credentialRef: "cred",
      channelBindingMaterial: "bad-format",
    });
    expect(result.ok).toBe(false);
  });
});
