import { describe, expect, it } from "vitest";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { RuleOccurrenceSubject } from "../../src/subject/admissionSubject.js";
import {
  computeReplayEvidenceDigest,
  verifyReplayEvidence,
} from "../../src/verifier/replayVerifier.js";

function ruleOccurrenceSubject(): RuleOccurrenceSubject {
  return {
    artifactSubjectRef: "artifact://pkg/1",
    signatureVersion: "sig-v1",
    epochId: "epoch-42",
    ruleId: "rule-native-1",
    occurrenceId: "occ-001",
    beforeSnapshotRef: "snap-before",
    eventRef: "event-001",
    afterSnapshotRef: "snap-after",
    replayRecipeRef: "recipe://replay/1",
  };
}

describe("replayVerifier", () => {
  it("accepts digest-bound deterministic replay evidence", () => {
    const subject = ruleOccurrenceSubject();
    const evidence = {
      recipeRef: subject.replayRecipeRef,
      deterministic: true,
      replayDigest: computeReplayEvidenceDigest({
        evidence: { recipeRef: subject.replayRecipeRef, deterministic: true },
        subject,
      }),
    };
    expect(verifyReplayEvidence({ evidence, subject })).toEqual([]);
  });

  it("rejects recipeRef subject mismatch", () => {
    const subject = ruleOccurrenceSubject();
    const evidence = {
      recipeRef: "recipe://other",
      deterministic: true,
      replayDigest: computeEvidenceDigest({ tampered: true }),
    };
    const violations = verifyReplayEvidence({ evidence, subject });
    expect(violations.some((v) => v.code === "subject_mismatch")).toBe(true);
  });

  it("rejects non-deterministic replay evidence", () => {
    const subject = ruleOccurrenceSubject();
    const evidence = {
      recipeRef: subject.replayRecipeRef,
      deterministic: false,
      replayDigest: computeReplayEvidenceDigest({
        evidence: { recipeRef: subject.replayRecipeRef, deterministic: false },
        subject,
      }),
    };
    const violations = verifyReplayEvidence({ evidence, subject });
    expect(violations.some((v) => v.code === "replay_failed")).toBe(true);
  });

  it("rejects tampered replayDigest", () => {
    const subject = ruleOccurrenceSubject();
    const evidence = {
      recipeRef: subject.replayRecipeRef,
      deterministic: true,
      replayDigest: computeEvidenceDigest({ tampered: true }),
    };
    const violations = verifyReplayEvidence({ evidence, subject });
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });
});
