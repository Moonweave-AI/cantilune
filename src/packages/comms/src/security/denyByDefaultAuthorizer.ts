import { err, type Result } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type CommsAuthorizer } from "./identityVerifier.js";

/** Production default — explicit allow rules must be injected. */
export function denyByDefaultAuthorizer(): CommsAuthorizer {
  return {
    authorize(): Result<void, CommsViolation> {
      return err(
        commsViolation("session_not_authorized", "authorize", "deny-by-default authorizer"),
      );
    },
  };
}
