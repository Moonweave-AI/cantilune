import React from "react";
import { Text } from "ink";
import { ViewFrame } from "./ViewFrame.js";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { str } from "./viewStr.js";
import { buildExportBody } from "../wiring/exportControl.js";

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

export function renderExportViewOutput(
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const target = str(viewArgs.target, "graph");
  const formats = EXPORT_TARGETS[target] ?? ["json"];
  const format = str(viewArgs.format, formats[0] ?? "json");
  const writtenPath = typeof viewArgs.writtenPath === "string" ? viewArgs.writtenPath : undefined;
  const error = typeof viewArgs.error === "string" ? viewArgs.error : undefined;
  const prefetchedBody = typeof viewArgs.body === "string" ? viewArgs.body : undefined;
  const computed =
    prefetchedBody === undefined && error === undefined
      ? buildExportBody(
          target,
          format,
          runtime,
          undefined,
          typeof viewArgs.ref === "string" ? viewArgs.ref : undefined,
        )
      : undefined;
  const body = prefetchedBody ?? (computed?.ok === true ? computed.body : undefined);
  const computeError = computed !== undefined && !computed.ok ? computed.message : undefined;

  const formatList = renderTable(
    [
      { header: "Target", width: 12 },
      { header: "Formats", width: 36 },
    ],
    Object.entries(EXPORT_TARGETS).map(([key, values]) => [key, values.join(", ")]),
  );

  if (error !== undefined || computeError !== undefined) {
    return [formatList, "", `Export failed: ${error ?? computeError}`].join("\n");
  }

  if (runtime.snapshot === null && runtime.changeLog.length === 0 && body === undefined) {
    return [formatList, "", NO_RUNTIME_MESSAGE].join("\n");
  }

  const lines = [
    formatList,
    "",
    `Export: ${target} (${format})`,
    writtenPath !== undefined ? `Wrote ${writtenPath}` : "Not written — no storagePath",
    "─".repeat(40),
    body ?? "",
  ];
  return lines.join("\n");
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
