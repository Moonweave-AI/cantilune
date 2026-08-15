import { describe, it, expect } from "vitest";
import { renderContentViewOutput } from "../../src/views/ContentView.js";
import { renderEvalViewOutput } from "../../src/views/EvalView.js";
import { renderTraceViewOutput } from "../../src/views/TraceView.js";
import { renderGraphViewOutput } from "../../src/views/GraphView.js";
import { renderPetriViewOutput } from "../../src/views/PetriView.js";
import { renderSchemaViewOutput } from "../../src/views/SchemaView.js";
import { renderWorldViewOutput } from "../../src/views/WorldView.js";
import { emptyRuntime, sampleRuntime } from "../support/sampleRuntime.js";
import { projectPetriNet } from "../../src/wiring/petriControl.js";

describe("view output extended branches", () => {
  it("covers content empty and no-runtime branches", () => {
    expect(renderContentViewOutput("content-cat", {}, emptyRuntime)).toContain(
      "No runtime connected",
    );
    expect(renderContentViewOutput("content-ls", {}, emptyRuntime)).toContain(
      "No runtime connected",
    );

    const noAudit = {
      ...sampleRuntime,
      snapshot: { ...sampleRuntime.snapshot!, auditTail: [] },
    };
    // No prefetched entries and an empty audit tail → no content to list.
    expect(renderContentViewOutput("content-ls", {}, noAudit)).toContain("No content");
    expect(renderContentViewOutput("content-stats", {}, noAudit)).toContain("Total blobs");
  });

  it("covers eval empty suite branch", () => {
    const snapshotOnly = {
      snapshot: sampleRuntime.snapshot,
      changeLog: [],
      epoch: sampleRuntime.epoch,
    };
    // No prefetched data + a runtime snapshot → data-load prompt.
    expect(renderEvalViewOutput("eval-list", {}, snapshotOnly)).toContain(
      "No evaluation data loaded",
    );
  });

  it("covers trace empty filter branch", () => {
    expect(
      renderTraceViewOutput("trace-search", { keyword: "zzzz-not-found" }, sampleRuntime),
    ).toContain("No trace entries match");
    expect(renderTraceViewOutput("trace-validate", {}, sampleRuntime)).toContain("Validation");
  });

  it("covers graph empty nodes branch", () => {
    const noChanges = {
      snapshot: sampleRuntime.snapshot,
      changeLog: [],
      epoch: sampleRuntime.epoch,
    };
    expect(renderGraphViewOutput("graph", {}, noChanges)).toContain("No coordination changes");
  });

  it("covers petri empty markings branch", () => {
    const noCaps = {
      snapshot: {
        ...sampleRuntime.snapshot!,
        capabilities: [],
        artifacts: [],
      },
      changeLog: sampleRuntime.changeLog,
      epoch: sampleRuntime.epoch,
    };
    // With prefetched data (no places) the view reports no markings.
    const petriData = projectPetriNet(noCaps);
    expect(petriData).not.toBeNull();
    expect(renderPetriViewOutput("petri", { petriData }, noCaps)).toContain("No Petri markings");
  });

  it("covers eval null data and empty report defaults", () => {
    expect(renderEvalViewOutput("eval-list", {}, emptyRuntime)).toContain("No runtime connected");
    expect(renderEvalViewOutput("eval-compare", {}, emptyRuntime)).toContain(
      "No runtime connected",
    );
  });

  it("covers schema no epoch branch", () => {
    expect(renderSchemaViewOutput("schema", {}, emptyRuntime)).toContain("No runtime connected");
  });

  it("covers world diff ref fallbacks and empty tables", () => {
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
      epoch: { epochId: "epoch:e1", ordinal: 1, schemaId: "orch-schema-v1" },
    };
    expect(renderWorldViewOutput("world-diff", {}, sparse)).toContain("snap:sparse");
    expect(renderWorldViewOutput("world-actors", {}, sparse)).toContain("ID");
  });

  it("covers trace no-runtime branch in output renderer", () => {
    expect(renderTraceViewOutput("trace", {}, emptyRuntime)).toContain("No runtime connected");
  });
});
