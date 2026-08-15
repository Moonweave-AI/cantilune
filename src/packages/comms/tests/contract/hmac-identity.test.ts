import { describe, expect, it } from "vitest";
import {
  createHmacBindingMaterial,
  HmacIdentityVerifier,
} from "../../src/security/hmacIdentityVerifier.js";
import { descriptorRef } from "../../src/foundation/messageId.js";
import type { PeerDescriptor } from "../../src/peer/peerDescriptor.js";

describe("HMAC identity verifier", () => {
  it("authenticates peer with valid binding material", async () => {
    const secret = "test-secret-key";
    const descriptor: PeerDescriptor = {
      descriptorRef: descriptorRef("desc-hmac-001"),
      digest: "digest-hmac-001" as never,
      runtimeInstanceId: "runtime-hmac-001" as never,
      activationDomainId: "default" as never,
      actors: [{ actorId: "actor-hmac-001" as never, kind: "agent" }],
      endpoints: [
        {
          endpointRef: descriptorRef("endpoint-hmac-001"),
          transport: "loopback",
          uri: "loopback://peer-a",
          wireVersions: [1 as never],
          maxFrameBytes: 1_048_576,
        },
      ],
      supportedWireVersions: [1 as never],
      supportedTransports: ["loopback"],
      supportedFeatures: [],
      supportedOperations: ["send"],
      schemaBinding: {
        schemaId: "default-v1",
        revisionId: "rev-001",
        digest: "abc" as never,
      } as never,
      issuedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2026-08-11T17:00:00Z",
      evidenceRefs: ["evidence-hmac-001" as never],
      provenance: "test-harness",
    };

    const issuedAt = new Date().toISOString();
    const binding = createHmacBindingMaterial(
      secret,
      descriptor.descriptorRef as string,
      "nonce-001",
      issuedAt,
    );
    const verifier = new HmacIdentityVerifier({
      keyResolver: { resolveVerificationKey: () => ({ ok: true, value: secret }) },
      clock: { now: () => issuedAt },
    });

    const result = await verifier.verifyPeer({
      descriptor,
      credentialRef: "key-ref-001",
      channelBindingMaterial: binding,
    });
    expect(result.ok).toBe(true);
  });
});
