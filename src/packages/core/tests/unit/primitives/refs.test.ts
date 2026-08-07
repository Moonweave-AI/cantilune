import { describe, expect, it } from "vitest";
import {
  contentRef,
  evidenceRef,
  snapshotRef,
  targetRef,
} from "../../../src/primitives/refs.js";

describe("refs", () => {
  it("builds snapshot and content refs", () => {
    expect(snapshotRef("snap-S0")).toBe("snap-S0");
    expect(contentRef("content://task-T")).toBe("content://task-T");
  });

  it("builds target refs for all entity kinds", () => {
    expect(targetRef("artifact", "task-T")).toEqual({ kind: "artifact", id: "task-T" });
    expect(targetRef("participant", "coder-c")).toEqual({
      kind: "participant",
      id: "coder-c",
    });
    expect(targetRef("session", "session-s")).toEqual({ kind: "session", id: "session-s" });
    expect(targetRef("capability", "write-lock-w")).toEqual({
      kind: "capability",
      id: "write-lock-w",
    });
    expect(targetRef("link", "link-1")).toEqual({ kind: "link", id: "link-1" });
  });

  it("builds evidence refs with content pointer", () => {
    const ref = evidenceRef("ev-1", "approval", contentRef("content://approval"));
    expect(ref.kind).toBe("approval");
    expect(ref.contentRef).toBe("content://approval");
  });
});
