import { describe, expect, it } from "vitest";
import {
  actorRef,
  correlationId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
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
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";

describe("messaging saga with real runtime observe/commit", () => {
  it("persists, observes into auditTail, commits receipt, and dispatches", async () => {
    const harness = buildCommsRuntimeHarness({
      availableContentRefs: ["content://runtime-saga" as never],
    });
    const [localTransport] = LoopbackTransport.connectPair();
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => harness.binding },
      sessionAuthority: { isController: () => true, isMember: () => true },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      observation: harness.runtimePorts.observation,
      runtimeCommit: harness.runtimePorts.runtimeCommit,
      transport: localTransport,
      clock: { now: () => "2026-08-11T16:00:00Z" },
    });

    const context = sealTestAuthContext({
      peer: {
        runtimeInstanceId: "runtime-local" as never,
        principal: actorRef("human-1" as never, "human"),
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
      messageId: messageId("msg-runtime-saga-001"),
      operationCode: "send" as const,
      metadata: {
        epochId: harness.binding.epochId,
        epochOrdinal: harness.binding.epochOrdinal,
        operationTemplateRef: operationTemplateRef("send", "1"),
        sessionId: sessionId("session-runtime-saga-001"),
        correlationId: correlationId("corr-runtime-saga-001"),
        occurrenceId: occurrenceId("occ-runtime-saga-001"),
        idempotencyKey: idempotencyKey("idem-runtime-saga-001"),
      },
      sender: actorRef("human-1" as never, "human"),
      recipient: actorRef("coder-c" as never, "agent"),
      channelId: channelId("channel-runtime-saga-001"),
      channelGeneration: channelGeneration(1),
      sequence: 1,
      payload: {
        contentRef: "content://runtime-saga" as never,
        contentDigest: "digest-runtime-saga" as never,
        mediaType: "application/json",
        byteLength: 12,
        classification: "internal" as const,
      },
      ackMode: "runtimeObserved" as const,
      issuedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2026-08-11T17:00:00Z",
    };

    const beforeTail = harness.runtime.getHead()?.auditTail.length ?? 0;
    const sent = await services.messaging.send(
      context,
      withIntegrityDigest(envelope),
      idempotencyKey("idem-runtime-saga-001"),
    );
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    expect(sent.value.sagaPhase).toBe("dispatched");
    expect(sent.value.runtimeReceiptRef).toMatch(/^comms-msg:\/\//);

    const afterHead = harness.runtime.getHead();
    expect(afterHead?.auditTail.length).toBe(beforeTail + 1);
    expect(afterHead?.auditTail.at(-1)?.payloadRef).toBe("content://runtime-saga");
    expect(services.store.snapshot().outbox).toHaveLength(1);
  });
});
