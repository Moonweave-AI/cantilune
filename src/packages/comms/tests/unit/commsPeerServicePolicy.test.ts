import { describe, expect, it } from "vitest";
import { CommsPeerService } from "../../src/engine/commsPeerService.js";
import { buildTestPeerDescriptor, stubPeerDirectory } from "../support/envelopeFixtures.js";
import { commsViolation } from "../../src/foundation/commsViolation.js";
import { descriptorRef } from "../../src/foundation/messageId.js";

describe("CommsPeerService endpoint policy", () => {
  it("rejects peer when endpoint policy fails", async () => {
    const descriptor = buildTestPeerDescriptor();
    const service = new CommsPeerService({
      directory: stubPeerDirectory(async () => descriptor),
      identity: {
        verifyPeer: async () => ({
          ok: false,
          error: commsViolation("identity_unverified", "authenticate", "stub"),
        }),
      },
      endpointPolicy: {
        assertEndpointAllowed: () => ({
          ok: false as const,
          error: commsViolation("endpoint_policy_violation", "negotiate", "blocked uri"),
        }),
      },
    });
    const result = await service.resolvePeer(descriptorRef(descriptor.descriptorRef as string));
    expect(result.ok).toBe(false);
  });
});
