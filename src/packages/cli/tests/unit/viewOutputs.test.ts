import { describe, it, expect } from "vitest";
import { renderWorldViewOutput } from "../../src/views/WorldView.js";
import { renderTraceViewOutput } from "../../src/views/TraceView.js";
import { renderContentViewOutput } from "../../src/views/ContentView.js";
import { renderObserveViewOutput } from "../../src/views/ObserveView.js";
import { renderSchemaViewOutput } from "../../src/views/SchemaView.js";
import { renderEvalViewOutput } from "../../src/views/EvalView.js";
import { renderReplayViewOutput } from "../../src/views/ReplayView.js";
import { renderGraphViewOutput } from "../../src/views/GraphView.js";
import { renderPetriViewOutput } from "../../src/views/PetriView.js";
import { emptyRuntime, sampleRuntime } from "../support/sampleRuntime.js";
import { fireTransition, invariantsFor, reachability } from "../../src/wiring/petriControl.js";

describe("view render outputs", () => {
  it("renders all world sub-views", () => {
    const data = sampleRuntime.snapshot!;
    expect(renderWorldViewOutput("world", {}, sampleRuntime)).toContain("Participants");
    expect(renderWorldViewOutput("world-actors", {}, sampleRuntime)).toContain(
      data.participants[0]!.id,
    );
    expect(renderWorldViewOutput("world-tasks", {}, sampleRuntime)).toContain("art:task-001");
    expect(renderWorldViewOutput("world-sessions", {}, sampleRuntime)).toContain("sess:main");
    expect(renderWorldViewOutput("world-caps", {}, sampleRuntime)).toContain("write_lock");
    expect(renderWorldViewOutput("world-links", {}, sampleRuntime)).toContain("depends_on");
    expect(renderWorldViewOutput("world-retired", {}, sampleRuntime)).toContain("actor:scout");
    expect(renderWorldViewOutput("world-diff", { refA: "a", refB: "b" }, sampleRuntime)).toContain(
      "a → b",
    );
    expect(renderWorldViewOutput("world", {}, emptyRuntime)).toContain("No runtime connected");
  });

  it("renders trace filters and validation", () => {
    expect(renderTraceViewOutput("trace", {}, sampleRuntime)).toContain("Commit");
    expect(renderTraceViewOutput("trace-obs", {}, sampleRuntime)).toContain("ObservationEntry");
    expect(renderTraceViewOutput("trace-rewrites", {}, sampleRuntime)).toContain("Commit");
    expect(renderTraceViewOutput("trace-search", { keyword: "commit" }, sampleRuntime)).toContain(
      "Commit",
    );
    expect(renderTraceViewOutput("trace-validate", {}, sampleRuntime)).toContain("Validation");
    expect(renderTraceViewOutput("trace", { since: "snap:t1" }, sampleRuntime)).toContain(
      "snap:t1",
    );
  });

  it("renders content sub-views", () => {
    expect(
      renderContentViewOutput(
        "content-cat",
        { ref: "sha256:x", body: "hello world" },
        sampleRuntime,
      ),
    ).toContain("sha256:x");
    expect(
      renderContentViewOutput(
        "content-cat",
        { ref: "sha256:x", body: "hello world" },
        sampleRuntime,
      ),
    ).toContain("hello world");
    expect(
      renderContentViewOutput(
        "content-ls",
        {
          entries: [
            {
              ref: "sha256:abc",
              metadata: {
                size: 3,
                mimeType: "text/plain",
                createdAt: "2026-08-14T00:00:00.000Z",
                createdBy: "x",
              },
            },
          ],
        },
        sampleRuntime,
      ),
    ).toContain("sha256:abc");
    expect(
      renderContentViewOutput(
        "content-search",
        {
          text: "abc",
          entries: [
            {
              ref: "sha256:abc",
              metadata: { size: 3, mimeType: "text/plain", createdAt: "2026-08-14T00:00:00.000Z" },
            },
          ],
        },
        sampleRuntime,
      ),
    ).toContain("abc");
    expect(
      renderContentViewOutput(
        "content-stats",
        { stats: { total: 2, totalBytes: 6, referenced: 1, orphans: 1 } },
        sampleRuntime,
      ),
    ).toContain("Total blobs");
    expect(
      renderContentViewOutput(
        "content-stats",
        { stats: { total: 2, totalBytes: 6, referenced: 1, orphans: 1 } },
        sampleRuntime,
      ),
    ).toContain("Orphans");
    expect(
      renderContentViewOutput(
        "content-gc",
        { orphans: ["sha256:abc"], confirm: false },
        sampleRuntime,
      ),
    ).toContain("dry-run");
  });

  it("renders observe lenses", () => {
    expect(renderObserveViewOutput("observe", sampleRuntime)).toContain("dependency");
    expect(renderObserveViewOutput("observe-dependency", sampleRuntime)).toContain("task");
    expect(renderObserveViewOutput("observe-resource", sampleRuntime)).toContain("write_lock");
    expect(renderObserveViewOutput("observe-communication", sampleRuntime)).toContain("sess:main");
    expect(renderObserveViewOutput("observe-structure", sampleRuntime)).toContain("task");
    expect(renderObserveViewOutput("observe-spine", sampleRuntime)).toContain("EventSpine");
    expect(renderObserveViewOutput("observe-diagnostic", sampleRuntime)).toContain("Diagnostics");
  });

  it("renders schema sub-views", () => {
    expect(renderSchemaViewOutput("schema", {}, sampleRuntime)).toContain("epoch:e1");
    expect(renderSchemaViewOutput("schema-ops", {}, sampleRuntime)).toContain("introduce_artifact");
    expect(renderSchemaViewOutput("schema-epoch", {}, sampleRuntime)).toContain("binding");
    expect(renderSchemaViewOutput("schema-epoch-history", {}, sampleRuntime)).toContain("epoch:e1");
    expect(renderSchemaViewOutput("schema-diff", {}, sampleRuntime)).toContain("Diff epochs");
    expect(renderSchemaViewOutput("schema-validate", {}, sampleRuntime)).toContain("Validation");
  });

  it("renders eval sub-views", () => {
    // Without prefetched eval data the view falls back to a data-load prompt
    // for runtimes with a snapshot, and the no-runtime message otherwise.
    expect(renderEvalViewOutput("eval-run", { suite: "x" }, sampleRuntime)).toContain(
      "No evaluation data loaded",
    );
    expect(renderEvalViewOutput("eval-list", {}, sampleRuntime)).toContain(
      "No evaluation data loaded",
    );
    expect(renderEvalViewOutput("eval-report", {}, sampleRuntime)).toContain(
      "No evaluation data loaded",
    );
    // With prefetched compare data the compare header renders.
    expect(
      renderEvalViewOutput(
        "eval-compare",
        { runA: "r1", runB: "r2", attemptsA: [], attemptsB: [] },
        sampleRuntime,
      ),
    ).toContain("Compare r1 vs r2");
  });

  it("renders replay sub-views", () => {
    expect(renderReplayViewOutput("replay", {}, sampleRuntime)).toContain("Replay from");
    expect(renderReplayViewOutput("replay-recipe", {}, sampleRuntime)).toContain(
      "introduce_artifact",
    );
    expect(renderReplayViewOutput("replay-bundle", {}, sampleRuntime)).toContain("snapshot");
  });

  it("renders extended graph and petri branches", () => {
    expect(renderGraphViewOutput("graph-forks", {}, sampleRuntime)).toContain("Fork Ref");
    expect(renderGraphViewOutput("graph", { actor: "coder" }, sampleRuntime)).toContain("coder");
    expect(renderGraphViewOutput("graph", { depth: 2 }, sampleRuntime)).toContain("observe");
    const reachData = reachability(sampleRuntime, "art:task-001");
    expect(
      renderPetriViewOutput(
        "petri-reach",
        { petriData: reachData, goal: "art:task-001" },
        sampleRuntime,
      ),
    ).toContain("Goal: art:task-001");
    const invData = invariantsFor(sampleRuntime);
    expect(
      renderPetriViewOutput("petri-invariants", { petriData: invData }, sampleRuntime),
    ).toContain("S-invariant");
    const fireData = fireTransition(sampleRuntime, "observe", { a: "1" });
    expect(
      renderPetriViewOutput(
        "petri-fire",
        { petriData: fireData, op: "observe", bindings: '{"a":"1"}' },
        sampleRuntime,
      ),
    ).toContain('{"a":"1"}');
  });
});
