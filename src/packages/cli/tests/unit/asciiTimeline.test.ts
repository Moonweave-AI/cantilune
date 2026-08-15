import { describe, it, expect } from "vitest";
import { renderTimeline, type TimelineEntry } from "../../src/render/asciiTimeline.js";

describe("renderTimeline", () => {
  it("returns placeholder for empty input", () => {
    expect(renderTimeline([])).toBe("(empty timeline)");
  });

  it("renders sorted entries with detail lines", () => {
    const entries: TimelineEntry[] = [
      { timestamp: 1_700_000_000_000, label: "Second", kind: "commit", detail: "snap=t2" },
      { timestamp: 1_699_999_000_000, label: "First", kind: "obs" },
    ];
    const output = renderTimeline(entries);
    expect(output).toContain("[obs   ] First");
    expect(output).toContain("[commit] Second");
    expect(output).toContain("snap=t2");
  });
});
