import type { ContentDigest } from "@cantilune/core";
import type { CommonTrajectoryEvidence } from "../evidence/evidenceFamilies.js";
import type { TrajectorySubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

const SUBJECT_FIELDS: (keyof TrajectorySubject)[] = [
  "productSubjectRef",
  "epochChainRef",
  "initialStateRef",
  "terminalStateRef",
  "selectedOccurrenceRef",
  "trajectoryDigest",
  "kernelDigest",
];

function requireNonEmpty(value: string, path: string, violations: ConformanceViolation[]): boolean {
  if (value.length === 0) {
    violations.push(conformanceViolation("missing_evidence", `${path} is required`, path));
    return false;
  }
  return true;
}

function requireDigest(
  value: unknown,
  path: string,
  violations: ConformanceViolation[],
): value is ContentDigest {
  if (typeof value !== "string" || !isSha256HexDigest(value)) {
    violations.push(
      conformanceViolation("digest_mismatch", `${path} must be sha256 hex digest`, path),
    );
    return false;
  }
  return true;
}

export function computeTrajectoryEvidenceDigest(input: {
  readonly evidence: CommonTrajectoryEvidence;
  readonly subject: TrajectorySubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "fullProductTrajectory",
    subject: {
      productSubjectRef: input.subject.productSubjectRef,
      epochChainRef: input.subject.epochChainRef,
      initialStateRef: input.subject.initialStateRef,
      terminalStateRef: input.subject.terminalStateRef,
      selectedOccurrenceRef: input.subject.selectedOccurrenceRef,
      selectedIndex: input.subject.selectedIndex,
      trajectoryDigest: input.subject.trajectoryDigest,
      kernelDigest: input.subject.kernelDigest,
    },
    evidence: {
      trajectoryDigest: input.evidence.trajectoryDigest,
      terminalDigest: input.evidence.terminalDigest,
    },
  });
}

export function verifyTrajectoryEvidence(input: {
  readonly evidence: CommonTrajectoryEvidence;
  readonly subject: TrajectorySubject;
  readonly evidenceDigest: ContentDigest;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  for (const field of SUBJECT_FIELDS) {
    if (field === "selectedIndex") {
      if (input.subject.selectedIndex < 0) {
        violations.push(
          conformanceViolation(
            "trajectory_invalid",
            "selectedIndex must be non-negative",
            "subject.selectedIndex",
          ),
        );
      }
      continue;
    }
    requireNonEmpty(input.subject[field], `subject.${field}`, violations);
  }

  requireDigest(input.evidence.trajectoryDigest, "evidence.trajectoryDigest", violations);
  requireDigest(input.evidence.terminalDigest, "evidence.terminalDigest", violations);
  if (!requireDigest(input.evidenceDigest, "evidenceDigest", violations)) {
    return violations;
  }

  if ((input.evidence.trajectoryDigest as string) !== input.subject.trajectoryDigest) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "evidence trajectoryDigest must match subject.trajectoryDigest",
        "evidence.trajectoryDigest",
      ),
    );
  }

  const expected = computeTrajectoryEvidenceDigest(input);
  if ((input.evidenceDigest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "digest_mismatch",
        "trajectory evidenceDigest does not match recomputed digest",
        "evidenceDigest",
      ),
    );
  }

  return violations;
}
