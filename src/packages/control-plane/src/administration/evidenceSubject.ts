import {
  contentDigest,
  planDigest,
  type ActivationDomainId,
  type ContentDigest,
  type EpochId,
  type EpochOrdinal,
  type PlanDigest,
  type SchemaAdmissionId,
  type SchemaRef,
  type SnapshotRef,
} from "@cantilune/core"; // NOSONAR — single import block, false positive

/** Canonical subject all qualification/authorization/four-view evidence must bind to. */
export interface AdmissionEvidenceSubject {
  readonly admissionId: SchemaAdmissionId;
  readonly activationDomainId: ActivationDomainId;
  readonly fromSchemaRef: SchemaRef;
  readonly toSchemaRef: SchemaRef;
  readonly fromEpochId: EpochId;
  readonly toEpochId: EpochId;
  readonly fromEpochOrdinal: EpochOrdinal;
  readonly toEpochOrdinal: EpochOrdinal;
  readonly extensionPlanDigest: PlanDigest;
  readonly expectedRuntimeHead: SnapshotRef;
  readonly expectedBindingGeneration: number;
}

export function admissionEvidenceSubjectDigest(subject: AdmissionEvidenceSubject): ContentDigest {
  return contentDigest(
    JSON.stringify({
      admissionId: subject.admissionId,
      domainId: subject.activationDomainId,
      fromSchemaRef: subject.fromSchemaRef,
      toSchemaRef: subject.toSchemaRef,
      fromEpochId: subject.fromEpochId,
      toEpochId: subject.toEpochId,
      fromEpochOrdinal: subject.fromEpochOrdinal,
      toEpochOrdinal: subject.toEpochOrdinal,
      extensionPlanDigest: subject.extensionPlanDigest,
      expectedRuntimeHead: subject.expectedRuntimeHead,
      expectedBindingGeneration: subject.expectedBindingGeneration,
    }),
  );
}

export function planDigestFromCanonical(canonical: string): PlanDigest {
  return planDigest(canonical);
}
