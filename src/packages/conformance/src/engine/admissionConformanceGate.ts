import type { VerificationDecision } from "../foundation/verificationDecision.js";

export function evaluateAdmissionConformanceGate(
  decision: VerificationDecision,
): "blocked" | "conditional" {
  if (decision.profile !== "engineeringAdmission" && decision.profile !== "crossEpochProduct") {
    return "blocked";
  }
  if (decision.status.machine !== "verified" || decision.violations.length > 0) {
    return "blocked";
  }
  return "conditional";
}
