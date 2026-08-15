import { describe, expect, it } from "vitest";
import {
  correlationId,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  schemaAdmissionId,
  schemaRevisionId,
  sessionId,
} from "@cantilune/core";
import {
  channelId,
  createCommsReconnectService,
  createCommsServices,
  descriptorRef,
  wireVersion,
} from "@cantilune/comms";
import { buildAdmissionHarness, createSchemaRevision } from "../support/buildAdmissionHarness.js";

describe("comms reconnect handoff after admission", () => {
  it("hands off epoch metadata from admission receipt to reconnect service", async () => {
    const harness = buildAdmissionHarness();
    const { genesisRevision } = harness;
    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-handoff"),
      parentRef: genesisRevision.schemaRef,
      createdBy: "author",
      createdAt: "2026-08-11T04:00:00Z",
    });
    harness.registerRevision(candidate);

    const committed = await harness.runAdmissionPipeline({
      admissionId: schemaAdmissionId("adm-handoff-001"),
      candidate,
      idempotencyKey: idempotencyKey("idem-handoff-001"),
      requestedAt: "2026-08-11T04:00:00Z",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }

    const services = createCommsServices({
      mode: "test",
      bindingResolver: {
        getActiveBinding: (domainId) => harness.store.getActiveBinding(domainId),
      },
      sessionAuthority: { isController: () => true, isMember: () => true },
      runtimeCommit: {
        commitReconnect: async () => ({ ok: true, value: { receiptRef: "runtime-handoff" } }),
        commitMessage: async () => ({ ok: true, value: { receiptRef: "runtime-message-handoff" } }),
      },
      quiescence: {
        resourcesClear: async () => true,
        sessionsQuiescent: async () => true,
      },
    });

    services.store.casSessionBinding({
      sessionId: sessionId("session-handoff"),
      expectedGeneration: 0 as never,
      next: {
        sessionId: sessionId("session-handoff"),
        authoritativeSnapshotRef: "snap-handoff" as never,
        localRuntimeInstanceId: "rt-local" as never,
        remoteRuntimeInstanceId: "rt-remote" as never,
        channelId: channelId("ch-handoff"),
        channelGeneration: 1 as never,
        localEndpoint: descriptorRef("endpoint-local"),
        remoteEndpoint: descriptorRef("endpoint-remote"),
        negotiated: {
          wireVersion: wireVersion(1),
          transport: "loopback",
          codecRef: "json",
          protocolVersion: "1.0",
          a2aProfile: "default",
          features: [],
        },
        schemaEpochId: committed.value.toBinding.epochId as string,
        status: "active",
        outboundSequence: 0,
        inboundSequence: 0,
        establishedAt: "2026-08-11T04:00:00Z",
        updatedAt: "2026-08-11T04:00:00Z",
      },
    });

    const comms = createCommsReconnectService({ services });
    const receipt = await comms.instanceReconnect({
      handoff: {
        targetEpochId: committed.value.toBinding.epochId,
        targetEpochOrdinal: committed.value.toBinding.epochOrdinal,
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sessionId("session-handoff"),
        correlationId: correlationId(committed.value.correlationId as string),
        occurrenceId: occurrenceId(committed.value.occurrenceId as string),
      },
      peerDescriptorRef: "peer://worker-1",
      admissionReceipt: committed.value,
    });
    expect(receipt.sessionId).toBe("session-handoff");
    expect(receipt.correlationId).toBe(committed.value.correlationId);
    expect(receipt.planDigest).toBeDefined();
  });
});
