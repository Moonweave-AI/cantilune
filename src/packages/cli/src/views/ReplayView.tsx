import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { renderTimeline } from "../render/asciiTimeline.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** Replay reconstructs committed history, so it carries the primary accent. */
const REPLAY_TONE: ViewTone = "accent";

export interface ViewProps {
  readonly store: AppStore;
}

function replayDataFromRuntime(runtime: RuntimeState): {
  recipe: readonly { step: string; op: string; bindings: string }[];
  bundle: readonly { artifact: string; ref: string }[];
} | null {
  if (runtime.snapshot === null && runtime.changeLog.length === 0) {
    return null;
  }

  const recipe = runtime.changeLog.map((entry, index) => ({
    step: String(index + 1),
    op: entry.operationTypeId,
    bindings: `initiator=${entry.initiator}`,
  }));

  const bundle = [
    { artifact: "snapshot", ref: runtime.snapshot?.snapshotRef ?? "—" },
    { artifact: "changeLog", ref: String(runtime.changeLog.length) },
    { artifact: "schema", ref: runtime.epoch?.epochId ?? runtime.snapshot?.epochId ?? "—" },
    { artifact: "recipes", ref: String(recipe.length) },
  ];

  return { recipe, bundle };
}

export function renderReplayViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const data = replayDataFromRuntime(runtime);
  if (data === null) {
    return NO_RUNTIME_MESSAGE;
  }

  switch (activeView) {
    case "replay-recipe":
      return renderTable(
        [
          { header: "Step", width: 6 },
          { header: "Operation", width: 20 },
          { header: "Bindings", width: 30 },
        ],
        data.recipe.map((r) => [r.step, r.op, r.bindings]),
      );
    case "replay-bundle":
      return renderTable(
        [
          { header: "Artifact", width: 14 },
          { header: "ContentRef", width: 24 },
        ],
        data.bundle.map((b) => [b.artifact, b.ref]),
      );
    case "replay":
    default:
      return [
        `Replay from: ${str(viewArgs.ref, runtime.snapshot?.snapshotRef ?? "snap:t0")}`,
        "",
        renderTimeline(
          runtime.changeLog.map((entry, index) => ({
            timestamp: Date.parse(entry.timestamp) || Date.now() + index,
            label: `Apply ${entry.changeId}`,
            kind: "replay",
          })),
        ),
      ].join("\n");
  }
}

export function ReplayView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "replay";
  const data = replayDataFromRuntime(store.runtime);
  const output = renderReplayViewOutput(activeView, store.viewArgs, store.runtime);

  if (data === null) {
    return <ViewFrame title="Replay Session" tone={REPLAY_TONE} empty={NO_RUNTIME_MESSAGE} />;
  }

  if (activeView === "replay-recipe") {
    const changeId = str(store.viewArgs.changeId, store.runtime.changeLog[0]?.changeId ?? "—");
    return (
      <ViewFrame title="Replay Recipe" tone={REPLAY_TONE} subtitle={changeId}>
        <ReportView
          title={`Replay Recipe: ${changeId}`}
          sections={[
            {
              heading: "Match Bindings",
              content:
                store.runtime.changeLog.find((entry) => entry.changeId === changeId)?.initiator ??
                "Derived from runtime changeLog",
            },
            { heading: "Steps", content: output },
          ]}
        />
      </ViewFrame>
    );
  }

  const titles: Record<string, string> = {
    replay: "Replay Session",
    "replay-recipe": "Replay Recipe",
    "replay-bundle": "Replay Bundle",
  };

  return (
    <ViewFrame title={titles[activeView] ?? "Replay"} tone={REPLAY_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function ReplayViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "replay",
    viewArgs: props.viewArgs ?? {},
  });
  return <ReplayView store={store} />;
}
