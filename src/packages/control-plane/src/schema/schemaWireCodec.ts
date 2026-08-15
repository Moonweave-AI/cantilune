import type { OrchestrationSchema } from "@cantilune/runtime";
import { cloneOrchestrationSchema } from "./immutableSchema.js";
import { createSchemaRevision, type SchemaRevision } from "./schemaRevision.js";
import { schemaId, type SchemaId, type SchemaRevisionId } from "@cantilune/core";

export interface WireOrchestrationSchema {
  readonly schemaId: string;
  readonly wireVersion: number;
  readonly objectTypes: readonly (readonly [string, unknown])[];
  readonly operationTypes: readonly (readonly [string, unknown])[];
  readonly templates: readonly unknown[];
  readonly resourceRules: readonly unknown[];
}

export function encodeOrchestrationSchema(schema: OrchestrationSchema): WireOrchestrationSchema {
  return {
    schemaId: schema.schemaId,
    wireVersion: schema.wireVersion,
    objectTypes: [...schema.objectTypes.entries()],
    operationTypes: [...schema.operationTypes.entries()],
    templates: schema.templates,
    resourceRules: schema.resourceRules,
  };
}

export function decodeOrchestrationSchema(wire: WireOrchestrationSchema): OrchestrationSchema {
  return cloneOrchestrationSchema({
    schemaId: schemaId(wire.schemaId) as SchemaId,
    wireVersion: wire.wireVersion,
    objectTypes: new Map(wire.objectTypes as unknown as OrchestrationSchema["objectTypes"]),
    operationTypes: new Map(
      wire.operationTypes as unknown as OrchestrationSchema["operationTypes"],
    ),
    templates: wire.templates as OrchestrationSchema["templates"],
    resourceRules: wire.resourceRules as OrchestrationSchema["resourceRules"],
  });
}

export function encodeSchemaRevision(revision: SchemaRevision): unknown {
  return {
    schemaRef: revision.schemaRef,
    parentRef: revision.parentRef,
    schema: encodeOrchestrationSchema(revision.schema),
    wireVersion: revision.wireVersion,
    canonicalDigest: revision.canonicalDigest,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt,
    provenanceEvidence: revision.provenanceEvidence,
  };
}

export function decodeSchemaRevision(wire: {
  readonly schemaRef: SchemaRevision["schemaRef"];
  readonly parentRef?: SchemaRevision["parentRef"];
  readonly schema: WireOrchestrationSchema;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly provenanceEvidence?: readonly string[];
}): SchemaRevision {
  const schema = decodeOrchestrationSchema(wire.schema);
  return createSchemaRevision({
    schema,
    revisionId: wire.schemaRef.revisionId as SchemaRevisionId,
    createdBy: wire.createdBy,
    createdAt: wire.createdAt,
    ...(wire.parentRef !== undefined ? { parentRef: wire.parentRef } : {}),
    ...(wire.provenanceEvidence !== undefined
      ? { provenanceEvidence: wire.provenanceEvidence }
      : {}),
  });
}
