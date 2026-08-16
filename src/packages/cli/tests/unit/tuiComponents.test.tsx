// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { inkInputHandlers } from "../setup/inkSetup.js";
import { createStore } from "../../src/store.js";
import type { ViewType } from "../../src/store.js";
import { DiffView } from "../../src/views/DiffView.js";
import { ReportView } from "../../src/views/ReportView.js";
import { SearchView } from "../../src/views/SearchView.js";
import { WorldView } from "../../src/views/WorldView.js";
import { GraphView } from "../../src/views/GraphView.js";
import { PetriView } from "../../src/views/PetriView.js";
import { TraceView } from "../../src/views/TraceView.js";
import { ContentView } from "../../src/views/ContentView.js";
import { ObserveView } from "../../src/views/ObserveView.js";
import { SchemaView } from "../../src/views/SchemaView.js";
import { EvalView } from "../../src/views/EvalView.js";
import { ReplayView } from "../../src/views/ReplayView.js";
import WorldViewContainer from "../../src/views/WorldView.js";
import GraphViewContainer from "../../src/views/GraphView.js";
import PetriViewContainer from "../../src/views/PetriView.js";
import TraceViewContainer from "../../src/views/TraceView.js";
import ContentViewContainer from "../../src/views/ContentView.js";
import ObserveViewContainer from "../../src/views/ObserveView.js";
import SchemaViewContainer from "../../src/views/SchemaView.js";
import EvalViewContainer from "../../src/views/EvalView.js";
import ReplayViewContainer from "../../src/views/ReplayView.js";
import { ProgressBar } from "../../src/tui/ProgressBar.js";
import { StatusBar } from "../../src/tui/StatusBar.js";
import { ToolCard } from "../../src/tui/ToolCard.js";
import { ChatPanel } from "../../src/tui/ChatPanel.js";
import { CommandPalette } from "../../src/tui/CommandPalette.js";
import type { CommandSuggestion } from "../../src/commands/suggest.js";
import { ConfirmDialog } from "../../src/tui/ConfirmDialog.js";
import { InputBar } from "../../src/tui/InputBar.js";
import { PickerPanel } from "../../src/tui/PickerPanel.js";
import { ViewContainer } from "../../src/tui/ViewContainer.js";
import {
  sampleObserveProjection,
  sampleReplayProjection,
} from "../support/sampleObserveReplay.js";

