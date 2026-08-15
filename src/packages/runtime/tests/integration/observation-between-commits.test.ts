import { describe, expect, it } from "vitest";
import { actorRef, contentRef } from "@cantilune/core";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { introduceIntent } from "../support/scenario/scenarioRunner.js";
import { storyActorIds } from "../support/fixtures/config-t0.js";

/**
 * An observation advances the head through `compareAndSwapHead` without writing
 * a change, by design: an `ObservationEntry` is not a `CoordinationChange`. The
 * pre-commit check compared consecutive log entries for `beforeRef ===
 * afterRef` contiguity, so the first commit that followed an observation was
 * rejected as `commit_atomic_failed` — and stayed rejected, because the hole in
 * the log is permanent. Reads and content writes were unaffected, so the world
 * looked healthy while it could no longer accept a second commit.
 */
describe("observations interleaved with commits", () => {
  it("keeps committing after an observation lands between two commits", () => {
    const { runtime } = buildTestRuntime({ eventCount: 8 });
    const human = actorRef(storyActorIds.human, "human");

    const first = runtime.proposeAndCommit(introduceIntent(0));
    expect("code" in first).toBe(false);

    const observed = runtime.observe(
      { source: human, payloadRef: contentRef("content://note") },
      { principal: human },
    );
    expect("code" in observed).toBe(false);

    const second = runtime.proposeAndCommit(introduceIntent(1));
    expect(second).not.toHaveProperty("code");
  });

  it("keeps committing across several observation/commit alternations", () => {
    const { runtime } = buildTestRuntime({ eventCount: 24 });
    const human = actorRef(storyActorIds.human, "human");

    for (let round = 0; round < 3; round++) {
      const observed = runtime.observe(
        { source: human, payloadRef: contentRef(`content://note-${String(round)}`) },
        { principal: human },
      );
      expect(observed).not.toHaveProperty("code");

      const committed = runtime.proposeAndCommit(introduceIntent(round));
      expect(committed).not.toHaveProperty("code");
    }
  });
});
