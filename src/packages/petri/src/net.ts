/**
 * Structural Petri-net types and the marking/enabled-set layer.
 *
 * The {@link PetriNet} structural type (`{ places, transitions, arcs }`) is the
 * same shape the PNML exporter projects from a runtime snapshot. We redefine it
 * here in the engine's own terms (the fields are plain structural records) and
 * export a {@link fromExportedNet} adapter so the CLI's PNML-derived net feeds
 * the engine without a parallel type. This keeps `@cantilune/petri` free of a
 * dependency on `@cantilune/cli` while honoring the "no parallel entity type"
 * rule: the PNML exporter's `PetriNet` is structurally assignable to this one.
 */

/** A branded place identifier. */
export type PlaceId = string & { readonly __brand: "PlaceId" };
/** A branded transition identifier. */
export type TransitionId = string & { readonly __brand: "TransitionId" };

/** A place in the net. `tokens` is optional initial marking metadata. */
export interface NetPlace {
  readonly id: string;
  readonly name: string;
  readonly tokens?: number;
}

/** A transition in the net. */
export interface NetTransition {
  readonly id: string;
  readonly name: string;
}

/** An arc between two nodes (place↔transition). */
export interface NetArc {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

/**
 * The structural Petri net. Structurally identical to the PNML exporter's
 * `PetriNet` so an exported net is assignable without conversion.
 */
export interface PetriNet {
  readonly places: readonly NetPlace[];
  readonly transitions: readonly NetTransition[];
  readonly arcs: readonly NetArc[];
}

/** Direction of an arc relative to a transition: into the transition, or out of it. */
export type ArcDirection = "in" | "out";

/** A token assignment: how many tokens each place holds. */
export type Marking = ReadonlyMap<string, number>;

/** An arc classified by its direction relative to a given transition. */
export interface ClassifiedArc {
  readonly arc: NetArc;
  readonly direction: ArcDirection;
  readonly placeId: string;
}

/** A transition whose input arcs are all satisfiable by the marking. */
export interface EnabledTransition {
  readonly transition: NetTransition;
  readonly consumes: readonly ClassifiedArc[];
  readonly produces: readonly ClassifiedArc[];
}

/** Reason a fire cannot proceed. */
export type FireBlockedReason = "unknown-transition" | "self-loop-arc" | "disabled";

/** Normalize an arbitrary value to a non-negative integer token count. */
function tokenCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

/** Build the initial {@link Marking} from a net's place `tokens` metadata. */
export function initialMarking(net: PetriNet): Marking {
  const marking = new Map<string, number>();
  for (const place of net.places) {
    marking.set(place.id, tokenCount(place.tokens));
  }
  return marking;
}

/** Read the token count at a place, defaulting to 0 for unmarked places. */
export function tokensAt(marking: Marking, placeId: string): number {
  return marking.get(placeId) ?? 0;
}

/** Return a new marking with `placeId` set to `count` (immutable copy). */
export function withTokens(marking: Marking, placeId: string, count: number): Marking {
  const next = new Map(marking);
  next.set(placeId, tokenCount(count));
  return next;
}

/** Whether the net has a self-loop arc on `transitionId` (source and target both this transition). */
export function hasSelfLoopArc(net: PetriNet, transitionId: string): boolean {
  return net.arcs.some((arc) => arc.source === transitionId && arc.target === transitionId);
}

/** Classify every arc of the net relative to a single transition. Throws on self-loop. */
export function classifyArcsForTransition(
  net: PetriNet,
  transitionId: string,
): {
  readonly inputs: readonly ClassifiedArc[];
  readonly outputs: readonly ClassifiedArc[];
} {
  const inputs: ClassifiedArc[] = [];
  const outputs: ClassifiedArc[] = [];
  const placeIds = new Set(net.places.map((p) => p.id));
  for (const arc of net.arcs) {
    if (arc.source === transitionId && arc.target === transitionId) {
      throw new SelfLoopArcError(arc.id, transitionId);
    }
    if (arc.source === transitionId) {
      if (placeIds.has(arc.target)) {
        outputs.push({ arc, direction: "out", placeId: arc.target });
      }
    } else if (arc.target === transitionId) {
      if (placeIds.has(arc.source)) {
        inputs.push({ arc, direction: "in", placeId: arc.source });
      }
    }
  }
  return { inputs, outputs };
}

/** Error raised when a self-loop arc (source and target are the same transition) is encountered. */
export class SelfLoopArcError extends Error {
  readonly arcId: string;
  readonly transitionId: string;
  constructor(arcId: string, transitionId: string) {
    super(
      `Petri arc '${arcId}' is a self-loop on transition '${transitionId}': source and target are the same transition. Inhibitor/reset arcs are not supported.`,
    );
    this.name = "SelfLoopArcError";
    this.arcId = arcId;
    this.transitionId = transitionId;
  }
}

/** Find a transition by id, or undefined if absent. */
export function findTransition(net: PetriNet, transitionId: string): NetTransition | undefined {
  return net.transitions.find((t) => t.id === transitionId);
}

/** Whether a transition is enabled under the given marking. */
export function isEnabled(net: PetriNet, marking: Marking, transitionId: string): boolean {
  const transition = findTransition(net, transitionId);
  if (transition === undefined) {
    return false;
  }
  try {
    const { inputs } = classifyArcsForTransition(net, transitionId);
    return inputs.every((arc) => tokensAt(marking, arc.placeId) >= 1);
  } catch {
    return false;
  }
}

/** Return every enabled transition with its consume/produce arc sets. */
export function enabledTransitions(net: PetriNet, marking: Marking): readonly EnabledTransition[] {
  const enabled: EnabledTransition[] = [];
  for (const transition of net.transitions) {
    let classified: { inputs: readonly ClassifiedArc[]; outputs: readonly ClassifiedArc[] };
    try {
      classified = classifyArcsForTransition(net, transition.id);
    } catch {
      continue;
    }
    if (classified.inputs.every((arc) => tokensAt(marking, arc.placeId) >= 1)) {
      enabled.push({
        transition,
        consumes: classified.inputs,
        produces: classified.outputs,
      });
    }
  }
  return enabled;
}

/**
 * Adapt a PNML-exporter-shaped net to the engine's {@link PetriNet}. Because the
 * structural fields match, this is a structural cast (no per-field copy). Kept
 * as an explicit function so callers document the reuse rather than relying on
 * silent assignability.
 */
export function fromExportedNet(net: PetriNet): PetriNet {
  return net;
}
