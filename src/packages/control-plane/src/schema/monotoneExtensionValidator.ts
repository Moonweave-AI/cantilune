import {
  err,
  ok,
  type OperationTypeId,
  type ObjectTypeId,
  type Result,
  type SchemaRef,
} from "@cantilune/core";
import type { OrchestrationSchema } from "@cantilune/runtime";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";

export interface SchemaExtensionPlan {
  readonly fromSchemaRef: SchemaRef;
  readonly toSchemaRef: SchemaRef;
  readonly addedObjectTypeIds: readonly ObjectTypeId[];
  readonly addedOperationTypeIds: readonly OperationTypeId[];
  readonly objectEmbedding: ReadonlyMap<ObjectTypeId, ObjectTypeId>;
  readonly operationEmbedding: ReadonlyMap<OperationTypeId, OperationTypeId>;
}

function embedObjectTypes(
  fromSchema: OrchestrationSchema,
  toSchema: OrchestrationSchema,
): Result<Map<ObjectTypeId, ObjectTypeId>, ControlPlaneViolation> {
  const objectEmbedding = new Map<ObjectTypeId, ObjectTypeId>();
  for (const [objectTypeId, declaration] of fromSchema.objectTypes) {
    const next = toSchema.objectTypes.get(objectTypeId);
    if (next === undefined) {
      return err(
        controlPlaneViolation(
          "declaration_deleted",
          "validate",
          `object type deleted: ${objectTypeId}`,
          { path: objectTypeId },
        ),
      );
    }
    if (JSON.stringify(next) !== JSON.stringify(declaration)) {
      return err(
        controlPlaneViolation(
          "declaration_redefined",
          "validate",
          `object type redefined: ${objectTypeId}`,
          { path: objectTypeId },
        ),
      );
    }
    objectEmbedding.set(objectTypeId, objectTypeId);
  }
  return ok(objectEmbedding);
}

function checkDeclarationUnchanged(
  declaration: OrchestrationSchema["operationTypes"] extends ReadonlyMap<OperationTypeId, infer V>
    ? V
    : never,
  next: OrchestrationSchema["operationTypes"] extends ReadonlyMap<OperationTypeId, infer V>
    ? V
    : never,
  operationTypeId: OperationTypeId,
): ControlPlaneViolation | undefined {
  if (JSON.stringify(next.portContract) !== JSON.stringify(declaration.portContract)) {
    return controlPlaneViolation(
      "port_contract_changed",
      "validate",
      `port contract changed: ${operationTypeId}`,
      { path: operationTypeId },
    );
  }
  if (next.templateRef.revision !== declaration.templateRef.revision) {
    return controlPlaneViolation(
      "template_missing",
      "validate",
      `template revision drift: ${operationTypeId}`,
      { path: operationTypeId },
    );
  }
  if (next.requiredRoles.join(",") !== declaration.requiredRoles.join(",")) {
    return controlPlaneViolation(
      "declaration_redefined",
      "validate",
      `requiredRoles changed: ${operationTypeId}`,
      { path: operationTypeId },
    );
  }
  if (next.defaultVisibility !== declaration.defaultVisibility) {
    return controlPlaneViolation(
      "declaration_redefined",
      "validate",
      `defaultVisibility changed: ${operationTypeId}`,
      { path: operationTypeId },
    );
  }
  if (next.mayCreateSessions !== declaration.mayCreateSessions) {
    return controlPlaneViolation(
      "declaration_redefined",
      "validate",
      `mayCreateSessions changed: ${operationTypeId}`,
      { path: operationTypeId },
    );
  }
  return undefined;
}

