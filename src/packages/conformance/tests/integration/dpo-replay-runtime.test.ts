import { describe, expect, it } from "vitest";
import { computeDpoReplayExecutionDigest } from "../../src/verifier/dpoReplayVerifier.js";
import { verifyDpoReplayWithPort } from "../../src/verifier/dpoReplayVerifier.js";
import type { RuleOccurrenceSubject } from "../../src/subject/admissionSubject.js";
import { buildCommittedDpoReplayFixture } from "../support/dpoReplayFixture.js";

describe("runtime DPO replay integration", () => {
  it("replays committed change chain through runtime port", async () => {
    const { t0, changes, replayPort, recipeChainRef } = buildCommittedDpoReplayFixture();
    expect(changes.length).toBeGreaterThan(0);
    const last = changes.at(-1)!;

    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://conformance/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: recipeChainRef,
    };

    const replayDigest = computeDpoReplayExecutionDigest({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        changeCount: changes.length,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
      },
      subject,
    });

    const violations = await verifyDpoReplayWithPort({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        replayDigest,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
        changes,
      },
      subject,
      replayPort: replayPort,
    });
    expect(violations).toEqual([]);
  });
});
