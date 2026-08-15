import { describe, it, expect } from "vitest";
import { exportDot } from "../../src/render/dotExporter.js";
import { exportJson } from "../../src/render/jsonExporter.js";
import { exportMermaid } from "../../src/render/mermaidExporter.js";
import { exportPlantUml } from "../../src/render/plantumlExporter.js";
import { exportPnml, type PetriNet } from "../../src/render/pnmlExporter.js";

const sampleNodes = [
  { id: "a", label: 'Node "A"', color: "#ff0000" },
  { id: "b", label: "Node B" },
];
const sampleEdges = [
  { from: "a", to: "b", label: 'link "x"' },
  { from: "b", to: "a" },
];

describe("render exporters", () => {
  it("exports DOT with escaped labels and optional edge labels", () => {
    const dot = exportDot(sampleNodes, sampleEdges);
    expect(dot).toContain("digraph Cantilune");
    expect(dot).toContain('label="Node \\"A\\""');
    expect(dot).toContain('color="#ff0000"');
    expect(dot).toContain('[label="link \\"x\\""]');
    expect(dot).toContain('"b" -> "a";');
  });

  it("exports Mermaid flowchart", () => {
    const mermaid = exportMermaid(sampleNodes, sampleEdges);
    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain('a["Node #quot;A#quot;"]');
    expect(mermaid).toContain("a -->|link #quot;x#quot;| b");
  });

  it("exports PlantUML with color class", () => {
    const puml = exportPlantUml(sampleNodes, sampleEdges);
    expect(puml).toContain("@startuml");
    expect(puml).toContain("class a #ff0000");
    expect(puml).toContain("a --> b : link 'x'");
    expect(puml).toContain("@enduml");
  });

  it("exports PNML with xml escaping and tokens", () => {
    const net: PetriNet = {
      places: [{ id: "p1", name: "Place & <1>", tokens: 2 }],
      transitions: [{ id: "t1", name: 'Trans "fire"' }],
      arcs: [{ id: "a1", source: "p1", target: "t1" }],
    };
    const pnml = exportPnml(net);
    expect(pnml).toContain("&amp;");
    expect(pnml).toContain("&lt;");
    expect(pnml).toContain("<initialMarking>");
    expect(pnml).toContain('source="p1"');
  });

  it("exports JSON with custom indent", () => {
    expect(exportJson({ ok: true })).toBe('{\n  "ok": true\n}');
    expect(exportJson({ ok: true }, 0)).toBe('{"ok":true}');
  });
});
