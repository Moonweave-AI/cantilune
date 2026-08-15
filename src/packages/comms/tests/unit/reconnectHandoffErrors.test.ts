import { describe, expect, it } from "vitest";
import { createCommsReconnectService } from "../../src/reconnect/reconnectHandoff.js";
import {
  correlationId,
  epochId,
  epochOrdinal,
  occurrenceId,
  operationTemplateRef,
  sessionId,
} from "@cantilune/core";
import { buildTestCommsServices } from "../support/envelopeFixtures.js";

describe("reconnectHandoff errors", () => {
  it("throws when reconnect commit fails", async () => {
    const service = createCommsReconnectService({ services: buildTestCommsServices() });
    await expect(
      service.instanceReconnect({
        handoff: {
          targetEpochId: epochId("43"),
          targetEpochOrdinal: epochOrdinal(2),
          operationTemplateRef: operationTemplateRef("introduce", "1"),
          sessionId: sessionId("session-handoff-fail"),
          correlationId: correlationId("corr-handoff-fail"),
          occurrenceId: occurrenceId("occ-handoff-fail"),
        },
        peerDescriptorRef: "peer://missing",
        admissionReceipt: {
          admissionId: "adm-handoff-fail" as never,
          activationDomainId: "default" as never,
          fromBinding: {} as never,
          toBinding: {} as never,
          beforeSnapshotRef: "snap-0" as never,
          afterSnapshotRef: "snap-1" as never,
          extensionPlanRef: "plan",
          admissionTombstoneId: "tomb" as never,
          committedBy: "op",
          committedAt: "2026-08-11T15:00:00Z",
          storeSequence: 1 as never,
          correlationId: correlationId("corr-handoff-fail"),
          occurrenceId: occurrenceId("occ-handoff-fail"),
          idempotencyKey: "idem" as never,
          planDigest: "pd" as never,
        },
      }),
    ).rejects.toThrow();
  });
});
