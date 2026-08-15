/**
 * Control-plane registration and runtime replay must use one canonical schema
 * identity algorithm. Keeping a second implementation here allowed valid
 * SchemaRefs to name different bytes at the two authority boundaries.
 */
export {
  canonicalizeOrchestrationSchema,
  schemaContentDigest,
  type CanonicalSchemaContent,
} from "@cantilune/runtime";
