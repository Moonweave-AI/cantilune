import React from "react";
import { Text } from "ink";
import { ViewFrame } from "./ViewFrame.js";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, ChangeLogEntry, RuntimeState } from "../store.js";
import { useAppStore } from "../storeContext.js";
import type { GraphEdge, GraphNode } from "../render/asciiGraph.js";
import { exportDot } from "../render/dotExporter.js";
import { exportJson } from "../render/jsonExporter.js";
import { str } from "./viewStr.js";
import { exportMermaid } from "../render/mermaidExporter.js";
import { exportPlantUml } from "../render/plantumlExporter.js";
import { exportPnml, type PetriNet } from "../render/pnmlExporter.js";
import { renderTable } from "../render/asciiTable.js";

export interface ViewProps {
  readonly store: AppStore;
}

const EXPORT_TARGETS: Record<string, readonly string[]> = {
  graph: ["dot", "mermaid", "json", "plantuml"],
  petri: ["pnml", "dot", "json"],
  trace: ["json"],
  snapshot: ["json"],
  bundle: ["json"],
  "four-view": ["json"],
};

function graphDataFromRuntime(
  runtime: RuntimeState,
): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
  if (runtime.changeLog.length === 0) {
    return runtime.snapshot === null ? null : { nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = runtime.changeLog.map((entry) => ({
    id: entry.changeId,
    label: `${entry.operationTypeId}(${entry.initiator})`,
  }));

  const edges: GraphEdge[] = runtime.changeLog.slice(1).map((entry, index) => {
    const prior = runtime.changeLog[index]!;
    return { from: prior.changeId, to: entry.changeId, label: "chain" };
  });

  return { nodes, edges };
}

function petriNetFromRuntime(runtime: RuntimeState): PetriNet | null {
  if (runtime.snapshot === null) {
    return null;
  }

  const places = [
    ...runtime.snapshot.artifacts.map((artifact, index) => ({
      id: `p${index}`,
      name: `artifact:${artifact.kind}`,
      tokens: 1,
    })),
    ...runtime.snapshot.capabilities.map((capability, index) => ({
      id: `c${index}`,
      name: capability.kind,
      tokens: 1,
    })),
  ];

  const transitions = [...new Set(runtime.changeLog.map((entry) => entry.operationTypeId))].map(
    (op, index) => ({
      id: `t${index}`,
      name: op,
    }),
  );

  const arcs = transitions.flatMap((transition, index) => {
    const place = places[index % Math.max(places.length, 1)];
    if (place === undefined) {
      return [];
    }
    return [{ id: `a${index}`, source: place.id, target: transition.id }];
  });

  return { places, transitions, arcs };
}

function exportGraphFormat(format: string, nodes: GraphNode[], edges: GraphEdge[]): string {
  switch (format) {
    case "dot":
      return exportDot(nodes, edges);
    case "mermaid":
      return exportMermaid(nodes, edges);
    case "plantuml":
      return exportPlantUml(nodes, edges);
    case "json":
    default:
      return exportJson({ nodes, edges });
  }
}

function exportPetriFormat(format: string, net: PetriNet): string {
  switch (format) {
    case "pnml":
      return exportPnml(net);
    case "dot": {
      const nodes: GraphNode[] = [
        ...net.places.map((place) => ({ id: place.id, label: place.name })),
        ...net.transitions.map((transition) => ({ id: transition.id, label: transition.name })),
      ];
      const edges: GraphEdge[] = net.arcs.map((arc) => ({
        from: arc.source,
        to: arc.target,
      }));
      return exportDot(nodes, edges);
    }
    case "json":
    default:
      return exportJson(net);
  }
}

function traceExportPayload(changeLog: readonly ChangeLogEntry[]): unknown {
  return { trace: changeLog };
}

function snapshotExportPayload(runtime: RuntimeState, ref: string | undefined): unknown {
  if (runtime.snapshot === null) {
    return { ref, snapshot: null };
  }
  if (ref !== undefined && ref !== runtime.snapshot.snapshotRef) {
    return { ref, snapshot: null, note: "Only current head snapshot is available in CLI sync" };
  }
  return { ref: runtime.snapshot.snapshotRef, snapshot: runtime.snapshot };
}

function bundleExportPayload(runtime: RuntimeState): unknown {
  return {
    snapshotRef: runtime.snapshot?.snapshotRef ?? null,
    epochId: runtime.epoch?.epochId ?? runtime.snapshot?.epochId ?? null,
    changeCount: runtime.changeLog.length,
    changes: runtime.changeLog,
  };
}

function fourViewExportPayload(runtime: RuntimeState): unknown {
  return {
    dependency: runtime.snapshot?.links ?? [],
    resource: runtime.snapshot?.capabilities ?? [],
    communication: runtime.snapshot?.sessions ?? [],
    structure: runtime.snapshot?.artifacts ?? [],
  };
}

export function renderExportViewOutput(
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const target = str(viewArgs.target, "graph");
  const formats = EXPORT_TARGETS[target] ?? ["json"];
  const format = str(viewArgs.format, formats[0] ?? "json");

  const formatList = renderTable(
    [
      { header: "Target", width: 12 },
      { header: "Formats", width: 36 },
    ],
    Object.entries(EXPORT_TARGETS).map(([key, values]) => [key, values.join(", ")]),
  );

  if (runtime.snapshot === null && runtime.changeLog.length === 0) {
    return [formatList, "", NO_RUNTIME_MESSAGE].join("\n");
  }

  let output = "";
  switch (target) {
    case "graph": {
      const data = graphDataFromRuntime(runtime);
      if (data === null) {
        output = NO_RUNTIME_MESSAGE;
      } else if (data.nodes.length === 0) {
        output = exportJson({
          nodes: [],
          edges: [],
          note: "No coordination changes recorded yet.",
        });
      } else {
        output = exportGraphFormat(format, data.nodes, data.edges);
      }
      break;
    }
    case "petri": {
      const net = petriNetFromRuntime(runtime);
      if (net === null) {
        output = NO_RUNTIME_MESSAGE;
      } else {
        output = exportPetriFormat(format, net);
      }
      break;
    }
    case "trace":
      output = exportJson(traceExportPayload(runtime.changeLog));
      break;
    case "snapshot":
      output = exportJson(snapshotExportPayload(runtime, viewArgs.ref as string | undefined));
      break;
    case "bundle":
      output = exportJson(bundleExportPayload(runtime));
      break;
    case "four-view":
      output = exportJson(fourViewExportPayload(runtime));
      break;
    default:
      output = exportJson({ target, runtime: runtime.snapshot, changeLog: runtime.changeLog });
  }

  return [formatList, "", `Export: ${target} (${format})`, "─".repeat(40), output].join("\n");
}

export function ExportView({ store }: ViewProps): React.ReactElement {
  const target = str(store.viewArgs.target, "graph");
  const format = str(store.viewArgs.format, EXPORT_TARGETS[target]?.[0] ?? "json");
  const output = renderExportViewOutput(store.viewArgs, store.runtime);

  return (
    <ViewFrame title="Export" tone="accent" subtitle={`${target} (${format})`}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
}

export default function ExportViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: "export",
    viewArgs: props.viewArgs ?? {},
  });
  return <ExportView store={store} />;
}
