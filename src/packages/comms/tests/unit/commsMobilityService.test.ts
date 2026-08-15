import { describe, expect, it } from "vitest";
import {
  contentRef,
  correlationId,
  epochId,
  epochOrdinal,
  evidenceId,
  evidenceRef,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { buildTestAuthContext, buildTestCommsServices } from "../support/envelopeFixtures.js";
import { channelGeneration, channelId, descriptorRef } from "../../src/foundation/messageId.js";

describe("CommsMobilityService", () => {
  it("delegates endpoint and returns receipt", () => {
    const services = buildTestCommsServices();
    const sid = sessionId("session-mob-001");
    const plan = {
      oldEndpointRef: descriptorRef("ep-old"),
      newEndpointRef: descriptorRef("ep-new"),
      oldChannelId: channelId("ch-old"),
      newChannelId: channelId("ch-new"),
      channelGeneration: channelGeneration(2),
      delegator: buildTestAuthContext().peer.principal,
      delegatee: buildTestAuthContext().peer.principal,
      authorizationRef: evidenceRef(
        evidenceId("auth-evidence"),
        "approval",
        contentRef("content://auth"),
      ),
      oneTimeCapabilityRef: evidenceRef(
        evidenceId("cap-evidence"),
        "approval",
        contentRef("content://cap"),
      ),
      metadata: {
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        operationTemplateRef: operationTemplateRef("delegate", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-mob"),
        occurrenceId: occurrenceId("occ-mob"),
      },
      planDigest: "plan-digest-mob",
      expiresAt: "2099-01-01T00:00:00Z",
    };
    const result = services.mobility.delegate(buildTestAuthContext(), plan);
    expect(result.ok).toBe(true);
  });

  it("allocates fresh endpoint", () => {
    const services = buildTestCommsServices();
    const alloc = services.mobility.allocateFreshEndpoint();
    expect(alloc.ok).toBe(true);
    if (!alloc.ok) {
      return;
    }
    expect(alloc.value.endpointRef).toContain("endpoint-fresh");
  });
});
