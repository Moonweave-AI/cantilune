import type { EvidenceRef } from "@cantilune/core";
import type { PolicyEvaluator } from "@cantilune/runtime";

/** Test-only policy for conformance integration fixtures. */
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
