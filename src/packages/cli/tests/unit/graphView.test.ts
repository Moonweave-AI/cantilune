import { describe, it, expect } from "vitest";
import { renderGraphViewOutput } from "../../src/views/GraphView.js";
import { emptyRuntime, sampleRuntime } from "../support/sampleRuntime.js";

describe("GraphView", () => {
  it("renders output containing expected nodes and edges", () => {
    const output = renderGraphViewOutput("graph", {}, sampleRuntime);

    expect(output).toContain("observe(actor:user)");
    expect(output).toContain("publish_artifact(actor:coder)");
    expect(output).toContain("commit_change(actor:planner)");
    expect(output).toContain("Edges:");
    expect(output).toContain("chain");
  });

  it("shows empty state without runtime data", () => {
    const output = renderGraphViewOutput("graph", {}, emptyRuntime);
    expect(output).toContain("No runtime connected");
  });

  it("renders path view with ref args", () => {
    const output = renderGraphViewOutput(
      "graph-path",
      {
        refA: "chg:obs-001",
        refB: "chg:commit-004",
      },
      sampleRuntime,
    );
    expect(output).toContain("Path chg:obs-001");
    expect(output).toContain("chg:commit-004");
  });

  it("renders stats view", () => {
    const output = renderGraphViewOutput("graph-stats", {}, sampleRuntime);
    expect(output).toContain("Nodes");
    expect(output).toContain("Edges");
    expect(output).toContain("Fork Points");
  });

  it("filters graph by operation name", () => {
    const output = renderGraphViewOutput("graph", { op: "commit" }, sampleRuntime);
    expect(output).toContain("commit");
  });

  it("limits graph depth when depth arg is set", () => {
    const output = renderGraphViewOutput("graph", { depth: 1 }, sampleRuntime);
    expect(output).not.toContain("publish_artifact(actor:coder)");
  });
});
