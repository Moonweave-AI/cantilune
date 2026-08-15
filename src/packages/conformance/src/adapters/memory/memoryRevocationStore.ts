import type { RevocationStore } from "../../ports/revocationStore.js";

export function createMemoryRevocationStore(checkpoint = "revocation/m2"): RevocationStore {
  return {
    checkpoint,
    async isRevoked() {
      return false;
    },
  };
}
