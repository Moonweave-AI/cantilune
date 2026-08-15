import { planDigest, type PlanDigest } from "@cantilune/core";
import type { SchemaExtensionPlan } from "./monotoneExtensionValidator.js";

/** Canonical plan digest — never JSON.stringify raw Maps. */
export function extensionPlanCanonicalDigest(plan: SchemaExtensionPlan): PlanDigest {
  const canonical = JSON.stringify({
    fromSchemaRef: plan.fromSchemaRef,
    toSchemaRef: plan.toSchemaRef,
    addedObjectTypeIds: [...plan.addedObjectTypeIds],
    addedOperationTypeIds: [...plan.addedOperationTypeIds],
    objectEmbedding: [...plan.objectEmbedding.entries()],
    operationEmbedding: [...plan.operationEmbedding.entries()],
  });
  return planDigest(canonical);
}
