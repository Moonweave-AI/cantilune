import { describe, expect, it } from "vitest";
import { HmacIdentityVerifier } from "../../src/security/hmacIdentityVerifier.js";
import { createHmacBindingMaterial } from "../../src/security/hmacIdentityVerifier.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";
import { err } from "@cantilune/core";
import { commsViolation } from "../../src/foundation/commsViolation.js";

describe("HmacIdentityVerifier branches", () => {
  const secret = "branch-test-secret";

  it("propagates key resolver failure", async () => {
    const verifier = new HmacIdentityVerifier({
      keyResolver: {
        resolveVerificationKey: () =>
          err(commsViolation("identity_unverified", "authenticate", "key missing")),
      },
      clock: { now: () => new Date().toISOString() },
    });
    const result = await verifier.verifyPeer({
      descriptor: buildTestPeerDescriptor(),
      credentialRef: "missing-key",
      channelBindingMaterial: "a|b|c",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects descriptor with no actors", async () => {
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: secret }) },
      clock: { now: () => new Date().toISOString() },
    });
    const result = await verifier.verifyPeer({
      descriptor: buildTestPeerDescriptor({ actors: [] }),
      credentialRef: "cred",
      channelBindingMaterial: "n|2026-08-11T16:00:00Z|00",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects expired binding material", async () => {
    const descriptor = buildTestPeerDescriptor();
    const issuedAt = "2020-01-01T00:00:00Z";
    const bindingMaterial = createHmacBindingMaterial(
      secret,
      descriptor.descriptorRef as string,
      "nonce-old",
      issuedAt,
    );
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: secret }) },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      ttlMs: 300_000,
    });
    const result = await verifier.verifyPeer({
      descriptor,
      credentialRef: "cred",
      channelBindingMaterial: bindingMaterial,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("wire_expired");
  });

  it("rejects signature mismatch", async () => {
    const descriptor = buildTestPeerDescriptor();
    const issuedAt = new Date().toISOString();
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: secret }) },
      clock: { now: () => issuedAt },
    });
    const result = await verifier.verifyPeer({
      descriptor,
      credentialRef: "cred",
      channelBindingMaterial: `nonce|${issuedAt}|deadbeef`,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects binding material with wrong segment count", async () => {
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: secret }) },
      clock: { now: () => new Date().toISOString() },
    });
    const result = await verifier.verifyPeer({
      descriptor: buildTestPeerDescriptor(),
      credentialRef: "cred",
      channelBindingMaterial: "only-one-part",
    });
    expect(result.ok).toBe(false);
  });
});
