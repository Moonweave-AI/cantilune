import { describe, expect, it } from "vitest";
import { actorId, actorRef } from "@cantilune/core";
import { createActorIdIdentityVerifier } from "../../../src/cluster/actorIdIdentityVerifier.js";

const descriptor = {
  descriptorRef: "desc" as never,
  digest: "d" as never,
  runtimeInstanceId: "rt" as never,
  activationDomainId: "default" as never,
  actors: [actorRef(actorId("agent-a"), "agent")],
  endpoints: [],
  supportedWireVersions: [],
  supportedTransports: [],
  supportedFeatures: [],
  supportedOperations: [],
  schemaBinding: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
  issuedAt: "2026-08-11T16:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  evidenceRefs: [],
  provenance: "test",
};

describe("createActorIdIdentityVerifier", () => {
  it("accepts a descriptor that names an actor", async () => {
    const result = await createActorIdIdentityVerifier().verifyPeer({
      descriptor,
      credentialRef: "cred",
      channelBindingMaterial: "unsigned",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authenticationMethod).toBe("actor-id-pin");
    }
  });

  it("rejects a descriptor with no actors", async () => {
    const result = await createActorIdIdentityVerifier().verifyPeer({
      descriptor: { ...descriptor, actors: [] },
      credentialRef: "cred",
      channelBindingMaterial: "unsigned",
    });
    expect(result.ok).toBe(false);
  });
});
