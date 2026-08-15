import { type CommsViolationCode } from "../../foundation/commsViolation.js";

/** Maps A2A transport status codes to stable comms violation codes. */
export function mapA2AStatusToViolation(status: string): CommsViolationCode {
  switch (status) {
    case "UNAUTHENTICATED":
      return "identity_unverified";
    case "PERMISSION_DENIED":
      return "authorization_denied";
    case "NOT_FOUND":
      return "session_not_found";
    case "RESOURCE_EXHAUSTED":
      return "backpressure";
    case "UNAVAILABLE":
      return "transport_failed";
    case "DEADLINE_EXCEEDED":
      return "delivery_expired";
    default:
      return "transport_failed";
  }
}
