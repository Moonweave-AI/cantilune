import { describe, expect, it } from "vitest";
import {
  buildReconnectPlanFromReceipt,
  createCommsServices,
  executeAdmissionReconnect,
} from "../../src/engine/createCommsServices.js";
import {
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  schemaAdmissionId,
  sessionId,
} from "@cantilune/core";

describe("createCommsServices exports", () => {
  it("executeAdmissionReconnect stops on propose failure", async () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: { isController: () => true, isMember: () => true },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      clock: { now: () => "2099-01-01T00:00:00Z" },
    });
    const receipt = {
      admissionId: schemaAdmissionId("adm-export-fail"),
      activationDomainId: "default" as never,
      fromBinding: {
        activationDomainId: "default" as never,
        bindingGeneration: 1 as never,
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
        policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
        handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
        runtimeHead: "snap" as never,
        admissionId: "adm" as never,
        activatedBy: "op",
        activatedAt: "2026-08-11T15:00:00Z",
      },
      toBinding: {
        activationDomainId: "default" as never,
        bindingGeneration: 1 as never,
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
        policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
        handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
        runtimeHead: "snap" as never,
        admissionId: "adm" as never,
        activatedBy: "op",
        activatedAt: "2026-08-11T15:00:00Z",
      },
      beforeSnapshotRef: "snap-0" as never,
      afterSnapshotRef: "snap-1" as never,
      extensionPlanRef: "plan",
      admissionTombstoneId: "tomb" as never,
      committedBy: "op",
      committedAt: "2026-08-11T15:00:00Z",
      storeSequence: 1 as never,
      correlationId: correlationId("corr-export"),
      occurrenceId: occurrenceId("occ-export"),
      idempotencyKey: idempotencyKey("idem-export"),
      planDigest: "pd" as never,
      authorizationEvidenceRef: "auth" as never,
    };
    const plan = buildReconnectPlanFromReceipt({
      resolver: services.receiptResolver,
      receipt,
      sessionId: sessionId("session-export-fail"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    const expiredPlan = { ...plan.value, expiresAt: "2020-01-01T00:00:00Z" };
    const result = await executeAdmissionReconnect({ services, plan: expiredPlan });
    expect(result.ok).toBe(false);
  });
});
