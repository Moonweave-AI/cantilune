import { err, ok } from "@cantilune/core";
import type { EvidenceStore } from "../../ports/evidenceStore.js";

export function createMemoryEvidenceStore(): EvidenceStore {
  const entries = new Map<string, Uint8Array>();
  return {
    async get(digest) {
      const value = entries.get(digest);
      if (value === undefined) {
        return err("not_found");
      }
      return ok(value);
    },
    async put(digest, bytes) {
      entries.set(digest, bytes);
      return ok(undefined);
    },
    async has(digest) {
      return entries.has(digest);
    },
  };
}
