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

/**
 * Scheduler view: the queue, the ceiling, and the budget.
 *
 * This is the answer to "why is nothing happening". A pending agent's
 * `blockedBy` distinguishes the three reasons it is not running — its start
 * condition is unmet, the concurrency ceiling is full, or a budget is spent —
 * which are indistinguishable from the participant table alone.
 */
function scheduleView(status: SwarmControllerStatus | undefined): string {
  const scheduler = status?.scheduler;
  if (scheduler === undefined) {
    return "No scheduler — the swarm is not started. Run `/swarm start`.";
  }

  const { policy, budget } = scheduler;
  const budgetLine =
    budget.kind === "within_budget"
      ? "Budget: within limits"
      : `Budget: EXHAUSTED (${budget.limit}) — ${budget.detail}`;

  // `effectivePriority` already folds in anti-starvation aging, so it is the
  // number that actually decides order — showing the declared base priority
  // would mislead about why a long-queued agent jumped ahead.
  const queueRows = scheduler.pending.map((p) => [
    p.agentId as string,
    p.blockedBy,
    String(p.effectivePriority),
    String(p.evaluations),
  ]);

  const stallLine =
    scheduler.stallTicks > 0
      ? `Stall checks: ${scheduler.stallTicks}/${policy.stallTicksBeforeDeadlock} consecutive`
      : "Stall checks: none";

  return [
    `Running: ${scheduler.running}/${formatLimit(policy.maxConcurrentAgents)}` +
      `${scheduler.saturated ? "  (saturated — new work queues)" : ""}`,
    `Queued: ${scheduler.pending.length}`,
    `Started: ${scheduler.startedTotal}/${formatLimit(policy.maxTotalAgents)}  ·  ` +
      `Completed: ${scheduler.completedTotal}  ·  ` +
      `Turns: ${scheduler.consumedTurns}/${formatLimit(policy.maxTotalTurns)}`,
    `Elapsed: ${Math.round(scheduler.elapsedMs / 1000)}s/${formatLimit(policy.maxWallClockMs / 1000)}s`,
    budgetLine,
    stallLine,
    "",
    queueRows.length === 0
      ? "Queue is empty — every activated agent is running or finished."
      : renderTable(
          [
            { header: "Queued agent", width: 34 },
            { header: "Blocked by", width: 18 },
            { header: "Priority", width: 10 },
            { header: "Evals", width: 7 },
          ],
          queueRows,
        ),
  ].join("\n");
}

/** Render an unbounded limit as a symbol rather than `Infinity`. */
function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "∞";
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
    case "swarm-schedule":
      return scheduleView(swarmStatus);
    default:
      return overview(store, swarmStatus);
  }
}

const TITLES: Partial<Record<ViewType, string>> = {
  swarm: "Swarm — Overview",
  "swarm-status": "Swarm — Liveness",
  "swarm-schedule": "Swarm — Scheduler",
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
