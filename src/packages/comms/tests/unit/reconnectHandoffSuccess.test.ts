import { describe, expect, it } from "vitest";
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
import { createCommsReconnectService } from "../../src/reconnect/reconnectHandoff.js";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";
import type { CommsStore } from "../../src/ports/commsStore.js";
import type { AdmissionReconnectPlan } from "../../src/reconnect/admissionReconnectPlan.js";

function registerBinding(store: CommsStore, plan: AdmissionReconnectPlan): void {
  store.casSessionBinding({
    sessionId: plan.sessionId,
    expectedGeneration: channelGeneration(0),
    next: {
      sessionId: plan.sessionId,
      authoritativeSnapshotRef: plan.expectedRuntimeHead,
      localRuntimeInstanceId: "runtime-local" as never,
      remoteRuntimeInstanceId: "runtime-remote" as never,
      channelId: channelId(`channel-${plan.sessionId as string}`),
      channelGeneration: plan.expectedChannelGeneration,
      localEndpoint: plan.oldEndpointRef,
      remoteEndpoint: plan.newEndpointRef,
      negotiated: {
        wireVersion: 1 as never,
        transport: "loopback",
        codecRef: "comms/wire-v1",
        protocolVersion: "comms/1",
        a2aProfile: "a2a/0.1",
        features: [],
      },
      schemaEpochId: String(plan.toBinding.epochId),
      status: "active",
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: "2026-08-11T16:00:00Z",
      updatedAt: "2026-08-11T16:00:00Z",
    },
  });
}

describe("reconnectHandoff success path", () => {
  it("completes instance reconnect with admission receipt", async () => {
    const binding = {
      activationDomainId: "default" as never,
      bindingGeneration: 2 as never,
      epochId: epochId("43"),
      epochOrdinal: epochOrdinal(2),
      schemaRef: { schemaId: "default-v1", revisionId: "rev-002", digest: "abc" as never } as never,
      policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
      handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
      runtimeHead: "snap-E2" as never,
      admissionId: "adm-handoff-001" as never,
      activatedBy: "operator",
      activatedAt: "2026-08-11T15:00:00Z",
    };
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => binding },
      sessionAuthority: { isController: () => true, isMember: () => true },
      runtimeCommit: testRuntimeCommitPort(),
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      clock: { now: () => new Date().toISOString() },
    });
    const receipt = {
      admissionId: schemaAdmissionId("adm-handoff-001"),
      activationDomainId: "default" as never,
      fromBinding: binding,
      toBinding: binding,
      beforeSnapshotRef: "snap-E1" as never,
      afterSnapshotRef: "snap-E2" as never,
      extensionPlanRef: "plan-ref",
      admissionTombstoneId: "tomb-001" as never,
      committedBy: "operator",
      committedAt: "2026-08-11T15:00:00Z",
      storeSequence: 1 as never,
      correlationId: correlationId("corr-handoff"),
      occurrenceId: occurrenceId("occ-handoff"),
      idempotencyKey: idempotencyKey("idem-handoff"),
      planDigest: "plan-digest" as never,
      authorizationEvidenceRef: "auth-evidence" as never,
    };
    const service = createCommsReconnectService({ services });
    const planResult = services.receiptResolver.buildReconnectPlan({
      receipt,
      sessionId: sessionId("session-handoff-001"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      oldEndpointRef: "peer://worker-1" as never,
      newEndpointRef: "peer://worker-1" as never,
      authorizationRef: "auth-evidence",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }
    registerBinding(services.store, planResult.value);
    const result = await service.instanceReconnect({
      handoff: {
        targetEpochId: epochId("43"),
        targetEpochOrdinal: epochOrdinal(2),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sessionId("session-handoff-001"),
        correlationId: correlationId("corr-handoff"),
        occurrenceId: occurrenceId("occ-handoff"),
      },
      peerDescriptorRef: "peer://worker-1",
      admissionReceipt: receipt,
    });
    expect(result.planDigest).toBeDefined();
  });
});
