import React, { useMemo } from "react";
import { Text } from "ink";
import type { AppStore, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { ViewFrame } from "./ViewFrame.js";
import { str } from "./viewStr.js";

export interface ViewProps {
  readonly store: AppStore;
}

export function renderMcpViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
): string {
  if (activeView === "mcp-connect") {
    const url = str(viewArgs["url"]);
    return [
      `Requested connection: ${url}`,
      "",
      "MCP servers are wired at boot time through BootConfig.tools, not from the TUI.",
      "To connect this server, add it to your boot configuration:",
      "",
      '  import { createMcpToolExecutor } from "@cantilune/tools";',
      "",
      "  bootFileOS(adapter, {",
      '    storagePath: "./.cantilune",',
      "    llm: config,",
      `    tools: [createMcpToolExecutor({ url: "${url}" })],`,
      "  });",
      "",
      "Runtime MCP attachment is not supported: tool availability is part of the",
      "admission schema, and changing it mid-run would invalidate the epoch.",
    ].join("\n");
  }

  return [
    "MCP server connections",
    "",
    "No servers attached to this session.",
    "",
    "MCP is provided by @cantilune/tools and injected at boot via BootConfig.tools.",
    "The TUI boots with a bare runtime (no external tools) so that runs stay",
    "reproducible; use a custom boot script to attach servers.",
    "",
    "Run /mcp connect <url> to see the wiring snippet for a specific server.",
  ].join("\n");
}

export function McpView({
  store,
  activeView,
}: ViewProps & { readonly activeView: ViewType }): React.ReactElement {
  const output = useMemo(
    () => renderMcpViewOutput(activeView, store.viewArgs),
    [activeView, store.viewArgs],
  );

  return (
    <ViewFrame
      title={activeView === "mcp-connect" ? "MCP — Connect" : "MCP — Servers"}
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

export default function McpViewContainer(props: ViewContainerProps): React.ReactElement {
  const activeView = props.activeView ?? "mcp";
  const store = useAppStore({ activeView, viewArgs: props.viewArgs ?? {} });
  return <McpView store={store} activeView={activeView} />;
}
