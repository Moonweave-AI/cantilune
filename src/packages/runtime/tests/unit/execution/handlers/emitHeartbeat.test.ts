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
import { emitHeartbeatHandler } from "../../../../src/execution/handlers/emitHeartbeat.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";

function snapshotWithAgent(status: "active" | "registered" | "retired" | "done" = "active") {
  const agent = actorId("agent-a");
  return collaborationSnapshot({
    snapshotRef: snapshotRef("s0"),
    epochId: epochId("e1"),
    participants: new Map([[agent, participant(agent, "agent", status)]]),
  });
}

function makeRecipe(from: string, turnCount = 0, lastAction = "unknown") {
  return replayRecipe({
    epochId: epochId("e1"),
    operationTypeId: operationTypeId("emit_heartbeat"),
    matchBindings: [matchBinding("from", from)],
    scalarInputs: { turnCount, lastAction },
    emittedAt: "2026-08-13T09:00:00Z",
    visibility: "internal",
  });
}

const ctx = { template: undefined as never };

describe("emitHeartbeatHandler", () => {
  it("appends heartbeat to heartbeatLog for active participant", () => {
    const snap = snapshotWithAgent("active");
    const result = emitHeartbeatHandler(snap, makeRecipe("agent-a", 5, "write_content"), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.heartbeatLog).toHaveLength(1);
    expect(result.after.heartbeatLog[0]!.agentId).toBe(actorId("agent-a"));
    expect(result.after.heartbeatLog[0]!.sequenceNo).toBe(1);
    expect(result.after.heartbeatLog[0]!.emittedAt).toBe("2026-08-13T09:00:00Z");
    expect(result.after.heartbeatLog[0]!.turnCount).toBe(5);
    expect(result.after.heartbeatLog[0]!.lastAction).toBe("write_content");
  });

  it("increments sequenceNo on subsequent heartbeats", () => {
    const snap = snapshotWithAgent("active");
    const r1 = emitHeartbeatHandler(snap, makeRecipe("agent-a", 1, "perceive"), ctx);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = emitHeartbeatHandler(r1.after, makeRecipe("agent-a", 2, "act"), ctx);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(r2.after.heartbeatLog).toHaveLength(2);
    expect(r2.after.heartbeatLog[1]!.sequenceNo).toBe(2);
  });

  it("rejects heartbeat from retired participant", () => {
    const snap = snapshotWithAgent("retired");
    const result = emitHeartbeatHandler(snap, makeRecipe("agent-a"), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("retired");
  });

  it("rejects heartbeat from non-existent participant", () => {
    const snap = snapshotWithAgent("active");
    const result = emitHeartbeatHandler(snap, makeRecipe("ghost"), ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("non-existent");
  });

  it("allows heartbeat from registered participant", () => {
    const snap = snapshotWithAgent("registered");
    const result = emitHeartbeatHandler(snap, makeRecipe("agent-a"), ctx);
    expect(result.ok).toBe(true);
  });

  it("rejects missing scalar inputs instead of inventing heartbeat data", () => {
    const snap = snapshotWithAgent("active");
    const result = emitHeartbeatHandler(
      snap,
      replayRecipe({
        epochId: epochId("e1"),
        operationTypeId: operationTypeId("emit_heartbeat"),
        matchBindings: [matchBinding("from", "agent-a")],
        emittedAt: "2026-08-13T09:00:00Z",
        visibility: "internal",
      }),
      ctx,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("scalar inputs");
  });

  it("rejects malformed scalar inputs", () => {
    const snap = snapshotWithAgent("active");
    const result = emitHeartbeatHandler(
      snap,
      replayRecipe({
        epochId: epochId("e1"),
        operationTypeId: operationTypeId("emit_heartbeat"),
        matchBindings: [matchBinding("from", "agent-a")],
        scalarInputs: { turnCount: -1, lastAction: "act" },
        emittedAt: "2026-08-13T09:00:00Z",
        visibility: "internal",
      }),
      ctx,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("turnCount");
  });

  it("rejects when 'from' binding is missing", () => {
    const snap = snapshotWithAgent("active");
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      matchBindings: [],
      visibility: "internal",
    });
    const result = emitHeartbeatHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("from");
  });

  it("fails closed when a legacy recipe has no replay-authoritative emittedAt", () => {
    const snap = snapshotWithAgent("active");
    const recipe = replayRecipe({
      epochId: epochId("e1"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      matchBindings: [matchBinding("from", "agent-a")],
      visibility: "internal",
    });

    const result = emitHeartbeatHandler(snap, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("emittedAt");
  });

  it("correctly reports involved actors", () => {
    const snap = snapshotWithAgent("active");
    const result = emitHeartbeatHandler(snap, makeRecipe("agent-a", 1, "x"), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.involved).toHaveLength(1);
    expect(result.involved[0]!.actorId).toBe(actorId("agent-a"));
  });
});
