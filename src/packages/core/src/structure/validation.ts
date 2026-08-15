import type { TargetRef } from "../primitives/refs.js";
import type { Footprint } from "./boundary.js";
import { footprintFromTargets } from "./isolation.js";
import type { CompositionIntent } from "./operators.js";
import { coreViolation, throwCore } from "../primitives/violation.js";

/** True when `outer` includes every id present in `inner` across all footprint dimensions. */
export function footprintCovers(outer: Footprint, inner: Footprint): boolean {
  return (
    coversSet(outer.artifactIds, inner.artifactIds) &&
    coversSet(outer.participantIds, inner.participantIds) &&
    coversSet(outer.sessionIds, inner.sessionIds) &&
    coversSet(outer.capabilityIds, inner.capabilityIds) &&
    coversSet(outer.linkIds, inner.linkIds)
  );
}

/** True when the declared footprint includes all entities referenced by targets. */
export function footprintCoversTargets(
  footprintValue: Footprint,
  targets: readonly TargetRef[],
): boolean {
  return footprintCovers(footprintValue, footprintFromTargets(targets));
}

/**
 * Ensures agent-declared footprint is wide enough for stated targets.
 * ADR-0002 C-prime: under-coverage is rejected; extra ids in footprint are allowed (conservative lock).
 */
export function validateCompositionIntentFootprint(intent: CompositionIntent): void {
  if (!footprintCoversTargets(intent.footprint, intent.targets)) {
    throwCore(
      coreViolation(
        "footprint_undercovers_targets",
        "CompositionIntent footprint does not cover all targets; concurrent isolation and admission may diverge",
      ),
    );
  }
}

function coversSet<T>(outer: ReadonlySet<T>, inner: ReadonlySet<T>): boolean {
  for (const value of inner) {
    if (!outer.has(value)) {
      return false;
    }
  }
  return true;
}
