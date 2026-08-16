import { describe, it, expect } from "vitest";
import { renderContentViewOutput } from "../../src/views/ContentView.js";
import { renderExportViewOutput } from "../../src/views/ExportView.js";
import { renderHelpViewOutput } from "../../src/views/HelpView.js";
import { renderEvalViewOutput } from "../../src/views/EvalView.js";
import type { ViewType } from "../../src/store.js";
import { emptyRuntime, sampleRuntime } from "../support/sampleRuntime.js";

describe("export and help views", () => {
  it("lists export formats and renders graph dot output", () => {
    const output = renderExportViewOutput({ target: "graph", format: "dot" }, sampleRuntime);
    expect(output).toContain("dot, mermaid, json, plantuml");
    expect(output).toContain("digraph Cantilune");
    expect(output).toContain("chg:obs-001");
  });

  it("renders graph mermaid and plantuml formats", () => {
    const mermaid = renderExportViewOutput({ target: "graph", format: "mermaid" }, sampleRuntime);
    expect(mermaid).toContain("flowchart TD");

    const plantuml = renderExportViewOutput({ target: "graph", format: "plantuml" }, sampleRuntime);
    expect(plantuml).toContain("@startuml");
  });

  it("renders empty graph export when no changes exist", () => {
    const noChanges = {
      snapshot: sampleRuntime.snapshot,
      changeLog: [],
      epoch: sampleRuntime.epoch,
    };
    const output = renderExportViewOutput({ target: "graph", format: "json" }, noChanges);
    expect(output).toContain("No coordination changes recorded yet");
  });

  it("renders petri pnml dot and trace json exports", () => {
    const pnml = renderExportViewOutput({ target: "petri", format: "pnml" }, sampleRuntime);
    expect(pnml).toContain("<pnml");

    const petriDot = renderExportViewOutput({ target: "petri", format: "dot" }, sampleRuntime);
    expect(petriDot).toContain("digraph Cantilune");

    const trace = renderExportViewOutput({ target: "trace", format: "json" }, sampleRuntime);
    expect(trace).toContain('"trace"');
    expect(trace).toContain("chg:commit-004");
  });

  it("renders snapshot bundle four-view and default target exports", () => {
    const snapshot = renderExportViewOutput(
      { target: "snapshot", ref: "snap:other", format: "json" },
      sampleRuntime,
    );
    expect(snapshot).toContain("Only current head snapshot is available");

    const bundle = renderExportViewOutput({ target: "bundle", format: "json" }, sampleRuntime);
    expect(bundle).toContain('"changeCount": 4');

    const fourView = renderExportViewOutput({ target: "four-view", format: "json" }, sampleRuntime);
    expect(fourView).toContain("observability controller required");

    const custom = renderExportViewOutput(
      { target: "custom-bundle", format: "json" },
      sampleRuntime,
    );
    expect(custom).toContain("unknown export target");
  });

  it("shows no-runtime message for empty runtime export targets", () => {
    expect(renderExportViewOutput({ target: "graph", format: "json" }, emptyRuntime)).toContain(
      "Export failed: no runtime graph",
    );
    expect(renderExportViewOutput({ target: "petri", format: "pnml" }, emptyRuntime)).toContain(
      "Export failed:",
    );
  });

  it("lists slash commands in help overview", () => {
    const output = renderHelpViewOutput({});
    expect(output).toContain("Cantilune CLI slash commands");
    expect(output).toContain("/export graph");
    expect(output).toContain("/help");
  });

  it("shows specific command help when filtered by name or alias", () => {
    const byName = renderHelpViewOutput({ command: "/help" });
    expect(byName).toContain("Show help overview");
    expect(byName).toContain("category: help");

    const byAlias = renderHelpViewOutput({ command: "q" });
    expect(byAlias).toContain("/quit");

    const withArgs = renderHelpViewOutput({ command: "/export graph" });
    expect(withArgs).toContain("*format");
  });

  it("deduplicates audit payload refs in content listing", () => {
    const withDupes = {
      ...sampleRuntime,
      snapshot: {
        ...sampleRuntime.snapshot!,
        auditTail: [sampleRuntime.snapshot!.auditTail[0]!, sampleRuntime.snapshot!.auditTail[0]!],
      },
    };
    expect(renderContentViewOutput("content-ls", {}, withDupes)).toContain("sha256:abc");
    expect(renderContentViewOutput("content-ls", {}, withDupes).match(/sha256:abc/g)?.length).toBe(
      1,
    );
  });

  it("renders snapshot export for current head ref", () => {
    const output = renderExportViewOutput(
      { target: "snapshot", ref: "snap:t1", format: "json" },
      sampleRuntime,
    );
    expect(output).toContain('"snap:t1"');
  });

  it("renders help title for specific command view", () => {
    const output = renderHelpViewOutput({ command: "export graph" });
    expect(output).toContain("Export coordination DAG");
  });

  it("covers content default branch and eval run output", () => {
    expect(renderContentViewOutput("content-unknown" as ViewType, {}, sampleRuntime)).toContain(
      "sha256:abc",
    );
    // Without prefetched eval data the view falls back to the data-load prompt.
    expect(renderEvalViewOutput("eval-run", { suite: "suite-a" }, sampleRuntime)).toContain(
      "No evaluation data loaded",
    );
  });

  it("exports sparse petri net without transitions", () => {
    const sparse = {
      snapshot: {
        snapshotRef: "snap:sparse",
        epochId: "epoch:e1",
        participants: [],
        artifacts: [],
        sessions: [],
        capabilities: [],
        links: [],
        auditTail: [],
        retired: [],
      },
      changeLog: [],
      epoch: sampleRuntime.epoch,
    };
    const output = renderExportViewOutput({ target: "petri", format: "json" }, sparse);
    expect(output).toContain('"places": []');
  });
});
