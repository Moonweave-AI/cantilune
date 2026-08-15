import type { AuditSink } from "../../ports/auditSink.js";
import { createMemoryEvidenceStore } from "./memoryEvidenceStore.js";
import { createMemoryTrustStore } from "./memoryTrustStore.js";
import { createMemoryRevocationStore } from "./memoryRevocationStore.js";
import { createMemoryVerificationCache } from "./memoryVerificationCache.js";
import { createConformanceEngine } from "../../engine/conformanceEngine.js";

export interface MemoryConformanceEngineOptions {
  readonly audit: AuditSink;
}

export function createMemoryConformanceEngine(options: MemoryConformanceEngineOptions) {
  return createConformanceEngine({
    evidenceStore: createMemoryEvidenceStore(),
    trustStore: createMemoryTrustStore(),
    revocationStore: createMemoryRevocationStore(),
    cache: createMemoryVerificationCache(),
    audit: options.audit,
  });
}

export { createMemoryEvidenceStore } from "./memoryEvidenceStore.js";
export { createMemoryTrustStore } from "./memoryTrustStore.js";
export { createMemoryRevocationStore } from "./memoryRevocationStore.js";
export { createMemoryVerificationCache } from "./memoryVerificationCache.js";
export { createNoopAuditSink } from "./memoryAuditSink.js";
export { createMemoryCryptoVerifier } from "./memoryCryptoVerifier.js";
export {
  defaultTestReviewerTrustStore,
  TEST_REVIEWER_KEY_ID,
  TEST_REVIEWER_PUBLIC_KEY,
} from "./testReviewerTrustStore.js";
