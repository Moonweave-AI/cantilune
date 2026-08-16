import { describe, expect, it } from "vitest";
import { alignLineDiff } from "../../src/render/lineDiff.js";

describe("alignLineDiff", () => {
  it("keeps equal lines paired when they move", () => {
    const rows = alignLineDiff("foo\nbar", "bar\nfoo");
    expect(rows.map((row) => row.kind)).toEqual(["delete", "equal", "insert"]);
    expect(rows[1]).toMatchObject({ left: "bar", right: "bar", kind: "equal" });
  });

  it("marks a pure insertion at the end", () => {
    const rows = alignLineDiff("a\nb", "a\nb\nc");
    expect(rows.at(-1)).toMatchObject({ left: "", right: "c", kind: "insert" });
  });

  it("marks identical texts as all equal", () => {
    const rows = alignLineDiff("same\nshared", "same\nshared");
    expect(rows.every((row) => row.kind === "equal")).toBe(true);
  });
});
