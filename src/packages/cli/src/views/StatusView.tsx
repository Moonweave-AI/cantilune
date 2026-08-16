import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { AppStore } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame } from "./ViewFrame.js";
import { ProgressBar } from "../tui/ProgressBar.js";
import { formatHostCapabilityReport, isHostCapabilityReport } from "../wiring/hostCapabilities.js";

export interface ViewProps {
  readonly store: AppStore;
}

export function renderStatusViewOutput(store: AppStore): string {
  const maxTurns = store.maxTurns ?? 100;
  const rows: string[][] = [
    ["provider", store.provider],
    ["model", store.model],
    ["durable", store.durable],
    ["storage", store.durable === "file" ? (store.storagePath ?? "(unset)") : "in-memory (dev)"],
    ["connected", store.connected ? "yes" : "no"],
    ["agent", store.agentRunning ? "running" : "idle"],
    ["phase", store.phase.kind],
    ["turns", `${String(store.session.turnCount)}/${String(maxTurns)}`],
    ["tokens", String(store.session.tokenUsage.total)],
    ["messages", String(store.session.messages.length)],
  ];
  const host = store.viewArgs.host;
  if (isHostCapabilityReport(host)) {
    rows.push(
      ["host", host.ok ? "ready" : "fail-closed"],
      [
        "postgres",
        host.postgres.haReady
          ? "HA ready"
          : `not-ready ${host.postgres.host}:${String(host.postgres.port)}`,
      ],
      [
        "sandbox",
        host.sandbox.isolationReady
          ? `${host.sandbox.isolation} ready`
          : `not-ready (${host.sandbox.isolation})`,
      ],
    );
  }
  const table = renderTable(
    [
      { header: "Field", width: 14 },
      { header: "Value", width: 48 },
    ],
    rows,
  );
  if (!isHostCapabilityReport(host)) {
    return table;
  }
  return `${table}\n\n${formatHostCapabilityReport(host)}`;
}

export function StatusView({ store }: ViewProps): React.ReactElement {
  const output = useMemo(() => renderStatusViewOutput(store), [store]);
  const maxTurns = store.maxTurns ?? 100;
  const progress = maxTurns > 0 ? store.session.turnCount / maxTurns : 0;

  return (
    <ViewFrame title="Status" tone="info">
      <Text>{output}</Text>
      <Box marginTop={1}>
        <ProgressBar label="turns" progress={progress} width={24} />
      </Box>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
}

export default function StatusViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({ activeView: "status", viewArgs: props.viewArgs ?? {} });
  return <StatusView store={store} />;
}
