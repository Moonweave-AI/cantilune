import { describe, expect, it } from "vitest";
import { actorId, artifactId, capabilityId, sessionId } from "../../../src/primitives/ids.js";
import { scopedCapability, withCapabilityHolder } from "../../../src/nodes/scopedCapability.js";

describe("scopedCapability", () => {
  it("tracks a unique holder for artifact-scoped capabilities", () => {
    const cap = scopedCapability(capabilityId("write-lock-w"), "write_lock", actorId("planner-p"), {
      kind: "artifact",
      artifactId: artifactId("task-T"),
    });
    expect(cap.kind).toBe("write_lock");
    expect(cap.holder).toBe("planner-p");
    expect(cap.scope).toEqual({ kind: "artifact", artifactId: "task-T" });
  });

  it("supports session-scoped capabilities", () => {
    const cap = scopedCapability(capabilityId("tool-lease-1"), "tool_lease", actorId("coder-c"), {
      kind: "session",
      sessionId: sessionId("session-s"),
    });
    expect(cap.scope.kind).toBe("session");
  });

  it("transfers holder immutably", () => {
    const cap = scopedCapability(capabilityId("write-lock-w"), "write_lock", actorId("planner-p"), {
      kind: "artifact",
      artifactId: artifactId("task-T"),
    });
    const transferred = withCapabilityHolder(cap, actorId("coder-c"));
    expect(cap.holder).toBe("planner-p");
    expect(transferred.holder).toBe("coder-c");
  });
});
