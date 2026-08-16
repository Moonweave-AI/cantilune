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
  visibleTranscript,
  withCapability,
  withNamespace,
  withParticipant,
  withTranscript,
  withTranscriptAccessRequest,
  type ActorKind,
} from "@cantilune/core";
import { createNamespaceRegistry } from "../../../src/namespace/namespaceRegistry.js";
import {
  createTranscriptAccessWorkflow,
  decideTranscriptAccess,
  requestTranscriptAccess,
} from "../../../src/namespace/transcriptAccessWorkflow.js";

describe("transcript access workflow", () => {
  const tenantA = namespaceId("tenant-a");
  const tenantB = namespaceId("tenant-b");
  const subject = actorId("writer");
  const outsider = actorId("outsider");
  const requestId = transcriptAccessRequestId("req-1");

  function registryWithTenants() {
    const registry = createNamespaceRegistry();
    expect(
      registry.registerNamespace({
        namespaceId: tenantA,
        displayName: "A",
        actorId: subject,
      }).ok,
    ).toBe(true);
    expect(
      registry.registerNamespace({
        namespaceId: tenantB,
        displayName: "B",
        actorId: outsider,
      }).ok,
    ).toBe(true);
    return registry;
  }

  function world() {
    let snap = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("1"),
    });
    snap = withNamespace(snap, collaborationNamespace(tenantA, "A"));
    snap = withNamespace(snap, collaborationNamespace(tenantB, "B"));
    snap = withParticipant(snap, participant(subject, "agent", "active", undefined, tenantA));
    snap = withParticipant(snap, participant(outsider, "agent", "active", undefined, tenantB));
    return withTranscript(
      snap,
      participantTranscript(subject, [{ role: "assistant", content: "secret plan" }], {
        namespaceId: tenantA,
      }),
    );
  }

  it("creates a requested TranscriptAccessRequest", () => {
    const created = requestTranscriptAccess({
      requestId,
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: tenantA,
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.status).toBe("requested");
      expect(created.value.subjectActorId).toBe(subject);
    }
  });

  it("allows only the subject actor to approve and emits transcript_read for runtime", () => {
    const workflow = createTranscriptAccessWorkflow({ registry: registryWithTenants() });
    const requested = workflow.requestTranscriptAccess({
      requestId,
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: tenantA,
    });
    expect(requested.ok).toBe(true);

    const outsiderDecide = workflow.decideTranscriptAccess({
      requestId,
      decidedBy: actorRef(outsider, "agent"),
      status: "approved",
    });
    expect(outsiderDecide.ok).toBe(false);
    if (!outsiderDecide.ok) {
      expect(outsiderDecide.error.code).toBe("authorization_denied");
    }

    const approved = workflow.decideTranscriptAccess({
      requestId,
      decidedBy: actorRef(subject, "agent"),
      status: "approved",
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) {
      return;
    }
    expect(approved.value.request.status).toBe("approved");
    expect(approved.value.request.decidedBy?.actorId).toBe(subject);
    const capability = approved.value.capabilityDescription?.capability;
    expect(capability?.kind).toBe("transcript_read");
    expect(capability?.holder).toBe(outsider);
    expect(capability?.scope).toEqual({
      kind: "transcript",
      actorId: subject,
      namespaceId: tenantA,
    });
  });

  it("redacts an outsider to a summary until a grant is committed", () => {
    const snap = world();
    const seen = visibleTranscript(snap, outsider, subject);
    expect(seen.kind).toBe("summary");
    if (seen.kind === "summary") {
      expect(seen.transcript.messages[0]?.content).toContain("chars");
      expect(seen.transcript.messages[0]?.content).not.toContain("secret");
    }

    const created = requestTranscriptAccess({
      requestId,
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: tenantA,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const decided = decideTranscriptAccess(created.value, actorRef(subject, "agent"), "approved");
    expect(decided.ok).toBe(true);
    if (!decided.ok || decided.value.capabilityDescription === undefined) {
      return;
    }
    const granted = withCapability(
      withTranscriptAccessRequest(snap, decided.value.request),
      decided.value.capabilityDescription.capability,
    );
    const revealed = visibleTranscript(granted, outsider, subject);
    expect(revealed.kind).toBe("full");
    if (revealed.kind === "full") {
      expect(revealed.transcript.messages[0]?.content).toBe("secret plan");
    }
  });

  it("rejects unknown namespace, duplicate request, and illegal transitions", () => {
    const workflow = createTranscriptAccessWorkflow({ registry: registryWithTenants() });
    const missingNs = workflow.requestTranscriptAccess({
      requestId: transcriptAccessRequestId("req-missing-ns"),
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: namespaceId("no-such-ns"),
    });
    expect(missingNs.ok).toBe(false);
    expect(
      workflow.requestTranscriptAccess({
        requestId: transcriptAccessRequestId(""),
        requester: actorRef(outsider, "agent"),
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(false);

    expect(
      workflow.requestTranscriptAccess({
        requestId,
        requester: actorRef(outsider, "agent"),
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(true);
    const duplicate = workflow.requestTranscriptAccess({
      requestId,
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: tenantA,
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe("idempotency_conflict");
    }

    const denied = workflow.decideTranscriptAccess({
      requestId,
      decidedBy: actorRef(subject, "agent"),
      status: "denied",
    });
    expect(denied.ok).toBe(true);
    const approveDenied = workflow.decideTranscriptAccess({
      requestId,
      decidedBy: actorRef(subject, "agent"),
      status: "approved",
    });
    expect(approveDenied.ok).toBe(false);
    expect(workflow.getRequest(requestId)?.status).toBe("denied");
    expect(workflow.listRequests()).toHaveLength(1);
  });

  it("validates request fields and decide-by-request object", () => {
    expect(
      requestTranscriptAccess({
        requestId: transcriptAccessRequestId(""),
        requester: actorRef(outsider, "agent"),
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(false);
    expect(
      requestTranscriptAccess({
        requestId,
        requester: actorRef(actorId(""), "agent"),
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(false);
    expect(
      requestTranscriptAccess({
        requestId,
        requester: { actorId: outsider, kind: "not-an-actor" as ActorKind },
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(false);
    expect(
      requestTranscriptAccess({
        requestId,
        requester: actorRef(outsider, "agent"),
        subjectActorId: actorId(""),
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(false);
    expect(
      requestTranscriptAccess({
        requestId,
        requester: actorRef(outsider, "agent"),
        subjectActorId: subject,
        subjectNamespaceId: namespaceId(""),
      }).ok,
    ).toBe(false);

    const created = requestTranscriptAccess({
      requestId,
      requester: actorRef(outsider, "agent"),
      subjectActorId: subject,
      subjectNamespaceId: tenantA,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(
      decideTranscriptAccess(created.value, actorRef(actorId(""), "agent"), "approved").ok,
    ).toBe(false);
    expect(
      decideTranscriptAccess(
        created.value,
        { actorId: subject, kind: "not-an-actor" as ActorKind },
        "approved",
      ).ok,
    ).toBe(false);

    const workflow = createTranscriptAccessWorkflow();
    const missing = workflow.decideTranscriptAccess({
      decidedBy: actorRef(subject, "agent"),
      status: "approved",
    });
    expect(missing.ok).toBe(false);
    expect(
      workflow.decideTranscriptAccess({
        requestId: transcriptAccessRequestId("missing-req"),
        decidedBy: actorRef(subject, "agent"),
        status: "approved",
      }).ok,
    ).toBe(false);

    const viaObject = workflow.decideTranscriptAccess({
      request: created.value,
      decidedBy: actorRef(subject, "agent"),
      status: "approved",
    });
    expect(viaObject.ok).toBe(true);
    if (viaObject.ok) {
      expect(viaObject.value.capabilityDescription?.capability.kind).toBe("transcript_read");
    }

    const idempotent = decideTranscriptAccess(
      viaObject.ok ? viaObject.value.request : created.value,
      actorRef(subject, "agent"),
      "approved",
    );
    expect(idempotent.ok).toBe(true);

    const workflowBare = createTranscriptAccessWorkflow();
    expect(
      workflowBare.requestTranscriptAccess({
        requestId: transcriptAccessRequestId("req-bare"),
        requester: actorRef(outsider, "agent"),
        subjectActorId: subject,
        subjectNamespaceId: tenantA,
      }).ok,
    ).toBe(true);
    expect(
      workflowBare.decideTranscriptAccess({
        requestId: transcriptAccessRequestId("req-bare"),
        decidedBy: actorRef(subject, "agent"),
        status: "revoked",
      }).ok,
    ).toBe(true);

    const revoked = decideTranscriptAccess(
      viaObject.ok ? viaObject.value.request : created.value,
      actorRef(subject, "agent"),
      "revoked",
    );
    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      expect(revoked.value.capabilityDescription).toBeUndefined();
    }
    const revokeAgain = decideTranscriptAccess(
      revoked.ok ? revoked.value.request : created.value,
      actorRef(subject, "agent"),
      "approved",
    );
    expect(revokeAgain.ok).toBe(false);
  });
});
