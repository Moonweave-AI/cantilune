import { describe, expect, it } from "vitest";
import {
  computeReplayRecipeChainDigest,
  computeReplayRecipeDigest,
  formatRecipeChainRef,
  parseRecipeChainRef,
  replayRecipeSnapshotFromChange,
  verifyRecipeChainRefMatchesChanges,
} from "../../src/canonical/replayRecipeChainDigest.js";
import {
  coordinationChange,
  contentRef,
  matchBinding,
  changeId,
  epochId,
  operationTypeId,
  snapshotRef,
  actorId,
  actorRef,
  targetRef,
} from "@cantilune/core";

function sampleChange() {
  return coordinationChange({
    changeId: changeId("chg-001"),
    recordedAt: "2026-01-01T00:00:00.000Z",
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapshotRef("snap-S0"),
    afterRef: snapshotRef("snap-S1"),
    matchBindings: [matchBinding("task", "task-0"), matchBinding("from", "planner-p")],
    targets: [targetRef("artifact", "task-0"), targetRef("participant", "planner-p")],
    initiator: actorRef(actorId("planner-p"), "agent"),
    involved: [actorRef(actorId("planner-p"), "agent")],
    authorization: [],
    external: [],
    createdSessionRefs: [],
    visibility: "internal",
  });
}

function sampleRecipe(change: ReturnType<typeof sampleChange>) {
  return replayRecipeSnapshotFromChange(change, {
    epochId: "42",
    operationTypeId: "introduce_artifact",
    matchBindings: change.matchBindings,
    matchWitness: { domainSize: 2, codomainSize: 2, embedding: [0, 1] },
    complementTag: 0,
    kind: "internal",
    authorization: [],
    external: [],
    createdSessionRefs: [],
    freshLinkRefs: [],
    inputContentRefs: [
      contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
    ],
    visibility: "internal",
  });
}

describe("replayRecipeChainDigest", () => {
  it("formats and parses recipe-chain refs", () => {
    const change = sampleChange();
    const digest = computeReplayRecipeDigest(sampleRecipe(change));
    const ref = formatRecipeChainRef(digest);
    expect(ref.startsWith("recipe-chain:sha256:")).toBe(true);
    expect(parseRecipeChainRef(ref)).toBe(digest);
    expect(parseRecipeChainRef("recipe://legacy")).toBeUndefined();
  });

  it("binds ordered change recipes into chain digest", () => {
    const change = sampleChange();
    const digest = computeReplayRecipeChainDigest({
      changes: [change],
      resolveRecipe: () => sampleRecipe(change),
    });
    const ref = formatRecipeChainRef(digest);
    expect(
      verifyRecipeChainRefMatchesChanges({
        recipeRef: ref,
        changes: [change],
        resolveRecipe: () => sampleRecipe(change),
      }),
    ).toBe(true);
  });

  it("covers session and link binding wire roles", () => {
    const change = sampleChange();
    const recipe = replayRecipeSnapshotFromChange(change, {
      epochId: "42",
      operationTypeId: "introduce_artifact",
      matchBindings: [matchBinding("session", "sess-1"), matchBinding("link", "link-1")],
      matchWitness: { domainSize: 2, codomainSize: 2, embedding: [0, 1] },
      complementTag: 0,
      kind: "internal",
      authorization: [],
      external: [],
      createdSessionRefs: [],
      freshLinkRefs: [],
      inputContentRefs: [
        contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
      ],
      visibility: "internal",
    });
    expect(recipe.matchBindings).toEqual([
      { role: "session", id: "sess-1" },
      { role: "link", id: "link-1" },
    ]);
    expect(parseRecipeChainRef("recipe-chain:sha256:not-hex")).toBeUndefined();
  });

  it("rejects tampered recipe chain ref", () => {
    const change = sampleChange();
    const ref = formatRecipeChainRef(
      computeReplayRecipeChainDigest({
        changes: [change],
        resolveRecipe: () => sampleRecipe(change),
      }),
    );
    const tampered = ref.replace(/a/g, "b");
    expect(
      verifyRecipeChainRefMatchesChanges({
        recipeRef: tampered,
        changes: [change],
        resolveRecipe: () => sampleRecipe(change),
      }),
    ).toBe(false);
  });
});
