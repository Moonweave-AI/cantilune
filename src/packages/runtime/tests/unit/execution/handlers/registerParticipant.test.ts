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
import { registerParticipantHandler } from "../../../../src/execution/handlers/registerParticipant.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";

function baseSnapshot() {
  const initiator = actorId("agent-0");
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s0"),
    epochId: epochId("e1"),
    participants: new Map([[initiator, participant(initiator, "agent", "active")]]),
  });
}

function makeRecipe(from: string, target: string) {
  return replayRecipe({
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("register_participant"),
    matchBindings: [matchBinding("from", from), matchBinding("participant", target)],
    visibility: "external",
  });
}

const ctx = { template: undefined as never };

describe("registerParticipantHandler", () => {
  it("successfully registers a new participant", () => {
    const snap = baseSnapshot();
    const recipe = makeRecipe("agent-0", "agent-a");
    const result = registerParticipantHandler(snap, recipe, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.has(actorId("agent-a"))).toBe(true);
    expect(result.after.participants.get(actorId("agent-a"))!.status).toBe("registered");
  });

  it("rejects when 'from' binding is missing", () => {
    const snap = baseSnapshot();
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("register_participant"),
      matchBindings: [matchBinding("participant", "agent-a")],
      visibility: "external",
    });
    const result = registerParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("from");
  });

  it("rejects when 'participant' binding is missing", () => {
    const snap = baseSnapshot();
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("register_participant"),
      matchBindings: [matchBinding("from", "agent-0")],
      visibility: "external",
    });
    const result = registerParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("participant");
  });

  it("rejects when initiator is not found in snapshot", () => {
    const snap = baseSnapshot();
    const recipe = makeRecipe("nonexistent", "agent-a");
    const result = registerParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not found");
  });

  it("rejects when initiator is not active", () => {
    const initiator = actorId("agent-0");
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s0"),
      epochId: epochId("e1"),
      participants: new Map([[initiator, participant(initiator, "agent", "registered")]]),
    });
    const recipe = makeRecipe("agent-0", "agent-a");
    const result = registerParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("active");
  });

  it("rejects duplicate registration", () => {
    const initiator = actorId("agent-0");
    const existing = actorId("agent-a");
    const snap = collaborationSnapshot({
      snapshotRef: snapshotRef("s0"),
      epochId: epochId("e1"),
      participants: new Map([
        [initiator, participant(initiator, "agent", "active")],
        [existing, participant(existing, "agent", "registered")],
      ]),
    });
    const recipe = makeRecipe("agent-0", "agent-a");
    const result = registerParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("already registered");
  });

  it("allows concurrent registration of different participants", () => {
    const snap = baseSnapshot();
    const recipeA = makeRecipe("agent-0", "agent-a");
    const resultA = registerParticipantHandler(snap, recipeA, ctx);
    expect(resultA.ok).toBe(true);
    if (!resultA.ok) return;

    const recipeB = makeRecipe("agent-0", "agent-b");
    const resultB = registerParticipantHandler(resultA.after, recipeB, ctx);
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) return;
    expect(resultB.after.participants.has(actorId("agent-a"))).toBe(true);
    expect(resultB.after.participants.has(actorId("agent-b"))).toBe(true);
  });

  it("includes both initiator and new participant in involved refs", () => {
    const snap = baseSnapshot();
    const recipe = makeRecipe("agent-0", "agent-a");
    const result = registerParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.involved).toHaveLength(2);
  });
});
