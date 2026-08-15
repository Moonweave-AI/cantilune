import type { ContentDigest } from "@cantilune/core";
import type { DagSemanticEvidence } from "../evidence/evidenceFamilies.js";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

const SEMANTIC_FIELDS: (keyof DagSemanticEvidence)[] = [
  "configDigest",
  "sccDigest",
  "rankDigest",
  "edgeCoverageDigest",
];

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

export function computeDagSemanticDigest(input: {
  readonly semantic: DagSemanticEvidence;
  readonly subject: AdmissionSubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "fourProjection",
    projection: "dag",
    subject: {
      admissionId: input.subject.admissionId,
      activationDomainId: input.subject.activationDomainId,
      fromEpochId: input.subject.fromEpochId,
      toEpochId: input.subject.toEpochId,
    },
    semantic: {
      configDigest: input.semantic.configDigest,
      sccDigest: input.semantic.sccDigest,
      rankDigest: input.semantic.rankDigest,
      edgeCoverageDigest: input.semantic.edgeCoverageDigest,
    },
  });
}

export function verifyDagSemanticEvidence(input: {
  readonly semantic: DagSemanticEvidence;
  readonly digest: ContentDigest;
  readonly subject: AdmissionSubject;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  for (const field of SEMANTIC_FIELDS) {
    requireDigest(input.semantic[field], `semantic.${field}`, violations);
  }
  if (!requireDigest(input.digest, "digest", violations)) {
    return violations;
  }

  const expected = computeDagSemanticDigest(input);
  if ((input.digest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "projection_invalid",
        "dag projection digest does not match recomputed semantic digest",
        "digest",
      ),
    );
  }

  return violations;
}
