import { actorId, artifactId } from "../../../src/primitives/ids.js";
import { targetRef } from "../../../src/primitives/refs.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { footprint } from "../../../src/structure/boundary.js";
import { compositionIntent, type CompositionIntent } from "../../../src/structure/operators.js";

/** Disjoint fork branch — one participant per branch. */
export function forkBranchIntent(index: number): CompositionIntent {
  const id = actorId(`agent-${index}`);
  return compositionIntent("fork", actorRef(id, "agent"), footprint({ participantIds: [id] }), [
    targetRef("participant", id),
  ]);
}

/** Nest pair — touches two adjacent agents in a branch group. */
export function nestPairIntent(leftIndex: number, rightIndex: number): CompositionIntent {
  const left = actorId(`agent-${leftIndex}`);
  const right = actorId(`agent-${rightIndex}`);
  return compositionIntent(
    "nest",
    actorRef(left, "agent"),
    footprint({ participantIds: [left, right] }),
    [targetRef("participant", left), targetRef("participant", right)],
  );
}

/** Serial delegate composition targeting one artifact per step. */
export function delegateStepIntent(index: number): CompositionIntent {
  const from = actorId(`agent-${index}`);
  const to = actorId(`agent-${index + 1}`);
  const task = artifactId(`task-${index}`);
  return compositionIntent(
    "delegate",
    actorRef(from, "agent"),
    footprint({ artifactIds: [task], participantIds: [from, to] }),
    [targetRef("artifact", task), targetRef("participant", from), targetRef("participant", to)],
  );
}

export function allForkBranches(count: number): CompositionIntent[] {
  return Array.from({ length: count }, (_, index) => forkBranchIntent(index));
}

export function nestPairLayer(pairCount: number, offset = 0): CompositionIntent[] {
  return Array.from({ length: pairCount }, (_, index) =>
    nestPairIntent(offset + index * 2, offset + index * 2 + 1),
  );
}
