import { describe, expect, it } from "vitest";
import {
  actorRef,
  artifactId,
  contentRef,
  epochId,
  linkId,
  matchBinding,
  operationTypeId,
  scopedCapability,
  sessionId,
  withArtifact,
  withCapability,
  workArtifact,
} from "@cantilune/core";
import { buildConfigT0, storyActorIds } from "../../../support/fixtures/config-t0.js";
import { delegateHandler } from "../../../../src/execution/handlers/delegate.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";
import { defaultDelegateTemplate } from "../../../../src/schema/defaultSchema.js";
import { storyEntityIds } from "../../../support/fixtures/story-entities.js";

describe("delegateHandler", () => {
  const template = defaultDelegateTemplate();
  const ctx = { template };

  function snapshotWithTask() {
    let snapshot = buildConfigT0();
    snapshot = withArtifact(
      snapshot,
      workArtifact(
        storyEntityIds.task,
        "Task",
        contentRef("content://task-T"),
        actorRef(storyActorIds.planner, "agent"),
        "active",
      ),
    );
    return withCapability(
      snapshot,
      scopedCapability(storyEntityIds.writeLock, "write_lock", storyActorIds.planner, {
        kind: "artifact",
        artifactId: storyEntityIds.task,
      }),
    );
  }

  it("rejects missing bindings", () => {
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      matchBindings: [matchBinding("task", storyEntityIds.task)],
      visibility: "external",
    });
    expect(delegateHandler(buildConfigT0(), recipe, ctx).ok).toBe(false);
  });

  it("rejects missing task or capability", () => {
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      matchBindings: [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
      ],
      visibility: "external",
    });
    expect(delegateHandler(buildConfigT0(), recipe, ctx).ok).toBe(false);
  });

  it("delegates task and opens session", () => {
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      matchBindings: [
        matchBinding("task", storyEntityIds.task),
        matchBinding("from", storyActorIds.planner),
        matchBinding("to", storyActorIds.coder),
        matchBinding("capability", storyEntityIds.writeLock),
      ],
      createdSessionRefs: [sessionId("session-s")],
      freshLinkRefs: [linkId("link-1")],
      visibility: "external",
    });
    const result = delegateHandler(snapshotWithTask(), recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.sessions.has(sessionId("session-s"))).toBe(true);
    expect(result.after.artifacts.get(artifactId(storyEntityIds.task))?.owner.actorId).toBe(
      storyActorIds.coder,
    );
  });
});
