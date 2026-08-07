import {
  collaborationSnapshot,
  type CollaborationSnapshot,
} from "../../../../src/coordination/collaborationSnapshot.js";
import { actorId, epochId } from "../../../../src/primitives/ids.js";
import { snapshotRef } from "../../../../src/primitives/refs.js";
import { participant } from "../../../../src/nodes/participant.js";

/** T0: Human, Planner, Coder — no task yet (naming contract §2.4). */
export function buildConfigT0(): CollaborationSnapshot {
  const human = participant(actorId("human-1"), "human");
  const planner = participant(actorId("planner-p"), "agent");
  const coder = participant(actorId("coder-c"), "agent");

  return collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
    participants: new Map([
      [human.actorId, human],
      [planner.actorId, planner],
      [coder.actorId, coder],
    ]),
  });
}

export const storyActorIds = {
  human: actorId("human-1"),
  planner: actorId("planner-p"),
  coder: actorId("coder-c"),
} as const;
