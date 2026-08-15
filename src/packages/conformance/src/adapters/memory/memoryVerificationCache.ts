import type { VerificationCache } from "../../ports/verificationCache.js";
import type { VerificationDecision } from "../../foundation/verificationDecision.js";
import { cacheKeyString } from "../../ports/verificationCache.js";

export function createMemoryVerificationCache(): VerificationCache {
  const entries = new Map<string, VerificationDecision>();
  return {
    get(key) {
      return entries.get(cacheKeyString(key));
    },
    set(key, decision) {
      entries.set(cacheKeyString(key), decision);
    },
    invalidateAll() {
      entries.clear();
    },
  };
}
