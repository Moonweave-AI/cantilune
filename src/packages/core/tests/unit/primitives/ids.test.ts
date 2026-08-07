import { describe, expect, it } from "vitest";
import { actorId, artifactId, changeId } from "../../../src/primitives/ids.js";

describe("branded ids", () => {
  it("constructs distinct branded values from strings", () => {
    expect(actorId("human-1")).toBe("human-1");
    expect(artifactId("task-T")).toBe("task-T");
    expect(changeId("chg-001")).toBe("chg-001");
  });

  it("preserves string identity for equality checks", () => {
    const a = actorId("planner-p");
    const b = actorId("planner-p");
    expect(a).toBe(b);
  });
});
