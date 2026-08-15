import React, { useMemo } from "react";
import { Text } from "ink";
import { ViewFrame } from "./ViewFrame.js";
import { createFullCommandRegistry } from "../commands/fullRegistry.js";
import type { SlashCommand } from "../commands/registry.js";
import type { AppStore } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { str } from "./viewStr.js";

export interface ViewProps {
  readonly store: AppStore;
}

function filterCommands(
  commands: readonly SlashCommand[],
  query: string | undefined,
): readonly SlashCommand[] {
  if (query === undefined || query.trim().length === 0) {
    return commands;
  }
  const normalized = query.startsWith("/") ? query : `/${query}`;
  const exact = commands.find((command) => command.name === normalized);
  if (exact !== undefined) {
    return [exact];
  }
  const lower = normalized.toLowerCase();
  return commands.filter(
    (command) =>
      command.name.toLowerCase().includes(lower) ||
      (command.aliases ?? []).some((alias) => alias.toLowerCase().includes(lower)),
  );
}

function formatCommandHelp(command: SlashCommand): string {
  const aliasText =
    command.aliases !== undefined && command.aliases.length > 0
      ? ` (${command.aliases.join(", ")})`
      : "";
  const argLines =
    command.args?.map(
      (arg) => `  ${arg.required ? "*" : ""}${arg.name} (${arg.type}): ${arg.description}`,
    ) ?? [];
  return [
    `${command.name}${aliasText}`,
    `  ${command.description}`,
    `  category: ${command.category}`,
    ...argLines,
  ].join("\n");
}

export function renderHelpViewOutput(viewArgs: Record<string, unknown>): string {
  const registry = createFullCommandRegistry();
  const commands = registry
    .getAll()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const filtered = filterCommands(commands, viewArgs.command as string | undefined);

  if (filtered.length === 1 && viewArgs.command !== undefined) {
    return formatCommandHelp(filtered[0]!);
  }

  const overview = renderTable(
    [
      { header: "Command", width: 22 },
      { header: "Category", width: 12 },
      { header: "Description", width: 40 },
    ],
    filtered.map((command) => [command.name, command.category, command.description]),
  );

  return ["Cantilune CLI slash commands", "", overview].join("\n");
}

export function HelpView({ store }: ViewProps): React.ReactElement {
  const output = useMemo(() => renderHelpViewOutput(store.viewArgs), [store.viewArgs]);
  const title =
    store.viewArgs.command !== undefined
      ? `Help — ${str(store.viewArgs.command)}`
      : "Help — Slash Commands";

  return (
    <ViewFrame title={title} tone="warning">
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
}

export default function HelpViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: "help",
    viewArgs: props.viewArgs ?? {},
  });
  return <HelpView store={store} />;
}
