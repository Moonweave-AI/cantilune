import { contentDigest, type ContentDigest } from "@cantilune/core";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { ContentAddressedStore } from "../../ports/stateGovernance.js";

export function createMemoryContentAddressedStore(): ContentAddressedStore {
  const store = new Map<string, Uint8Array>();

  return {
    async put(data: Uint8Array): Promise<EvaluationResult<ContentDigest>> {
      const digest = await computeDigest(data);
      store.set(digest, new Uint8Array(data));
      return ok(contentDigest(digest));
    },

    async get(digest: ContentDigest): Promise<EvaluationResult<Uint8Array>> {
      const data = store.get(digest);
      if (data === undefined) {
        return violations([
          violation("evidence_digest_mismatch", "cas.get", `Content not found: ${digest}`),
        ]);
      }
      return ok(new Uint8Array(data));
    },

    async has(digest: ContentDigest): Promise<boolean> {
      return store.has(digest);
    },
  };
}

async function computeDigest(data: Uint8Array): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
