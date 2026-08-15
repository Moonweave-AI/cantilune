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
import { introduceArtifactHandler } from "../../../../src/execution/handlers/introduceArtifact.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";
import { defaultIntroduceTemplate } from "../../../../src/schema/defaultSchema.js";

describe("introduceArtifactHandler", () => {
  const template = defaultIntroduceTemplate();
  const ctx = { template };
  const taskContentRef = contentRef(
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );

  it("rejects when task or from binding is missing", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [matchBinding("task", "task-T")],
      visibility: "external",
    });
    const result = introduceArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("task and from");
  });

  it("rejects duplicate artifact", () => {
    const t0 = buildConfigT0();
    const existing = workArtifact(
      artifactId("task-T"),
      "Task",
      contentRef("content://task-T"),
      actorRef(actorId("planner-p"), "agent"),
      "active",
    );
    const before = withArtifact(t0, existing);
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      visibility: "external",
    });
    const result = introduceArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("already exists");
  });

  it("introduces artifact with explicit capability binding", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [
        matchBinding("task", "task-T"),
        matchBinding("from", "planner-p"),
        matchBinding("capability", "cap-custom"),
      ],
      inputContentRefs: [taskContentRef],
      visibility: "external",
    });
    const result = introduceArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.artifacts.has(artifactId("task-T"))).toBe(true);
    expect(result.after.artifacts.get(artifactId("task-T"))?.contentRef).toBe(taskContentRef);
    expect(result.after.capabilities.has("cap-custom" as never)).toBe(true);
  });

  it("rejects a new artifact when its contentRef is missing", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      visibility: "external",
    });

    const result = introduceArtifactHandler(before, recipe, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("input contentRef");
  });

  it("uses default write lock when capability binding omitted", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      inputContentRefs: [taskContentRef],
      visibility: "external",
    });
    const result = introduceArtifactHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.capabilities.has("write-lock-task-T" as never)).toBe(true);
  });
});
