import { describe, expect, it } from "vitest";
import { contentDigest } from "@cantilune/core";
import { buildCommittedDpoReplayFixture } from "../support/dpoReplayFixture.js";
import { formatRecipeChainRef } from "../../src/canonical/replayRecipeChainDigest.js";

describe("runtimeDpoReplayPort", () => {
  it("executes when recipeRef matches durable recipe chain", async () => {
    const { t0, changes, replayPort, recipeChainRef } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const result = await replayPort.execute({
      fromSnapshotRef: t0.snapshotRef,
      toSnapshotRef: last.afterRef,
      changes,
      recipeRef: recipeChainRef,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stepCount).toBe(changes.length);
    }
  });

  it("rejects recipeRef that does not match durable sidecar recipes", async () => {
    const { t0, changes, replayPort } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const fakeRef = formatRecipeChainRef(contentDigest("0".repeat(64)));
    const result = await replayPort.execute({
      fromSnapshotRef: t0.snapshotRef,
      toSnapshotRef: last.afterRef,
      changes,
      recipeRef: fakeRef,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("recipe_mismatch");
    }
  });

  it("rejects legacy recipe:// ref", async () => {
    const { t0, changes, replayPort } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const result = await replayPort.execute({
      fromSnapshotRef: t0.snapshotRef,
      toSnapshotRef: last.afterRef,
      changes,
      recipeRef: "recipe://legacy",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("recipe_mismatch");
    }
  });
});
