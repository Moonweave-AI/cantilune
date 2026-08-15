import type { CoordinationIntent, Footprint } from "@cantilune/core";
import { footprintFromTargets, targetsFromMatchBindings } from "@cantilune/core";
import type { OperationTemplate } from "../schema/operationTemplate.js";

/**
 * ADR-0002 C-prime: authoritative touch set from normalized matchBindings only.
 */
export function effectiveFootprintForAdmission(
  intent: CoordinationIntent,
  _template: OperationTemplate,
): Footprint {
  return footprintFromTargets(targetsFromMatchBindings(intent.matchBindings));
}

export function requestedFootprintFromIntent(intent: CoordinationIntent): Footprint {
  return footprintFromTargets(intent.targets);
}
