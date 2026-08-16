import { describe, expect, it } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  epochId,
  operationTemplateRef,
  operationTypeId,
  participant,
  snapshotRef,
} from "@cantilune/core";
import { commitTranscriptHandler } from "../../../src/execution/handlers/commitTranscript.js";
import type { ReplayRecipe } from "../../../src/replay/recipe.js";
import type { ApplyContext } from "../../../src/execution/applyContext.js";

const ctx: ApplyContext = {
  template: {
    operationTypeId: operationTypeId("commit_transcript"),
    templateRef: operationTemplateRef("commit_transcript", "1"),
    description: "",
    requiredRoles: ["from"],
    requires: [],
    ensures: [],
    defaultVisibility: "internal",
    mayCreateSessions: false,
  },
};

function recipe(overrides: Partial<ReplayRecipe> = {}): ReplayRecipe {
  return {
    epochId: epochId("1"),
    operationTypeId: operationTypeId("commit_transcript"),
    matchBindings: [{ role: "from", actorId: actorId("writer") }],
    matchWitness: { domainSize: 1, codomainSize: 1, embedding: [0] },
    complementTag: 0,
    kind: "internal",
    authorization: [],
    external: [],
    createdSessionRefs: [],
    freshLinkRefs: [],
    inputContentRefs: [],
    scalarInputs: {
      messagesJson: JSON.stringify([{ role: "user", content: "hi" }]),
      revision: 1,
    },
    visibility: "internal",
    ...overrides,
  };
}

describe("commitTranscriptHandler", () => {
  const writer = participant(actorId("writer"), "agent");
  const before = collaborationSnapshot({
    snapshotRef: snapshotRef("s0"),
    epochId: epochId("1"),
    participants: new Map([[writer.actorId, writer]]),
  });

  it("writes the transcript onto the snapshot", () => {
    const result = commitTranscriptHandler(before, recipe(), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.after.transcripts.get(writer.actorId)?.messages[0]?.content).toBe("hi");
    }
  });

  it("rejects invalid JSON", () => {
    const result = commitTranscriptHandler(
      before,
      recipe({ scalarInputs: { messagesJson: "{", revision: 1 } }),
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a missing from binding", () => {
    const result = commitTranscriptHandler(before, recipe({ matchBindings: [] }), ctx);
    expect(result.ok).toBe(false);
  });
});
