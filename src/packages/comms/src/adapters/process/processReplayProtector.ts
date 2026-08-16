/**
 * Explicit process-local replay protector — injectable for production wiring.
 */
import { type Result, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../../foundation/commsViolation.js";
import type { ReplayProtector } from "../../security/identityVerifier.js";

export function createProcessReplayProtector(): ReplayProtector {
  const seen = new Set<string>();
  return {
    checkReplay(input) {
      if (seen.has(input.messageDigest)) {
        return {
          ok: false,
          error: commsViolation("replay_detected", "ingress", "duplicate frame digest"),
        } satisfies Result<void, CommsViolation>;
      }
      return ok(undefined);
    },
    recordSeen(digest) {
      seen.add(digest);
    },
  };
}
