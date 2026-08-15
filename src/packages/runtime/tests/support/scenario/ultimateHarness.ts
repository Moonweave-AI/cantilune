import type { CollaborationSnapshot, CoordinationChange } from "@cantilune/core";
import {
  actorRef,
  contentRef,
  validateAuditTailMatchesHistory,
  validateBeforeRefChain,
  validateEpochConsistent,
  validateSnapshotIntegrity,
} from "@cantilune/core";
import { appendObservationSegment, appendRewriteSegment, emptyRunHistory } from "@cantilune/core";
import { decodeChange, encodeChange } from "../../../src/codec/changeCodec.js";
import { decodeSnapshot, encodeSnapshot } from "../../../src/codec/snapshotCodec.js";
import type { CoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import type { MemoryChangeLog } from "../../../src/memory/memoryChangeLog.js";
import {
  proposeAndCommitOrThrow,
  introduceIntent,
  runDelegateRoundRobin,
  runIntroduceDelegateLoop,
  runSerialIntroduceFarm,
  replayChainStart,
} from "./scenarioRunner.js";
import { RUNTIME_SCALE, runtimeActors, runtimeAgentIds } from "./largeWorld.js";

export interface UltimateRuntimeClosure {
  readonly observationCount: number;
  readonly farmCommits: number;
  readonly concurrentExtraCommits: number;
  readonly loopCommits: number;
  readonly roundRobinCommits: number;
  readonly totalCommits: number;
  readonly replayOk: boolean;
  readonly replaySteps: number;
  readonly codecRoundTrips: number;
  readonly changelogTailLength: number;
  readonly snapshotCodecOk: boolean;
  readonly head: CollaborationSnapshot | undefined;
  readonly changes: readonly CoordinationChange[];
}

function runExtraIntroducePair(
  runtime: CoordinationRuntime,
  taskA: number,
  taskB: number,
  holderB: ReturnType<typeof runtimeAgentIds>[number],
): CoordinationChange[] {
  const first = proposeAndCommitOrThrow(runtime, introduceIntent(taskA, runtimeActors.planner));
  const second = proposeAndCommitOrThrow(runtime, introduceIntent(taskB, holderB));
  return [first.change, second.change];
}

/** Maximum runtime closure: obs storm + farm + concurrent re-admit + loop + multi-task RR + codec + replay. */
export function runUltimateRuntimeClosure(
  runtime: CoordinationRuntime,
  changelog: MemoryChangeLog,
  t0: CollaborationSnapshot,
): UltimateRuntimeClosure {
  const agentCount = RUNTIME_SCALE.extremeAgents;
  const farm = RUNTIME_SCALE.extremeFarm;
  const loopRounds = RUNTIME_SCALE.extremeLoopRounds;
  const observations = RUNTIME_SCALE.extremeObs;
  const roundRobinSpec = RUNTIME_SCALE.extremeRoundRobinHops;
  const agents = runtimeAgentIds(agentCount);

  let history = emptyRunHistory();
  for (let index = 0; index < observations; index++) {
    const source = actorRef(runtimeActors.human, "human");
    const observed = runtime.observe(
      {
        source,
        payloadRef: contentRef(`content://ultimate-obs-${index}`),
      },
      { principal: source },
    );
    if ("entry" in observed) {
      history = appendObservationSegment(history, observed.entry);
    }
  }

  const farmChanges = runSerialIntroduceFarm(runtime, farm - 2);
  const concurrentChanges = runExtraIntroducePair(runtime, farm + 50, farm + 51, agents[1]!);
  const loopStart = farm;
  const loopChanges = runIntroduceDelegateLoop(runtime, loopRounds, agents, loopStart);

  const roundRobinChanges: CoordinationChange[] = [];
  const roundRobinTasks: Array<{ taskIndex: number; initialHolder: (typeof agents)[number] }> = [
    { taskIndex: 0, initialHolder: runtimeActors.planner },
    { taskIndex: Math.floor(farm / 2), initialHolder: runtimeActors.planner },
    { taskIndex: farm - 3, initialHolder: runtimeActors.planner },
  ];
  for (let specIndex = 0; specIndex < roundRobinSpec.length; specIndex++) {
    const hops = roundRobinSpec[specIndex];
    const spec = roundRobinTasks[specIndex];
    if (hops === undefined || spec === undefined) {
      continue;
    }
    roundRobinChanges.push(
      ...runDelegateRoundRobin(runtime, spec.taskIndex, hops, agents, spec.initialHolder),
    );
  }

  const changes = [...farmChanges, ...concurrentChanges, ...loopChanges, ...roundRobinChanges];
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

  let codecRoundTrips = 0;
  for (const change of changes) {
    const decoded = decodeChange(encodeChange(change));
    if (decoded.changeId !== change.changeId) {
      throw new Error(`codec round-trip failed for ${change.changeId}`);
    }
    codecRoundTrips += 1;
  }

  const head = runtime.getHead();
  let snapshotCodecOk = false;
  if (head !== undefined) {
    validateSnapshotIntegrity(head);
    validateAuditTailMatchesHistory(head, history);
    const decodedHead = decodeSnapshot(encodeSnapshot(head));
    snapshotCodecOk =
      decodedHead.snapshotRef === head.snapshotRef &&
      decodedHead.artifacts.size === head.artifacts.size &&
      decodedHead.auditTail.length === head.auditTail.length;
  }

  const midRef = changes[Math.floor(changes.length / 3)]?.beforeRef;
  const changelogTailLength =
    midRef !== undefined ? changelog.since(midRef).length : changelog.all().length;

  const replay = runtime.replay({ fromRef: replayChainStart(changelog, t0) });

  return {
    observationCount: observations,
    farmCommits: farmChanges.length + concurrentChanges.length,
    concurrentExtraCommits: concurrentChanges.length,
    loopCommits: loopChanges.length,
    roundRobinCommits: roundRobinChanges.length,
    totalCommits: changes.length,
    replayOk: replay.ok,
    replaySteps: replay.ok ? replay.steps.length : 0,
    codecRoundTrips,
    changelogTailLength,
    snapshotCodecOk,
    head,
    changes,
  };
}

export function ultimateRuntimeEventCount(): number {
  const farm = RUNTIME_SCALE.extremeFarm;
  const loopRounds = RUNTIME_SCALE.extremeLoopRounds;
  const roundRobin = RUNTIME_SCALE.extremeRoundRobinHops.reduce((sum, hops) => sum + hops, 0);
  return farm + loopRounds * 2 + roundRobin + 16;
}

export function ultimateExpectedArtifactCount(): number {
  return RUNTIME_SCALE.extremeFarm + RUNTIME_SCALE.extremeLoopRounds;
}
