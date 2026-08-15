import type { ActivationDomainId, EpochId, SchemaEpochBinding, SchemaRef } from "@cantilune/core";
import {
  snapshotOrchestrationSchema,
  type OrchestrationSchema,
} from "../schema/orchestrationSchema.js";
import { schemaContentDigest } from "../schema/schemaContentDigest.js";
import { snapshotSchemaEpochBinding } from "../engine/activeSchemaContext.js";

/** Resolves active schema binding and historical schema content for a runtime instance. */
export interface RuntimeSchemaResolver {
  active(domainId: ActivationDomainId): Promise<SchemaEpochBinding | undefined>;
  /**
   * Resolve the exact queried SchemaRef. Runtime independently recomputes the
   * schema id and canonical content digest; revisionId remains catalog
   * provenance while equal schemaId+digest content is replay-equivalent.
   */
  resolveSchema(ref: SchemaRef): Promise<OrchestrationSchema | undefined>;
  resolveByEpoch(
    domainId: ActivationDomainId,
    epochId: EpochId,
  ): Promise<SchemaEpochBinding | undefined>;
}

export interface StaticSchemaResolverConfig {
  readonly domainId: ActivationDomainId;
  readonly binding: SchemaEpochBinding;
  readonly schemas: ReadonlyMap<string, OrchestrationSchema>;
}

/** Stable map key for the complete immutable schema reference. */
export function schemaLookupKey(ref: SchemaRef): string {
  return `${ref.schemaId}@${ref.revisionId}@${ref.digest}`;
}

export function createStaticSchemaResolver(
  config: StaticSchemaResolverConfig,
): RuntimeSchemaResolver {
  // Preserve the caller's full SchemaRef key.  Re-keying values by schemaId
  // loses revision and digest and makes every precise lookup miss.
  const domainIdSnapshot = config.domainId;
  const bindingSnapshot = snapshotSchemaEpochBinding(config.binding);
  const byRef = new Map(
    [...config.schemas].map(([key, schema]) => [key, snapshotOrchestrationSchema(schema)] as const),
  );

  const resolver: RuntimeSchemaResolver = {
    async active(domainId) {
      return domainId === domainIdSnapshot ? bindingSnapshot : undefined;
    },
    async resolveSchema(ref) {
      const schema = byRef.get(schemaLookupKey(ref));
      return schema !== undefined &&
        schema.schemaId === ref.schemaId &&
        schemaContentDigest(schema) === ref.digest
        ? schema
        : undefined;
    },
    async resolveByEpoch(domainId, epochId) {
      if (domainId !== domainIdSnapshot) {
        return undefined;
      }
      return bindingSnapshot.epochId === epochId ? bindingSnapshot : undefined;
    },
  };
  return Object.freeze(resolver);
}
