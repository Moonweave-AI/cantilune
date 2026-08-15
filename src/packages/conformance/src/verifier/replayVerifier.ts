import type { ContentDigest } from "@cantilune/core";
import type { ReplayEvidence } from "../evidence/evidenceFamilies.js";
import type { RuleOccurrenceSubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

const SUBJECT_FIELDS: (keyof RuleOccurrenceSubject)[] = [
  "artifactSubjectRef",
  "signatureVersion",
  "epochId",
  "ruleId",
  "occurrenceId",
  "beforeSnapshotRef",
  "eventRef",
  "afterSnapshotRef",
  "replayRecipeRef",
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

export function computeReplayEvidenceDigest(input: {
  readonly evidence: Pick<ReplayEvidence, "recipeRef" | "deterministic">;
  readonly subject: RuleOccurrenceSubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "fixedEpochRule",
    kind: "replay",
    subject: {
      artifactSubjectRef: input.subject.artifactSubjectRef,
      epochId: input.subject.epochId,
      ruleId: input.subject.ruleId,
      occurrenceId: input.subject.occurrenceId,
      replayRecipeRef: input.subject.replayRecipeRef,
    },
    evidence: {
      recipeRef: input.evidence.recipeRef,
      deterministic: input.evidence.deterministic,
    },
  });
}

/** Shared structural binding checks without replayDigest recomputation. */
export function verifyReplayEvidenceBinding(input: {
  readonly evidence: Pick<ReplayEvidence, "recipeRef" | "replayDigest" | "deterministic">;
  readonly subject: RuleOccurrenceSubject;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  for (const field of SUBJECT_FIELDS) {
    requireNonEmpty(input.subject[field], `subject.${field}`, violations);
  }

  requireNonEmpty(input.evidence.recipeRef, "evidence.recipeRef", violations);
  if (!requireDigest(input.evidence.replayDigest, "evidence.replayDigest", violations)) {
    return violations;
  }

  if (input.evidence.recipeRef !== input.subject.replayRecipeRef) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "replay recipeRef must match subject.replayRecipeRef",
        "evidence.recipeRef",
      ),
    );
  }

  if (!input.evidence.deterministic) {
    violations.push(
      conformanceViolation(
        "replay_failed",
        "replay evidence must declare deterministic execution",
        "evidence.deterministic",
      ),
    );
  }

  return violations;
}

/** Endpoint-free replay verification — structural binding without runtime replay execution. */
export function verifyReplayEvidence(input: {
  readonly evidence: ReplayEvidence;
  readonly subject: RuleOccurrenceSubject;
}): ConformanceViolation[] {
  const violations = verifyReplayEvidenceBinding(input);
  if (violations.length > 0) {
    return violations;
  }

  const expected = computeReplayEvidenceDigest(input);
  if ((input.evidence.replayDigest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "digest_mismatch",
        "replayDigest does not match recomputed evidence digest",
        "evidence.replayDigest",
      ),
    );
  }

  return violations;
}
