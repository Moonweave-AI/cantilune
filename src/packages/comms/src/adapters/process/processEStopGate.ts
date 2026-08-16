/**
 * Explicit process-local E-Stop — injectable, never a silent production default.
 */
import type { EStopGate } from "../../security/identityVerifier.js";

export function createProcessEStopGate(initialFrozen = false): EStopGate {
  let frozen = initialFrozen;
  return {
    isFrozen: () => frozen,
    setFrozen: (next: boolean) => {
      frozen = next;
    },
  };
}