function checkTemplateSnapshotUnchanged(
  fromSchema: OrchestrationSchema,
  toSchema: OrchestrationSchema,
  operationTypeId: OperationTypeId,
): ControlPlaneViolation | undefined {
  const fromTemplate = fromSchema.templates.find((t) => t.operationTypeId === operationTypeId);
  const toTemplate = toSchema.templates.find((t) => t.operationTypeId === operationTypeId);
  if (fromTemplate === undefined || toTemplate === undefined) {
    return controlPlaneViolation(
      "template_missing",
      "validate",
      `template snapshot missing: ${operationTypeId}`,
    );
  }
  if (JSON.stringify(fromTemplate.requires) !== JSON.stringify(toTemplate.requires)) {
    return controlPlaneViolation(
      "declaration_redefined",
      "validate",
      `template requires changed: ${operationTypeId}`,
    );
  }
  if (JSON.stringify(fromTemplate.ensures) !== JSON.stringify(toTemplate.ensures)) {
    return controlPlaneViolation(
      "declaration_redefined",
      "validate",
      `template ensures changed: ${operationTypeId}`,
    );
  }
  if (fromTemplate.description !== toTemplate.description) {
    return controlPlaneViolation(
      "declaration_redefined",
      "validate",
      `template description changed: ${operationTypeId}`,
    );
  }
  return undefined;
}

function embedOperationTypes(
  fromSchema: OrchestrationSchema,
  toSchema: OrchestrationSchema,
): Result<Map<OperationTypeId, OperationTypeId>, ControlPlaneViolation> {
  const operationEmbedding = new Map<OperationTypeId, OperationTypeId>();
  for (const [operationTypeId, declaration] of fromSchema.operationTypes) {
    const next = toSchema.operationTypes.get(operationTypeId);
    if (next === undefined) {
      return err(
        controlPlaneViolation(
          "declaration_deleted",
          "validate",
          `operation type deleted: ${operationTypeId}`,
          { path: operationTypeId },
        ),
      );
    }
    const declViolation = checkDeclarationUnchanged(declaration, next, operationTypeId);
    if (declViolation) return err(declViolation);

    const templateViolation = checkTemplateSnapshotUnchanged(fromSchema, toSchema, operationTypeId);
    if (templateViolation) return err(templateViolation);

    operationEmbedding.set(operationTypeId, operationTypeId);
  }
  return ok(operationEmbedding);
}

function validateResourceRulesUnchanged(
  fromSchema: OrchestrationSchema,
  toSchema: OrchestrationSchema,
): Result<void, ControlPlaneViolation> {
  if (fromSchema.resourceRules.length !== toSchema.resourceRules.length) {
    return err(
      controlPlaneViolation("declaration_redefined", "validate", "resource rules count changed"),
    );
  }
  for (let index = 0; index < fromSchema.resourceRules.length; index += 1) {
    const left = fromSchema.resourceRules[index]!;
    const right = toSchema.resourceRules[index]!;
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      return err(
        controlPlaneViolation(
          "declaration_redefined",
          "validate",
          `resource rule changed at index ${index}`,
        ),
      );
    }
  }
  return ok(undefined);
}

export function computeMonotoneExtensionPlan(
  fromSchema: OrchestrationSchema,
  toSchema: OrchestrationSchema,
  fromRef: SchemaRef,
  toRef: SchemaRef,
): Result<SchemaExtensionPlan, ControlPlaneViolation> {
  if (fromSchema.schemaId !== toSchema.schemaId) {
    return err(
      controlPlaneViolation(
        "non_monotone_extension",
        "validate",
        "schema family mismatch for monotone extension",
      ),
    );
  }

  const objectEmbedding = embedObjectTypes(fromSchema, toSchema);
  if (!objectEmbedding.ok) {
    return objectEmbedding;
  }

  const operationEmbedding = embedOperationTypes(fromSchema, toSchema);
  if (!operationEmbedding.ok) {
    return operationEmbedding;
  }

  const resourceRules = validateResourceRulesUnchanged(fromSchema, toSchema);
  if (!resourceRules.ok) {
    return resourceRules;
  }

  const addedObjectTypeIds = [...toSchema.objectTypes.keys()].filter(
    (id) => !fromSchema.objectTypes.has(id),
  );
  const addedOperationTypeIds = [...toSchema.operationTypes.keys()].filter(
    (id) => !fromSchema.operationTypes.has(id),
  );

  return ok({
    fromSchemaRef: fromRef,
    toSchemaRef: toRef,
    addedObjectTypeIds,
    addedOperationTypeIds,
    objectEmbedding: objectEmbedding.value,
    operationEmbedding: operationEmbedding.value,
  });
}
