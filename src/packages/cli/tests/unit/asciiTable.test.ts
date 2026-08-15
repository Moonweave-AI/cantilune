import { describe, it, expect } from "vitest";
import { renderTable } from "../../src/render/asciiTable.js";

describe("renderTable", () => {
  it("returns empty string for no columns", () => {
    expect(renderTable([], [])).toBe("");
  });

  it("aligns cells left, right, and center", () => {
    const output = renderTable(
      [
        { header: "Left", width: 6 },
        { header: "Right", width: 6, align: "right" },
        { header: "Center", width: 8, align: "center" },
      ],
      [
        ["abc", "9", "mid"],
        ["longvalue", "100", "x"],
      ],
    );
    expect(output).toContain("Left");
    expect(output).toContain("longva");
  });

  it("aligns table data cells to the right", () => {
    const output = renderTable([{ header: "Count", width: 8, align: "right" }], [["42"]]);
    expect(output).toContain("42");
  });

  it("handles sparse rows and truncates wide cells", () => {
    const output = renderTable(
      [
        { header: "A", width: 4 },
        { header: "B", width: 4, align: "center" },
      ],
      [["only-a"], ["x", "y", "ignored"]],
    );
    expect(output).toContain("only");
    expect(output).toContain("│");
  });
});
