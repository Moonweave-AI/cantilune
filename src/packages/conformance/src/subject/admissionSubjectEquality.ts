import type { AdmissionSubject } from "./admissionSubject.js";

const SUBJECT_KEYS: readonly (keyof AdmissionSubject)[] = [
  "admissionId",
  "activationDomainId",
  "fromSchemaRef",
  "toSchemaRef",
  "fromEpochId",
  "toEpochId",
  "fromEpochOrdinal",
  "toEpochOrdinal",
  "extensionPlanDigest",
  "expectedRuntimeHead",
  "expectedBindingGeneration",
  "tombstoneId",
];

function schemaRefEqual(
  left: AdmissionSubject["fromSchemaRef"],
  right: AdmissionSubject["fromSchemaRef"],
): boolean {
  return (
    left.schemaId === right.schemaId &&
    left.revisionId === right.revisionId &&
    left.digest === right.digest
  );
}

/** Canonical field-wise admission subject equality — order-independent. */
export function admissionSubjectsEqual(left: AdmissionSubject, right: AdmissionSubject): boolean {
  if (
    left.admissionId !== right.admissionId ||
    left.activationDomainId !== right.activationDomainId ||
    left.fromEpochId !== right.fromEpochId ||
    left.toEpochId !== right.toEpochId ||
    left.fromEpochOrdinal !== right.fromEpochOrdinal ||
    left.toEpochOrdinal !== right.toEpochOrdinal ||
    left.extensionPlanDigest !== right.extensionPlanDigest ||
    left.expectedRuntimeHead !== right.expectedRuntimeHead ||
    left.expectedBindingGeneration !== right.expectedBindingGeneration ||
    (left.tombstoneId ?? "") !== (right.tombstoneId ?? "")
  ) {
    return false;
  }
  return (
    schemaRefEqual(left.fromSchemaRef, right.fromSchemaRef) &&
    schemaRefEqual(left.toSchemaRef, right.toSchemaRef)
  );
}

export function extractAdmissionSubjectFields(
  value: Record<string, unknown>,
): Partial<AdmissionSubject> {
  const out: Partial<AdmissionSubject> = {};
  for (const key of SUBJECT_KEYS) {
    if (Object.hasOwn(value, key)) {
      (out as Record<string, unknown>)[key] = value[key];
    }
  }
  return out;
}
