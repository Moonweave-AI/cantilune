import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  collaborationNamespace,
  collaborationSnapshot,
  epochId,
  namespaceId,
  participant,
  participantTranscript,
  snapshotRef,
  transcriptAccessRequestId,
  withNamespace,
  withParticipant,
  withTranscript,
} from "@cantilune/core";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { createControlPlaneService } from "../../../src/engine/controlPlaneService.js";
import { createNamespaceRegistry } from "../../../src/namespace/namespaceRegistry.js";
import { createTranscriptAccessWorkflow } from "../../../src/namespace/transcriptAccessWorkflow.js";

describe("control-plane namespace RBAC service", () => {
  const tenantA = namespaceId("tenant-a");
  const admin = actorId("ns-admin");
  const outsider = actorId("outsider");
  const subject = actorId("writer");

  it("wires register, RBAC deny, subject-only decide, and fleet redaction", () => {
    const store = new MemoryControlPlaneStore();
    const namespaceRegistry = createNamespaceRegistry();
    const service = createControlPlaneService({
      store,
      namespaceRegistry,
      transcriptAccessWorkflow: createTranscriptAccessWorkflow({ registry: namespaceRegistry }),
    });
    const registered = service.registerNamespace({
      namespaceId: tenantA,
      displayName: "Tenant A",
      actorId: admin,
    });
    expect(registered.ok).toBe(true);
    expect(service.listNamespaces().some((item) => item.namespace.namespaceId === tenantA)).toBe(
      true,
    );

    const denied = service.assignNamespaceRole({
      namespaceId: tenantA,
      actorId: outsider,
      role: "member",
      assignedBy: outsider,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe("authorization_denied");
    }

    const requested = service.requestTranscriptAccess({
      requestId: transcriptAccessRequestId("req-svc"),
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: tenantA,
    });
    expect(requested.ok).toBe(true);
    const outsiderApprove = service.decideTranscriptAccess({
      requestId: transcriptAccessRequestId("req-svc"),
      decidedBy: actorRef(outsider, "agent"),
      status: "approved",
    });
    expect(outsiderApprove.ok).toBe(false);
    const approved = service.decideTranscriptAccess({
      requestId: transcriptAccessRequestId("req-svc"),
      decidedBy: actorRef(subject, "agent"),
      status: "approved",
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      expect(approved.value.capabilityDescription?.capability.kind).toBe("transcript_read");
    }

    let snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-svc"),
      epochId: epochId("1"),
    });
    snap = withNamespace(snap, collaborationNamespace(tenantA, "Tenant A"));
    snap = withParticipant(snap, participant(subject, "agent", "active", undefined, tenantA));
    snap = withTranscript(
      snap,
      participantTranscript(subject, [{ role: "assistant", content: "secret plan" }], {
        namespaceId: tenantA,
      }),
    );
    const fleet = service.projectFleetConsole(snap, admin);
    const writerView = fleet.transcripts.find((item) => item.actorId === subject);
    expect(writerView?.visibility.kind).toBe("summary");
  });

  it("freezes namespace and transcript mutations", () => {
    const store = new MemoryControlPlaneStore();
    const service = createControlPlaneService({ store });
    store.setFrozen(true);
    expect(
      service.registerNamespace({
        namespaceId: tenantA,
        displayName: "Frozen",
        actorId: admin,
      }).ok,
    ).toBe(false);
    expect(
      service.assignNamespaceRole({
        namespaceId: tenantA,
        actorId: outsider,
        role: "member",
        assignedBy: admin,
      }).ok,
    ).toBe(false);
    expect(
      service.requestTranscriptAccess({
        requestId: transcriptAccessRequestId("req-frozen"),
        requester: actorRef(outsider, "agent"),
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(false);
    expect(
      service.decideTranscriptAccess({
        requestId: transcriptAccessRequestId("req-frozen"),
        decidedBy: actorRef(subject, "agent"),
        status: "approved",
      }).ok,
    ).toBe(false);
  });
});
