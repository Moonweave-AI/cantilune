/**
 * The token-game firing engine: consume from input places, produce to output
 * places. Firing is pure and total — the input marking is never mutated, and a
 * disabled fire returns `ok: false` with no partial effect.
 */

import {
  classifyArcsForTransition,
  findTransition,
  hasSelfLoopArc,
  type EnabledTransition,
  type FireBlockedReason,
  type Marking,
  type PetriNet,
  tokensAt,
} from "./net.js";

/** The optional binding pass-through (coloured nets are out of scope; no-op). */
export type FireBinding = Readonly<Record<string, string>>;

/** The outcome of one fire attempt. */
export interface FireResult {
  /** Whether the transition fired. */
  readonly ok: boolean;
  /** When ok, the next marking; when blocked, the unchanged input marking. */
  readonly marking: Marking;
  /** When ok, the transition that fired. */
  readonly transition?: EnabledTransition["transition"];
  /** When blocked, why. */
  readonly blockedReason?: FireBlockedReason;
  /** When blocked by an under-marked input, the place ids that lacked tokens. */
  readonly underMarked?: readonly string[];
  /** The optional binding pass-through (coloured nets are out of scope; no-op). */
  readonly binding?: FireBinding;
}

/** Compute the next marking by consuming and producing tokens per the arc set. */
function applyFire(
  marking: Marking,
  inputs: readonly { readonly placeId: string }[],
  outputs: readonly { readonly placeId: string }[],
): Marking {
  const next = new Map(marking);
  // Consume: enabled fire guarantees each input place held ≥1 token, so it is
  // present in the marking. Subtract 1 per input arc (clamped ≥ 0).
  for (const arc of inputs) {
    const current = marking.get(arc.placeId) ?? 0;
    next.set(arc.placeId, Math.max(0, current - 1));
  }
  // Produce: output places may not yet exist in the marking; default to 0.
  for (const arc of outputs) {
    const current = next.get(arc.placeId) ?? 0;
    next.set(arc.placeId, current + 1);
  }
  return next;
}

/**
 * Fire `transitionId` under `marking`.
 *
 * @param binding Optional coloured-net binding. Forward-compatible no-op: the
 *   engine fires a plain place/transition net, so the binding is recorded but
 *   not interpreted. Documented so it is not a silent fabrication.
 */
export function fire(
  net: PetriNet,
  marking: Marking,
  transitionId: string,
  binding?: FireBinding,
): FireResult {
  const transition = findTransition(net, transitionId);
  if (transition === undefined) {
    return {
      ok: false,
      marking,
      blockedReason: "unknown-transition",
      ...(binding !== undefined && { binding }),
    };
  }
  if (hasSelfLoopArc(net, transitionId)) {
    return {
      ok: false,
      marking,
      blockedReason: "self-loop-arc",
      ...(binding !== undefined && { binding }),
    };
  }
  const classified = classifyArcsForTransition(net, transitionId);
  const underMarked = classified.inputs
    .filter((arc) => tokensAt(marking, arc.placeId) < 1)
    .map((arc) => arc.placeId);
  if (underMarked.length > 0) {
    return {
      ok: false,
      marking,
      blockedReason: "disabled",
      underMarked,
      ...(binding !== undefined && { binding }),
    };
  }
  const nextMarking = applyFire(marking, classified.inputs, classified.outputs);
  return {
    ok: true,
    marking: nextMarking,
    transition,
    ...(binding !== undefined && { binding }),
  };
}

/** Whether firing `transitionId` would succeed under `marking` (no side effect). */
export function canFire(net: PetriNet, marking: Marking, transitionId: string): boolean {
  return fire(net, marking, transitionId).ok;
}
