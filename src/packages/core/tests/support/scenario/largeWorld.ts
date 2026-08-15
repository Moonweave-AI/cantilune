import {
  collaborationSnapshot,
  type CollaborationSnapshot,
} from "../../../src/coordination/collaborationSnapshot.js";
import { actorId, epochId, type ActorId } from "../../../src/primitives/ids.js";
import { snapshotRef } from "../../../src/primitives/refs.js";
import { participant } from "../../../src/nodes/participant.js";

export const SCALE = {
  small: 10,
  medium: 30,
  large: 50,
  /** CI stress tier — naming-contract 大图 / 多 Agent */
  stressAgents: 100,
  stressTasks: 200,
  stressLoopRounds: 50,
  /** Ultimate tier — single mega closure without new production modules */
  extremeAgents: 200,
  extremeTasks: 500,
  extremeLoopRounds: 100,
} as const;

export function agentIds(count: number): ActorId[] {
  return Array.from({ length: count }, (_, index) => actorId(`agent-${index}`));
}

/** Large T0: human + planner + N agents, no artifacts yet. */
export function buildLargeWorld(agentCount: number): CollaborationSnapshot {
  const human = participant(actorId("human-1"), "human");
  const planner = participant(actorId("planner-p"), "agent");
  const agents = agentIds(agentCount).map((id) => participant(id, "agent"));

  const participants = new Map([
    [human.actorId, human],
    [planner.actorId, planner],
    ...agents.map((entry) => [entry.actorId, entry] as const),
  ]);

  return collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
    participants,
  });
}

export const largeStoryActorIds = {
  human: actorId("human-1"),
  planner: actorId("planner-p"),
} as const;
