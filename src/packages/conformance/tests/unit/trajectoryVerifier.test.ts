import { describe, expect, it } from "vitest";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";
import type { TrajectorySubject } from "../../src/subject/admissionSubject.js";
import {
  computeTrajectoryEvidenceDigest,
  verifyTrajectoryEvidence,
} from "../../src/verifier/trajectoryVerifier.js";

function trajectorySubject(): TrajectorySubject {
  const trajectoryDigest = computeEvidenceDigest({ facet: "trajectory" });
  return {
    productSubjectRef: "product://subject/1",
    epochChainRef: "epoch-chain://1",
    initialStateRef: "state://initial",
    terminalStateRef: "state://terminal",
    selectedOccurrenceRef: "occurrence://selected",
    selectedIndex: 0,
    trajectoryDigest: trajectoryDigest as string,
    kernelDigest: computeEvidenceDigest({ facet: "kernel" }) as string,
  };
}

describe("trajectoryVerifier", () => {
  it("accepts digest-bound trajectory evidence", () => {
    const subject = trajectorySubject();
    const evidence = {
      trajectoryDigest: subject.trajectoryDigest as never,
      terminalDigest: computeEvidenceDigest({ facet: "terminal" }),
    };
    const evidenceDigest = computeTrajectoryEvidenceDigest({ evidence, subject });
    expect(verifyTrajectoryEvidence({ evidence, subject, evidenceDigest })).toEqual([]);
  });

  it("rejects trajectory digest subject mismatch", () => {
    const subject = trajectorySubject();
    const evidence = {
      trajectoryDigest: computeEvidenceDigest({ facet: "other-trajectory" }),
      terminalDigest: computeEvidenceDigest({ facet: "terminal" }),
    };
    const evidenceDigest = computeTrajectoryEvidenceDigest({ evidence, subject });
    const violations = verifyTrajectoryEvidence({ evidence, subject, evidenceDigest });
    expect(violations.some((v) => v.code === "subject_mismatch")).toBe(true);
  });

  it("rejects tampered trajectory evidence digest", () => {
    const subject = trajectorySubject();
    const evidence = {
      trajectoryDigest: subject.trajectoryDigest as never,
      terminalDigest: computeEvidenceDigest({ facet: "terminal" }),
    };
    const violations = verifyTrajectoryEvidence({
      evidence,
      subject,
      evidenceDigest: computeEvidenceDigest({ tampered: true }),
    });
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });
});
