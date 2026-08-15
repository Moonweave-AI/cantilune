/**
 * Bounded reachability analysis via breadth-first search over the firing graph.
 *
 * The search is total: a mandatory `maxSteps` bound guarantees termination on
 * nets with an unbounded state space. The verdict is bounded-reachability —
 * "reachable within N steps" — which is the honest result; unbounded
 * reachability is undecidable in general and is out of scope.
 */

import { enabledTransitions, type EnabledTransition, type Marking, type PetriNet } from "./net.js";

/** Apply an enabled transition's consume/produce to produce the next marking (immutable). */
function applyEnabled(marking: Marking, enabled: EnabledTransition): Marking {
  const next = new Map(marking);
  for (const arc of enabled.consumes) {
    const current = next.get(arc.placeId) ?? 0;
    next.set(arc.placeId, Math.max(0, current - 1));
  }
  for (const arc of enabled.produces) {
    const current = next.get(arc.placeId) ?? 0;
    next.set(arc.placeId, current + 1);
  }
  return next;
}

/** One step in a reachability trace. */
export interface ReachStep {
  /** The marking before this step's fire. */
  readonly marking: Marking;
  /** The transition fired to reach the next marking. */
  readonly firedTransition: string;
}

/** Result of a reachability search. */
export interface ReachResult {
  /** Whether the goal marking is reachable within the bound. */
  readonly reachable: boolean;
  /** When reachable, the firing trace from the initial marking to the goal. */
  readonly trace: readonly ReachStep[];
  /** When not reachable, the number of distinct markings explored. */
  readonly explored: number;
  /** The bound that was applied. */
  readonly maxSteps: number;
}

/** Compare two place ids for sorting (ascending lexical). */
function comparePlaceIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** A canonical key for a marking, so distinct maps with equal tokens compare equal. */
export function markingKey(marking: Marking): string {
  const entries = [...marking.entries()]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => comparePlaceIds(a, b));
  return entries.map(([id, count]) => `${id}:${count}`).join("|");
}

/**
 * Search for a marking satisfying `goal`, firing every enabled transition at
 * each depth, up to `maxSteps` fires along any single path.
 *
 * @param initial The starting marking.
 * @param goal Predicate over a marking; true stops the search.
 * @param maxSteps Maximum fires along any single path (default 50). Must be ≥ 1.
 */
export function reachable(
  net: PetriNet,
  initial: Marking,
  goal: (marking: Marking) => boolean,
  maxSteps = 50,
): ReachResult {
  if (!Number.isFinite(maxSteps) || maxSteps < 1) {
    maxSteps = 1;
  }
  if (goal(initial)) {
    return { reachable: true, trace: [], explored: 1, maxSteps };
  }
  const visited = new Set<string>([markingKey(initial)]);
  // Queue holds { marking, trace }. BFS so the first hit is the shortest trace.
  const queue: Array<{ marking: Marking; trace: ReachStep[] }> = [{ marking: initial, trace: [] }];
  let explored = 1;
  while (queue.length > 0) {
    const { marking, trace } = queue.shift()!;
    if (trace.length >= maxSteps) {
      continue;
    }
    for (const enabled of enabledTransitions(net, marking)) {
      const nextMarking = applyEnabled(marking, enabled);
      const key = markingKey(nextMarking);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      explored += 1;
      const nextTrace: ReachStep[] = [
        ...trace,
        { marking, firedTransition: enabled.transition.id },
      ];
      if (goal(nextMarking)) {
        return { reachable: true, trace: nextTrace, explored, maxSteps };
      }
      queue.push({ marking: nextMarking, trace: nextTrace });
    }
  }
  return { reachable: false, trace: [], explored, maxSteps };
}

/** Whether any transition is enabled under `marking` (a dead-marking test). */
export function isDeadMarking(net: PetriNet, marking: Marking): boolean {
  return enabledTransitions(net, marking).length === 0;
}
