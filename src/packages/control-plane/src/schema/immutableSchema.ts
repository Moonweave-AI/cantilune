import { snapshotOrchestrationSchema, type OrchestrationSchema } from "@cantilune/runtime";

/**
 * Take the detached runtime-authoritative schema snapshot.
 *
 * In particular, this must not use `Object.freeze(new Map())`: freezing a Map
 * does not disable its internal-slot mutators. The runtime snapshot boundary
 * also recursively detaches declarations, metadata, contracts, conditions,
 * templates, resource rules, arrays, Maps, and Sets.
 */
export function cloneOrchestrationSchema(schema: OrchestrationSchema): OrchestrationSchema {
  return snapshotOrchestrationSchema(schema);
}
