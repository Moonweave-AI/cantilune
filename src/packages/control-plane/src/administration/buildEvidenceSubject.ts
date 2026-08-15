import type { SchemaAdmissionRecord } from "../admission/schemaAdmissionRequest.js";
import type { SchemaEpochBinding } from "@cantilune/core";
import type { AdmissionEvidenceSubject } from "./evidenceSubject.js";

export function buildAdmissionEvidenceSubject(
  record: SchemaAdmissionRecord,
  active: SchemaEpochBinding,
): AdmissionEvidenceSubject | undefined {
  if (
    record.targetSchemaRef === undefined ||
    record.targetEpochId === undefined ||
    record.targetEpochOrdinal === undefined ||
    record.extensionPlan === undefined
  ) {
    return undefined;
  }
  const planDig = record.qualification?.extensionPlanDigest;
  if (planDig === undefined) {
    return undefined;
  }
  return {
    admissionId: record.request.admissionId,
    activationDomainId: record.request.activationDomainId,
    fromSchemaRef: active.schemaRef,
    toSchemaRef: record.targetSchemaRef,
    fromEpochId: active.epochId,
    toEpochId: record.targetEpochId,
    fromEpochOrdinal: active.epochOrdinal,
    toEpochOrdinal: record.targetEpochOrdinal,
    extensionPlanDigest: planDig,
    expectedRuntimeHead: record.request.expectedRuntimeHead,
    expectedBindingGeneration: active.bindingGeneration as number,
  };
}

export function toFourViewSubject(subject: AdmissionEvidenceSubject) {
  return {
    admissionId: subject.admissionId as string,
    activationDomainId: subject.activationDomainId as string,
    fromSchemaRef: subject.fromSchemaRef,
    toSchemaRef: subject.toSchemaRef,
    fromEpochId: subject.fromEpochId as string,
    toEpochId: subject.toEpochId as string,
    fromEpochOrdinal: subject.fromEpochOrdinal as number,
    toEpochOrdinal: subject.toEpochOrdinal as number,
    extensionPlanDigest: subject.extensionPlanDigest as string,
    expectedRuntimeHead: subject.expectedRuntimeHead as string,
    expectedBindingGeneration: subject.expectedBindingGeneration,
  };
}
