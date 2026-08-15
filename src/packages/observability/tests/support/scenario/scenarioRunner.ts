import {
  actorRef,
  coordinationIntent,
  matchBinding,
  operationTypeId,
  type ActorId,
  type CollaborationSnapshot,
  type CoordinationChange,
  type CoordinationIntent,
  type SnapshotRef,
} from "@cantilune/core";
import type { CoordinationRuntime } from "@cantilune/runtime";
import { type ChangeLogLike } from "../buildTestRuntime.js";
import { testArtifactContentRef } from "../contentRefs.js";
import { lockId, runtimeActors, taskId } from "./runtimeLargeWorld.js";

export function introduceIntent(taskIndex: number, holder: ActorId = runtimeActors.planner) {
  return coordinationIntent(
    actorRef(holder, "agent"),
    operationTypeId("introduce_artifact"),
    [
      matchBinding("task", taskId(taskIndex)),
      matchBinding("from", holder),
      matchBinding("capability", lockId(taskIndex)),
    ],
    undefined,
    [testArtifactContentRef],
  );
}

export function delegateIntent(taskIndex: number, from: ActorId, to: ActorId) {
  return coordinationIntent(actorRef(from, "agent"), operationTypeId("delegate"), [
    matchBinding("task", taskId(taskIndex)),
    matchBinding("from", from),
    matchBinding("to", to),
    matchBinding("capability", lockId(taskIndex)),
  ]);
}

export function replayChainStart(changelog: ChangeLogLike, t0: CollaborationSnapshot): SnapshotRef {
  const first = changelog.all()[0];
  return first?.beforeRef ?? t0.snapshotRef;
}

export function commitOrThrow(
  runtime: CoordinationRuntime,
  ticket: Parameters<CoordinationRuntime["commit"]>[0],
) {
  const result = runtime.commit(ticket);
  if (!("change" in result)) {
    throw new Error(`commit failed: ${JSON.stringify(result)}`);
  }
  return result;
}

export function proposeAndCommitOrThrow(runtime: CoordinationRuntime, intent: CoordinationIntent) {
  const result = runtime.proposeAndCommit(intent);
  if (!("change" in result)) {
    throw new Error(`proposeAndCommit failed: ${JSON.stringify(result)}`);
  }
  return result;
}

export function runSerialIntroduceFarm(
  runtime: CoordinationRuntime,
  count: number,
): CoordinationChange[] {
  const changes: CoordinationChange[] = [];
  for (let index = 0; index < count; index++) {
    changes.push(proposeAndCommitOrThrow(runtime, introduceIntent(index)).change);
  }
  return changes;
}

export function runDelegateRoundRobin(
  runtime: CoordinationRuntime,
  taskIndex: number,
  hops: number,
  agentIds: readonly ActorId[],
  initialHolder: ActorId = runtimeActors.planner,
): CoordinationChange[] {
  const changes: CoordinationChange[] = [];
  let holder = initialHolder;
  for (let hop = 0; hop < hops; hop++) {
    const next = agentIds[hop % agentIds.length];
    if (next === undefined) {
      break;
    }
    changes.push(proposeAndCommitOrThrow(runtime, delegateIntent(taskIndex, holder, next)).change);
    holder = next;
  }
  return changes;
}

export function runIntroduceDelegateLoop(
  runtime: CoordinationRuntime,
  rounds: number,
  agentIds: readonly ActorId[],
  startIndex = 0,
): CoordinationChange[] {
  const changes: CoordinationChange[] = [];
  for (let round = 0; round < rounds; round++) {
    const taskIndex = startIndex + round;
    changes.push(proposeAndCommitOrThrow(runtime, introduceIntent(taskIndex)).change);
    const to = agentIds[round % agentIds.length];
    if (to === undefined) {
      continue;
    }
    changes.push(
      proposeAndCommitOrThrow(runtime, delegateIntent(taskIndex, runtimeActors.planner, to)).change,
    );
  }
  return changes;
}
