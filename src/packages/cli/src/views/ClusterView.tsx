import React, { useMemo } from "react";
import { Text } from "ink";
import type { AppStore, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame } from "./ViewFrame.js";
import type { ClusterStatus } from "../wiring/clusterControl.js";

export interface ViewProps {
  readonly store: AppStore;
}

/** Participant statuses that mean an agent is still occupying the cluster. */
const LIVE_STATUSES = new Set(["active", "registered", "waiting"]);

function readClusterStatus(
  viewArgs: Record<string, unknown> | undefined,
): ClusterStatus | undefined {
  const status = viewArgs?.["clusterStatus"];
  if (
    status !== undefined &&
    typeof status === "object" &&
    status !== null &&
    "running" in status &&
    "events" in status
  ) {
    return status as ClusterStatus;
  }
  return undefined;
}

/** One-line supervisor status for the cluster overview. */
function supervisorLineFor(status: ClusterStatus | undefined): string {
  if (status === undefined) {
    return "Supervisor: not connected (start an agent loop, then /cluster start)";
  }
  if (status.running) {
    return "Supervisor: running (draining trusted-change feed)";
  }
  return "Supervisor: stopped";
}

function overview(store: AppStore, status: ClusterStatus | undefined): string {
  const snapshot = store.runtime.snapshot;
  if (snapshot === null) {
    return "No runtime connected — start an agent run to populate cluster state.";
  }

  const rows = snapshot.participants.map((p) => {
    const changes = store.runtime.changeLog.filter((c) => c.initiator === p.id).length;
    return [p.id, p.kind, p.status, String(changes)];
  });

  const live = snapshot.participants.filter((p) => LIVE_STATUSES.has(p.status)).length;

  const supervisorLine = supervisorLineFor(status);

  return [
    `Agents: ${snapshot.participants.length} total, ${live} live`,
    `Changes: ${store.runtime.changeLog.length}`,
    supervisorLine,
    "",
    renderTable(
      [
        { header: "Agent", width: 34 },
        { header: "Kind", width: 10 },
        { header: "Status", width: 12 },
        { header: "Changes", width: 9 },
      ],
      rows,
    ),
  ].join("\n");
}

function status(store: AppStore, status: ClusterStatus | undefined): string {
  const snapshot = store.runtime.snapshot;
  if (snapshot === null) return "No runtime connected.";

  const heartbeats = store.runtime.changeLog.filter((c) => c.operationTypeId === "emit_heartbeat");
  const registrations = store.runtime.changeLog.filter(
    (c) => c.operationTypeId === "register_participant",
  );
  const dones = store.runtime.changeLog.filter((c) => c.operationTypeId === "signal_done");

  const rows = snapshot.participants.map((p) => {
    const own = heartbeats.filter((h) => h.initiator === p.id);
    return [p.id, p.status, String(own.length), own.at(-1)?.timestamp ?? "—"];
  });

  const supervisorLines =
    status === undefined
      ? []
      : [
          "",
          `Supervisor events (${status.events.length}): ${status.running ? "running" : "stopped"}`,
          ...(status.events.length === 0
            ? ["  (no events yet)"]
            : status.events
                .slice(-8)
                .map(
                  (e) =>
                    `  ${e.kind}${e.actorId !== undefined ? ` ${e.actorId}` : ""}${
                      e.summary !== undefined ? ` — ${e.summary}` : ""
                    }`,
                )),
        ];

  return [
    `Registrations: ${registrations.length}  ·  Heartbeats: ${heartbeats.length}  ·  Done signals: ${dones.length}`,
    "",
    renderTable(
      [
        { header: "Agent", width: 34 },
        { header: "Status", width: 12 },
        { header: "Beats", width: 7 },
        { header: "Last heartbeat", width: 26 },
      ],
      rows,
    ),
    ...supervisorLines,
  ].join("\n");
}

function topology(store: AppStore, _status: ClusterStatus | undefined): string {
  const snapshot = store.runtime.snapshot;
  if (snapshot === null) return "No runtime connected.";

  if (snapshot.links.length === 0 && snapshot.sessions.length === 0) {
    return [
      `Participants: ${snapshot.participants.length}`,
      "",
      "No links or sessions yet — the cluster is a flat peer set.",
      ...snapshot.participants.map((p) => `  ${p.id} [${p.status}]`),
    ].join("\n");
  }

  const linkRows = snapshot.links.map((l) => [l.from, "→", l.to, l.kind]);
  const sessionRows = snapshot.sessions.map((s) => [s.id, s.initiator, s.status]);

  return [
    `Links (${snapshot.links.length})`,
    renderTable(
      [
        { header: "From", width: 26 },
        { header: "", width: 3 },
        { header: "To", width: 26 },
        { header: "Kind", width: 14 },
      ],
      linkRows,
    ),
    "",
    `Sessions (${snapshot.sessions.length})`,
    renderTable(
      [
        { header: "Session", width: 30 },
        { header: "Controller", width: 26 },
        { header: "Visibility", width: 14 },
      ],
      sessionRows,
    ),
  ].join("\n");
}

export function renderClusterViewOutput(
  activeView: ViewType,
  store: AppStore,
  viewArgs?: Record<string, unknown>,
): string {
  const clusterStatus = readClusterStatus(viewArgs);
  switch (activeView) {
    case "cluster-status":
      return status(store, clusterStatus);
    case "cluster-topology":
      return topology(store, clusterStatus);
    default:
      return overview(store, clusterStatus);
  }
}

const TITLES: Partial<Record<ViewType, string>> = {
  cluster: "Cluster — Overview",
  "cluster-status": "Cluster — Liveness",
  "cluster-topology": "Cluster — Topology",
};

export function ClusterView({
  store,
  activeView,
  viewArgs,
}: ViewProps & {
  readonly activeView: ViewType;
  readonly viewArgs?: Record<string, unknown>;
}): React.ReactElement {
  const output = useMemo(
    () => renderClusterViewOutput(activeView, store, viewArgs),
    [activeView, store, viewArgs],
  );

  return (
    <ViewFrame title={TITLES[activeView] ?? "Cluster"} tone="accentAlt">
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function ClusterViewContainer(props: ViewContainerProps): React.ReactElement {
  const activeView = props.activeView ?? "cluster";
  const store = useAppStore({ activeView, viewArgs: props.viewArgs ?? {} });
  return <ClusterView store={store} activeView={activeView} viewArgs={props.viewArgs ?? {}} />;
}
