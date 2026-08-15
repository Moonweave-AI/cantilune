import { describe, expect, it } from "vitest";
import { targetRef } from "@cantilune/core";
import {
  bindingsForCreateSession,
  bindingsForForkBranch,
  bindingsForPublishArtifact,
  bindingsForTransferSession,
} from "../../../src/admission/compositionBindings.js";

describe("compositionBindings", () => {
  it("derives create_session bindings from session and participants", () => {
    const bindings = bindingsForCreateSession(
      [
        targetRef("session", "session-s"),
        targetRef("participant", "planner-p"),
        targetRef("participant", "coder-c"),
      ],
      "planner-p" as never,
    );
    expect(bindings.some((b) => b.role === "session")).toBe(true);
    expect(bindings.some((b) => b.role === "from")).toBe(true);
    expect(bindings.filter((b) => b.role === "participant")).toHaveLength(1);
  });

  it("derives fork_branch bindings with artifact and capability targets", () => {
    const bindings = bindingsForForkBranch(
      [
        targetRef("artifact", "task-T"),
        targetRef("capability", "cap-1"),
        targetRef("participant", "coder-c"),
      ],
      "planner-p" as never,
    );
    expect(bindings.some((b) => b.role === "task")).toBe(true);
    expect(bindings.some((b) => b.role === "capability")).toBe(true);
    expect(bindings.some((b) => b.role === "participant")).toBe(true);
  });

  it("derives publish bindings from artifact and owner participant", () => {
    const bindings = bindingsForPublishArtifact(
      [targetRef("artifact", "task-T"), targetRef("participant", "planner-p")],
      "planner-p" as never,
    );
    expect(bindings.some((b) => b.role === "task")).toBe(true);
    expect(bindings.some((b) => b.role === "from")).toBe(true);
  });

  it("derives transfer_session bindings with from/to participants", () => {
    const bindings = bindingsForTransferSession(
      [
        targetRef("session", "session-s"),
        targetRef("participant", "planner-p"),
        targetRef("participant", "coder-c"),
      ],
      "planner-p" as never,
    );
    expect(bindings.some((b) => b.role === "session")).toBe(true);
    expect(bindings.some((b) => b.role === "from")).toBe(true);
    expect(bindings.some((b) => b.role === "to")).toBe(true);
  });

  it("falls back to first participant when initiator not in targets", () => {
    const bindings = bindingsForPublishArtifact(
      [targetRef("artifact", "task-T"), targetRef("participant", "coder-c")],
      "planner-p" as never,
    );
    expect(bindings.find((b) => b.role === "from")?.actorId).toBe("coder-c");
  });
});
