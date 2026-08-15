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

/**
 * Builtin syscall operations the agent loop always exposes, independent of any
 * external tool wiring. Mirrors `DEFAULT_TEMPLATES` plus the loop's own tools.
 */
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

export function renderToolsViewOutput(
  activeView: ViewType,
  store: AppStore,
  viewArgs: Record<string, unknown>,
): string {
  if (activeView === "tools-test") {
    const name = str(viewArgs["name"]);
    const known = BUILTIN_TOOLS.find((tool) => tool.name === name);
    if (known === undefined) {
      return [
        `Unknown tool: ${name}`,
        "",
        "Available builtin tools:",
        ...BUILTIN_TOOLS.map((tool) => `  ${tool.name}`),
      ].join("\n");
    }
    return [
      `Tool: ${known.name}`,
      `Kind: ${known.kind}`,
      `Description: ${known.description}`,
      "",
      known.kind === "coordination" || known.kind === "cluster"
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
    "External tools (filesystem/shell/web/mcp) are supplied via BootConfig.tools.",
    "Use /mcp to inspect MCP server connections.",
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
      tone="info"
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
