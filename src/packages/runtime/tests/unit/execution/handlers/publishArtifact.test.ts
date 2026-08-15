import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  artifactId,
  contentRef,
  epochId,
  matchBinding,
  operationTypeId,
  withArtifact,
  workArtifact,
} from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { publishArtifactHandler } from "../../../../src/execution/handlers/publishArtifact.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";
import { defaultPublishArtifactTemplate } from "../../../../src/schema/defaultSchema.js";

describe("publishArtifactHandler", () => {
  const template = defaultPublishArtifactTemplate();
  const ctx = { template };

  it("rejects when task binding is missing", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("publish_artifact"),
      matchBindings: [matchBinding("from", "planner-p")],
      visibility: "external",
    });
    const result = publishArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("task binding");
  });

  it("rejects when artifact does not exist", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("publish_artifact"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      visibility: "external",
    });
    const result = publishArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("artifact not found");
  });

  it("publishes artifact and records from actor when bound", () => {
    const t0 = buildConfigT0();
    const task = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      actorRef(actorId("planner-p"), "agent"),
      "active",
    );
    const before = withArtifact(t0, task);
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("publish_artifact"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      visibility: "external",
    });
    const result = publishArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.artifacts.get(artifactId("task-T"))?.lifecycle).toBe("published");
    expect(result.involved).toHaveLength(1);
    expect(result.involved[0]?.actorId).toBe("planner-p");
  });

  it("resolves task via artifact role binding", () => {
    const t0 = buildConfigT0();
    const task = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      actorRef(actorId("planner-p"), "agent"),
      "reviewable",
    );
    const before = withArtifact(t0, task);
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("publish_artifact"),
      matchBindings: [matchBinding("artifact", "task-T")],
      visibility: "external",
    });
    const result = publishArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.artifacts.get(artifactId("task-T"))?.lifecycle).toBe("published");
    expect(result.involved).toHaveLength(0);
  });
});
