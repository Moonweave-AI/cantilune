import type { Result } from "@cantilune/core";

export interface EvidenceStore {
  readonly get: (digest: string) => Promise<Result<Uint8Array, "not_found" | "unavailable">>;
  readonly put: (digest: string, bytes: Uint8Array) => Promise<Result<void, "unavailable">>;
  readonly has: (digest: string) => Promise<boolean>;
}
