/**
 * Petri-net engine wiring for the CLI (ADR-0017).
 *
 * Projects the runtime snapshot into a structural {@link PetriNet} (places from
 * artifacts/capabilities, transitions from observed operationTypeIds, arcs
 * woven so each transition consumes its capability place and produces its
 * artifact place), then drives the real `@cantilune/petri` firing engine. The
 * CLI's /petri fire|transitions|reach|invariants views render genuine token-game
 * results instead of a cosmetic before/after diff.
 *
 * The net is a read-only analysis lens over the coordination graph: firing
 * mutates only an in-memory marking, never the runtime world. The runtime's
 * authority over state is untouched (per ADR-0001 §formal structure).
 */
import {
  enabledTransitions,
  fire,
  initialMarking,
  isDeadMarking,
  placeInvariants,
  transitionInvariants,
  reachable,
  type FireResult,
  type Marking,
  type PetriNet,
  type PlaceInvariant,
  type TransitionInvariant,
} from "@cantilune/petri";
import type { RuntimeState } from "../store.js";

/** A place in the projected net, with its runtime-provenance label. */
export interface PetriPlaceRow {
  readonly id: string;
  readonly name: string;
  readonly tokens: number;
}

/** A transition in the projected net. */
export interface PetriTransitionRow {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly consumes: readonly string[];
  readonly produces: readonly string[];
}

/** The projected net + marking snapshot the views render. */
export interface PetriSnapshot {
  readonly net: PetriNet;
  readonly marking: Marking;
  readonly places: readonly PetriPlaceRow[];
  readonly transitions: readonly PetriTransitionRow[];
}

/** The result of a /petri fire command: before + after markings. */
export interface PetriFireSnapshot {
  /** The resolved transition's display name (operationTypeId). */
  readonly op: string;
  /** The resolved transition's id. */
  readonly transitionId: string;
  readonly bindings: string;
  readonly before: PetriSnapshot;
  readonly after: PetriSnapshot;
  readonly result: FireResult;
}

/** The result of a /petri reach command: bounded-BFS verdict + trace. */
export interface PetriReachSnapshot {
  readonly goal: string;
  readonly reachable: boolean;
  readonly trace: readonly { step: number; transition: string; marking: PetriSnapshot }[];
  readonly explored: number;
  readonly maxSteps: number;
  readonly dead: boolean;
}

/** The result of a /petri invariants command: computed S- and T-invariant bases. */
export interface PetriInvariantsSnapshot {
  readonly invariants: readonly PlaceInvariant[];
  readonly transitionInvariants: readonly TransitionInvariant[];
  readonly changeChainNonEmpty: boolean;
}

/**
 * Project the runtime into a Petri net. Each artifact becomes a place (1 token,
 * its lifecycle as state), each capability becomes a place (1 token, held by its
 * holder), and each observed operationTypeId becomes a transition. Arcs are woven
 * so a transition consumes its paired capability place and produces its paired
 * artifact place — making fire a genuine consume/produce over the arc structure
 * rather than a cosmetic token-wipe.
 */
export function projectPetriNet(runtime: RuntimeState): PetriSnapshot | null {
  if (runtime.snapshot === null) {
    return null;
  }
  const snapshot = runtime.snapshot;

  const places: { id: string; name: string; tokens: number }[] = [];
  for (const artifact of snapshot.artifacts) {
    places.push({ id: `art:${artifact.id}`, name: artifact.id, tokens: 1 });
  }
  for (const capability of snapshot.capabilities) {
    places.push({ id: `cap:${capability.id}`, name: capability.kind, tokens: 1 });
  }

  const operationIds = [...new Set(runtime.changeLog.map((entry) => entry.operationTypeId))];
  const transitions = operationIds.map((op, index) => ({ id: `t${index}`, name: op }));

  const arcs: { id: string; source: string; target: string }[] = [];
  for (let i = 0; i < transitions.length; i += 1) {
    const transition = transitions[i]!;
    // Consume from the i-th capability place (if present); produce to the i-th artifact place.
    const capIndex = snapshot.capabilities[i];
    const artIndex = snapshot.artifacts[i];
    if (capIndex !== undefined) {
      arcs.push({ id: `a-c${i}`, source: `cap:${capIndex.id}`, target: transition.id });
    }
    if (artIndex !== undefined) {
      arcs.push({ id: `a-p${i}`, source: transition.id, target: `art:${artIndex.id}` });
    }
  }

  const net: PetriNet = { places, transitions, arcs };
  const marking = initialMarking(net);

  const enabled = enabledTransitions(net, marking);
  const enabledIds = new Set(enabled.map((e) => e.transition.id));
  const transitionRows: PetriTransitionRow[] = transitions.map((t) => {
    const enabledEntry = enabled.find((e) => e.transition.id === t.id);
    return {
      id: t.id,
      name: t.name,
      enabled: enabledIds.has(t.id),
      consumes: enabledEntry?.consumes.map((a) => a.placeId) ?? [],
      produces: enabledEntry?.produces.map((a) => a.placeId) ?? [],
    };
  });
  const placeRows: PetriPlaceRow[] = places.map((p) => ({
    id: p.id,
    name: p.name,
    tokens: marking.get(p.id) ?? 0,
  }));

  return { net, marking, places: placeRows, transitions: transitionRows };
}

