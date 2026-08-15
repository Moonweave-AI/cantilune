import { describe, expect, it } from "vitest";
import {
  assertAuthenticatedCommsContext,
  assertVerifiedEnvelope,
  isSealedAuthContext,
  sealAuthenticatedCommsContext,
  sealVerifiedEnvelope,
} from "../../src/security/commsCapability.js";
import { buildTestAuthContext, buildTestEnvelope } from "../support/envelopeFixtures.js";
import { actorRef } from "@cantilune/core";

describe("commsCapability", () => {
  it("seals and asserts authenticated context", () => {
    const context = buildTestAuthContext();
    expect(isSealedAuthContext(context)).toBe(true);
    expect(assertAuthenticatedCommsContext(context).ok).toBe(true);
  });

  it("rejects unsealed auth context", () => {
    const unsealed = {
      peer: {
        runtimeInstanceId: "rt-1" as never,
        principal: actorRef("human-1" as never, "human"),
        descriptorRef: "desc-1" as never,
        descriptorDigest: "d",
        authenticationMethod: "test",
        channelBindingDigest: "b",
        evidenceRef: "e",
        authenticatedAt: "2026-08-11T16:00:00Z",
        expiresAt: "2099-01-01T00:00:00Z",
      },
      roles: ["session-member"],
    };
    expect(assertAuthenticatedCommsContext(unsealed).ok).toBe(false);
  });

  it("seals and asserts verified envelope", () => {
    const envelope = buildTestEnvelope();
    const verified = sealVerifiedEnvelope({ envelope, verifiedAt: "2026-08-11T16:00:00Z" });
    expect(assertVerifiedEnvelope(verified).ok).toBe(true);
  });

  it("sealAuthenticatedCommsContext freezes roles", () => {
    const sealed = sealAuthenticatedCommsContext({
      peer: buildTestAuthContext().peer,
      roles: ["session-member", "admin"],
    });
    expect(sealed.roles).toEqual(["session-member", "admin"]);
  });
});
