import { describe, it, expect } from "vitest";
import { renderGraph } from "../../src/render/asciiGraph.js";

describe("renderGraph", () => {
  it("renders a simple DAG with nodes and edges", () => {
    const output = renderGraph(
      [
        { id: "a", label: "Start" },
        { id: "b", label: "Process" },
        { id: "c", label: "End" },
      ],
      [
        { from: "a", to: "b", label: "init" },
        { from: "b", to: "c" },
      ],
    );

    expect(output).toContain("Start");
    expect(output).toContain("Process");
    expect(output).toContain("End");
    expect(output).toContain("Edges:");
    expect(output).toContain("Start ──► Process [init]");
    expect(output).toContain("Process ──► End");
  });

  it("renders node color attribute when provided", () => {
    const output = renderGraph([{ id: "a", label: "Colored", color: "red" }], []);
    expect(output).toContain("Colored");
  });

  it("renders cyclic graphs and unknown node ids", () => {
    const cycle = renderGraph(
      [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    );
    expect(cycle).toContain("A");
    expect(cycle).toContain("B");

    const dangling = renderGraph(
      [{ id: "only", label: "Only" }],
      [{ from: "only", to: "missing", label: "edge" }],
    );
    expect(dangling).toContain("missing");
    expect(dangling).toContain("[edge]");
  });
});
