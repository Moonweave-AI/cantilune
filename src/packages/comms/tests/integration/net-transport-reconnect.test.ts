import { describe, expect, it, afterEach } from "vitest";
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
} from "../../src/engine/createCommsServices.js";
import { connectNetTransportPair } from "../../src/transports/net/netTransport.js";
import { channelGeneration, channelId } from "../../src/foundation/messageId.js";
import type { AdmissionReconnectPlan } from "../../src/reconnect/admissionReconnectPlan.js";
import type { CommsStore } from "../../src/ports/commsStore.js";
import { A2A_PROFILE_PINNED } from "../../src/foundation/commsLimits.js";

const open: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(open.splice(0, open.length).map((t) => t.close().catch(() => undefined)));
});

function registerSessionBinding(store: CommsStore, plan: AdmissionReconnectPlan): void {
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
        transport: "net",
        codecRef: "comms/wire-v1",
        protocolVersion: "comms/1",
        a2aProfile: A2A_PROFILE_PINNED,
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

describe("NetTransport + admission reconnect (L6)", () => {
  it("commits an admission-bound reconnect and handshakes over mTLS", async () => {
    const [local, remote] = await connectNetTransportPair();
    open.push(local);
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
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => binding },
      sessionAuthority: { isController: () => true, isMember: () => true },
      quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      clock: { now: () => "2026-08-11T16:00:00Z" },
      transport: local,
    });
    const receipt = {
      admissionId: schemaAdmissionId("adm-net-rc"),
      activationDomainId: "default" as never,
      fromBinding: binding,
      toBinding: { ...binding },
      beforeSnapshotRef: "snap-E1" as never,
      afterSnapshotRef: "snap-E2" as never,
      extensionPlanRef: "plan-ref",
      admissionTombstoneId: "tomb-net" as never,
      committedBy: "operator",
      committedAt: "2026-08-11T15:00:00Z",
      storeSequence: 1 as never,
      correlationId: correlationId("corr-net-rc"),
      occurrenceId: occurrenceId("occ-net-rc"),
      idempotencyKey: idempotencyKey("idem-net-rc"),
      planDigest: "plan-digest" as never,
      authorizationEvidenceRef: "auth-net" as never,
    };
    const plan = buildReconnectPlanFromReceipt({
      resolver: services.receiptResolver,
      receipt,
      sessionId: sessionId("session-net-rc"),
      operationTemplateRef: operationTemplateRef("introduce", "1"),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }
    registerSessionBinding(services.store, plan.value);
    const committed = await executeAdmissionReconnect({ services, plan: plan.value });
    expect(committed.ok).toBe(true);
    const sid = sessionId("session-net-rc-hs");
    const hs = await local.handshake({
      sessionId: sid,
      authoritativeSnapshotRef: "snap-E2" as never,
      requester: "rt-req" as never,
      acceptor: "rt-acc" as never,
      offeredProtocols: [],
      endpointRef: "ep-net" as never,
      transcriptDigest: "transcript-net-rc",
      authEvidenceRef: "auth",
      metadata: {
        epochId: epochId("43"),
        epochOrdinal: epochOrdinal(2),
        operationTemplateRef: operationTemplateRef("introduce", "1"),
        sessionId: sid,
        correlationId: correlationId("corr-net-rc-hs"),
        occurrenceId: occurrenceId("occ-net-rc-hs"),
      },
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(hs.ok).toBe(true);
    expect(remote.transportId).toBe("net");
    expect(services.events.events.some((event) => event.kind === "ReconnectCommitted")).toBe(true);
  });
});
