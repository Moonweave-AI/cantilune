import type { TrustStore, TrustRootEntry } from "../ports/trustStore.js";

/** Test-only trust roots for signed human review in harnesses — NOT production authority. */
export function createTestReviewerTrustStore(
  entries: readonly TrustRootEntry[],
  version = "trust/test-reviewers",
): TrustStore {
  return {
    version,
    getRoots(scope: string) {
      if (scope !== "conformance/human-review") {
        return [];
      }
      return entries;
    },
  };
}

/** Fixed ed25519 test reviewer — private key lives only in `./testing`. */
export const TEST_REVIEWER_KEY_ID = "test-reviewer-ed25519";
export const TEST_REVIEWER_PUBLIC_KEY = Uint8Array.from(
  Buffer.from("8156466856f4e87d396d2b0afb916b181de9fcddfad3cdbabe990f4295d89013", "hex"),
);

export function defaultTestReviewerTrustStore(): TrustStore {
  return createTestReviewerTrustStore([
    {
      keyId: TEST_REVIEWER_KEY_ID,
      publicKey: TEST_REVIEWER_PUBLIC_KEY,
      scope: ["formal", "security"],
      notBefore: "2020-01-01T00:00:00.000Z",
      expiresAt: "2099-12-31T23:59:59.999Z",
    },
  ]);
}
