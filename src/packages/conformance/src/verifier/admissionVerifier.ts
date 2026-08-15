import type { ContentDigest } from "@cantilune/core";
import type {
  CrossEpochEvidence,
  FormalAdmissionEvidence,
  OperationalProjectionEvidence,
} from "../evidence/evidenceFamilies.js";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest, isSha256HexDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

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

export function computeFormalAdmissionDigest(input: {
  readonly admission: FormalAdmissionEvidence;
  readonly subject: AdmissionSubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "crossEpochProduct",
    kind: "formalAdmission",
    subject: {
      admissionId: input.subject.admissionId,
      activationDomainId: input.subject.activationDomainId,
      fromSchemaRef: input.subject.fromSchemaRef,
      toSchemaRef: input.subject.toSchemaRef,
      fromEpochId: input.subject.fromEpochId,
      toEpochId: input.subject.toEpochId,
      fromEpochOrdinal: input.subject.fromEpochOrdinal,
      toEpochOrdinal: input.subject.toEpochOrdinal,
      extensionPlanDigest: input.subject.extensionPlanDigest,
      expectedRuntimeHead: input.subject.expectedRuntimeHead,
      expectedBindingGeneration: input.subject.expectedBindingGeneration,
      tombstoneId: input.subject.tombstoneId,
    },
    evidence: {
      extensionDigest: input.admission.extensionDigest,
      tombstoneId: input.admission.tombstoneId,
    },
  });
}

export function computeCrossEpochChainDigest(input: {
  readonly epochChain: CrossEpochEvidence;
  readonly subject: AdmissionSubject;
}): ContentDigest {
  return computeEvidenceDigest({
    profile: "crossEpochProduct",
    kind: "epochChain",
    subject: {
      admissionId: input.subject.admissionId,
      fromEpochId: input.subject.fromEpochId,
      toEpochId: input.subject.toEpochId,
      fromEpochOrdinal: input.subject.fromEpochOrdinal,
      toEpochOrdinal: input.subject.toEpochOrdinal,
    },
    epochChain: {
      fromEpochId: input.epochChain.fromEpochId,
      toEpochId: input.epochChain.toEpochId,
    },
  });
}

export function verifyFormalAdmissionEvidence(input: {
  readonly admission: FormalAdmissionEvidence;
  readonly subject: AdmissionSubject;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  requireNonEmpty(input.subject.admissionId, "subject.admissionId", violations);
  requireNonEmpty(input.subject.fromEpochId, "subject.fromEpochId", violations);
  requireNonEmpty(input.subject.toEpochId, "subject.toEpochId", violations);

  if (!requireDigest(input.admission.admissionDigest, "admission.admissionDigest", violations)) {
    return violations;
  }
  requireDigest(input.admission.extensionDigest, "admission.extensionDigest", violations);

  if (input.subject.toEpochOrdinal <= input.subject.fromEpochOrdinal) {
    violations.push(
      conformanceViolation(
        "admission_invalid",
        "cross-epoch admission requires strictly increasing epoch ordinals",
        "subject.toEpochOrdinal",
      ),
    );
  }

  if (
    input.admission.tombstoneId !== undefined &&
    input.subject.tombstoneId !== undefined &&
    input.admission.tombstoneId !== input.subject.tombstoneId
  ) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "admission tombstoneId does not match subject",
        "admission.tombstoneId",
      ),
    );
  }

  const expected = computeFormalAdmissionDigest(input);
  if ((input.admission.admissionDigest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "digest_mismatch",
        "admissionDigest does not match recomputed formal admission digest",
        "admission.admissionDigest",
      ),
    );
  }

  return violations;
}

export function verifyCrossEpochEvidence(input: {
  readonly epochChain: CrossEpochEvidence;
  readonly subject: AdmissionSubject;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  requireNonEmpty(input.epochChain.fromEpochId, "epochChain.fromEpochId", violations);
  requireNonEmpty(input.epochChain.toEpochId, "epochChain.toEpochId", violations);
  if (!requireDigest(input.epochChain.chainDigest, "epochChain.chainDigest", violations)) {
    return violations;
  }

  if (input.epochChain.fromEpochId !== input.subject.fromEpochId) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "epoch chain fromEpochId must match subject",
        "epochChain.fromEpochId",
      ),
    );
  }
  if (input.epochChain.toEpochId !== input.subject.toEpochId) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "epoch chain toEpochId must match subject",
        "epochChain.toEpochId",
      ),
    );
  }

  const expected = computeCrossEpochChainDigest(input);
  if ((input.epochChain.chainDigest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "digest_mismatch",
        "chainDigest does not match recomputed cross-epoch chain digest",
        "epochChain.chainDigest",
      ),
    );
  }

  return violations;
}

export function verifyCrossEpochAdmission(input: {
  readonly admission: FormalAdmissionEvidence;
  readonly epochChain: CrossEpochEvidence;
  readonly subject: AdmissionSubject;
}): ConformanceViolation[] {
  return [
    ...verifyFormalAdmissionEvidence({
      admission: input.admission,
      subject: input.subject,
    }),
    ...verifyCrossEpochEvidence({
      epochChain: input.epochChain,
      subject: input.subject,
    }),
  ];
}

export function computeOperationalProjectionDigest(
  evidence: OperationalProjectionEvidence,
): ContentDigest {
  return computeEvidenceDigest({
    profile: "operationalProjection",
    evidence: {
      projectionKind: evidence.projectionKind,
      soundDigest: evidence.soundDigest,
      reflectionDigest: evidence.reflectionDigest,
    },
  });
}

export function verifyOperationalProjectionEvidence(input: {
  readonly evidence: OperationalProjectionEvidence;
  readonly evidenceDigest: ContentDigest;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  if (input.evidence.projectionKind !== "operational") {
    violations.push(
      conformanceViolation(
        "projection_invalid",
        "expected operational projection kind",
        "evidence.projectionKind",
      ),
    );
  }

  requireDigest(input.evidence.soundDigest, "evidence.soundDigest", violations);
  requireDigest(input.evidence.reflectionDigest, "evidence.reflectionDigest", violations);
  if (!requireDigest(input.evidenceDigest, "evidenceDigest", violations)) {
    return violations;
  }

  const expected = computeOperationalProjectionDigest(input.evidence);
  if ((input.evidenceDigest as string) !== (expected as string)) {
    violations.push(
      conformanceViolation(
        "digest_mismatch",
        "operational projection evidenceDigest does not match recomputed digest",
        "evidenceDigest",
      ),
    );
  }

  return violations;
}
