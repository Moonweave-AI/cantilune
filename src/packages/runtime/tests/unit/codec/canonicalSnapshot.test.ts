import { describe, expect, it } from "vitest";
import { snapshotsCanonicallyEqual } from "../../../src/codec/canonicalSnapshot.js";
import {
  actorId,
  actorRef,
  collaborationLink,
  collaborationSnapshot,
  communicationSession,
  contentRef,
  epochId,
  linkId,
  scopedCapability,
  sessionId,
  snapshotRef,
  withArtifact,
  withCapability,
  withLink,
  withSession,
  workArtifact,
} from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";

describe("snapshotsCanonicallyEqual", () => {
  it("returns true for identical world content with different snapshotRef", () => {
    const base = buildConfigT0();
    const left = collaborationSnapshot({ ...base, snapshotRef: snapshotRef("snap-A") });
    const right = collaborationSnapshot({ ...base, snapshotRef: snapshotRef("snap-B") });
    expect(snapshotsCanonicallyEqual(left, right)).toBe(true);
  });

  it("returns false when epochId differs", () => {
    const base = buildConfigT0();
    const right = collaborationSnapshot({ ...base, epochId: epochId("99") });
    expect(snapshotsCanonicallyEqual(base, right)).toBe(false);
  });

  it("compares artifacts capabilities sessions and links", () => {
    let enriched = withArtifact(
      buildConfigT0(),
      workArtifact(
        "task-T" as never,
        "Task",
        contentRef("content://task-T"),
        actorRef(actorId("planner-p"), "agent"),
        "active",
      ),
    );
    enriched = withCapability(
      enriched,
      scopedCapability("cap-1" as never, "write_lock", actorId("planner-p"), {
        kind: "artifact",
        artifactId: "task-T" as never,
      }),
    );
    enriched = withSession(
      enriched,
      communicationSession(
        sessionId("session-s"),
        actorId("planner-p"),
        [actorId("planner-p")],
        "shared",
      ),
    );
    enriched = withLink(
      enriched,
      collaborationLink(
        linkId("link-1"),
        "parallel_with",
        { kind: "participant", actorId: actorId("planner-p") },
        { kind: "participant", actorId: actorId("coder-c") },
      ),
    );
    const clone = collaborationSnapshot({
      ...enriched,
      snapshotRef: snapshotRef("snap-other"),
    });
    expect(snapshotsCanonicallyEqual(enriched, clone)).toBe(true);
  });

  it("returns false when links or policy context differ", () => {
    const base = buildConfigT0();
    const linked = withLink(
      base,
      collaborationLink(
        linkId("link-1"),
        "parallel_with",
        { kind: "participant", actorId: actorId("planner-p") },
        { kind: "participant", actorId: actorId("coder-c") },
      ),
    );
    expect(snapshotsCanonicallyEqual(base, linked)).toBe(false);

    const policyVariant = collaborationSnapshot({
      ...base,
      policyContext: {
        approvalState: { kind: "awaiting_review", reviewers: [] },
        retryState: { kind: "idle" },
      },
    });
    expect(snapshotsCanonicallyEqual(base, policyVariant)).toBe(false);
  });

  it("returns false when auditTail or retired entities differ", () => {
    const base = buildConfigT0();
    const withAudit = collaborationSnapshot({
      ...base,
      auditTail: [
        {
          sequenceNo: 1,
          source: actorRef(actorId("planner-p"), "agent"),
          payloadRef: contentRef("content://obs"),
          receivedAt: "2026-08-07T10:00:00Z" as never,
        },
      ],
    });
    expect(snapshotsCanonicallyEqual(base, withAudit)).toBe(false);

    const retiredVariant = collaborationSnapshot({
      ...base,
      retiredEntities: [
        {
          entityId: "task-T" as never,
          entityKind: "artifact",
          retiredAt: "2026-08-07T10:00:00Z" as never,
        },
      ],
    });
    expect(snapshotsCanonicallyEqual(base, retiredVariant)).toBe(false);

    const withArtifactSnap = withArtifact(
      base,
      workArtifact(
        "task-T" as never,
        "Task",
        contentRef("content://task-T"),
        actorRef(actorId("planner-p"), "agent"),
        "active",
      ),
    );
    expect(snapshotsCanonicallyEqual(base, withArtifactSnap)).toBe(false);
  });
});
