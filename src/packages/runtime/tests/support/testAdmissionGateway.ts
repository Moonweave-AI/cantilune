import type { CollaborationSnapshot } from "@cantilune/core";
import { epochId } from "@cantilune/core";
import { AdmissionRegistry } from "../../src/admission/admissionRegistry.js";
import { createAdmissionGateway } from "../../src/admission/admissionGateway.js";
import { createActiveSchemaContext } from "../../src/engine/activeSchemaContext.js";
import { MemoryCollaborationStore, MemoryResourceLockTable } from "../../src/memory/index.js";
import { createDefaultSchema } from "../../src/schema/defaultSchema.js";
import { allowAllPolicyEvaluator } from "./testPolicy.js";

export function createTestAdmissionGateway(initial?: CollaborationSnapshot) {
  const store = new MemoryCollaborationStore(initial !== undefined ? { initial } : {});
  const locks = new MemoryResourceLockTable();
  const registry = new AdmissionRegistry(locks);
  const gateway = createAdmissionGateway({
    store,
    schemaContext: createActiveSchemaContext(createDefaultSchema(), epochId("42")),
    policy: allowAllPolicyEvaluator(),
    locks,
    registry,
  });
  return { gateway, store, locks, registry };
}
