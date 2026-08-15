import {
  actorRef,
  contentRef,
  coordinationIntent,
  matchBinding,
  operationTypeId,
  type ActorId,
  type CoordinationChange,
  type CoordinationIntent,
} from "@cantilune/core";
import type { CoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import type { CommitResult } from "../../../src/execution/commitChange.js";
import type { AdmissionTicket } from "../../../src/admission/admissionTicket.js";
import type { SnapshotRef, CollaborationSnapshot } from "@cantilune/core";
import type { MemoryChangeLog } from "../../../src/memory/memoryChangeLog.js";
import { lockId, runtimeActors, taskId } from "./largeWorld.js";

export function introduceIntent(taskIndex: number, holder: ActorId = runtimeActors.planner) {
  const digest = taskIndex.toString(16).padStart(64, "0").slice(-64);
  return coordinationIntent(
    actorRef(holder, "agent"),
    operationTypeId("introduce_artifact"),
    [
      matchBinding("task", taskId(taskIndex)),
      matchBinding("from", holder),
      matchBinding("capability", lockId(taskIndex)),
    ],
    undefined,
    [contentRef(`sha256:${digest}`)],
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

export function replayChainStart(
  changelog: MemoryChangeLog,
  t0: CollaborationSnapshot,
): SnapshotRef {
  const first = changelog.all()[0];
  return first?.beforeRef ?? t0.snapshotRef;
}

export function commitOrThrow(runtime: CoordinationRuntime, ticket: AdmissionTicket): CommitResult {
  const result = runtime.commit(ticket);
  if (!("change" in result)) {
    throw new Error(`commit failed: ${JSON.stringify(result)}`);
  }
  return result;
}

export function proposeAndCommitOrThrow(
  runtime: CoordinationRuntime,
  intent: CoordinationIntent,
): CommitResult {
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
    const committed = proposeAndCommitOrThrow(runtime, introduceIntent(index));
    changes.push(committed.change);
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
    const committed = proposeAndCommitOrThrow(runtime, delegateIntent(taskIndex, holder, next));
    changes.push(committed.change);
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
