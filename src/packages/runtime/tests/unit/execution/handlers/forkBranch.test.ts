import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  artifactId,
  contentRef,
  epochId,
  linkId,
  matchBinding,
  operationTypeId,
  withArtifact,
  workArtifact,
} from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { forkBranchHandler } from "../../../../src/execution/handlers/forkBranch.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";
import { defaultForkBranchTemplate } from "../../../../src/schema/defaultSchema.js";

describe("forkBranchHandler", () => {
  const template = defaultForkBranchTemplate();
  const ctx = { template };
  const taskContentRef = contentRef(
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );

  it("rejects when from binding is missing", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [matchBinding("participant", "coder-c")],
      visibility: "external",
    });
    const result = forkBranchHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate task when task binding present", () => {
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
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [matchBinding("from", "planner-p"), matchBinding("task", "task-T")],
      visibility: "external",
    });
    const result = forkBranchHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("already exists");
  });

  it("rejects when freshLinkRefs insufficient for parallel participants", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [
        matchBinding("from", "planner-p"),
        matchBinding("participant", "coder-c"),
        matchBinding("participant", "human-1"),
      ],
      freshLinkRefs: [],
      visibility: "external",
    });
    const result = forkBranchHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("freshLinkRefs");
  });

  it("creates parallel_with links between branch participants", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [matchBinding("from", "planner-p"), matchBinding("participant", "coder-c")],
      freshLinkRefs: [linkId("link-1")],
      visibility: "external",
    });
    const result = forkBranchHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.links.size).toBe(1);
  });

  it("rejects a task branch without content instead of creating a dangling ref", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [matchBinding("from", "planner-p"), matchBinding("task", "task-T")],
      visibility: "external",
    });

    const result = forkBranchHandler(before, recipe, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("requires an input contentRef");
  });

  it("rejects orphan content when no task binding consumes it", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [matchBinding("from", "planner-p")],
      inputContentRefs: [taskContentRef],
      visibility: "external",
    });

    const result = forkBranchHandler(before, recipe, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("requires a task binding");
  });

  it("introduces branch task with explicit capability binding", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("fork_branch"),
      matchBindings: [
        matchBinding("from", "planner-p"),
        matchBinding("task", "task-T"),
        matchBinding("capability", "cap-branch"),
      ],
      freshLinkRefs: [],
      inputContentRefs: [taskContentRef],
      visibility: "external",
    });
    const result = forkBranchHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.artifacts.has(artifactId("task-T"))).toBe(true);
    expect(result.after.artifacts.get(artifactId("task-T"))?.contentRef).toBe(taskContentRef);
    expect(result.after.capabilities.has("cap-branch" as never)).toBe(true);
  });
});
