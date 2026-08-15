import type { TrustStore } from "../../ports/trustStore.js";

export function createMemoryTrustStore(version = "trust/m2"): TrustStore {
  return {
    version,
    getRoots() {
      return [];
    },
  };
}
