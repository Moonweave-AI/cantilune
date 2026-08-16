import { describe, it, expect } from "vitest";
import { renderGraphViewOutput } from "../../src/views/GraphView.js";
import { renderPetriViewOutput } from "../../src/views/PetriView.js";
import { renderGraph } from "../../src/render/asciiGraph.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import { fireTransition, projectPetriNet } from "../../src/wiring/petriControl.js";

describe("view branch coverage", () => {
  it("covers graph op-only filter and empty edge cases", () => {
    expect(renderGraphViewOutput("graph", { op: "commit" }, sampleRuntime)).toContain("commit");
    expect(renderGraphViewOutput("graph-path", { refA: "x", refB: "y" }, sampleRuntime)).toContain(
      "No path",
    );
    expect(renderGraph([], [{ from: "missing", to: "nope" }])).toContain("(empty graph)");
  });

  it("covers petri default and diff-friendly diff view lines", () => {
    const petriData = projectPetriNet(sampleRuntime);
    expect(petriData).not.toBeNull();
    expect(renderPetriViewOutput("petri", { petriData }, sampleRuntime)).toContain("write_lock");
    const fireData = fireTransition(sampleRuntime, "introduce_artifact");
    expect(fireData).not.toBeNull();
    expect(renderPetriViewOutput("petri-fire", { petriData: fireData }, sampleRuntime)).toContain(
      "Fire:",
    );
    expect(renderPetriViewOutput("petri-fire", { petriData: fireData }, sampleRuntime)).toContain(
      "Before:",
    );
  });

  it("covers ascii graph nodes without color and edges without labels", () => {
    expect(renderGraph([{ id: "n", label: "N" }], [{ from: "n", to: "n" }])).toContain("N ──► N");
  });
});
