import { describe, expect, it } from "vitest";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import {
  introduceIntent,
  proposeAndCommitOrThrow,
  replayChainStart,
} from "../../support/scenario/scenarioRunner.js";

describe("L7 soak", () => {
  it("survives repeated introduce/replay cycles without drift", () => {
    const { runtime, t0, changelog } = buildTestRuntime({ eventCount: 120 });
    const rounds = 30;

    for (let round = 0; round < rounds; round++) {
      proposeAndCommitOrThrow(runtime, introduceIntent(round));
      const replay = runtime.replay({ fromRef: replayChainStart(changelog, t0) });
      expect(replay.ok).toBe(true);
      if (!replay.ok) {
        return;
      }
      expect(replay.steps).toHaveLength(round + 1);
      expect(replay.terminal.artifacts.size).toBe(round + 1);
    }
  });
});
