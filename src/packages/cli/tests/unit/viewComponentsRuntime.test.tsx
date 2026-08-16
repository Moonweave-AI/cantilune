// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { createStore } from "../../src/store.js";
import { StoreProvider } from "../../src/storeContext.js";
import { ContentView } from "../../src/views/ContentView.js";
import { EvalView } from "../../src/views/EvalView.js";
import { TraceView } from "../../src/views/TraceView.js";
import { ObserveView } from "../../src/views/ObserveView.js";
import { SchemaView } from "../../src/views/SchemaView.js";
import { ReplayView } from "../../src/views/ReplayView.js";
import { PetriView } from "../../src/views/PetriView.js";
import { WorldView } from "../../src/views/WorldView.js";
import { GraphView } from "../../src/views/GraphView.js";
import ExportViewContainer from "../../src/views/ExportView.js";
import HelpViewContainer from "../../src/views/HelpView.js";
import ContentViewContainer from "../../src/views/ContentView.js";
import EvalViewContainer from "../../src/views/EvalView.js";
import TraceViewContainer from "../../src/views/TraceView.js";
import ObserveViewContainer from "../../src/views/ObserveView.js";
import SchemaViewContainer from "../../src/views/SchemaView.js";
import ReplayViewContainer from "../../src/views/ReplayView.js";
import PetriViewContainer from "../../src/views/PetriView.js";
import WorldViewContainer from "../../src/views/WorldView.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import {
  sampleObserveProjection,
  sampleReplayProjection,
} from "../support/sampleObserveReplay.js";
import { fireTransition, invariantsFor, reachability } from "../../src/wiring/petriControl.js";

function renderWithRuntime(
  Component: React.ComponentType<{ store: ReturnType<typeof createStore> }>,
  activeView: ReturnType<typeof createStore>["activeView"],
  viewArgs: Record<string, unknown> = {},
  runtime = sampleRuntime,
): ReturnType<typeof render> {
  const store = createStore({ runtime, activeView, viewArgs, mode: "view" });
  return render(
    <StoreProvider store={store}>
      <Component store={store} />
    </StoreProvider>,
  );
}

