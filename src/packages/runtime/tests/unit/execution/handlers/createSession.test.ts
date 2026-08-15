import { describe, expect, it } from "vitest";
import {
  communicationSession,
  epochId,
  linkId,
  matchBinding,
  operationTypeId,
  sessionId,
  withSession,
} from "@cantilune/core";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { createSessionHandler } from "../../../../src/execution/handlers/createSession.js";
import { replayRecipe } from "../../../../src/replay/recipe.js";
import { defaultCreateSessionTemplate } from "../../../../src/schema/defaultSchema.js";

describe("createSessionHandler", () => {
  const template = defaultCreateSessionTemplate();
  const ctx = { template };

  it("rejects missing from binding", () => {
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("create_session"),
      matchBindings: [],
      createdSessionRefs: [sessionId("session-s")],
      visibility: "external",
    });
    const result = createSessionHandler(buildConfigT0(), recipe, ctx);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate session", () => {
    const before = withSession(
      buildConfigT0(),
      communicationSession(
        sessionId("session-s"),
        "planner-p" as never,
        ["planner-p" as never],
        "private",
      ),
    );
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("create_session"),
      matchBindings: [matchBinding("from", "planner-p"), matchBinding("participant", "coder-c")],
      createdSessionRefs: [sessionId("session-s")],
      freshLinkRefs: [linkId("link-1")],
      visibility: "external",
    });
    const result = createSessionHandler(before, recipe, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toContain("already exists");
  });

  it("creates session with nested_in links", () => {
    const recipe = replayRecipe({
      epochId: epochId("42"),
      operationTypeId: operationTypeId("create_session"),
      matchBindings: [matchBinding("from", "planner-p"), matchBinding("participant", "coder-c")],
      createdSessionRefs: [sessionId("session-s")],
      freshLinkRefs: [linkId("link-1")],
      visibility: "external",
    });
    const result = createSessionHandler(buildConfigT0(), recipe, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.after.sessions.has(sessionId("session-s"))).toBe(true);
    expect(result.after.links.size).toBe(1);
  });
});
