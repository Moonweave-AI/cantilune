import {
  collaborationSnapshot,
  actorId,
  artifactId,
  capabilityId,
  epochId,
  sessionId,
  snapshotRef,
  participant,
  type CollaborationSnapshot,
} from "@cantilune/core";

/** T0: Human, Planner, Coder — naming contract §2.4. */
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

export const storyEntityIds = {
  task: artifactId("task-T"),
  writeLock: capabilityId("write-lock-w"),
  session: sessionId("session-s"),
} as const;
