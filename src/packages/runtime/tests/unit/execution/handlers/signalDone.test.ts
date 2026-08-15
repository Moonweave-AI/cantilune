import { describe, it, expect } from "vitest";
import {
  actorId,
  epochId,
  operationTypeId,
  matchBinding,
  collaborationSnapshot,
  snapshotRef,
  participant,
} from "@cantilune/core";
import type { ParticipationStatus } from "@cantilune/core";
import { signalDoneHandler } from "../../../../src/execution/handlers/signalDone.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";

function snapshotWithAgent(status: ParticipationStatus) {
  const agent = actorId("agent-a");
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s0"),
    epochId: epochId("e1"),
    participants: new Map([[agent, participant(agent, "agent", status)]]),
  });
}

function makeRecipe(from: string) {
  return replayRecipe({
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("signal_done"),
    matchBindings: [matchBinding("from", from)],
    visibility: "external",
  });
}

const ctx = { template: undefined as never };

describe("signalDoneHandler", () => {
  it("transitions active → done", () => {
    const snap = snapshotWithAgent("active");
    const result = signalDoneHandler(snap, makeRecipe("agent-a"), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.get(actorId("agent-a"))!.status).toBe("done");
  });

  it.each(["waiting", "done", "retired"] as const)(
    "rejects %s → done (invalid transition)",
    (status) => {
      const snap = snapshotWithAgent(status);
      const result = signalDoneHandler(snap, makeRecipe("agent-a"), ctx);
      expect(result.ok).toBe(false);
    },
  );

  it("rejects registered → done with reason message", () => {
    const snap = snapshotWithAgent("registered");
    const result = signalDoneHandler(snap, makeRecipe("agent-a"), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("invalid lifecycle transition");
  });

  it("rejects when 'from' binding is missing", () => {
    const snap = snapshotWithAgent("active");
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("signal_done"),
      matchBindings: [],
      visibility: "external",
    });
    const result = signalDoneHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("from");
  });

  it("rejects when participant does not exist", () => {
    const snap = snapshotWithAgent("active");
    const result = signalDoneHandler(snap, makeRecipe("nonexistent"), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not found");
  });

  it("preserves participant kind after transition", () => {
    const agent = actorId("agent-a");
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s0"),
      epochId: epochId("e1"),
      participants: new Map([[agent, participant(agent, "human", "active")]]),
    });
    const result = signalDoneHandler(snap, makeRecipe("agent-a"), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.get(agent)!.kind).toBe("human");
  });
});
