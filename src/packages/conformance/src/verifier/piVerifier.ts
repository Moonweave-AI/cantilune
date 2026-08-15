import type { ContentDigest } from "@cantilune/core";
import type { PiSemanticEvidence } from "../evidence/evidenceFamilies.js";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

const SEMANTIC_FIELDS: (keyof PiSemanticEvidence)[] = [
  "nativeStepDigest",
  "actionDigest",
  "freshnessDigest",
  "registryDigest",
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

export function computePiSemanticDigest(input: {
  readonly semantic: PiSemanticEvidence;
  readonly subject: AdmissionSubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "fourProjection",
    projection: "pi",
    subject: {
      admissionId: input.subject.admissionId,
      activationDomainId: input.subject.activationDomainId,
      fromEpochId: input.subject.fromEpochId,
      toEpochId: input.subject.toEpochId,
    },
    semantic: {
      nativeStepDigest: input.semantic.nativeStepDigest,
      actionDigest: input.semantic.actionDigest,
      freshnessDigest: input.semantic.freshnessDigest,
      registryDigest: input.semantic.registryDigest,
    },
  });
}

export function verifyPiSemanticEvidence(input: {
  readonly semantic: PiSemanticEvidence;
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

  const expected = computePiSemanticDigest(input);
  if ((input.digest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "projection_invalid",
        "pi projection digest does not match recomputed semantic digest",
        "digest",
      ),
    );
  }

  return violations;
}
