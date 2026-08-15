import { describe, expect, it } from "vitest";
import {
  artifactId,
  validateAuditTailMatchesHistory,
  validateBeforeRefChain,
  validateSnapshotIntegrity,
} from "@cantilune/core";
import { appendRewriteSegment, emptyRunHistory } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  RUNTIME_SCALE,
  buildRuntimeLargeWorld,
  runtimeAgentIds,
} from "../../support/scenario/largeWorld.js";
import { runIntroduceDelegateLoop } from "../../support/scenario/scenarioRunner.js";

describe("loop introduce-delegate via runtime", () => {
  it("runs multi-round introduce+delegate with replay closure", () => {
    const rounds = RUNTIME_SCALE.loopRounds;
    const agents = runtimeAgentIds(RUNTIME_SCALE.agents);
    const eventCount = rounds * 2 + 4;
    const world = buildRuntimeLargeWorld(RUNTIME_SCALE.agents);
    const { runtime, t0 } = buildTestRuntime({ initial: world, eventCount });

    let history = emptyRunHistory();
    const changes = runIntroduceDelegateLoop(runtime, rounds, agents);
    for (const change of changes) {
      history = appendRewriteSegment(history, change);
    }

    const head = runtime.getHead();
    expect(changes).toHaveLength(rounds * 2);
    validateBeforeRefChain(changes);
    if (head !== undefined) {
      validateSnapshotIntegrity(head);
      expect(head.artifacts.size).toBe(rounds);
      for (let round = 0; round < rounds; round++) {
        const expected = agents[round % agents.length];
        expect(head.artifacts.get(artifactId(`task-${round}`))?.owner.actorId).toBe(expected);
      }
    }

    const replay = runtime.replay({ fromRef: t0.snapshotRef });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.steps).toHaveLength(rounds * 2);
      expect(replay.terminalRef).toBe(head?.snapshotRef);
    }

    expect(() => {
      if (head !== undefined) {
        validateAuditTailMatchesHistory(head, history);
      }
    }).not.toThrow();
  });
});
