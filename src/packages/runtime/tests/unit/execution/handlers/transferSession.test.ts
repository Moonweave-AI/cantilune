import { describe, expect, it } from "vitest";
import {
  actorId,
  communicationSession,
  epochId,
  matchBinding,
  operationTypeId,
  sessionId,
  withSession,
} from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { transferSessionHandler } from "../../../../src/execution/handlers/transferSession.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";
import { defaultTransferSessionTemplate } from "../../../../src/schema/defaultSchema.js";

describe("transferSessionHandler", () => {
  const template = defaultTransferSessionTemplate();
  const ctx = { template };

  function snapshotWithSession(controller: string, participants: string[]) {
    const t0 = buildConfigT0();
    return withSession(
      t0,
      communicationSession(
        sessionId("session-s"),
        actorId(controller),
        participants.map((p) => actorId(p)),
        "shared",
      ),
    );
  }

  it("rejects when session or to binding is missing", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("transfer_session"),
      matchBindings: [matchBinding("session", "session-s")],
      visibility: "external",
    });
    const result = transferSessionHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
  });

  it("rejects when session is not found", () => {
    const before = buildConfigT0();
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("transfer_session"),
      matchBindings: [matchBinding("session", "session-s"), matchBinding("to", "coder-c")],
      visibility: "external",
    });
    const result = transferSessionHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("session not found");
  });

  it("rejects when from is not current controller", () => {
    const before = snapshotWithSession("planner-p", ["planner-p", "coder-c"]);
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("transfer_session"),
      matchBindings: [
        matchBinding("session", "session-s"),
        matchBinding("from", "coder-c"),
        matchBinding("to", "planner-p"),
      ],
      visibility: "external",
    });
    const result = transferSessionHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("current controller");
  });

  it("transfers controller and adds to participant when absent", () => {
    const before = snapshotWithSession("planner-p", ["planner-p"]);
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("transfer_session"),
      matchBindings: [
        matchBinding("session", "session-s"),
        matchBinding("from", "planner-p"),
        matchBinding("to", "coder-c"),
      ],
      visibility: "external",
    });
    const result = transferSessionHandler(before, recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const session = result.after.sessions.get(sessionId("session-s"));
    expect(session?.controller).toBe("coder-c");
    expect(session?.participants).toContain("coder-c");
    expect(result.involved).toHaveLength(2);
  });
});
