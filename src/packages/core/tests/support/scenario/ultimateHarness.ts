import {
  appendObservation,
  type CollaborationSnapshot,
} from "../../../src/coordination/collaborationSnapshot.js";
import {
  validateAuditTailMatchesHistory,
  validateBeforeRefChain,
  validateCollaborationWorld,
  validateEpochConsistent,
  validateSnapshotIntegrity,
} from "../../../src/consistency/index.js";
import { actorId, artifactId } from "../../../src/primitives/ids.js";
import { contentRef, targetRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import {
  footprint,
  goal,
  interfacePorts,
  port,
  portBinding,
} from "../../../src/structure/boundary.js";
import {
  deriveDiagnosticSummary,
  deriveSnapshotStatsWithHistory,
} from "../../../src/structure/derive.js";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import {
  compositionIntent,
  operationTypeForOperator,
  toCoordinationIntent,
  type CompositionOperatorKind,
} from "../../../src/structure/operators.js";
import { validateCompositionIntentFootprint } from "../../../src/structure/validation.js";
import {
  appendObservationSegment,
  composeSerialHistory,
  sliceRunHistory,
  validateRunHistory,
  type UnvalidatedTrace,
} from "../../../src/structure/trace.js";
import { allForkBranches, nestPairLayer } from "./largeComposition.js";
import {
  buildSerialRewriteHistory,
  buildStressTrace,
  sliceFootprintForTask,
} from "./largeHistory.js";
import { buildLargeWorld, largeStoryActorIds, SCALE } from "./largeWorld.js";
import {
  countAgents,
  finalHolderForTask,
  runIntroduceDelegateLoop,
  type OrchestrationResult,
} from "./orchestrationHarness.js";

const ALL_OPERATORS: CompositionOperatorKind[] = [
  "attach",
  "delegate",
  "fork",
  "nest",
  "rewire",
  "isolate",
  "close",
];

export interface UltimateCoreClosure {
  readonly agentCount: number;
  readonly orchestrationChanges: number;
  readonly stressTaskCount: number;
  readonly serialSliceCount: number;
  readonly isolationPairs: number;
  readonly operatorIntents: number;
  readonly nestPairs: number;
  readonly snapshot: CollaborationSnapshot;
  readonly history: UnvalidatedTrace;
}

function validateOrchestrationTrace(orchestration: OrchestrationResult): void {
  validateBeforeRefChain(orchestration.changes);
  validateEpochConsistent(orchestration.changes);
  validateRunHistory(orchestration.history);
}

function countSerialRewriteSlices(stressTasks: number): number {
  const serialHistory = buildSerialRewriteHistory(stressTasks);
  let serialSliceCount = 0;
  for (let index = 0; index < stressTasks; index++) {
    const slice = sliceRunHistory(serialHistory, sliceFootprintForTask(index));
    if (slice.length === 1 && slice[0]?.kind === "rewrite") {
      serialSliceCount += 1;
    }
  }
  return serialSliceCount;
}

function alignHistoryWithSnapshot(
  orchestration: OrchestrationResult,
  snapshot: CollaborationSnapshot,
): UnvalidatedTrace {
  let alignedHistory = orchestration.history;
  const tailObs = snapshot.auditTail.at(-1);
  if (tailObs !== undefined) {
    alignedHistory = appendObservationSegment(alignedHistory, tailObs);
  }
  validateCollaborationWorld(snapshot, alignedHistory);
  validateAuditTailMatchesHistory(snapshot, alignedHistory);
  return alignedHistory;
}

function countIsolationPairs(agentCount: number): number {
  const branches = allForkBranches(agentCount);
  let isolationPairs = 0;
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const left = branches[i];
      const right = branches[j];
      if (left !== undefined && right !== undefined && !compatibleConcurrently(left, right)) {
        throw new Error(`fork branches ${i} and ${j} overlap`);
      }
      isolationPairs += 1;
    }
  }
  return isolationPairs;
}

function buildOperatorIntentCount(operatorScale: number): number {
  let operatorIntents = 0;
  for (const operator of ALL_OPERATORS) {
    for (let index = 0; index < operatorScale; index++) {
      const agent = actorId(`op-agent-${operator}-${index}`);
      const task = artifactId(`op-task-${operator}-${index}`);
      const intent = compositionIntent(
        operator,
        actorRef(agent, "agent"),
        footprint({ participantIds: [agent], artifactIds: [task] }),
        [targetRef("participant", agent), targetRef("artifact", task)],
        {
          interface: interfacePorts([port("in", "TaskRef"), port("out", "ResultRef")]),
          binds: goal([portBinding(port("in", "TaskRef"), task)]),
        },
      );
      validateCompositionIntentFootprint(intent);
      const coordination = toCoordinationIntent(intent);
      if (coordination.operationTypeId !== operationTypeForOperator(operator)) {
        throw new Error(`operator ${operator} mapping mismatch`);
      }
      operatorIntents += 1;
    }
  }
  return operatorIntents;
}

function validateClosureMetrics(
  snapshot: CollaborationSnapshot,
  alignedHistory: UnvalidatedTrace,
  loopRounds: number,
  agentCount: number,
): void {
  const stats = deriveSnapshotStatsWithHistory(snapshot, alignedHistory);
  const view = deriveDiagnosticSummary(snapshot, alignedHistory);
  if (stats.changes !== loopRounds * 2) {
    throw new Error(`expected ${loopRounds * 2} rewrite stats, got ${stats.changes}`);
  }
  if (view.kind !== "serial" || view.parts.length !== loopRounds * 2) {
    throw new Error("derive serial view mismatch at ultimate scale");
  }
  if (countAgents(snapshot) !== agentCount + 1) {
    throw new Error("participant count mismatch");
  }
  if (finalHolderForTask(snapshot, loopRounds - 1) === undefined) {
    throw new Error("missing final task holder");
  }
}

/** Maximum core closure: orchestration + trace + isolation + operators + derive. */
export function runUltimateCoreClosure(): UltimateCoreClosure {
  const agentCount = SCALE.extremeAgents;
  const loopRounds = SCALE.extremeLoopRounds;
  const stressTasks = SCALE.extremeTasks;

  const orchestration = runIntroduceDelegateLoop(loopRounds, agentCount);
  validateOrchestrationTrace(orchestration);

  const stressTrace = buildStressTrace(stressTasks, 3);
  validateRunHistory(stressTrace);

  const serialSliceCount = countSerialRewriteSlices(stressTasks);

  const snapshot = appendObservation(orchestration.final, {
    source: actorRef(largeStoryActorIds.human, "human"),
    payloadRef: contentRef("content://ultimate-closure-tail"),
    receivedAt: timestamp("2026-08-07T13:00:00Z"),
  });
  validateSnapshotIntegrity(snapshot);

  const alignedHistory = alignHistoryWithSnapshot(orchestration, snapshot);
  const history = composeSerialHistory(alignedHistory, stressTrace);

  const isolationPairs = countIsolationPairs(agentCount);
  const operatorIntents = buildOperatorIntentCount(100);
  const nestPairs = nestPairLayer(Math.floor(agentCount / 2)).length;

  validateClosureMetrics(snapshot, alignedHistory, loopRounds, agentCount);

  return {
    agentCount,
    orchestrationChanges: orchestration.changes.length,
    stressTaskCount: stressTasks,
    serialSliceCount,
    isolationPairs,
    operatorIntents,
    nestPairs,
    snapshot,
    history,
  };
}

export function buildUltimateWorldOnly(): CollaborationSnapshot {
  return buildLargeWorld(SCALE.extremeAgents);
}