describe("view components with runtime data", () => {
  it("renders content view branches with populated runtime", () => {
    const search = renderWithRuntime(ContentView, "content-search", { text: "abc" });
    expect(search.container.textContent).toContain("abc");

    const gc = renderWithRuntime(ContentView, "content-gc");
    expect(gc.container.textContent).toContain("Content GC");

    const cat = renderWithRuntime(ContentView, "content-cat", { ref: "sha256:xyz" });
    expect(cat.container.textContent).toContain("Content Viewer");

    const stats = renderWithRuntime(ContentView, "content-stats");
    expect(stats.container.textContent).toContain("Content Statistics");

    const empty = renderWithRuntime(
      ContentView,
      "content-ls",
      {},
      {
        snapshot: { ...sampleRuntime.snapshot!, auditTail: [] },
        changeLog: sampleRuntime.changeLog,
        epoch: sampleRuntime.epoch,
      },
    );
    expect(empty.container.textContent).toContain("Content Store");
  });

  it("renders content-gc report with orphans and with confirm delete", () => {
    const dryRun = renderWithRuntime(ContentView, "content-gc", {
      orphans: ["sha256:orphan"],
      confirm: false,
      deletedCount: 0,
    });
    expect(dryRun.container.textContent).toContain("1 orphaned blob(s) found.");
    expect(dryRun.container.textContent).toContain("Dry-run only");

    const confirmed = renderWithRuntime(ContentView, "content-gc", {
      orphans: ["sha256:orphan"],
      confirm: true,
      deletedCount: 1,
    });
    expect(confirmed.container.textContent).toContain("Deleted 1 orphaned blob(s).");
  });

  it("renders content default view branch with and without entries", () => {
    const withEntries = renderWithRuntime(ContentView, "content" as never, {
      entries: [
        {
          ref: "sha256:abc",
          metadata: {
            size: 3,
            mimeType: "text/plain",
            createdAt: "2026-08-14T00:00:00.000Z",
            createdBy: undefined,
          },
        },
      ],
    });
    expect(withEntries.container.textContent).toContain("sha256:abc");

    const noEntries = renderWithRuntime(
      ContentView,
      "content" as never,
      {},
      {
        snapshot: { ...sampleRuntime.snapshot!, auditTail: [] },
        changeLog: sampleRuntime.changeLog,
        epoch: sampleRuntime.epoch,
      },
    );
    expect(noEntries.container.textContent).toContain("No content available.");
  });

  it("renders eval compare and report branches", () => {
    // With prefetched compare data the DiffView renders the run labels.
    const compare = renderWithRuntime(EvalView, "eval-compare", {
      runA: "run:a",
      runB: "run:b",
      attemptsA: [],
      attemptsB: [],
    });
    expect(compare.container.textContent).toContain("run:a");

    const evalRun = renderWithRuntime(EvalView, "eval-run", { suite: "suite-a" });
    expect(evalRun.container.textContent).toContain("Evaluation Run");

    const evalList = renderWithRuntime(EvalView, "eval-list");
    expect(evalList.container.textContent).toContain("Evaluation Suites");

    const report = renderWithRuntime(EvalView, "eval-report", {
      lastRunId: "run:custom",
      runs: [],
      attempts: [],
    });
    expect(report.container.textContent).toContain("run:custom");

    const run = renderWithRuntime(EvalView, "eval-run", { suite: "suite-x" });
    expect(run.container.textContent).toContain("Evaluation Run");
  });

  it("renders trace search and validate branches", () => {
    const search = renderWithRuntime(TraceView, "trace-search", { keyword: "commit" });
    expect(search.container.textContent).toContain("commit");

    const validate = renderWithRuntime(TraceView, "trace-validate");
    expect(validate.container.textContent).toContain("Trace Validation");

    const obs = renderWithRuntime(TraceView, "trace-obs");
    expect(obs.container.textContent).toContain("Observations");
  });

  it("renders observe diagnostic and titled lens branches", () => {
    const diagnostic = renderWithRuntime(ObserveView, "observe-diagnostic", {
      observeProjection: sampleObserveProjection,
    });
    expect(diagnostic.container.textContent).toContain("Observability Diagnostics");

    const resource = renderWithRuntime(ObserveView, "observe-resource", {
      observeProjection: sampleObserveProjection,
    });
    expect(resource.container.textContent).toContain("Resource Lens");
  });

  it("renders schema diff and validate branches", () => {
    const diff = renderWithRuntime(SchemaView, "schema-diff", { epochA: "e0", epochB: "e1" });
    expect(diff.container.textContent).toContain("e0");

    const validate = renderWithRuntime(SchemaView, "schema-validate");
    expect(validate.container.textContent).toContain("Schema Validation");

    const history = renderWithRuntime(SchemaView, "schema-epoch-history");
    expect(history.container.textContent).toContain("Epoch History");
  });

  it("renders replay recipe branch with change id", () => {
    const recipe = renderWithRuntime(ReplayView, "replay-recipe", {
      changeId: "chg:obs-001",
      replayProjection: sampleReplayProjection,
    });
    expect(recipe.container.textContent).toContain("chg:obs-001");

    const replay = renderWithRuntime(ReplayView, "replay", {
      replayProjection: sampleReplayProjection,
    });
    expect(replay.container.textContent).toContain("Replay Session");
  });

  it("renders petri fire and invariants branches", () => {
    const fireData = fireTransition(sampleRuntime, "publish_artifact");
    const fire = renderWithRuntime(PetriView, "petri-fire", {
      petriData: fireData,
      op: "publish_artifact",
    });
    expect(fire.container.textContent).toContain("Petri Fire");

    const invData = invariantsFor(sampleRuntime);
    const invariants = renderWithRuntime(PetriView, "petri-invariants", { petriData: invData });
    expect(invariants.container.textContent).toContain("Petri Invariants");

    const reachData = reachability(sampleRuntime, "art:task-001");
    const reach = renderWithRuntime(PetriView, "petri-reach", {
      petriData: reachData,
      goal: "art:task-001",
    });
    expect(reach.container.textContent).toContain("Reachability");
  });

  it("renders world diff branch", () => {
    const diff = renderWithRuntime(WorldView, "world-diff", {
      refA: "snap:a",
      refB: "snap:b",
      worldDiffLeft: "participants: a",
      worldDiffRight: "participants: b",
    });
    expect(diff.container.textContent).toContain("World Diff");

    const emptyDiff = renderWithRuntime(WorldView, "world-diff", {
      worldDiffLeft: "participants: (none)",
      worldDiffRight: "participants: (none)",
      refA: "snap:empty",
      refB: "snap:empty",
    });
    expect(emptyDiff.container.textContent).toContain("(none)");

    const actors = renderWithRuntime(WorldView, "world-actors");
    expect(actors.container.textContent).toContain("actors");
  });

  it("renders eval report with empty suites and replay unknown change id", () => {
    const snapshotOnly = {
      snapshot: sampleRuntime.snapshot,
      changeLog: [],
      epoch: sampleRuntime.epoch,
    };
    const report = renderWithRuntime(EvalView, "eval-report", {}, snapshotOnly);
    expect(report.container.textContent).toContain("No evaluation data loaded");

    const recipe = renderWithRuntime(ReplayView, "replay-recipe", { changeId: "missing-id" });
    expect(recipe.container.textContent).toMatch(/No replay result|fail-closed|CoordinationRuntime\.replay/);
  });

  it("renders graph stats and empty graph message via output", () => {
    const stats = renderWithRuntime(GraphView, "graph-stats");
    expect(stats.container.textContent).toContain("DAG Statistics");

    const empty = renderWithRuntime(
      GraphView,
      "graph",
      {},
      {
        snapshot: sampleRuntime.snapshot,
        changeLog: [],
        epoch: sampleRuntime.epoch,
      },
    );
    expect(empty.container.textContent).toMatch(/graph|No coordination/i);
  });

  it("renders export and help view containers", () => {
    const store = createStore({ runtime: sampleRuntime, mode: "view" });
    const { container } = render(
      <StoreProvider store={store}>
        <ExportViewContainer viewArgs={{ target: "graph", format: "dot" }} />
        <HelpViewContainer viewArgs={{ command: "/help" }} />
      </StoreProvider>,
    );
    expect(container.textContent).toContain("Export");
    expect(container.textContent).toContain("/help");
  });

  it("renders default view containers through useAppStore provider", () => {
    const store = createStore({ runtime: sampleRuntime, mode: "view" });
    const { container } = render(
      <StoreProvider store={store}>
        <ContentViewContainer activeView="content-search" viewArgs={{ text: "def" }} />
        <EvalViewContainer activeView="eval-compare" viewArgs={{ runA: "a", runB: "b" }} />
        <TraceViewContainer activeView="trace-validate" />
        <ObserveViewContainer activeView="observe-diagnostic" />
        <SchemaViewContainer activeView="schema-validate" />
        <ReplayViewContainer activeView="replay-recipe" viewArgs={{ changeId: "chg:1" }} />
        <PetriViewContainer activeView="petri-fire" />
        <WorldViewContainer activeView="world-diff" viewArgs={{ refA: "a", refB: "b" }} />
      </StoreProvider>,
    );
    expect(container.textContent).toContain("Trace Validation");
    expect(container.textContent).toContain("World Diff");
  });

  it("renders EvalView container defaults and unknown-view fallback", () => {
    // Container with no props falls back to eval-list default.
    const containerDefault = render(
      <StoreProvider store={createStore({ runtime: sampleRuntime })}>
        <EvalViewContainer />
      </StoreProvider>,
    );
    expect(containerDefault.container.textContent).toContain("Evaluation Suites");

    // An unknown active view falls back to the "Evaluation" title.
    const unknown = renderWithRuntime(EvalView, "eval-unknown" as never, {
      suites: [],
    });
    expect(unknown.container.textContent).toContain("Evaluation");

    // A null active view falls back to the eval-list default branch.
    const nullStore = createStore({ runtime: sampleRuntime, activeView: null, mode: "view" });
    const nullView = render(
      <StoreProvider store={nullStore}>
        <EvalView store={nullStore} />
      </StoreProvider>,
    );
    expect(nullView.container.textContent).toContain("Evaluation Suites");

    // Compare with prefetched attempts renders the DiffView labels.
    const compare = renderWithRuntime(EvalView, "eval-compare", {
      runA: "alpha",
      runB: "beta",
      attemptsA: [],
      attemptsB: [],
    });
    expect(compare.container.textContent).toContain("alpha");
    expect(compare.container.textContent).toContain("beta");
  });
});
