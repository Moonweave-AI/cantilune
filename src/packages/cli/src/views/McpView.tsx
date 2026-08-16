import React, { useMemo } from "react";
import { Text } from "ink";
import type { AppStore, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { ViewFrame } from "./ViewFrame.js";
import { str } from "./viewStr.js";
import { parseMcpServerSpec } from "../wiring/cliToolSet.js";

export interface ViewProps {
  readonly store: AppStore;
}

export function renderMcpViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  mcpServers: readonly string[] | undefined = undefined,
): string {
  if (activeView === "mcp-connect") {
    const spec = str(viewArgs["url"]);
    const parsed = parseMcpServerSpec(spec);
    if (parsed.rejected !== undefined) {
      return [`Requested: ${spec}`, "", `Rejected: ${parsed.rejected}`].join("\n");
    }
    const transport =
      parsed.config?.command.startsWith("http://") === true ||
      parsed.config?.command.startsWith("https://") === true
        ? "HTTP"
        : "stdio";
    return [
      `Requested ${transport} MCP: ${parsed.config?.name} → ${parsed.config?.command}`,
      "",
      viewArgs.scheduled === true
        ? "Wrote CliConfig.mcpServers and scheduled epoch-bound attach after the current turn."
        : viewArgs.persisted === true
          ? "Wrote CliConfig.mcpServers."
          : "Call /mcp connect from the TUI to persist and schedule attach.",
    ].join("\n");
  }

  if (activeView === "mcp-disconnect") {
    const name = str(viewArgs["name"]);
    if (viewArgs.error !== undefined) {
      return [`Disconnect ${name}`, "", `Rejected: ${str(viewArgs["error"])}`].join("\n");
    }
    return [
      `Disconnect ${name}`,
      "",
      viewArgs.scheduled === true
        ? "Scheduled epoch-bound detach after the current turn. The in-flight turn keeps the old tool surface."
        : "Call /mcp disconnect <name> to schedule detach.",
    ].join("\n");
  }

  const servers = mcpServers ?? [];
  if (servers.length === 0) {
    return [
      "MCP server connections",
      "",
      "No servers in CliConfig.mcpServers.",
      "Use /mcp connect <name=command args> or an http(s) URL to persist a server and schedule attach.",
      "Hot-attach is epoch-bound: the current turn keeps the old tool surface.",
    ].join("\n");
  }

  return [
    "MCP server connections (from CliConfig; hot-attach is epoch-bound)",
    "",
    ...servers.map((spec) => {
      const parsed = parseMcpServerSpec(spec);
      if (parsed.rejected !== undefined) {
        return `  ${spec} — rejected: ${parsed.rejected}`;
      }
      const transport =
        parsed.config?.command.startsWith("http://") === true ||
        parsed.config?.command.startsWith("https://") === true
          ? "http"
          : "stdio";
      return `  ${parsed.config?.name} ${transport} ${parsed.config?.command}`;
    }),
  ].join("\n");
}

export function McpView({
  store,
  activeView,
}: ViewProps & { readonly activeView: ViewType }): React.ReactElement {
  const output = useMemo(
    () => renderMcpViewOutput(activeView, store.viewArgs, store.mcpServers),
    [activeView, store],
  );

  const title =
    activeView === "mcp-connect"
      ? "MCP — Connect"
      : activeView === "mcp-disconnect"
        ? "MCP — Disconnect"
        : "MCP — Servers";

  return (
    <ViewFrame title={title} tone="accent">
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
