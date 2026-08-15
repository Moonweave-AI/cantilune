import { asBrand, type Brand } from "./ids.js";

function asNumberBrand<T extends number, B extends string>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

export type SchemaId = Brand<string, "SchemaId">;
export type SchemaRevisionId = Brand<string, "SchemaRevisionId">;
export type SchemaDigest = Brand<string, "SchemaDigest">;
export type ObjectTypeId = Brand<string, "ObjectTypeId">;
export type PolicyId = Brand<string, "PolicyId">;
export type PolicyRevisionId = Brand<string, "PolicyRevisionId">;
export type HandlerManifestId = Brand<string, "HandlerManifestId">;
export type HandlerManifestDigest = Brand<string, "HandlerManifestDigest">;
export type SchemaAdmissionId = Brand<string, "SchemaAdmissionId">;
export type ActivationDomainId = Brand<string, "ActivationDomainId">;
export type RuntimeInstanceId = Brand<string, "RuntimeInstanceId">;
export type BindingGeneration = Brand<number, "BindingGeneration">;
export type EpochOrdinal = Brand<number, "EpochOrdinal">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type CausationId = Brand<string, "CausationId">;
export type OccurrenceId = Brand<string, "OccurrenceId">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;
export type ControlPlaneEventId = Brand<string, "ControlPlaneEventId">;
export type StoreSequence = Brand<number, "StoreSequence">;
export type PreparedAdmissionId = Brand<string, "PreparedAdmissionId">;
export type AdmissionTombstoneId = Brand<string, "AdmissionTombstoneId">;
export type PlanDigest = Brand<string, "PlanDigest">;
export type ContentDigest = Brand<string, "ContentDigest">;

export const schemaId = (value: string): SchemaId => asBrand(value);
export const schemaRevisionId = (value: string): SchemaRevisionId => asBrand(value);
export const schemaDigest = (value: string): SchemaDigest => asBrand(value);
export const objectTypeId = (value: string): ObjectTypeId => asBrand(value);
export const policyId = (value: string): PolicyId => asBrand(value);
export const policyRevisionId = (value: string): PolicyRevisionId => asBrand(value);
export const handlerManifestId = (value: string): HandlerManifestId => asBrand(value);
export const handlerManifestDigest = (value: string): HandlerManifestDigest => asBrand(value);
export const schemaAdmissionId = (value: string): SchemaAdmissionId => asBrand(value);
export const activationDomainId = (value: string): ActivationDomainId => asBrand(value);
export const runtimeInstanceId = (value: string): RuntimeInstanceId => asBrand(value);
export const bindingGeneration = (value: number): BindingGeneration => asNumberBrand(value);
export const epochOrdinal = (value: number): EpochOrdinal => asNumberBrand(value);
export const correlationId = (value: string): CorrelationId => asBrand(value);
export const causationId = (value: string): CausationId => asBrand(value);
export const occurrenceId = (value: string): OccurrenceId => asBrand(value);
export const idempotencyKey = (value: string): IdempotencyKey => asBrand(value);
export const controlPlaneEventId = (value: string): ControlPlaneEventId => asBrand(value);
export const storeSequence = (value: number): StoreSequence => asNumberBrand(value);
export const preparedAdmissionId = (value: string): PreparedAdmissionId => asBrand(value);
export const admissionTombstoneId = (value: string): AdmissionTombstoneId => asBrand(value);
export const planDigest = (value: string): PlanDigest => asBrand(value);
export const contentDigest = (value: string): ContentDigest => asBrand(value);

/** Immutable pointer to a registered schema revision. */
export interface SchemaRef {
  readonly schemaId: SchemaId;
  readonly revisionId: SchemaRevisionId;
  readonly digest: SchemaDigest;
}

export function schemaRef(
  schemaIdValue: SchemaId,
  revisionId: SchemaRevisionId,
  digest: SchemaDigest,
): SchemaRef {
  return { schemaId: schemaIdValue, revisionId, digest };
}

/** Immutable pointer to a registered policy revision. */
export interface PolicyRef {
  readonly policyId: PolicyId;
  readonly revisionId: PolicyRevisionId;
  readonly digest: ContentDigest;
}

export function policyRef(
  policyIdValue: PolicyId,
  revisionId: PolicyRevisionId,
  digest: ContentDigest,
): PolicyRef {
  return { policyId: policyIdValue, revisionId, digest };
}

/** Immutable pointer to a handler manifest snapshot. */
export interface HandlerManifestRef {
  readonly manifestId: HandlerManifestId;
  readonly digest: HandlerManifestDigest;
}

export function handlerManifestRef(
  manifestId: HandlerManifestId,
  digest: HandlerManifestDigest,
): HandlerManifestRef {
  return { manifestId, digest };
}
