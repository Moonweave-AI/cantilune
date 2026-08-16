import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, ChangeLogEntry, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderGraph } from "../render/asciiGraph.js";
import { renderTable } from "../render/asciiTable.js";
import {
  graphDataFromRuntime,
  graphStats,
  shortestPath,
  type GraphViewData,
} from "../wiring/graphData.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** The DAG is the committed-history view; green reads as "this actually happened". */
const GRAPH_TONE: ViewTone = "success";

export interface ViewProps {
  readonly store: AppStore;
}

function filterByArgs(data: GraphViewData, viewArgs: Record<string, unknown>): GraphViewData {
  const actor = viewArgs.actor as string | undefined;
  const op = viewArgs.op as string | undefined;
  let { nodes, edges } = data;

  if (actor !== undefined) {
    nodes = nodes.filter((n) => n.label.includes(actor));
    const ids = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }
  if (op !== undefined) {
    nodes = nodes.filter((n) => n.label.toLowerCase().includes(op.toLowerCase()));
    const ids = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }

  const depth = viewArgs.depth as number | undefined;
  if (depth !== undefined && depth > 0 && depth < nodes.length) {
    nodes = nodes.slice(0, depth);
    const ids = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  }

  return { nodes, edges };
}

function forkRows(changeLog: readonly ChangeLogEntry[]): string[][] {
  const parentCounts = new Map<string, number>();
  for (const entry of changeLog) {
    parentCounts.set(entry.beforeRef, (parentCounts.get(entry.beforeRef) ?? 0) + 1);
  }
  return changeLog
    .filter((entry) => (parentCounts.get(entry.beforeRef) ?? 0) > 1)
    .map((entry) => [
      entry.changeId,
      entry.beforeRef,
      String(parentCounts.get(entry.beforeRef) ?? 0),
    ]);
}


export function renderGraphViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const data = graphDataFromRuntime(runtime);
  if (data === null) {
    return NO_RUNTIME_MESSAGE;
  }

  const filtered = filterByArgs(data, viewArgs);

  switch (activeView) {
    case "graph-path": {
      const refA = str(viewArgs.refA);
      const refB = str(viewArgs.refB);
      if (!refA || !refB) {
        return "Usage: /graph path <refA> <refB> — both change refs required";
      }
      const path = shortestPath(filtered.nodes, filtered.edges, refA, refB);
      if (path === undefined) {
        return `No path from ${refA} to ${refB} in the coordination DAG`;
      }
      const pathSet = new Set(path);
      return [
        `Shortest path ${refA} → ${refB} (${path.length} nodes)`,
        path.join(" → "),
        "",
        renderGraph(
          filtered.nodes.filter((n) => pathSet.has(n.id)),
          filtered.edges.filter((e) => pathSet.has(e.from) && pathSet.has(e.to)),
        ),
      ].join("\n");
    }
    case "graph-forks":
      return renderTable(
        [
          { header: "Fork Ref", width: 16 },
          { header: "Parent", width: 16 },
          { header: "Branches", width: 10 },
        ],
        forkRows(runtime.changeLog),
      );
    case "graph-stats": {
      const stats = graphStats(filtered);
      return renderTable(
        [
          { header: "Metric", width: 16 },
          { header: "Value", width: 10 },
        ],
        [
          ["Nodes", String(stats.nodes)],
          ["Edges", String(stats.edges)],
          ["Max Depth", String(stats.maxDepth)],
          ["Fork Points", String(forkRows(runtime.changeLog).length)],
          ["Leaf Changes", String(stats.leafChanges)],
        ],
      );
    }
    case "graph":
    default:
      if (filtered.nodes.length === 0) {
        return "No coordination changes recorded yet.";
      }
      return renderGraph(filtered.nodes, filtered.edges);
  }
}

export function GraphView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "graph";
  const output = renderGraphViewOutput(activeView, store.viewArgs, store.runtime);
  const titles: Record<string, string> = {
    graph: "Coordination DAG",
    "graph-path": "Shortest Path",
    "graph-forks": "Fork Points",
    "graph-stats": "DAG Statistics",
  };

  const filters = [
    store.viewArgs.depth !== undefined ? `depth=${str(store.viewArgs.depth)}` : "",
    store.viewArgs.actor !== undefined ? `actor=${str(store.viewArgs.actor)}` : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

  return (
    <ViewFrame title={titles[activeView] ?? "Graph View"} tone={GRAPH_TONE} subtitle={filters}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function GraphViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "graph",
    viewArgs: props.viewArgs ?? {},
  });
  return <GraphView store={store} />;
}
