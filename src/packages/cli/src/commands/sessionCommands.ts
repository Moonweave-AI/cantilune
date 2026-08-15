import type { SlashCommand, CommandCategory } from "./registry.js";
import { createEmptySession } from "../store.js";

export function registerSessionCommands(): SlashCommand[] {
  const session = "session" as CommandCategory;
  const help = "help" as CommandCategory;
  return [
    {
      name: "/compact",
      description: "Compact session context (summarize older turns)",
      category: session,
      handler: (_args, store) => {
        store.viewArgs = { action: "compact" };
      },
    },
    {
      name: "/clear",
      description: "Clear chat messages and reset turn count",
      category: session,
      handler: async (_args, store, services) => {
        // The transcript and the model's private message history form one
        // session boundary.  Clearing only the visible transcript would leave
        // the cached OS able to recall messages the user explicitly removed.
        await services?.resetRuntime?.("clear");
        store.session = createEmptySession();
        store.mode = "chat";
        store.activeView = null;
      },
    },
    {
      name: "/session save",
      description: "Save session to named slot",
      category: session,
      args: [{ name: "name", description: "Session slot name", required: true, type: "string" }],
      handler: (args, store) => {
        store.viewArgs = { action: "session-save", ...args };
      },
    },
    {
      name: "/session load",
      description: "Load session from named slot",
      category: session,
      args: [{ name: "name", description: "Session slot name", required: true, type: "string" }],
      handler: (args, store) => {
        store.viewArgs = { action: "session-load", ...args };
      },
    },
    {
      name: "/session list",
      description: "List saved session slots",
      category: session,
      handler: (_args, store) => {
        store.mode = "view";
        store.viewArgs = { action: "session-list" };
      },
    },
    {
      name: "/status",
      description: "Show runtime connection + agent status",
      category: session,
      handler: (_args, store) => {
        store.viewArgs = {
          action: "status",
          provider: store.provider,
          model: store.model,
          connected: store.connected,
          agentRunning: store.agentRunning,
          turnCount: store.session.turnCount,
        };
      },
    },
    {
      name: "/help",
      aliases: ["/h"],
      description: "Show help overview",
      category: help,
      handler: (_args, store) => {
        store.mode = "view";
        store.activeView = "help";
      },
    },
    {
      name: "/help command",
      description: "Show help for a specific command",
      category: help,
      args: [
        {
          name: "command",
          description: "Command name (e.g. /world)",
          required: true,
          type: "string",
        },
      ],
      handler: (args, store) => {
        store.mode = "view";
        store.activeView = "help";
        store.viewArgs = args;
      },
    },
    {
      name: "/quit",
      aliases: ["/exit", "/q"],
      description: "Quit Cantilune CLI",
      category: session,
      handler: (_args, store) => {
        store.mode = "confirm";
        store.viewArgs = { action: "quit", message: "Quit Cantilune?" };
      },
    },
  ];
}
