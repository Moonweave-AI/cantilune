import type { CoordinationChange, CollaborationSnapshot } from "@cantilune/core";
import {
  actorRef,
  contentRef,
  validateAuditTailMatchesHistory,
  validateBeforeRefChain,
  validateEpochConsistent,
  validateSnapshotIntegrity,
} from "@cantilune/core";
import { appendObservationSegment, appendRewriteSegment, emptyRunHistory } from "@cantilune/core";
import type { CoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import type { MemoryChangeLog } from "../../../src/memory/memoryChangeLog.js";
import { RUNTIME_SCALE, runtimeActors, runtimeAgentIds } from "./largeWorld.js";
import {
  runIntroduceDelegateLoop,
  runSerialIntroduceFarm,
  replayChainStart,
} from "./scenarioRunner.js";

export interface RuntimeEngineeringClosure {
  readonly changes: readonly CoordinationChange[];
  readonly head: CollaborationSnapshot | undefined;
  readonly replayOk: boolean;
  readonly replaySteps: number;
}

export function runRuntimeEngineeringClosure(
  runtime: CoordinationRuntime,
  changelog: MemoryChangeLog,
  t0: CollaborationSnapshot,
  options?: {
    farm?: number;
    loopRounds?: number;
    observations?: number;
    agentCount?: number;
  },
): RuntimeEngineeringClosure {
  const farm = options?.farm ?? RUNTIME_SCALE.stressFarm;
  const loopRounds = options?.loopRounds ?? RUNTIME_SCALE.stressLoopRounds;
  const observations = options?.observations ?? RUNTIME_SCALE.stressObs;
  const agentCount = options?.agentCount ?? RUNTIME_SCALE.stressAgents;
  const agents = runtimeAgentIds(agentCount);

  let history = emptyRunHistory();
  for (let index = 0; index < observations; index++) {
    const source = actorRef(runtimeActors.human, "human");
    const observed = runtime.observe(
      {
        source,
        payloadRef: contentRef(`content://eng-obs-${index}`),
      },
      { principal: source },
    );
    if ("entry" in observed) {
      history = appendObservationSegment(history, observed.entry);
    }
  }

  const farmChanges = runSerialIntroduceFarm(runtime, farm);
  const loopChanges = runIntroduceDelegateLoop(runtime, loopRounds, agents, farm);
  const changes = [...farmChanges, ...loopChanges];
  for (const change of changes) {
    history = appendRewriteSegment(history, change);
  }

  validateBeforeRefChain(changes);
  validateEpochConsistent(changes);
  if (changelog.all().length !== changes.length) {
    throw new Error(
      `changelog length ${changelog.all().length} !== committed changes ${changes.length}`,
    );
  }

  const head = runtime.getHead();
  if (head !== undefined) {
    validateSnapshotIntegrity(head);
    validateAuditTailMatchesHistory(head, history);
  }

  const replay = runtime.replay({ fromRef: replayChainStart(changelog, t0) });
  return {
    changes,
    head,
    replayOk: replay.ok,
    replaySteps: replay.ok ? replay.steps.length : 0,
  };
}
