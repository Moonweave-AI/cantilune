import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderGraph } from "../render/asciiGraph.js";
import { renderTable } from "../render/asciiTable.js";
import { renderTimeline } from "../render/asciiTimeline.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";

/** Observability is strictly read-only, matching the informational hue. */
const OBSERVE_TONE: ViewTone = "info";

export interface ViewProps {
  readonly store: AppStore;
}

function observeDataFromRuntime(runtime: RuntimeState): {
  summary: readonly { lens: string; nodes: number; edges: number }[];
  resources: readonly { resource: string; actor: string; mode: string }[];
} | null {
  if (runtime.snapshot === null) {
    return null;
  }

  const snapshot = runtime.snapshot;
  const dependencyNodes = snapshot.artifacts.length;
  const dependencyEdges = snapshot.links.length;
  const resourceNodes = snapshot.capabilities.length;
  const communicationNodes = snapshot.participants.length;
  const structureNodes =
    snapshot.participants.length + snapshot.artifacts.length + snapshot.links.length;

  return {
    summary: [
      { lens: "dependency", nodes: dependencyNodes, edges: dependencyEdges },
      { lens: "resource", nodes: resourceNodes, edges: resourceNodes },
      { lens: "communication", nodes: communicationNodes, edges: snapshot.sessions.length },
      { lens: "structure", nodes: structureNodes, edges: snapshot.links.length },
    ],
    resources: snapshot.capabilities.map((capability) => ({
      resource: capability.kind,
      actor: capability.holder,
      mode: "exclusive",
    })),
  };
}

export function renderObserveViewOutput(activeView: ViewType, runtime: RuntimeState): string {
  const data = observeDataFromRuntime(runtime);
  if (data === null) {
    return NO_RUNTIME_MESSAGE;
  }

  const snapshot = runtime.snapshot!;

  switch (activeView) {
    case "observe-dependency":
      return renderGraph(
        snapshot.artifacts.map((artifact) => ({ id: artifact.id, label: artifact.kind })),
        snapshot.links.map((link) => ({ from: link.from, to: link.to, label: link.kind })),
      );
    case "observe-resource":
      return renderTable(
        [
          { header: "Resource", width: 16 },
          { header: "Actor", width: 18 },
          { header: "Mode", width: 12 },
        ],
        data.resources.map((r) => [r.resource, r.actor, r.mode]),
      );
    case "observe-communication":
      return renderGraph(
        snapshot.participants.map((participant) => ({
          id: participant.id,
          label: participant.kind,
        })),
        snapshot.sessions.map((session) => ({
          from: session.initiator,
          to: session.id,
          label: session.status,
        })),
      );
    case "observe-structure":
      return renderGraph(
        [
          ...snapshot.participants.map((participant) => ({
            id: participant.id,
            label: participant.kind,
          })),
          ...snapshot.artifacts.map((artifact) => ({
            id: artifact.id,
            label: artifact.kind,
          })),
        ],
        snapshot.links.map((link) => ({ from: link.from, to: link.to, label: link.kind })),
      );
    case "observe-spine":
      return renderTimeline(
        runtime.changeLog.map((entry, index) => ({
          timestamp: Date.parse(entry.timestamp) || Date.now() + index,
          label: `EventSpine[${index}] ${entry.operationTypeId}`,
          kind: "spine",
        })),
      );
    case "observe-diagnostic":
      return `Diagnostics: ${snapshot.links.length} links, ${snapshot.capabilities.length} capabilities, ${runtime.changeLog.length} commits`;
    case "observe":
    default:
      return renderTable(
        [
          { header: "Lens", width: 16 },
          { header: "Nodes", width: 8, align: "right" },
          { header: "Edges", width: 8, align: "right" },
        ],
        data.summary.map((s) => [s.lens, String(s.nodes), String(s.edges)]),
      );
  }
}

export function ObserveView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "observe";
  const output = renderObserveViewOutput(activeView, store.runtime);

  if (store.runtime.snapshot === null) {
    return <ViewFrame title="Four-View Bundle" tone={OBSERVE_TONE} empty={NO_RUNTIME_MESSAGE} />;
  }

  if (activeView === "observe-diagnostic") {
    return (
      <ViewFrame title="Observability Diagnostics" tone={OBSERVE_TONE}>
        <ReportView
          title="Observability Diagnostics"
          sections={[
            {
              heading: "Cross-Lens Invariants",
              content: "Four lenses derived from current runtime snapshot.",
            },
            {
              heading: "Stale Resources",
              content: `${store.runtime.snapshot.capabilities.length} scoped capabilities on snapshot head.`,
            },
            {
              heading: "Spine Coverage",
              content: `${store.runtime.changeLog.length} commits projected onto EventSpine timeline.`,
            },
          ]}
        />
      </ViewFrame>
    );
  }

  const titles: Record<string, string> = {
    observe: "Four-View Bundle",
    "observe-dependency": "Dependency Lens",
    "observe-resource": "Resource Lens",
    "observe-communication": "Communication Lens",
    "observe-structure": "Structure Lens",
    "observe-spine": "EventSpine Timeline",
  };

  return (
    <ViewFrame title={titles[activeView] ?? "Observability"} tone={OBSERVE_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function ObserveViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "observe",
    viewArgs: props.viewArgs ?? {},
  });
  return <ObserveView store={store} />;
}
