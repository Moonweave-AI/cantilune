import {
  appendObservation,
  type CollaborationSnapshot,
} from "../../../src/coordination/collaborationSnapshot.js";
import { validateCollaborationWorld } from "../../../src/consistency/index.js";
import { contentRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import {
  deriveDiagnosticSummary,
  deriveSnapshotStatsWithHistory,
} from "../../../src/structure/derive.js";
import { compatibleConcurrently } from "../../../src/structure/isolation.js";
import {
  composeSerialHistory,
  appendObservationSegment,
  validateRunHistory,
  type UnvalidatedTrace,
} from "../../../src/structure/trace.js";
import { allForkBranches } from "./largeComposition.js";
import { buildStressTrace } from "./largeHistory.js";
import { buildLargeWorld, largeStoryActorIds, SCALE } from "./largeWorld.js";
import { runIntroduceDelegateLoop } from "./orchestrationHarness.js";

export interface ThreePillarClosure {
  readonly snapshot: CollaborationSnapshot;
  readonly history: UnvalidatedTrace;
  readonly validated: ReturnType<typeof validateRunHistory>;
  readonly stats: ReturnType<typeof deriveSnapshotStatsWithHistory>;
  readonly view: ReturnType<typeof deriveDiagnosticSummary>;
}

/** Exercises nodes · coordination · structure · consistency in one closure (naming §2). */
export function runThreePillarClosure(
  agentCount = SCALE.stressAgents,
  loopRounds = SCALE.stressLoopRounds,
): ThreePillarClosure {
  const orchestration = runIntroduceDelegateLoop(loopRounds, agentCount);
  const snapshot = appendObservation(orchestration.final, {
    source: actorRef(largeStoryActorIds.human, "human"),
    payloadRef: contentRef("content://pillar-closure-tail"),
    receivedAt: timestamp("2026-08-07T12:00:00Z"),
  });

  let alignedHistory = orchestration.history;
  const tailObs = snapshot.auditTail.at(-1);
  if (tailObs !== undefined) {
    alignedHistory = appendObservationSegment(alignedHistory, tailObs);
  }

  const stressTail = buildStressTrace(20, 4);
  const history = composeSerialHistory(alignedHistory, stressTail);
  const validated = validateRunHistory(orchestration.history);
  validateRunHistory(stressTail);
  validateCollaborationWorld(snapshot, alignedHistory);

  const branches = allForkBranches(Math.min(agentCount, 32));
  for (let i = 0; i + 1 < branches.length; i += 2) {
    const left = branches[i];
    const right = branches[i + 1];
    if (left !== undefined && right !== undefined) {
      expectConcurrentDisjoint(left, right);
    }
  }

  const stats = deriveSnapshotStatsWithHistory(snapshot, history);
  const view = deriveDiagnosticSummary(snapshot, history);
  return { snapshot, history, validated, stats, view };
}

function expectConcurrentDisjoint(
  a: ReturnType<typeof allForkBranches>[number],
  b: ReturnType<typeof allForkBranches>[number],
): void {
  if (!compatibleConcurrently(a, b)) {
    throw new Error("expected disjoint composition intents");
  }
}

export function buildStressWorldOnly(agentCount = SCALE.stressAgents): CollaborationSnapshot {
  return buildLargeWorld(agentCount);
}
