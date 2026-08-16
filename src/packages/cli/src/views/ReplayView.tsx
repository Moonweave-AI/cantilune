import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { renderTimeline } from "../render/asciiTimeline.js";
import {
  readReplayError,
  readReplayProjection,
  type CliReplayProjection,
} from "../wiring/replayControl.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** Replay reconstructs committed history, so it carries the primary accent. */
const REPLAY_TONE: ViewTone = "accent";

export interface ViewProps {
  readonly store: AppStore;
}

export function renderReplayViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  _runtime?: RuntimeState,
): string {
  const error = readReplayError(viewArgs);
  if (error !== undefined) {
    return `Replay failed (fail-closed): ${error}`;
  }
  const data = readReplayProjection(viewArgs);
  if (data === undefined) {
    return "No replay result — run `/replay from <ref>` to call CoordinationRuntime.replay";
  }
  return renderProjection(activeView, data, viewArgs);
}

function renderProjection(
  activeView: ViewType,
  data: CliReplayProjection,
  viewArgs: Record<string, unknown>,
): string {
  switch (activeView) {
    case "replay-recipe":
      return renderTable(
        [
          { header: "Step", width: 6 },
          { header: "Operation", width: 20 },
          { header: "Bindings", width: 30 },
        ],
        data.steps.map((r) => [r.step, r.op, r.bindings]),
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
        `Replay from: ${str(viewArgs.ref, data.fromRef)}`,
        data.ok ? data.message : `FAILED: ${data.message}`,
        "",
        renderTimeline([...data.timeline]),
      ].join("\n");
  }
}

export function ReplayView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "replay";
  const error = readReplayError(store.viewArgs);
  const data = readReplayProjection(store.viewArgs);
  const output = renderReplayViewOutput(activeView, store.viewArgs, store.runtime);

  if (error !== undefined || data === undefined) {
    return (
      <ViewFrame
        title="Replay Session"
        tone={REPLAY_TONE}
        empty={error !== undefined ? output : store.runtime.snapshot === null ? NO_RUNTIME_MESSAGE : output}
      />
    );
  }

  if (activeView === "replay-recipe") {
    const changeId = str(store.viewArgs.changeId, data.steps[0]?.changeId ?? "—");
    return (
      <ViewFrame title="Replay Recipe" tone={REPLAY_TONE} subtitle={changeId}>
        <ReportView
          title={`Replay Recipe: ${changeId}`}
          sections={[
            {
              heading: "Match Bindings",
              content:
                data.steps.find((entry) => entry.changeId === changeId)?.bindings ??
                data.message,
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
    <ViewFrame
      title={titles[activeView] ?? "Replay"}
      tone={REPLAY_TONE}
      subtitle={data.ok ? data.message : data.message}
    >
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
