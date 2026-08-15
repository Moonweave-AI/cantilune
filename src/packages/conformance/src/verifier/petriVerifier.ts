import type { ContentDigest } from "@cantilune/core";
import type { PetriSemanticEvidence } from "../evidence/evidenceFamilies.js";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

const SEMANTIC_FIELDS: (keyof PetriSemanticEvidence)[] = [
  "declarationDigest",
  "markingDigest",
  "firingDigest",
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

export function computePetriSemanticDigest(input: {
  readonly semantic: PetriSemanticEvidence;
  readonly subject: AdmissionSubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "fourProjection",
    projection: "petri",
    subject: {
      admissionId: input.subject.admissionId,
      activationDomainId: input.subject.activationDomainId,
      fromEpochId: input.subject.fromEpochId,
      toEpochId: input.subject.toEpochId,
    },
    semantic: {
      declarationDigest: input.semantic.declarationDigest,
      markingDigest: input.semantic.markingDigest,
      firingDigest: input.semantic.firingDigest,
      registryDigest: input.semantic.registryDigest,
    },
  });
}

export function verifyPetriSemanticEvidence(input: {
  readonly semantic: PetriSemanticEvidence;
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

  const expected = computePetriSemanticDigest(input);
  if ((input.digest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "projection_invalid",
        "petri projection digest does not match recomputed semantic digest",
        "digest",
      ),
    );
  }

  return violations;
}