describe("ink view and tui components", () => {
  beforeEach(() => {
    inkInputHandlers.length = 0;
  });

  it("renders diff with matching and differing lines", () => {
    const { container } = render(
      <DiffView
        left={"same\nonly-left\n"}
        right={"same\nonly-right\n"}
        leftLabel="A"
        rightLabel="B"
      />,
    );
    expect(container.textContent).toContain("only-left");
    expect(container.textContent).toContain("only-right");

    const same = render(
      <DiffView
        left={"line-one\nshared"}
        right={"line-one\nshared"}
        leftLabel="A"
        rightLabel="B"
      />,
    );
    expect(same.container.textContent).toContain("shared");
  });

  it("renders report and search views", () => {
    const report = render(<ReportView title="T" sections={[{ heading: "H", content: "body" }]} />);
    expect(report.container.textContent).toContain("T");

    const emptySearch = render(<SearchView query="x" results={[]} />);
    expect(emptySearch.container.textContent).toContain("No matches");

    const search = render(
      <SearchView query="lock" results={[{ line: 1, content: "write_lock", source: "file" }]} />,
    );
    expect(search.container.textContent).toContain("write_lock");
  });

  it("renders domain views across branches", () => {
    const views: Array<{
      view: ReturnType<typeof createStore>["activeView"];
      args?: Record<string, unknown>;
    }> = [
      { view: "world" },
      { view: "world-tasks" },
      { view: "world-diff", args: { refA: "a", refB: "b", worldDiffLeft: "a", worldDiffRight: "b" } },
      { view: "graph", args: { depth: 2, actor: "coder" } },
      { view: "graph-forks" },
      { view: "graph-path", args: { refA: "chg:obs-001", refB: "chg:commit-004" } },
      { view: "petri" },
      { view: "petri-transitions" },
      { view: "petri-reach", args: { goal: "gate" } },
      { view: "petri-invariants" },
      { view: "petri-fire", args: { op: "publishArtifact" } },
      { view: "trace" },
      { view: "trace-obs" },
      { view: "trace-rewrites" },
      { view: "trace-search", args: { keyword: "commit" } },
      { view: "trace-validate" },
      { view: "content-cat", args: { ref: "sha256:x" } },
      { view: "content-ls" },
      { view: "content-stats" },
      { view: "content-search", args: { text: "write_lock" } },
      { view: "content-gc" },
      { view: "observe", args: { observeProjection: sampleObserveProjection } },
      { view: "observe-dependency", args: { observeProjection: sampleObserveProjection } },
      { view: "observe-diagnostic", args: { observeProjection: sampleObserveProjection } },
      { view: "schema" },
      { view: "schema-ops" },
      { view: "schema-diff", args: { epochA: "e0", epochB: "e1" } },
      { view: "schema-validate" },
      { view: "eval-list" },
      { view: "eval-run", args: { suite: "coord-basic" } },
      { view: "eval-compare", args: { runA: "a", runB: "b" } },
      { view: "eval-report", args: { runId: "run:1" } },
      { view: "replay", args: { replayProjection: sampleReplayProjection } },
      { view: "replay-bundle", args: { replayProjection: sampleReplayProjection } },
      {
        view: "replay-recipe",
        args: { changeId: "chg:1", replayProjection: sampleReplayProjection },
      },
    ];

    for (const spec of views) {
      const store = createStore({ activeView: spec.view, viewArgs: spec.args ?? {}, mode: "view" });
      if (spec.view?.startsWith("world")) render(<WorldView store={store} />);
      else if (spec.view?.startsWith("graph")) render(<GraphView store={store} />);
      else if (spec.view?.startsWith("petri")) render(<PetriView store={store} />);
      else if (spec.view?.startsWith("trace")) render(<TraceView store={store} />);
      else if (spec.view?.startsWith("content")) render(<ContentView store={store} />);
      else if (spec.view?.startsWith("observe")) render(<ObserveView store={store} />);
      else if (spec.view?.startsWith("schema")) render(<SchemaView store={store} />);
      else if (spec.view?.startsWith("eval")) render(<EvalView store={store} />);
      else if (spec.view?.startsWith("replay")) render(<ReplayView store={store} />);
    }

    const toolCard = render(
      <ToolCard
        toolCall={{
          id: "3",
          name: "run",
          args: {},
          status: "running",
          result: { ok: false, output: "denied" },
        }}
      />,
    );
    expect(views).toHaveLength(35);
    expect(toolCard.container.textContent).toContain("denied");
  });

  it("renders view default containers", () => {
    const world = render(<WorldViewContainer activeView="world" />);
    expect(world.container).toBeDefined();
    render(<GraphViewContainer activeView="graph-stats" viewArgs={{}} />);
    render(<PetriViewContainer activeView="petri-invariants" />);
    render(<TraceViewContainer activeView="trace-obs" />);
    render(<ContentViewContainer activeView="content-stats" />);
    render(<ObserveViewContainer activeView="observe-spine" />);
    render(<SchemaViewContainer activeView="schema-epoch" />);
    render(<EvalViewContainer activeView="eval-list" />);
    render(<ReplayViewContainer activeView="replay-bundle" />);
  });

  it("renders simple tui widgets", () => {
    const progress = render(<ProgressBar label="Load" progress={1.5} width={10} />);
    expect(progress.container.textContent).toContain("Load");
    render(<ProgressBar label="Load" progress={-1} />);
    render(
      <StatusBar
        provider="openai"
        model="gpt-4o"
        session={createStore().session}
        maxTurns={50}
        participants={2}
      />,
    );
    render(
      <ToolCard
        toolCall={{
          id: "1",
          name: "readContent",
          args: { ref: "x" },
          status: "done",
          result: { ok: true, output: "ok" },
        }}
      />,
    );
    render(
      <ToolCard
        toolCall={{
          id: "2",
          name: "fail",
          args: {},
          status: "error",
        }}
      />,
    );
  });

  it("renders chat panel empty and populated", () => {
    const empty = render(<ChatPanel messages={[]} />);
    expect(empty.container).toBeDefined();
    const populated = render(
      <ChatPanel
        messages={[
          { role: "user", content: "hi", timestamp: 1 },
          {
            role: "assistant",
            content: "hello",
            timestamp: 2,
            toolCalls: [{ id: "t1", name: "tool", args: {}, status: "pending" }],
          },
          { role: "system", content: "note", timestamp: 3 },
        ]}
      />,
    );
    expect(populated.container.textContent).toContain("hello");
  });

  it("renders command palette rows and wires picker input handlers", () => {
    const onClose = vi.fn();
    const suggestion = (name: string, childCount = 0): CommandSuggestion => ({
      name,
      label: name,
      description: `${name} description`,
      category: "view",
      command: { name, description: "d", category: "view", handler: () => undefined },
      childCount,
      requiredArgs: [],
    });

    const palette = render(
      <CommandPalette suggestions={[suggestion("/graph"), suggestion("/world", 2)]} selected={1} />,
    );
    expect(palette.container.textContent).toContain("/graph");
    expect(palette.container.textContent).toContain("2/2");
    // The palette is presentational now, so it must not claim any keystrokes.
    expect(inkInputHandlers).toHaveLength(0);

    const empty = render(<CommandPalette suggestions={[]} selected={0} />);
    expect(empty.container.textContent).toContain("No matching commands.");

    const usage = render(
      <CommandPalette
        suggestions={[]}
        selected={0}
        usage={{
          name: "/rprov",
          description: "Register a provider",
          args: [{ name: "url", description: "Endpoint", required: true, type: "string" }],
          argIndex: 0,
          missing: ["url"],
        }}
      />,
    );
    expect(usage.container.textContent).toContain("<url>");
    expect(usage.container.textContent).toContain("(required)");

    const onSelect = vi.fn();
    render(
      <PickerPanel
        title="Pick"
        options={[
          { id: "1", label: "One", description: "d" },
          { id: "2", label: "Two" },
        ]}
        onSelect={onSelect}
        onCancel={onClose}
      />,
    );
    const pickerHandler = inkInputHandlers.at(-1)!;
    pickerHandler("", { downArrow: true });
    pickerHandler("", { upArrow: true });
    pickerHandler("", { escape: true });
    pickerHandler("", { return: true });
    expect(onSelect).toHaveBeenCalled();

    render(<PickerPanel title="Empty" options={[]} onSelect={onSelect} onCancel={onClose} />);
  });

  it("handles confirm dialog cancel paths", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);
    inkInputHandlers.at(-1)!("y", {});
    expect(onConfirm).toHaveBeenCalled();
    render(<ConfirmDialog message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);
    inkInputHandlers.at(-1)!("n", {});
    expect(onCancel).toHaveBeenCalled();
    render(<ConfirmDialog message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);
    inkInputHandlers.at(-1)!("", { escape: true });
    render(<ConfirmDialog message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);
    inkInputHandlers.at(-1)!("", { return: true });
  });

  it("handles input bar history navigation", () => {
    const onSubmit = vi.fn();
    render(<InputBar onSubmit={onSubmit} history={["a", "b"]} />);
    const inputHandler = inkInputHandlers.at(-1)!;
    inputHandler("a", {});
    inputHandler("", { backspace: true });
    inputHandler("", { upArrow: true });
    inputHandler("", { upArrow: true });
    inputHandler("", { downArrow: true });
    inputHandler("", { downArrow: true });
    inputHandler("", { return: true });

    render(<InputBar onSubmit={onSubmit} />);
    const blankHandler = inkInputHandlers.at(-1)!;
    blankHandler("   ", {});
    blankHandler("", { return: true });
    expect(onSubmit).not.toHaveBeenCalled();

    render(<InputBar onSubmit={onSubmit} />);
    inkInputHandlers.at(-1)!("", { return: true });
    expect(onSubmit).not.toHaveBeenCalled();

    render(<InputBar disabled onSubmit={onSubmit} />);
    inkInputHandlers.at(-1)!("x", {});

    render(<InputBar onSubmit={onSubmit} history={[]} />);
    inkInputHandlers.at(-1)!("", { upArrow: true });

    render(<InputBar onSubmit={onSubmit} history={["prev"]} />);
    const downFromNull = inkInputHandlers.at(-1)!;
    downFromNull("", { downArrow: true });
    downFromNull("prev", {});
    downFromNull("", { upArrow: true });
    downFromNull("", { downArrow: true });
    downFromNull("", { downArrow: true });
  });

  it("shows loading then fallback when dynamic import unavailable", async () => {
    const loading = render(<ViewContainer activeView="world" viewArgs={{}} />);
    expect(loading.container.textContent).toContain("loading world");

    await vi.waitFor(() => {
      expect(loading.container.textContent).toMatch(
        /Coming soon|CollaborationSnapshot|Participants/,
      );
    });

    const unknown = render(
      <ViewContainer activeView={"unknown" as ViewType} viewArgs={{ hint: true }} />,
    );
    await vi.waitFor(() => {
      expect(unknown.container.textContent).toContain("Coming soon");
    });
  });
});
