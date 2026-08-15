import React, { useMemo } from "react";
import { Text } from "ink";
import type { AppStore, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame } from "./ViewFrame.js";
import type { SwarmControllerStatus } from "../wiring/swarmControl.js";

export interface ViewProps {
  readonly store: AppStore;
}

function readSwarmStatus(
  viewArgs: Record<string, unknown> | undefined,
): SwarmControllerStatus | undefined {
  const status = viewArgs?.["swarmStatus"];
  if (
    status !== undefined &&
    typeof status === "object" &&
    status !== null &&
    "running" in status &&
    "events" in status
  ) {
    return status as SwarmControllerStatus;
  }
  return undefined;
}

/** One-line supervisor status for the swarm overview. */
function swarmLineFor(status: SwarmControllerStatus | undefined): string {
  if (status === undefined) {
    return "Swarm: not connected (start an agent loop, then /swarm start)";
  }
  if (status.running) {
    return "Swarm: running (CantilunOS pool draining trusted-change feed)";
  }
  return "Swarm: stopped";
}

function overview(store: AppStore, status: SwarmControllerStatus | undefined): string {
  const snapshot = store.runtime.snapshot;
  if (snapshot === null) {
    return "No runtime connected — start an agent run to populate swarm state.";
  }

  const rows = snapshot.participants.map((p) => {
    const changes = store.runtime.changeLog.filter((c) => c.initiator === p.id).length;
    return [p.id, p.kind, p.status, String(changes)];
  });

  const live = snapshot.participants.filter((p) => p.status === "active").length;

  const swarmLine = swarmLineFor(status);
  let poolLine: string;
  if (status !== undefined) {
    const plural = status.agents.size === 1 ? "" : "s";
    poolLine = `Agent pool: ${status.agents.size} active handle${plural}`;
  } else {
    poolLine = "Agent pool: 0 active handles (swarm not started)";
  }

  return [
    `Participants: ${snapshot.participants.length} total, ${live} active`,
    `Changes: ${store.runtime.changeLog.length}`,
    swarmLine,
    poolLine,
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

function statusView(store: AppStore, status: SwarmControllerStatus | undefined): string {
  const snapshot = store.runtime.snapshot;
  if (snapshot === null) return "No runtime connected.";

  const heartbeats = store.runtime.changeLog.filter((c) => c.operationTypeId === "emit_heartbeat");
  const dones = store.runtime.changeLog.filter((c) => c.operationTypeId === "signal_done");

  const rows = snapshot.participants.map((p) => {
    const own = heartbeats.filter((h) => h.initiator === p.id);
    return [p.id, p.status, String(own.length), own.at(-1)?.timestamp ?? "—"];
  });

  const swarmLines =
    status === undefined
      ? []
      : [
          "",
          `Swarm events (${status.events.length}): ${status.running ? "running" : "stopped"}`,
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
    `Heartbeats: ${heartbeats.length}  ·  Done signals: ${dones.length}`,
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
    ...swarmLines,
  ].join("\n");
}

export function renderSwarmViewOutput(
  activeView: ViewType,
  store: AppStore,
  viewArgs?: Record<string, unknown>,
): string {
  const swarmStatus = readSwarmStatus(viewArgs);
  switch (activeView) {
    case "swarm-status":
      return statusView(store, swarmStatus);
    default:
      return overview(store, swarmStatus);
  }
}

const TITLES: Partial<Record<ViewType, string>> = {
  swarm: "Swarm — Overview",
  "swarm-status": "Swarm — Liveness",
};

export function SwarmView({
  store,
  activeView,
  viewArgs,
}: ViewProps & {
  readonly activeView: ViewType;
  readonly viewArgs?: Record<string, unknown>;
}): React.ReactElement {
  const output = useMemo(
    () => renderSwarmViewOutput(activeView, store, viewArgs),
    [activeView, store, viewArgs],
  );

  return (
    <ViewFrame title={TITLES[activeView] ?? "Swarm"} tone="accentAlt">
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function SwarmViewContainer(props: ViewContainerProps): React.ReactElement {
  const activeView = props.activeView ?? "swarm";
  const store = useAppStore({ activeView, viewArgs: props.viewArgs ?? {} });
  return <SwarmView store={store} activeView={activeView} viewArgs={props.viewArgs ?? {}} />;
}
