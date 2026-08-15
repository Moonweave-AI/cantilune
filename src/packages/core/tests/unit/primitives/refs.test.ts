import { describe, expect, it } from "vitest";
import {
  evidenceId,
  linkId,
  sessionId,
  capabilityId,
  artifactId,
  actorId,
} from "../../../src/primitives/ids.js";
import {
  contentRef,
  evidenceRef,
  matchBinding,
  matchBindingsFromTargets,
  targetRef,
  targetsFromMatchBindings,
} from "../../../src/primitives/refs.js";

describe("refs", () => {
  it("builds evidence refs with branded evidence ids", () => {
    const ref = evidenceRef(evidenceId("ev-1"), "approval", contentRef("content://approval"));
    expect(ref.evidenceId).toBe("ev-1");
    expect(ref.kind).toBe("approval");
  });

  it("derives targets from named match bindings", () => {
    const bindings = [
      matchBinding("from", "planner-p"),
      matchBinding("to", "coder-c"),
      matchBinding("task", "task-T"),
      matchBinding("session", "session-s"),
      matchBinding("capability", "cap-1"),
      matchBinding("link", "link-1"),
    ];
    const targets = targetsFromMatchBindings(bindings);
    expect(targets).toEqual([
      targetRef("participant", "planner-p"),
      targetRef("participant", "coder-c"),
      targetRef("artifact", "task-T"),
      targetRef("session", "session-s"),
      targetRef("capability", "cap-1"),
      targetRef("link", "link-1"),
    ]);
  });

  it("reconstructs match bindings from legacy targets", () => {
    const bindings = matchBindingsFromTargets([
      targetRef("artifact", artifactId("task-T")),
      targetRef("participant", actorId("planner-p")),
      targetRef("capability", capabilityId("cap-1")),
      targetRef("session", sessionId("session-s")),
      targetRef("link", linkId("link-1")),
    ]);
    expect(bindings.map((b) => b.role)).toEqual([
      "artifact",
      "participant",
      "capability",
      "session",
      "link",
    ]);
  });
});
