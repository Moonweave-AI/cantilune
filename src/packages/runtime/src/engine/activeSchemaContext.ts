import type { EpochId, OperationTypeId, SchemaEpochBinding } from "@cantilune/core";
import type { OrchestrationSchema } from "../schema/orchestrationSchema.js";
import {
  allowedOperationsFromSchema,
  resolveTemplate,
  snapshotOrchestrationSchema,
} from "../schema/orchestrationSchema.js";
import type { OperationTemplate } from "../schema/operationTemplate.js";

/** Active schema view for admission/replay at a pinned epoch. */
export interface ActiveSchemaContext {
  readonly epochId: EpochId;
  readonly schema: OrchestrationSchema;
  readonly binding?: SchemaEpochBinding;
  readonly allowedOperations: ReadonlySet<OperationTypeId>;
  getTemplate(operationTypeId: OperationTypeId, revision?: string): OperationTemplate | undefined;
}

export function createActiveSchemaContext(
  schema: OrchestrationSchema,
  epochId: EpochId,
  binding?: SchemaEpochBinding | undefined,
): ActiveSchemaContext {
  const schemaSnapshot = snapshotOrchestrationSchema(schema);
  const bindingSnapshot = binding === undefined ? undefined : snapshotSchemaEpochBinding(binding);
  return Object.freeze({
    epochId,
    schema: schemaSnapshot,
    ...(bindingSnapshot !== undefined ? { binding: bindingSnapshot } : {}),
    allowedOperations: allowedOperationsFromSchema(schemaSnapshot),
    getTemplate(operationTypeId: OperationTypeId, revision?: string) {
      return resolveTemplate(schemaSnapshot, operationTypeId, revision);
    },
  });
}

function ownDataProperty<Source extends object, Key extends keyof Source>(
  source: Source,
  key: Key,
): Source[Key];
function ownDataProperty<Value>(source: object, key: PropertyKey): Value;
function ownDataProperty<Value>(source: object, key: PropertyKey): Value {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`Expected own data property ${String(key)}`);
  }
  return descriptor.value as Value;
}

function optionalOwnDataProperty<Source extends object, Key extends keyof Source>(
  source: Source,
  key: Key,
): Source[Key] | undefined;
function optionalOwnDataProperty<Value>(source: object, key: PropertyKey): Value | undefined;
function optionalOwnDataProperty<Value>(source: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor)) {
    throw new TypeError(`Expected own data property ${String(key)}`);
  }
  return descriptor.value as Value;
}

export function snapshotSchemaEpochBinding(binding: SchemaEpochBinding): SchemaEpochBinding {
  if (binding === null || typeof binding !== "object") {
    throw new TypeError("Expected schema epoch binding object");
  }
  const schemaRef = ownDataProperty(binding, "schemaRef");
  const policyRef = ownDataProperty(binding, "policyRef");
  const handlerManifestRef = ownDataProperty(binding, "handlerManifestRef");
  const previousBindingGeneration = optionalOwnDataProperty(binding, "previousBindingGeneration");

  return Object.freeze({
    activationDomainId: ownDataProperty(binding, "activationDomainId"),
    bindingGeneration: ownDataProperty(binding, "bindingGeneration"),
    epochId: ownDataProperty(binding, "epochId"),
    epochOrdinal: ownDataProperty(binding, "epochOrdinal"),
    schemaRef: Object.freeze({
      schemaId: ownDataProperty(schemaRef, "schemaId"),
      revisionId: ownDataProperty(schemaRef, "revisionId"),
      digest: ownDataProperty(schemaRef, "digest"),
    }),
    policyRef: Object.freeze({
      policyId: ownDataProperty(policyRef, "policyId"),
      revisionId: ownDataProperty(policyRef, "revisionId"),
      digest: ownDataProperty(policyRef, "digest"),
    }),
    handlerManifestRef: Object.freeze({
      manifestId: ownDataProperty(handlerManifestRef, "manifestId"),
      digest: ownDataProperty(handlerManifestRef, "digest"),
    }),
    runtimeHead: ownDataProperty(binding, "runtimeHead"),
    admissionId: ownDataProperty(binding, "admissionId"),
    ...(previousBindingGeneration !== undefined ? { previousBindingGeneration } : {}),
    activatedBy: ownDataProperty(binding, "activatedBy"),
    activatedAt: ownDataProperty(binding, "activatedAt"),
  });
}
