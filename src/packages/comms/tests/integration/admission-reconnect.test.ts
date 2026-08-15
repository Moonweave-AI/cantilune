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
import {
  buildReconnectPlanFromReceipt,
  createCommsServices,
  executeAdmissionReconnect,
} from "../../src/index.js";
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";

import type { AdmissionReconnectPlan } from "../../src/reconnect/admissionReconnectPlan.js";
import type { CommsStore } from "../../src/ports/commsStore.js";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";

function registerSessionBindingForReconnectPlan(
  store: CommsStore,
  plan: AdmissionReconnectPlan,
): void {
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

describe("admission receipt — instance reconnect", () => {
  it("executes reconnect coordinator state machine from committed receipt", async () => {
    const binding = {
      activationDomainId: "default" as never,
      bindingGeneration: 2 as never,
      epochId: "43" as never,
      epochOrdinal: 2 as never,
      schemaRef: { schemaId: "default-v1", revisionId: "rev-002", digest: "abc" as never } as never,
      policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
      handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
      runtimeHead: "snap-E2" as never,
      admissionId: "adm-001" as never,
      activatedBy: "operator",
      activatedAt: "2026-08-11T15:00:00Z",
    } as const;
    const bindingResolver = {
      getActiveBinding: () => binding,
    };

    const services = createCommsServices({
      mode: "test",
      bindingResolver,
      sessionAuthority: { isController: () => true, isMember: () => true },
      runtimeCommit: testRuntimeCommitPort(),
      quiescence: {
        resourcesClear: async () => true,
        sessionsQuiescent: async () => true,
      },
      clock: { now: () => new Date().toISOString() },
    });

    const receipt = {
      admissionId: schemaAdmissionId("adm-reconnect-001"),
      activationDomainId: "default" as never,
      fromBinding: binding,
      toBinding: {
        ...binding,
        epochId: "43" as never,
        epochOrdinal: 2 as never,
      },
      beforeSnapshotRef: "snap-E1" as never,
      afterSnapshotRef: "snap-E2" as never,
      extensionPlanRef: "plan-ref",
      admissionTombstoneId: "tomb-001" as never,
      committedBy: "operator",
      committedAt: "2026-08-11T15:00:00Z",
      storeSequence: 1 as never,
      correlationId: correlationId("corr-rc-001"),
      occurrenceId: occurrenceId("occ-rc-001"),
      idempotencyKey: idempotencyKey("idem-rc-001"),
      planDigest: "plan-digest" as never,
      authorizationEvidenceRef: "auth-evidence-rc-001" as never,
    };

    const planResult = buildReconnectPlanFromReceipt({
      resolver: services.receiptResolver,
      receipt,
      sessionId: sessionId("session-rc-001"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }

    registerSessionBindingForReconnectPlan(services.store, planResult.value);

    const committed = await executeAdmissionReconnect({ services, plan: planResult.value });
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }
    expect(committed.value.planDigest).toBe(planResult.value.planDigest);
    expect(services.events.events.some((event) => event.kind === "ReconnectCommitted")).toBe(true);
    expect(services.store.snapshot().occurrences).toHaveLength(1);
    expect(services.store.snapshot().occurrences[0]?.operation.family).toBe("instanceReconnect");
  });

  it("commits reconnect through real runtime epoch administration", async () => {
    const harness = buildCommsRuntimeHarness();
    const admissionId = schemaAdmissionId("adm-reconnect-runtime-001");
    const prepared = await harness.epochAdmin.prepareEpochTransition({
      domainId: harness.binding.activationDomainId,
      admissionId,
      planDigest: "plan-digest-rc-runtime" as never,
      expectedHead: harness.runtime.getHead()!.snapshotRef,
      expectedBindingGeneration: harness.binding.bindingGeneration,
      expectedEpochId: harness.binding.epochId,
      expectedEpochOrdinal: harness.binding.epochOrdinal,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      targetSchemaRef: harness.binding.schemaRef,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    const epochCommitted = await harness.epochAdmin.commitEpochTransition(prepared.value);
    expect(epochCommitted.ok).toBe(true);
    if (!epochCommitted.ok) {
      return;
    }

    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => epochCommitted.value.toBinding },
      sessionAuthority: { isController: () => true, isMember: () => true },
      runtimeCommit: harness.runtimePorts.runtimeCommit,
      observation: harness.runtimePorts.observation,
      quiescence: {
        resourcesClear: async () => true,
        sessionsQuiescent: async () => true,
      },
      clock: { now: () => new Date().toISOString() },
    });

    const receipt = {
      admissionId,
      activationDomainId: harness.binding.activationDomainId,
      fromBinding: epochCommitted.value.fromBinding,
      toBinding: epochCommitted.value.toBinding,
      beforeSnapshotRef: epochCommitted.value.beforeSnapshotRef,
      afterSnapshotRef: epochCommitted.value.afterSnapshotRef,
      extensionPlanRef: "plan-ref",
      admissionTombstoneId: "tomb-runtime-001" as never,
      committedBy: "operator",
      committedAt: "2026-08-11T15:00:00Z",
      storeSequence: 1 as never,
      correlationId: correlationId("corr-rc-runtime-001"),
      occurrenceId: occurrenceId("occ-rc-runtime-001"),
      idempotencyKey: idempotencyKey("idem-rc-runtime-001"),
      planDigest: "plan-digest-rc-runtime" as never,
      authorizationEvidenceRef: "auth-evidence-rc-runtime-001" as never,
    };

    const planResult = buildReconnectPlanFromReceipt({
      resolver: services.receiptResolver,
      receipt,
      sessionId: sessionId("session-rc-runtime-001"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
    });
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) {
      return;
    }

    registerSessionBindingForReconnectPlan(services.store, planResult.value);

    const committed = await executeAdmissionReconnect({ services, plan: planResult.value });
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }
    expect(committed.value.runtimeReceiptRef).toBe(epochCommitted.value.afterSnapshotRef as string);
  });
});
