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
import { retireParticipantHandler } from "../../../../src/execution/handlers/retireParticipant.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";

function snapshotWithAgents(agents: [string, ParticipationStatus][]) {
  const map = new Map(
    agents.map(([id, status]) => [actorId(id), participant(actorId(id), "agent", status)]),
  );
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s0"),
    epochId: epochId("e1"),
    participants: map,
  });
}

const ctx = { template: undefined as never };

describe("retireParticipantHandler", () => {
  it("transitions done → retired", () => {
    const snap = snapshotWithAgents([
      ["agent-0", "active"],
      ["agent-a", "done"],
    ]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("from", "agent-0"), matchBinding("participant", "agent-a")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.get(actorId("agent-a"))!.status).toBe("retired");
  });

  it("transitions active → retired", () => {
    const snap = snapshotWithAgents([
      ["agent-0", "active"],
      ["agent-a", "active"],
    ]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("from", "agent-0"), matchBinding("participant", "agent-a")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.get(actorId("agent-a"))!.status).toBe("retired");
  });

  it("rejects registered → retired (must go through active)", () => {
    const snap = snapshotWithAgents([
      ["agent-0", "active"],
      ["agent-a", "registered"],
    ]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("from", "agent-0"), matchBinding("participant", "agent-a")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("invalid lifecycle transition");
  });

  it("rejects retired → retired (already terminal)", () => {
    const snap = snapshotWithAgents([
      ["agent-0", "active"],
      ["agent-a", "retired"],
    ]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("from", "agent-0"), matchBinding("participant", "agent-a")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
  });

  it("allows self-retire (from == participant)", () => {
    const snap = snapshotWithAgents([["agent-a", "done"]]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("from", "agent-a")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.participants.get(actorId("agent-a"))!.status).toBe("retired");
  });

  it("rejects when 'from' binding is missing", () => {
    const snap = snapshotWithAgents([["agent-a", "done"]]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("participant", "agent-a")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("from");
  });

  it("rejects when target participant does not exist", () => {
    const snap = snapshotWithAgents([["agent-0", "active"]]);
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("retire_participant"),
      matchBindings: [matchBinding("from", "agent-0"), matchBinding("participant", "ghost")],
      visibility: "external",
    });
    const result = retireParticipantHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not found");
  });
});
