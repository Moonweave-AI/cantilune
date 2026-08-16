import React, { useMemo } from "react";
import { Text } from "ink";
import type { AppStore, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame } from "./ViewFrame.js";
import { str } from "./viewStr.js";

export interface ViewProps {
  readonly store: AppStore;
}

const BUILTIN_TOOLS: readonly { name: string; kind: string; description: string }[] = [
  { name: "done", kind: "loop", description: "Declare the task complete" },
  { name: "read_content", kind: "content", description: "Read a content-addressed blob" },
  { name: "write_content", kind: "content", description: "Store a blob, returns a ContentRef" },
  { name: "introduce_artifact", kind: "coordination", description: "Introduce a work artifact" },
  { name: "publish_artifact", kind: "coordination", description: "Publish a work artifact" },
  { name: "delegate", kind: "coordination", description: "Delegate a task to a participant" },
  { name: "create_session", kind: "coordination", description: "Open a communication session" },
  { name: "fork_branch", kind: "coordination", description: "Open a parallel branch" },
  { name: "transfer_session", kind: "coordination", description: "Transfer session control" },
  { name: "register_participant", kind: "cluster", description: "Register a new agent" },
  { name: "retire_participant", kind: "cluster", description: "Retire a participant" },
  { name: "signal_done", kind: "cluster", description: "Signal this agent finished" },
  { name: "emit_heartbeat", kind: "cluster", description: "Prove agent liveness" },
];

interface InjectedToolRow {
  readonly name: string;
  readonly description: string;
}

function readInjected(viewArgs: Record<string, unknown>): readonly InjectedToolRow[] {
  const raw = viewArgs["injectedTools"];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is InjectedToolRow =>
      typeof row === "object" &&
      row !== null &&
      typeof (row as InjectedToolRow).name === "string",
  );
}

export function renderToolsViewOutput(
  activeView: ViewType,
  store: AppStore,
  viewArgs: Record<string, unknown>,
): string {
  const injected = readInjected(viewArgs);
  if (activeView === "tools-test") {
    const name = str(viewArgs["name"]);
    const known = BUILTIN_TOOLS.find((tool) => tool.name === name);
    const injectedHit = injected.find((tool) => tool.name === name);
    if (known === undefined && injectedHit === undefined) {
      return [
        `Unknown tool: ${name}`,
        "",
        "Available builtin tools:",
        ...BUILTIN_TOOLS.map((tool) => `  ${tool.name}`),
        ...(injected.length > 0
          ? ["", "Injected tools:", ...injected.map((tool) => `  ${tool.name}`)]
          : []),
      ].join("\n");
    }
    if (injectedHit !== undefined) {
      return [
        `Tool: ${injectedHit.name}`,
        `Kind: injected`,
        `Description: ${injectedHit.description}`,
        "",
        "Dry-run: schema listed only. Side effects are refused (no execute).",
      ].join("\n");
    }
    return [
      `Tool: ${known!.name}`,
      `Kind: ${known!.kind}`,
      `Description: ${known!.description}`,
      "",
      known!.kind === "coordination" || known!.kind === "cluster"
        ? "Dry-run: this operation goes through runtime admission; it is rejected unless the\ncurrent principal holds the required role bindings."
        : "Dry-run: this operation is handled directly by the agent loop.",
    ].join("\n");
  }

  const external = store.connected ? "runtime connected" : "not connected";
  return [
    `Builtin tools (${BUILTIN_TOOLS.length}) — ${external}`,
    "",
    renderTable(
      [
        { header: "Tool", width: 22 },
        { header: "Kind", width: 14 },
        { header: "Description", width: 44 },
      ],
      BUILTIN_TOOLS.map((tool) => [tool.name, tool.kind, tool.description]),
    ),
    "",
    injected.length === 0
      ? "No injected tools yet (filesystem/shell/web attach at boot via createToolSet)."
      : [
          `Injected tools (${injected.length})`,
          ...injected.map((tool) => `  ${tool.name} — ${tool.description}`),
        ].join("\n"),
  ].join("\n");
}

export function ToolsView({
  store,
  activeView,
}: ViewProps & { readonly activeView: ViewType }): React.ReactElement {
  const output = useMemo(
    () => renderToolsViewOutput(activeView, store, store.viewArgs),
    [activeView, store],
  );

  return (
    <ViewFrame
      title={activeView === "tools-test" ? "Tools — Dry Run" : "Tools — Registry"}
      tone="accent"
    >
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function ToolsViewContainer(props: ViewContainerProps): React.ReactElement {
  const activeView = props.activeView ?? "tools";
  const store = useAppStore({ activeView, viewArgs: props.viewArgs ?? {} });
  return <ToolsView store={store} activeView={activeView} />;
}
