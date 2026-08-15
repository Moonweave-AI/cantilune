import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, ChangeLogEntry, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderGraph, type GraphEdge, type GraphNode } from "../render/asciiGraph.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** The DAG is the committed-history view; green reads as "this actually happened". */
const GRAPH_TONE: ViewTone = "success";

export interface ViewProps {
  readonly store: AppStore;
}

export interface GraphViewData {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
}

function graphDataFromRuntime(runtime: RuntimeState): GraphViewData | null {
  if (runtime.changeLog.length === 0) {
    return runtime.snapshot === null ? null : { nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = runtime.changeLog.map((entry) => ({
    id: entry.changeId,
    label: `${entry.operationTypeId}(${entry.initiator})`,
  }));

  const edges: GraphEdge[] = runtime.changeLog.slice(1).map((entry, index) => {
    const prior = runtime.changeLog[index]!;
    return {
      from: prior.changeId,
      to: entry.changeId,
      label: "chain",
    };
  });

  return { nodes, edges };
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
      const refA = str(viewArgs.refA, filtered.nodes[0]?.id ?? "—");
      const refB = str(viewArgs.refB, filtered.nodes.at(-1)?.id ?? "—");
      const pathNodes = filtered.nodes.filter((n) => n.id === refA || n.id === refB);
      const pathEdges = filtered.edges.filter((e) =>
        pathNodes.some((n) => n.id === e.from || n.id === e.to),
      );
      return [
        `Path ${refA} → ${refB}`,
        renderGraph(
          pathNodes.length > 0 ? pathNodes : filtered.nodes.slice(0, 2),
          pathEdges.length > 0 ? pathEdges : filtered.edges,
        ),
      ].join("\n\n");
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
    case "graph-stats":
      return renderTable(
        [
          { header: "Metric", width: 16 },
          { header: "Value", width: 10 },
        ],
        [
          ["Nodes", String(filtered.nodes.length)],
          ["Edges", String(filtered.edges.length)],
          ["Max Depth", String(filtered.nodes.length)],
          ["Fork Points", String(forkRows(runtime.changeLog).length)],
          ["Leaf Changes", String(filtered.nodes.length > 0 ? 1 : 0)],
        ],
      );
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
