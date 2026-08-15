import { describe, expect, it } from "vitest";
import {
  actorRef,
  correlationId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { LoopbackTransport } from "../../src/memory/loopbackTransport.js";
import {
  channelGeneration,
  channelId,
  messageId,
  registryVersion,
  wireVersion,
} from "../../src/foundation/messageId.js";
import { sealTestAuthContext, withIntegrityDigest } from "../support/commsTestHelpers.js";

describe("dual peer loopback messaging (L6)", () => {
  it("delivers envelope across connected loopback transports", async () => {
    const [localTransport, remoteTransport] = LoopbackTransport.connectPair();
    const services = createCommsServices({
      mode: "test",
      transport: localTransport,
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: { isController: () => true, isMember: () => true },
      runtimeCommit: testRuntimeCommitPort(),
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });

    const context = sealTestAuthContext({
      peer: {
        runtimeInstanceId: "runtime-local" as never,
        principal: actorRef("actor-local" as never, "agent"),
        descriptorRef: "desc-local" as never,
        descriptorDigest: "digest-local",
        authenticationMethod: "test",
        channelBindingDigest: "bind-local",
        evidenceRef: "evidence-local",
        authenticatedAt: "2026-08-11T16:00:00Z",
        expiresAt: "2026-08-11T17:00:00Z",
      },
      roles: ["session-member"],
    });

    const envelope = {
      wireVersion: wireVersion(1),
      registryVersion: registryVersion(1),
      messageId: messageId("msg-dual-001"),
      operationCode: "send" as const,
      metadata: {
        epochId: "42" as never,
        epochOrdinal: 1 as never,
        operationTemplateRef: operationTemplateRef("send", "1"),
        sessionId: sessionId("session-dual-001"),
        correlationId: correlationId("corr-dual-001"),
        occurrenceId: occurrenceId("occ-dual-001"),
        idempotencyKey: idempotencyKey("idem-dual-001"),
      },
      sender: actorRef("actor-local" as never, "agent"),
      recipient: actorRef("actor-remote" as never, "agent"),
      channelId: channelId("channel-dual-001"),
      channelGeneration: channelGeneration(1),
      sequence: 1,
      payload: {
        contentRef: "content-ref-001" as never,
        contentDigest: "digest-payload" as never,
        mediaType: "application/json",
        byteLength: 12,
        classification: "internal" as const,
      },
      ackMode: "durablyAccepted" as const,
      issuedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2026-08-11T17:00:00Z",
    };

    const sent = await services.messaging.send(
      context,
      withIntegrityDigest(envelope),
      idempotencyKey("idem-dual-001"),
    );
    expect(sent.ok).toBe(true);

    const received = await remoteTransport.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) {
      return;
    }
    const payload = JSON.parse(new TextDecoder().decode(received.value));
    expect(payload.messageId).toBe("msg-dual-001");
  });
});
