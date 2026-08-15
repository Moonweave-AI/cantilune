import {
  collaborationSnapshot,
  actorId,
  epochId,
  artifactId,
  capabilityId,
  snapshotRef,
  participant,
  type CollaborationSnapshot,
  type ActorId,
  type ArtifactId,
  type CapabilityId,
} from "@cantilune/core";

export const RUNTIME_SCALE = {
  farm: 15,
  loopRounds: 8,
  storm: 20,
  agents: 12,
  stressAgents: 100,
  stressFarm: 50,
  stressLoopRounds: 15,
  stressObs: 50,
  stressCodecBatch: 100,
  extremeAgents: 150,
  extremeFarm: 100,
  extremeLoopRounds: 50,
  extremeObs: 100,
  extremeRoundRobinHops: [30, 20, 15] as const,
} as const;

export function runtimeAgentIds(count: number): ActorId[] {
  return Array.from({ length: count }, (_, index) => actorId(`agent-${index}`));
}

export function buildRuntimeLargeWorld(agentCount: number): CollaborationSnapshot {
  const human = participant(actorId("human-1"), "human");
  const planner = participant(actorId("planner-p"), "agent");
  const agents = runtimeAgentIds(agentCount).map((id) => participant(id, "agent"));

  return collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
    participants: new Map([
      [human.actorId, human],
      [planner.actorId, planner],
      ...agents.map((entry) => [entry.actorId, entry] as const),
    ]),
  });
}

export const runtimeActors = {
  human: actorId("human-1"),
  planner: actorId("planner-p"),
} as const;

export function taskId(index: number): ArtifactId {
  return artifactId(`task-${index}`);
}

export function lockId(index: number): CapabilityId {
  return capabilityId(`write-lock-${index}`);
}
