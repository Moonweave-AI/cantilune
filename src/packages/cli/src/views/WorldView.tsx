import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, SnapshotData, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { DiffView } from "./DiffView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** The coordination world reads as informational, not as an action surface. */
const WORLD_TONE: ViewTone = "info";

export interface ViewProps {
  readonly store: AppStore;
}

export type WorldViewData = Pick<
  SnapshotData,
  "participants" | "artifacts" | "sessions" | "capabilities" | "links" | "retired"
>;

function worldDataFromRuntime(runtime: RuntimeState): WorldViewData | null {
  if (runtime.snapshot === null) {
    return null;
  }
  return runtime.snapshot;
}

function renderParticipantsTable(data: WorldViewData): string {
  return renderTable(
    [
      { header: "ID", width: 18 },
      { header: "Kind", width: 8 },
      { header: "Status", width: 10 },
    ],
    data.participants.map((p) => [p.id, p.kind, p.status]),
  );
}

function renderArtifactsTable(data: WorldViewData): string {
  return renderTable(
    [
      { header: "ID", width: 16 },
      { header: "Kind", width: 8 },
      { header: "Lifecycle", width: 14 },
    ],
    data.artifacts.map((a) => [a.id, a.kind, a.lifecycle]),
  );
}

function renderSessionsTable(data: WorldViewData): string {
  return renderTable(
    [
      { header: "ID", width: 14 },
      { header: "Initiator", width: 18 },
      { header: "Status", width: 8 },
    ],
    data.sessions.map((s) => [s.id, s.initiator, s.status]),
  );
}

function renderCapabilitiesTable(data: WorldViewData): string {
  return renderTable(
    [
      { header: "ID", width: 16 },
      { header: "Kind", width: 12 },
      { header: "Holder", width: 18 },
    ],
    data.capabilities.map((c) => [c.id, c.kind, c.holder]),
  );
}

function renderLinksTable(data: WorldViewData): string {
  return renderTable(
    [
      { header: "From", width: 16 },
      { header: "To", width: 16 },
      { header: "Kind", width: 14 },
    ],
    data.links.map((l) => [l.from, l.to, l.kind]),
  );
}

function renderRetiredTable(data: WorldViewData): string {
  return renderTable(
    [
      { header: "ID", width: 16 },
      { header: "Kind", width: 8 },
      { header: "Retired At", width: 22 },
    ],
    data.retired.map((r) => [r.id, r.kind, r.retiredAt]),
  );
}

export function renderWorldViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const data = worldDataFromRuntime(runtime);
  if (data === null) {
    return NO_RUNTIME_MESSAGE;
  }

  switch (activeView) {
    case "world-actors":
      return renderParticipantsTable(data);
    case "world-tasks":
      return renderArtifactsTable(data);
    case "world-sessions":
      return renderSessionsTable(data);
    case "world-caps":
      return renderCapabilitiesTable(data);
    case "world-links":
      return renderLinksTable(data);
    case "world-retired":
      return renderRetiredTable(data);
    case "world-diff": {
      const err = viewArgs.worldDiffError;
      if (typeof err === "string" && err.length > 0) {
        return `World diff failed (fail-closed): ${err}`;
      }
      const left = typeof viewArgs.worldDiffLeft === "string" ? viewArgs.worldDiffLeft : "";
      const right = typeof viewArgs.worldDiffRight === "string" ? viewArgs.worldDiffRight : "";
      if (left.length === 0 || right.length === 0) {
        return "No world diff — run `/world diff <refA> <refB>` to load both snapshots by ref";
      }
      return `Diff: ${str(viewArgs.refA, "—")} → ${str(viewArgs.refB, "—")}`;
    }
    case "world":
    default:
      return [
        "Participants",
        renderParticipantsTable(data),
        "",
        "Artifacts",
        renderArtifactsTable(data),
        "",
        "Sessions",
        renderSessionsTable(data),
        "",
        "Capabilities",
        renderCapabilitiesTable(data),
        "",
        "Links",
        renderLinksTable(data),
      ].join("\n");
  }
}

export function WorldView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "world";

  if (activeView === "world-diff") {
    const err = store.viewArgs.worldDiffError;
    if (typeof err === "string" && err.length > 0) {
      return (
        <ViewFrame
          title="World Diff"
          tone={WORLD_TONE}
          empty={`World diff failed (fail-closed): ${err}`}
        />
      );
    }
    const left =
      typeof store.viewArgs.worldDiffLeft === "string" ? store.viewArgs.worldDiffLeft : "";
    const right =
      typeof store.viewArgs.worldDiffRight === "string" ? store.viewArgs.worldDiffRight : "";
    if (left.length === 0 || right.length === 0) {
      return (
        <ViewFrame
          title="World Diff"
          tone={WORLD_TONE}
          empty="No world diff — run `/world diff <refA> <refB>` to load both snapshots by ref"
        />
      );
    }
    const refA = str(store.viewArgs.refA, "—");
    const refB = str(store.viewArgs.refB, "—");
    return (
      <ViewFrame title="World Diff" tone={WORLD_TONE}>
        <DiffView leftLabel={refA} rightLabel={refB} left={left} right={right} />
      </ViewFrame>
    );
  }

  const data = worldDataFromRuntime(store.runtime);
  const snapshot = store.runtime.snapshot;

  if (data === null) {
    return (
      <ViewFrame
        title="CollaborationSnapshot Overview"
        tone={WORLD_TONE}
        empty={NO_RUNTIME_MESSAGE}
      />
    );
  }

  const output = renderWorldViewOutput(activeView, store.viewArgs, store.runtime);
  const title =
    activeView === "world"
      ? "CollaborationSnapshot Overview"
      : activeView.replace("world-", "").replaceAll("-", " ");

  const subtitle =
    `epoch=${snapshot?.epochId ?? "—"} snapshot=${snapshot?.snapshotRef ?? "—"} ` +
    `participants=${data.participants.length}`;

  return (
    <ViewFrame title={title} tone={WORLD_TONE} subtitle={subtitle}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function WorldViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "world",
    viewArgs: props.viewArgs ?? {},
  });
  return <WorldView store={store} />;
}
