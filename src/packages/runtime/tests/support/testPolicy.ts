import type { EvidenceRef } from "@cantilune/core";
import type { PolicyEvaluator } from "../../src/ports/policyEvaluator.js";

/** Test-only policy — never use in production runtime wiring. */
export function allowAllPolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate({ intent }) {
      return {
        kind: "allow",
        authorization: (intent.external ?? []) as readonly EvidenceRef[],
      };
    },
  };
}
