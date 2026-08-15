import { describe, expect, it } from "vitest";
import { epochId, operationTypeId } from "@cantilune/core";
import { allocateFreshRefsForRecipe } from "../../../src/execution/allocateFreshRefs.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";

describe("allocateFreshRefsForRecipe", () => {
  it("allocates fresh link refs for fork_branch with multiple participants", () => {
    const idGen = createDeterministicIdGenerator({ linkIds: ["link-1"] });
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [
        { role: "from", actorId: "planner-p" as never },
        { role: "participant", actorId: "coder-c" as never },
      ],
      visibility: "external",
    });
    const result = allocateFreshRefsForRecipe(recipe, operationTypeId("fork_branch"), idGen);
    expect(result.freshLinkRefs).toEqual(["link-1"]);
  });

  it("allocates session ref for delegate when none provided", () => {
    const idGen = createDeterministicIdGenerator({ sessionIds: ["session-new"] });
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      matchBindings: [
        { role: "from", actorId: "planner-p" as never },
        { role: "to", actorId: "coder-c" as never },
        { role: "participant", actorId: "reviewer-r" as never },
      ],
      visibility: "external",
    });
    const result = allocateFreshRefsForRecipe(recipe, operationTypeId("delegate"), idGen);
    expect(result.createdSessionRefs).toEqual(["session-new"]);
    expect(result.freshLinkRefs).toHaveLength(1);
  });

  it("returns empty fresh refs for introduce_artifact", () => {
    const idGen = createDeterministicIdGenerator({ linkIds: ["link-1"] });
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [
        { role: "task", artifactId: "task-T" as never },
        { role: "from", actorId: "planner-p" as never },
      ],
      visibility: "external",
    });
    const result = allocateFreshRefsForRecipe(recipe, operationTypeId("introduce_artifact"), idGen);
    expect(result.freshLinkRefs).toEqual([]);
  });
});
