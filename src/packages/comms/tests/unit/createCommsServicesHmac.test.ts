import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { COMMS_HMAC_KEY_ENV, COMMS_HMAC_KEY_FILE } from "../../src/security/hmacKeyMaterial.js";
import { createHmacBindingMaterial } from "../../src/security/hmacIdentityVerifier.js";
import { productionCommsDeps } from "../support/productionCommsDeps.js";
import { buildTestEnvelope, buildTestPeerDescriptor } from "../support/envelopeFixtures.js";
import { encodeCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";
import type { IngressTransportContext } from "../../src/engine/commsIngress.js";

function actorIdFallback() {
  return {
    async verifyPeer(input: {
      readonly descriptor: ReturnType<typeof buildTestPeerDescriptor>;
      readonly credentialRef: string;
      readonly channelBindingMaterial: string;
    }) {
      const principal = input.descriptor.actors[0];
      if (principal === undefined) {
        return {
          ok: false as const,
          error: {
            code: "identity_unverified" as const,
            phase: "authenticate" as const,
            message: "no actors",
            retryable: false,
          },
        };
      }
      const now = new Date().toISOString();
      return {
        ok: true as const,
        value: {
          runtimeInstanceId: input.descriptor.runtimeInstanceId,
          principal,
          descriptorRef: input.descriptor.descriptorRef,
          descriptorDigest: input.descriptor.digest,
          authenticationMethod: "actor-id-pin",
          channelBindingDigest: input.channelBindingMaterial,
          evidenceRef: input.credentialRef,
          authenticatedAt: now,
          expiresAt: now,
        },
      };
    },
  };
}

const previousHmac = process.env[COMMS_HMAC_KEY_ENV];
afterEach(() => {
  if (previousHmac === undefined) {
    delete process.env[COMMS_HMAC_KEY_ENV];
  } else {
    process.env[COMMS_HMAC_KEY_ENV] = previousHmac;
  }
});

describe("createCommsServices HMAC composition", () => {
  it("accepts production wiring with only a store HMAC key", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-svc-hmac-only-"));
    try {
      delete process.env[COMMS_HMAC_KEY_ENV];
      writeFileSync(join(dir, COMMS_HMAC_KEY_FILE), "only-file-secret", "utf8");
      const services = createCommsServices(productionCommsDeps(dir));
      expect(services.admin.isFrozen()).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses HMAC when hmac.key is present even if ActorId was injected", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-svc-hmac-"));
    try {
      delete process.env[COMMS_HMAC_KEY_ENV];
      writeFileSync(join(dir, COMMS_HMAC_KEY_FILE), "svc-hmac-secret", "utf8");
      const services = createCommsServices(productionCommsDeps(dir, actorIdFallback()));
      const descriptor = buildTestPeerDescriptor();
      const issuedAt = new Date().toISOString();
      const context: IngressTransportContext = {
        transport: "loopback",
        tlsVerified: true,
        peerDescriptor: descriptor,
        credentialRef: "cred",
        channelBindingMaterial: "unsigned-actor-id",
      };
      const bytes = encodeCommunicationWireFrame(buildTestEnvelope());
      const unsigned = await services.ingress.acceptInboundFrame(bytes, context);
      expect(unsigned.ok).toBe(false);

      const signedContext: IngressTransportContext = {
        ...context,
        channelBindingMaterial: createHmacBindingMaterial(
          "svc-hmac-secret",
          descriptor.descriptorRef as string,
          "nonce",
          issuedAt,
        ),
      };
      const signed = await services.ingress.acceptInboundFrame(bytes, signedContext);
      expect(signed.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the injected verifier when no key material exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-svc-actor-"));
    try {
      delete process.env[COMMS_HMAC_KEY_ENV];
      const services = createCommsServices(productionCommsDeps(dir, actorIdFallback()));
      const context: IngressTransportContext = {
        transport: "loopback",
        tlsVerified: true,
        peerDescriptor: buildTestPeerDescriptor(),
        credentialRef: "cred",
        channelBindingMaterial: "any-actor-binding",
      };
      const accepted = await services.ingress.acceptInboundFrame(
        encodeCommunicationWireFrame(buildTestEnvelope()),
        context,
      );
      expect(accepted.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
