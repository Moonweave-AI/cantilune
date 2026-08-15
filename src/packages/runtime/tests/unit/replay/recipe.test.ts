import { describe, expect, it } from "vitest";
import {
  changeId,
  coordinationChange,
  epochId,
  operationTypeId,
  snapshotRef,
} from "@cantilune/core";
import { matchBinding } from "@cantilune/core";
import { timestamp } from "@cantilune/core";
import { actorRef, actorId } from "@cantilune/core";
import {
  replayRecipeFromChange,
  coordinationChangeFromCommit,
  replayRecipe,
  withRecipeSessions,
  withRecipeAuthorization,
} from "../../../src/replay/recipe.js";
import { sessionId, evidenceId, contentRef } from "@cantilune/core";
import { evidenceRef } from "@cantilune/core";
import { matchWitnessFromBindings, verifyMatchWitness } from "../../../src/replay/matchWitness.js";

describe("replay recipe", () => {
  it("round-trips change without before/after in recipe", () => {
    const change = coordinationChange({
      changeId: changeId("chg-1"),
      recordedAt: timestamp("2026-08-07T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("delegate"),
      beforeRef: snapshotRef("snap-S0"),
      afterRef: snapshotRef("snap-S1"),
      matchBindings: [
        matchBinding("task", "task-T"),
        matchBinding("from", "planner-p"),
        matchBinding("to", "coder-c"),
        matchBinding("capability", "write-lock-w"),
      ],
      initiator: actorRef(actorId("planner-p"), "agent"),
      visibility: "external",
    });

    const recipe = replayRecipeFromChange(change);
    expect(recipe.matchBindings).toHaveLength(4);
    expect(recipe).not.toHaveProperty("beforeRef");
    expect(recipe).not.toHaveProperty("afterRef");
    expect(verifyMatchWitness(recipe.matchWitness, recipe.matchBindings)).toBe(true);

    const roundTrip = coordinationChangeFromCommit({
      recipe,
      changeId: change.changeId,
      recordedAt: change.recordedAt,
      beforeRef: change.beforeRef,
      afterRef: change.afterRef,
      initiator: change.initiator,
      involved: change.involved,
    });

    expect(roundTrip.operationTypeId).toBe(change.operationTypeId);
    expect(roundTrip.matchBindings).toEqual(change.matchBindings);
  });

  it("builds witness from bindings", () => {
    const bindings = [matchBinding("task", "task-T"), matchBinding("from", "planner-p")];
    const witness = matchWitnessFromBindings(bindings);
    expect(witness.domainSize).toBe(2);
    expect(witness.embedding).toEqual([0, 1]);
  });

  it("creates recipe with complement tag default", () => {
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("introduce_artifact"),
      matchBindings: [matchBinding("task", "task-T")],
      visibility: "external",
    });
    expect(recipe.complementTag).toBe(0);
    expect(recipe.kind).toBe("external");
  });

  it("supports recipe session and authorization helpers", () => {
    const base = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("create_session"),
      matchBindings: [matchBinding("from", "planner-p")],
      visibility: "external",
    });
    const withSessions = withRecipeSessions(base, [sessionId("session-s")]);
    expect(withSessions.createdSessionRefs).toEqual(["session-s"]);
    const withAuth = withRecipeAuthorization(base, [
      evidenceRef(evidenceId("ev-1"), "approval", contentRef("content://ev")),
    ]);
    expect(withAuth.authorization).toHaveLength(1);
  });
});
