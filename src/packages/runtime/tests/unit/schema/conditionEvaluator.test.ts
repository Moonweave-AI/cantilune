import { describe, expect, it } from "vitest";
import { actorRef, contentRef, matchBinding, withArtifact, workArtifact } from "@cantilune/core";
import { evaluateCondition, evaluateRequires } from "../../../src/schema/conditionEvaluator.js";
import {
  defaultIntroduceTemplate,
  defaultDelegateTemplate,
} from "../../../src/schema/defaultSchema.js";
import { buildConfigT0, storyActorIds } from "../../support/fixtures/config-t0.js";
import { storyEntityIds } from "../../support/fixtures/story-entities.js";

describe("conditionEvaluator", () => {
  const introduceBindings = [
    matchBinding("task", storyEntityIds.task),
    matchBinding("from", storyActorIds.planner),
    matchBinding("capability", storyEntityIds.writeLock),
  ];

  it("passes introduce requires on T0", () => {
    const snapshot = buildConfigT0();
    expect(
      evaluateRequires(snapshot, introduceBindings, defaultIntroduceTemplate().requires),
    ).toBeUndefined();
  });

  it("fails delegate requires when task is missing", () => {
    const snapshot = buildConfigT0();
    const delegateBindings = [
      matchBinding("task", storyEntityIds.task),
      matchBinding("from", storyActorIds.planner),
      matchBinding("to", storyActorIds.coder),
      matchBinding("capability", storyEntityIds.writeLock),
    ];
    const failed = evaluateRequires(snapshot, delegateBindings, defaultDelegateTemplate().requires);
    expect(failed?.kind).toBe("task.exists");
  });

  it("evaluates delegator.holds via artifact owner", () => {
    let snapshot = buildConfigT0();
    snapshot = withArtifact(
      snapshot,
      workArtifact(
        storyEntityIds.task,
        "Task",
        contentRef("content://task-T"),
        actorRef(storyActorIds.planner, "agent"),
      ),
    );

    expect(
      evaluateCondition(
        snapshot,
        [matchBinding("task", storyEntityIds.task), matchBinding("from", storyActorIds.planner)],
        { kind: "delegator.holds", bindings: {} },
      ),
    ).toBe(true);

    snapshot = withArtifact(
      snapshot,
      workArtifact(
        storyEntityIds.task,
        "Task",
        contentRef("content://task-T"),
        actorRef(storyActorIds.coder, "agent"),
      ),
    );

    expect(
      evaluateCondition(
        snapshot,
        [matchBinding("task", storyEntityIds.task), matchBinding("from", storyActorIds.planner)],
        { kind: "delegator.holds", bindings: {} },
      ),
    ).toBe(false);
  });
});