/** Build a PetriSnapshot from a marking (for trace steps / after-fire views). */
function snapshotFromMarking(net: PetriNet, marking: Marking): PetriSnapshot {
  const places: PetriPlaceRow[] = net.places.map((p) => ({
    id: p.id,
    name: p.name,
    tokens: marking.get(p.id) ?? 0,
  }));
  const enabled = enabledTransitions(net, marking);
  const enabledIds = new Set(enabled.map((e) => e.transition.id));
  const transitions: PetriTransitionRow[] = net.transitions.map((t) => {
    const enabledEntry = enabled.find((e) => e.transition.id === t.id);
    return {
      id: t.id,
      name: t.name,
      enabled: enabledIds.has(t.id),
      consumes: enabledEntry?.consumes.map((a) => a.placeId) ?? [],
      produces: enabledEntry?.produces.map((a) => a.placeId) ?? [],
    };
  });
  return { net, marking, places, transitions };
}

/** Resolve a transition id by operation-template name or by id. */
function resolveTransitionId(snapshot: PetriSnapshot, op: string): string | undefined {
  const byName = snapshot.transitions.find((t) => t.name === op);
  if (byName !== undefined) return byName.id;
  const byId = snapshot.transitions.find((t) => t.id === op);
  return byId?.id;
}

/** Execute a /petri fire: fire the named transition under the current marking. */
export function fireTransition(
  runtime: RuntimeState,
  op: string,
  bindings?: Record<string, string>,
): PetriFireSnapshot | null {
  const before = projectPetriNet(runtime);
  if (before === null) return null;
  const transitionId = resolveTransitionId(before, op) ?? before.transitions[0]?.id;
  const result = fire(before.net, before.marking, transitionId ?? "", bindings);
  const after = snapshotFromMarking(before.net, result.marking);
  const resolvedName = before.transitions.find((t) => t.id === transitionId)?.name ?? op;
  return {
    op: resolvedName,
    transitionId: transitionId ?? op,
    bindings: bindings === undefined ? "{}" : JSON.stringify(bindings),
    before,
    after,
    result,
  };
}

/** Execute a /petri reach: bounded BFS toward a goal place holding ≥ 1 token. */
export function reachability(
  runtime: RuntimeState,
  goal: string,
  maxSteps = 50,
): PetriReachSnapshot | null {
  const initial = projectPetriNet(runtime);
  if (initial === null) return null;
  const goalPlaceId = initial.places.find((p) => p.id === goal || p.name === goal)?.id ?? goal;
  const search = reachable(
    initial.net,
    initial.marking,
    (marking) => (marking.get(goalPlaceId) ?? 0) >= 1,
    maxSteps,
  );
  const trace = search.trace.map((step, index) => ({
    step: index + 1,
    transition:
      initial.transitions.find((t) => t.id === step.firedTransition)?.name ?? step.firedTransition,
    marking: snapshotFromMarking(initial.net, step.marking),
  }));
  // `reachable` returns an empty trace on failure, so when the goal is not
  // reachable the verdict is whether the initial marking itself is dead (no
  // transition can fire). A non-empty trace only accompanies `reachable:true`,
  // which short-circuits the `&&`, so there is no final-marking case to inspect.
  const dead = !search.reachable && isDeadMarking(initial.net, initial.marking);
  return {
    goal,
    reachable: search.reachable,
    trace,
    explored: search.explored,
    maxSteps: search.maxSteps,
    dead,
  };
}

/** Execute a /petri invariants: compute S- and T-invariant bases. */
export function invariantsFor(runtime: RuntimeState): PetriInvariantsSnapshot | null {
  const snapshot = projectPetriNet(runtime);
  if (snapshot === null) return null;
  return {
    invariants: placeInvariants(snapshot.net),
    transitionInvariants: transitionInvariants(snapshot.net),
    changeChainNonEmpty: runtime.changeLog.length > 0,
  };
}

/**
 * The Petri-net engine controller (ADR-0017), surfaced to /petri commands. The
 * CLI's runtime is read-only, so the controller is a thin namespace over the
 * pure engine functions: project → fire/enable/reach/invariants. Each call
 * re-projects from the current runtime, so views always reflect fresh state.
 */
export interface PetriController {
  readonly project: (runtime: RuntimeState) => PetriSnapshot | null;
  readonly fire: (
    runtime: RuntimeState,
    op: string,
    bindings?: Record<string, string>,
  ) => PetriFireSnapshot | null;
  readonly reach: (
    runtime: RuntimeState,
    goal: string,
    maxSteps?: number,
  ) => PetriReachSnapshot | null;
  readonly invariants: (runtime: RuntimeState) => PetriInvariantsSnapshot | null;
}

/** Build the CLI Petri controller (stateless; the engine is pure). */
export function createPetriController(): PetriController {
  return {
    project: projectPetriNet,
    fire: fireTransition,
    reach: reachability,
    invariants: invariantsFor,
  };
}
