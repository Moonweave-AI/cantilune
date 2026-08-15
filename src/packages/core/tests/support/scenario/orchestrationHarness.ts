import {
  appendObservation,
  withArtifact,
  withCapability,
  withSnapshotRef,
  type CollaborationSnapshot,
} from "../../../src/coordination/collaborationSnapshot.js";
import type { CoordinationChange } from "../../../src/coordination/coordinationChange.js";
import {
  actorId,
  artifactId,
  capabilityId,
  changeId,
  epochId,
  operationTypeId,
  type ActorId,
} from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { scopedCapability, withCapabilityHolder } from "../../../src/nodes/scopedCapability.js";
import { workArtifact, withArtifactOwner } from "../../../src/nodes/workArtifact.js";
import {
  appendObservationSegment,
  emptyRunHistory,
  type UnvalidatedTrace,
} from "../../../src/structure/trace.js";
import { testCoordinationChange } from "../fixtures/change-fixture.js";
import { simulateCommit } from "../harness/simulate-commit.js";
import { buildLargeWorld, largeStoryActorIds } from "./largeWorld.js";

export interface OrchestrationResult {
  readonly final: CollaborationSnapshot;
  readonly history: UnvalidatedTrace;
  readonly changes: readonly CoordinationChange[];
}

function taskEntity(index: number) {
  return artifactId(`task-${index}`);
}

function lockEntity(index: number) {
  return capabilityId(`write-lock-${index}`);
}

export function runIntroduceDelegateLoop(rounds: number, agentCount: number): OrchestrationResult {
  let snapshot = buildLargeWorld(agentCount);
  let history = emptyRunHistory();
  const changes: CoordinationChange[] = [];
  let snapIndex = 0;

  snapshot = appendObservation(snapshot, {
    source: actorRef(largeStoryActorIds.human, "human"),
    payloadRef: contentRef("content://orchestration-kickoff"),
    receivedAt: timestamp("2026-08-07T10:00:00Z"),
  });
  const kickoff = snapshot.auditTail.at(-1);
  if (kickoff !== undefined) {
    history = appendObservationSegment(history, kickoff);
  }

  for (let round = 0; round < rounds; round++) {
    const task = taskEntity(round);
    const lock = lockEntity(round);
    const holder =
      round === 0 ? largeStoryActorIds.planner : actorId(`agent-${(round - 1) % agentCount}`);

    const introduceChange = testCoordinationChange({
      changeId: changeId(`chg-intro-${round}`),
      recordedAt: timestamp(`2026-08-07T10:${String(round * 2 + 5).padStart(2, "0")}:00Z`),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef(`snap-S${snapIndex}`),
      afterRef: snapshotRef(`snap-S${snapIndex + 1}`),
      targets: [targetRef("artifact", task), targetRef("participant", holder)],
      initiator: actorRef(largeStoryActorIds.planner, "agent"),
    });

    const introduced = simulateCommit(snapshot, history, introduceChange, (current, change) =>
      withSnapshotRef(
        withCapability(
          withArtifact(
            current,
            workArtifact(task, "Task", contentRef(`content://${task}`), actorRef(holder, "agent")),
          ),
          scopedCapability(lock, "write_lock", holder, { kind: "artifact", artifactId: task }),
        ),
        change.afterRef,
      ),
    );
    snapshot = introduced.after;
    history = introduced.history;
    changes.push(introduceChange);
    snapIndex += 1;

    const from = holder;
    const to = actorId(`agent-${round % agentCount}`);
    const delegateChange = testCoordinationChange({
      changeId: changeId(`chg-deleg-${round}`),
      recordedAt: timestamp(`2026-08-07T10:${String(round * 2 + 6).padStart(2, "0")}:00Z`),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef(`snap-S${snapIndex}`),
      afterRef: snapshotRef(`snap-S${snapIndex + 1}`),
      targets: [
        targetRef("artifact", task),
        targetRef("participant", from),
        targetRef("participant", to),
        targetRef("capability", lock),
      ],
      initiator: actorRef(from, "agent"),
    });

    const delegated = simulateCommit(snapshot, history, delegateChange, (current, change) => {
      const artifact = current.artifacts.get(task)!;
      const capability = current.capabilities.get(lock)!;
      return withSnapshotRef(
        withCapability(
          withArtifact(current, withArtifactOwner(artifact, actorRef(to, "agent"))),
          withCapabilityHolder(capability, to),
        ),
        change.afterRef,
      );
    });
    snapshot = delegated.after;
    history = delegated.history;
    changes.push(delegateChange);
    snapIndex += 1;
  }

  return { final: snapshot, history, changes };
}

export function countAgents(snapshot: CollaborationSnapshot): number {
  let agents = 0;
  for (const participant of snapshot.participants.values()) {
    if (participant.kind === "agent") {
      agents += 1;
    }
  }
  return agents;
}

export function finalHolderForTask(
  snapshot: CollaborationSnapshot,
  index: number,
): ActorId | undefined {
  const task = snapshot.artifacts.get(taskEntity(index));
  return task?.owner.actorId;
}
