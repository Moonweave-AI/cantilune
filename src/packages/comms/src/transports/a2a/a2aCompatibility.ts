import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../../foundation/commsViolation.js";
import { A2A_PROFILE_PINNED } from "../../foundation/commsLimits.js";

export interface A2ACompatibilityMatrix {
  readonly pinnedProfile: typeof A2A_PROFILE_PINNED;
  readonly supportedWireVersions: readonly number[];
  readonly nMinusOneWireVersions: readonly number[];
}

export const A2A_COMPATIBILITY: A2ACompatibilityMatrix = {
  pinnedProfile: A2A_PROFILE_PINNED,
  supportedWireVersions: [1],
  nMinusOneWireVersions: [],
};

export function assertA2AProfileCompatible(offered: string): Result<void, CommsViolation> {
  if (offered !== A2A_PROFILE_PINNED) {
    return err(
      commsViolation("protocol_incompatible", "negotiate", `unsupported A2A profile: ${offered}`, {
        retryable: false,
      }),
    );
  }
  return ok(undefined);
}
