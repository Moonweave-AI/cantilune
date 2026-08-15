import { describe, expect, it } from "vitest";
import {
  correlationId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { A2ATransportAdapter } from "../../src/transports/a2a/a2aTransportAdapter.js";
import { createA2AExternalAgentBroker } from "../../src/integration/a2aExternalAgentHarness.js";
import { decodeA2AFrame } from "../../src/transports/a2a/a2aCodec.js";
import {
  channelGeneration,
  channelId,
  messageId,
  registryVersion,
  wireVersion,
} from "../../src/foundation/messageId.js";
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";
import { sealTestAuthContext, withIntegrityDigest } from "../support/commsTestHelpers.js";

describe("external A2A agent interop drill", () => {
  it("dispatches through A2A adapter to external agent broker with runtime saga", async () => {
    const harness = buildCommsRuntimeHarness({
      availableContentRefs: ["content://a2a-external" as never],
    });
    const broker = createA2AExternalAgentBroker();
    const externalAgentId = "external-agent-alpha";
    broker.registerAgent({ agentId: externalAgentId, profile: "a2a/0.1" });

    const transport = new A2ATransportAdapter({
      remoteEndpoint: `a2a://${externalAgentId}`,
      sendFrame: async (_endpoint, frame) => broker.sendTo(externalAgentId, frame),
      receiveFrame: async () => broker.receiveFrom(externalAgentId),
    });

    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => harness.binding },
      sessionAuthority: { isController: () => true, isMember: () => true },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      observation: harness.runtimePorts.observation,
      runtimeCommit: harness.runtimePorts.runtimeCommit,
      transport,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });

    const context = sealTestAuthContext({
      peer: {
        runtimeInstanceId: "runtime-local" as never,
        principal: { actorId: "human-1" as never, kind: "human" },
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
      messageId: messageId("msg-a2a-external-001"),
      operationCode: "send" as const,
      metadata: {
        epochId: harness.binding.epochId,
        epochOrdinal: harness.binding.epochOrdinal,
        operationTemplateRef: operationTemplateRef("send", "1"),
        sessionId: sessionId("session-a2a-external-001"),
        correlationId: correlationId("corr-a2a-external-001"),
        occurrenceId: occurrenceId("occ-a2a-external-001"),
        idempotencyKey: idempotencyKey("idem-a2a-external-001"),
      },
      sender: { actorId: "human-1" as never, kind: "human" as const },
      recipient: { actorId: "coder-c" as never, kind: "agent" as const },
      channelId: channelId("channel-a2a-external-001"),
      channelGeneration: channelGeneration(1),
      sequence: 1,
      payload: {
        contentRef: "content://a2a-external" as never,
        contentDigest: "digest-a2a-external" as never,
        mediaType: "application/json",
        byteLength: 8,
        classification: "internal" as const,
      },
      ackMode: "durablyAccepted" as const,
      issuedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2026-08-11T17:00:00Z",
    };

    const sent = await services.messaging.send(
      context,
      withIntegrityDigest(envelope),
      idempotencyKey("idem-a2a-external-001"),
    );
    expect(sent.ok).toBe(true);

    await broker.runExternalAgentLoop(externalAgentId);

    const ack = await broker.receiveFrom(externalAgentId);
    expect(ack.ok).toBe(true);
    if (!ack.ok) {
      return;
    }
    const ackDecoded = decodeA2AFrame(ack.value);
    expect(ackDecoded.ok).toBe(true);
    if (!ackDecoded.ok) {
      return;
    }
    expect(ackDecoded.value.header.messageKind).toBe("ack");
  });
});
