import { describe, expect, it } from "vitest";
import { actorId, artifactId, linkId } from "../../../src/primitives/ids.js";
import { collaborationLink } from "../../../src/nodes/collaborationLink.js";

describe("collaborationLink", () => {
  it("models directed collaboration edges", () => {
    const link = collaborationLink(
      linkId("link-waits-1"),
      "waits_for",
      { kind: "participant", actorId: actorId("reviewer-r") },
      { kind: "participant", actorId: actorId("coder-c") },
    );
    expect(link.kind).toBe("waits_for");
    expect(link.from).toEqual({ kind: "participant", actorId: "reviewer-r" });
    expect(link.to).toEqual({ kind: "participant", actorId: "coder-c" });
  });

  it("supports artifact endpoints", () => {
    const link = collaborationLink(
      linkId("link-supplies-1"),
      "supplies",
      { kind: "participant", actorId: actorId("planner-p") },
      { kind: "artifact", artifactId: artifactId("task-T") },
    );
    expect(link.to.kind).toBe("artifact");
  });
});
