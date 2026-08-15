import type { OrchestrationSchema } from "@cantilune/runtime";
import {
  schemaRef,
  type SchemaDigest,
  type SchemaId,
  type SchemaRef,
  type SchemaRevisionId,
} from "@cantilune/core";
import { schemaContentDigest } from "./schemaCanonicalization.js";
import { cloneOrchestrationSchema } from "./immutableSchema.js";

export type SchemaRevisionStatus = "registered" | "withdrawn" | "deprecated";

export interface SchemaRevision {
  readonly schemaRef: SchemaRef;
  readonly parentRef?: SchemaRef;
  readonly schema: OrchestrationSchema;
  readonly wireVersion: number;
  readonly canonicalDigest: SchemaDigest;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly provenanceEvidence?: readonly string[];
}

export interface SchemaRevisionSummary {
  readonly schemaRef: SchemaRef;
  readonly status: SchemaRevisionStatus;
  readonly createdAt: string;
}

function snapshotSchemaRef(ref: SchemaRef): SchemaRef {
  return Object.freeze({
    schemaId: ref.schemaId,
    revisionId: ref.revisionId,
    digest: ref.digest,
  });
}

/**
 * Detach every caller-owned value from a revision boundary.
 *
 * This is deliberately used for both store ingress and egress. Returning the
 * store's own frozen object would be safe today, but a fresh snapshot keeps the
 * authority boundary explicit and prevents future nested fields from silently
 * becoming aliases.
 */
export function snapshotSchemaRevision(revision: SchemaRevision): SchemaRevision {
  return Object.freeze({
    schemaRef: snapshotSchemaRef(revision.schemaRef),
    ...(revision.parentRef !== undefined
      ? { parentRef: snapshotSchemaRef(revision.parentRef) }
      : {}),
    schema: cloneOrchestrationSchema(revision.schema),
    wireVersion: revision.wireVersion,
    canonicalDigest: revision.canonicalDigest,
    createdBy: revision.createdBy,
    createdAt: revision.createdAt,
    ...(revision.provenanceEvidence !== undefined
      ? { provenanceEvidence: Object.freeze([...revision.provenanceEvidence]) }
      : {}),
  });
}

export function createSchemaRevision(input: {
  readonly schema: OrchestrationSchema;
  readonly revisionId: SchemaRevisionId;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly parentRef?: SchemaRef;
  readonly provenanceEvidence?: readonly string[];
}): SchemaRevision {
  const immutableSchema = cloneOrchestrationSchema(input.schema);
  const canonicalDigest = schemaContentDigest(immutableSchema);
  return snapshotSchemaRevision({
    schemaRef: schemaRef(immutableSchema.schemaId, input.revisionId, canonicalDigest),
    ...(input.parentRef !== undefined ? { parentRef: input.parentRef } : {}),
    schema: immutableSchema,
    wireVersion: immutableSchema.wireVersion,
    canonicalDigest,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    ...(input.provenanceEvidence !== undefined
      ? { provenanceEvidence: input.provenanceEvidence }
      : {}),
  });
}

/** Identity key — (schemaId, revisionId) unique; digest checked separately. */
export function revisionKey(ref: SchemaRef): string {
  return `${ref.schemaId}@${ref.revisionId}`;
}

export function sameSchemaFamily(left: SchemaId, right: SchemaId): boolean {
  return left === right;
}

/** Recompute digest after load; reject drift. */
export function verifySchemaRevisionIntegrity(revision: SchemaRevision): boolean {
  return (
    schemaContentDigest(revision.schema) === revision.canonicalDigest &&
    revision.schemaRef.digest === revision.canonicalDigest &&
    revision.schemaRef.schemaId === revision.schema.schemaId &&
    revision.wireVersion === revision.schema.wireVersion
  );
}
