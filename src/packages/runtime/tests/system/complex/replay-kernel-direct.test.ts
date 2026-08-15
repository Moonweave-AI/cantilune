import { describe, expect, it } from "vitest";
import { actorRef, actorId, contentRef, matchBinding, operationTypeId } from "@cantilune/core";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { replayKernelRun } from "../../../src/execution/replayKernel.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { defaultIntroduceTemplate } from "../../../src/schema/defaultSchema.js";
import { coordinationChange, changeId, epochId, snapshotRef, timestamp } from "@cantilune/core";

describe("replayKernel direct", () => {
  it("replays introduce recipe from T0 via Lean-aligned kernel entry", () => {
    const t0 = buildConfigT0();
    const registry = createDefaultHandlers();
    const change = coordinationChange({
      changeId: changeId("chg-kernel-1"),
      recordedAt: timestamp("2026-08-07T10:05:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", actorId("planner-p")),
        matchBinding("capability", storyEntityIds.writeLock),
      ],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });

    const recipe = replayRecipe({
      epochId: change.epochId,
      operationTypeId: change.operationTypeId,
      matchBindings: change.matchBindings,
      inputContentRefs: [
        contentRef("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      ],
      visibility: change.visibility,
    });
    const result = replayKernelRun(recipe, t0, registry, {
      template: defaultIntroduceTemplate(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.after.artifacts.has(storyEntityIds.task)).toBe(true);
    }
  });
});
