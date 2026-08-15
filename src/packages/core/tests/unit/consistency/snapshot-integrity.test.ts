import { describe, expect, it } from "vitest";
import { collaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import {
  validateSnapshotIntegrity,
  validateSnapshotIntegrityResult,
} from "../../../src/consistency/snapshotIntegrity.js";
import { actorRef, participant } from "../../../src/nodes/participant.js";
import { observationEntry } from "../../../src/nodes/observationEntry.js";
import { withApprovalState, emptyPolicyContext } from "../../../src/nodes/policyContext.js";
import { workArtifact } from "../../../src/nodes/workArtifact.js";
import { actorId, artifactId, epochId } from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { CoreError } from "../../../src/primitives/violation.js";

function minimalSnapshot() {
  const planner = participant(actorId("planner-p"), "agent");
  return collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
    participants: new Map([[planner.actorId, planner]]),
    artifacts: new Map([
      [
        artifactId("task-T"),
        workArtifact(
          artifactId("task-T"),
          "Task",
          contentRef("content://task-T"),
          actorRef(planner.actorId, "agent"),
        ),
      ],
    ]),
  });
}

describe("validateSnapshotIntegrity", () => {
  it("accepts a coherent minimal snapshot", () => {
    expect(() => validateSnapshotIntegrity(minimalSnapshot())).not.toThrow();
    expect(validateSnapshotIntegrityResult(minimalSnapshot()).ok).toBe(true);
  });

  it("throws CoreError for unregistered policy reviewer", () => {
    const snapshot = collaborationSnapshot({
      ...minimalSnapshot(),
      policyContext: withApprovalState(emptyPolicyContext, {
        kind: "awaiting_review",
        reviewers: ["reviewer-r"],
      }),
    });
    expect(() => validateSnapshotIntegrity(snapshot)).toThrow(CoreError);
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("snapshot_integrity");
      expect(result.error.path).toBe("policyContext.approvalState.reviewers");
    }
  });

  it("throws CoreError for artifact owner kind mismatch", () => {
    const base = minimalSnapshot();
    const badOwner = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      actorRef(actorId("planner-p"), "human"),
    );
    const snapshot = collaborationSnapshot({
      ...base,
      artifacts: new Map([[artifactId("task-T"), badOwner]]),
    });
    expect(() => validateSnapshotIntegrity(snapshot)).toThrow(CoreError);
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("actor_kind_mismatch");
    }
  });

  it("throws CoreError for auditTail source kind mismatch", () => {
    const base = minimalSnapshot();
    const snapshot = collaborationSnapshot({
      ...base,
      auditTail: [
        observationEntry(
          1,
          actorRef(actorId("planner-p"), "human"),
          contentRef("content://obs-1"),
          timestamp("2026-08-07T10:00:00Z"),
        ),
      ],
    });
    expect(() => validateSnapshotIntegrity(snapshot)).toThrow(CoreError);
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("actor_kind_mismatch");
      expect(result.error.path).toBe("auditTail[0].source");
    }
  });

  it("throws CoreError for auditTail sequence gap", () => {
    const base = minimalSnapshot();
    const planner = base.participants.get(actorId("planner-p"))!;
    const snapshot = collaborationSnapshot({
      ...base,
      auditTail: [
        observationEntry(
          2,
          actorRef(planner.actorId, planner.kind),
          contentRef("content://obs-1"),
          timestamp("2026-08-07T10:00:00Z"),
        ),
      ],
    });
    expect(() => validateSnapshotIntegrity(snapshot)).toThrow(CoreError);
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("observation_sequence_invalid");
    }
  });

  it("throws for participant map key mismatch", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      participants: new Map([[actorId("wrong-key"), planner]]),
    });
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
  });

  it("throws for capability scoped to missing artifact", () => {
    const base = minimalSnapshot();
    const snapshot = collaborationSnapshot({
      ...base,
      capabilities: new Map([
        [
          "cap-1" as never,
          {
            capabilityId: "cap-1",
            kind: "write_lock",
            holder: actorId("planner-p"),
            scope: { kind: "artifact", artifactId: artifactId("missing") },
          } as never,
        ],
      ]),
    });
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
  });

  it("throws when tombstone references live entity", () => {
    const base = minimalSnapshot();
    const snapshot = collaborationSnapshot({
      ...base,
      retiredEntities: [
        {
          entityId: "task-T",
          entityKind: "artifact",
          retiredAt: timestamp("2026-08-07T10:00:00Z"),
        },
      ],
    });
    const result = validateSnapshotIntegrityResult(snapshot);
    expect(result.ok).toBe(false);
  });
});
