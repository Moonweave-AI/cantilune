import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderGraph } from "../render/asciiGraph.js";
import { renderTable } from "../render/asciiTable.js";
import { renderTimeline } from "../render/asciiTimeline.js";
import {
  readObserveError,
  readObserveProjection,
  type CliObserveProjection,
} from "../wiring/observeControl.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";

/** Observability is strictly read-only, matching the informational hue. */
const OBSERVE_TONE: ViewTone = "info";

export interface ViewProps {
  readonly store: AppStore;
}

export function renderObserveViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  _runtime?: RuntimeState,
): string {
  const error = readObserveError(viewArgs);
  if (error !== undefined) {
    return `Observe failed (fail-closed): ${error}`;
  }
  const data = readObserveProjection(viewArgs);
  if (data === undefined) {
    return "No FourViewBundle — run `/observe` to project via @cantilune/observability";
  }
  return renderProjection(activeView, data);
}

function renderProjection(activeView: ViewType, data: CliObserveProjection): string {
  switch (activeView) {
    case "observe-dependency":
      return renderGraph([...data.dependency.nodes], [...data.dependency.edges]);
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
      return renderGraph([...data.communication.nodes], [...data.communication.edges]);
    case "observe-structure":
      return renderGraph([...data.structure.nodes], [...data.structure.edges]);
    case "observe-spine":
      return renderTimeline([...data.spine]);
    case "observe-diagnostic":
      return data.diagnostic;
    case "observe":
    default:
      return [
        `head=${data.headRef} since=${data.sinceRef}`,
        "",
        renderTable(
          [
            { header: "Lens", width: 16 },
            { header: "Nodes", width: 8, align: "right" },
            { header: "Edges", width: 8, align: "right" },
          ],
          data.summary.map((s) => [s.lens, String(s.nodes), String(s.edges)]),
        ),
      ].join("\n");
  }
}

export function ObserveView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "observe";
  const error = readObserveError(store.viewArgs);
  const data = readObserveProjection(store.viewArgs);
  const output = renderObserveViewOutput(activeView, store.viewArgs, store.runtime);

  if (error !== undefined) {
    return <ViewFrame title="Four-View Bundle" tone={OBSERVE_TONE} empty={output} />;
  }

  if (data === undefined) {
    return (
      <ViewFrame
        title="Four-View Bundle"
        tone={OBSERVE_TONE}
        empty={store.runtime.snapshot === null ? NO_RUNTIME_MESSAGE : output}
      />
    );
  }

  if (activeView === "observe-diagnostic") {
    return (
      <ViewFrame title="Observability Diagnostics" tone={OBSERVE_TONE}>
        <ReportView
          title="Observability Diagnostics"
          sections={[
            {
              heading: "Cross-Lens Invariants",
              content: `FourViewBundle from @cantilune/observability (since=${data.sinceRef}).`,
            },
            {
              heading: "Resource Lens",
              content: `${data.resources.length} scoped capabilities projected.`,
            },
            {
              heading: "Spine Coverage",
              content: `${data.spine.length} EventSpine events in observation cut.`,
            },
            { heading: "Stats", content: data.diagnostic },
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
    <ViewFrame
      title={titles[activeView] ?? "Observability"}
      tone={OBSERVE_TONE}
      subtitle={`head=${data.headRef} since=${data.sinceRef}`}
    >
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
