import { describe, expect, it } from "vitest";
import { actorId, actorRef } from "@cantilune/core";
import { createSessionParticipantAuthorizer } from "../../../src/cluster/sessionParticipantAuthorizer.js";

const principal = actorRef(actorId("agent-a"), "agent");
const context = {
  peer: {
    runtimeInstanceId: "rt" as never,
    principal,
    descriptorRef: "desc" as never,
    descriptorDigest: "d",
    authenticationMethod: "actor-id-pin",
    channelBindingDigest: "b",
    evidenceRef: "e",
    authenticatedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
  },
  roles: ["session-member"],
};

describe("createSessionParticipantAuthorizer", () => {
  it("denies when the session resource is missing", () => {
    const authorizer = createSessionParticipantAuthorizer({
      isController: () => true,
      isMember: () => true,
    });
    expect(authorizer.authorize({ action: "ingress.receive", context }).ok).toBe(false);
    expect(authorizer.authorize({ action: "ingress.receive", context, resource: "" }).ok).toBe(
      false,
    );
  });

  it("allows a session member or controller and denies others", () => {
    const authorizer = createSessionParticipantAuthorizer({
      isController: (_session, actor) => (actor.actorId as string) === "agent-ctrl",
      isMember: (_session, actor) => (actor.actorId as string) === "agent-a",
    });
    expect(
      authorizer.authorize({ action: "ingress.receive", context, resource: "session-1" }).ok,
    ).toBe(true);
    const controller = {
      ...context,
      peer: { ...context.peer, principal: actorRef(actorId("agent-ctrl"), "agent") },
    };
    expect(
      authorizer.authorize({
        action: "ingress.receive",
        context: controller,
        resource: "session-1",
      }).ok,
    ).toBe(true);
    const stranger = {
      ...context,
      peer: { ...context.peer, principal: actorRef(actorId("agent-z"), "agent") },
    };
    expect(
      authorizer.authorize({ action: "ingress.receive", context: stranger, resource: "session-1" })
        .ok,
    ).toBe(false);
  });
});
