import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeProductionIdentityVerifier } from "../../src/security/composeProductionIdentity.js";
import { COMMS_HMAC_KEY_ENV, COMMS_HMAC_KEY_FILE } from "../../src/security/hmacKeyMaterial.js";
import { createHmacBindingMaterial } from "../../src/security/hmacIdentityVerifier.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";

describe("composeProductionIdentityVerifier", () => {
  it("returns undefined when no key material is present", () => {
    expect(composeProductionIdentityVerifier({ env: {} })).toBeUndefined();
  });

  it("builds an HMAC verifier from a store file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-hmac-compose-"));
    try {
      writeFileSync(join(dir, COMMS_HMAC_KEY_FILE), "compose-secret", "utf8");
      const verifier = composeProductionIdentityVerifier({ storeDir: dir, env: {} });
      expect(verifier).toBeDefined();
      const descriptor = buildTestPeerDescriptor();
      const issuedAt = new Date().toISOString();
      const result = await verifier!.verifyPeer({
        descriptor,
        credentialRef: "cred",
        channelBindingMaterial: createHmacBindingMaterial(
          "compose-secret",
          descriptor.descriptorRef as string,
          "nonce",
          issuedAt,
        ),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.authenticationMethod).toBe("hmac-sha256");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds an HMAC verifier from env", async () => {
    const verifier = composeProductionIdentityVerifier({
      env: { [COMMS_HMAC_KEY_ENV]: "env-compose-secret" },
    });
    expect(verifier).toBeDefined();
    const descriptor = buildTestPeerDescriptor();
    const issuedAt = new Date().toISOString();
    const denied = await verifier!.verifyPeer({
      descriptor,
      credentialRef: "cred",
      channelBindingMaterial: "not-hmac",
    });
    expect(denied.ok).toBe(false);
    const accepted = await verifier!.verifyPeer({
      descriptor,
      credentialRef: "cred",
      channelBindingMaterial: createHmacBindingMaterial(
        "env-compose-secret",
        descriptor.descriptorRef as string,
        "nonce",
        issuedAt,
      ),
    });
    expect(accepted.ok).toBe(true);
  });
});
