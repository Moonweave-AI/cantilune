import { createHash } from "node:crypto";
import { schemaDigest, type SchemaDigest } from "@cantilune/core";
import type { OrchestrationSchema } from "./orchestrationSchema.js";

export interface CanonicalSchemaContent {
  readonly schemaId: string;
  readonly wireVersion: number;
  readonly objectTypes: readonly unknown[];
  readonly operationTypes: readonly unknown[];
  readonly templates: readonly unknown[];
  readonly resourceRules: readonly unknown[];
}

/** Canonical projection shared by runtime verification and control-plane registration. */
export function canonicalizeOrchestrationSchema(
  schema: OrchestrationSchema,
): CanonicalSchemaContent {
  return {
    schemaId: schema.schemaId,
    wireVersion: schema.wireVersion,
    objectTypes: [...schema.objectTypes.values()].sort((left, right) =>
      left.objectTypeId.localeCompare(right.objectTypeId),
    ),
    operationTypes: [...schema.operationTypes.values()].sort((left, right) =>
      left.operationTypeId.localeCompare(right.operationTypeId),
    ),
    templates: [...schema.templates].sort((left, right) =>
      `${left.operationTypeId}@${left.templateRef.revision}`.localeCompare(
        `${right.operationTypeId}@${right.templateRef.revision}`,
      ),
    ),
    resourceRules: [...schema.resourceRules].sort((left, right) =>
      left.ruleId.localeCompare(right.ruleId),
    ),
  };
}

/** SHA-256 identity of the complete canonical orchestration schema content. */
export function schemaContentDigest(schema: OrchestrationSchema): SchemaDigest {
  const canonical = JSON.stringify(sortValue(canonicalizeOrchestrationSchema(schema)));
  return schemaDigest(createHash("sha256").update(canonical, "utf8").digest("hex"));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, sortValue(record[key])]),
  );
}
