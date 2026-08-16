import type { SlashCommand, CommandCategory } from "./registry.js";
import { createEmptySession } from "../store.js";
import {
  compactSession,
  listSessionSlots,
  loadSessionSlot,
  saveSessionSlot,
} from "../session/sessionSlots.js";
import { probeHostCapabilities } from "../wiring/hostCapabilities.js";

function storageRoot(store: { storagePath: string | undefined }): string {
  return store.storagePath ?? "./.cantilune/os";
}

function slotName(args: Record<string, unknown>): string {
  const value = args.name;
  return typeof value === "string" ? value : "";
}

function compactNoticeText(dropped: number, summary: string | undefined): string {
  if (dropped === 0) {
    return "Nothing to compact";
  }
  if (summary !== undefined) {
    return `Compacted ${String(dropped)} earlier messages (LLM summary)`;
  }
  return `Compacted ${String(dropped)} earlier messages (omitted, not summarized)`;
}

export function registerSessionCommands(): SlashCommand[] {
  const session = "session" as CommandCategory;
  const help = "help" as CommandCategory;
  return [
    {
      name: "/compact",
      description: "Compact session context (summarize older turns)",
      category: session,
      handler: async (_args, store, services) => {
        const dropped = store.session.messages.slice(
          0,
          Math.max(0, store.session.messages.length - 8),
        );
        const canSummarize =
          (store.contractModel !== undefined || store.judgeModel !== undefined) &&
          services?.summarizeCompact !== undefined;
        let summary: string | undefined;
        if (canSummarize && dropped.length > 0) {
          const text = dropped.map((message) => `${message.role}: ${message.content}`).join("\n");
          summary = await services.summarizeCompact?.(text);
        }
        const result = compactSession(store.session, 8, summary);
        store.session = result.session;
        store.mode = "chat";
        store.activeView = null;
        store.notice = {
          level: "info",
          text: compactNoticeText(result.dropped, summary),
        };
        services?.notify?.("info", store.notice.text);
      },
    },
    {
      name: "/clear",
      description: "Clear chat messages and reset turn count",
      category: session,
      handler: async (_args, store, services) => {
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
      handler: (args, store, services) => {
        const name = slotName(args);
        try {
          const meta = saveSessionSlot(storageRoot(store), name, store.session);
          store.notice = { level: "info", text: `Saved session slot "${meta.name}"` };
          services?.notify?.("info", store.notice.text);
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          store.notice = { level: "error", text };
          services?.notify?.("error", text);
        }
      },
    },
    {
      name: "/session load",
      description: "Load session from named slot",
      category: session,
      args: [{ name: "name", description: "Session slot name", required: true, type: "string" }],
      handler: (args, store, services) => {
        const name = slotName(args);
        try {
          const loaded = loadSessionSlot(storageRoot(store), name);
          if (loaded === undefined) {
            store.notice = { level: "error", text: `Session slot "${name}" not found` };
            services?.notify?.("error", store.notice.text);
            return;
          }
          store.session = loaded;
          store.mode = "chat";
          store.activeView = null;
          store.notice = { level: "info", text: `Loaded session slot "${name}"` };
          services?.notify?.("info", store.notice.text);
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          store.notice = { level: "error", text };
          services?.notify?.("error", text);
        }
      },
    },
    {
      name: "/session list",
      description: "List saved session slots",
      category: session,
      handler: (_args, store) => {
        const slots = listSessionSlots(storageRoot(store));
        store.mode = "view";
        store.activeView = "session-list";
        store.viewArgs = { action: "session-list", slots };
      },
    },
    {
      name: "/status",
      description: "Show runtime connection + agent status",
      category: session,
      handler: async (_args, store, services) => {
        const host = await (services?.probeHost ?? probeHostCapabilities)();
        store.mode = "view";
        store.activeView = "status";
        store.viewArgs = {
          action: "status",
          provider: store.provider,
          model: store.model,
          connected: store.connected,
          agentRunning: store.agentRunning,
          turnCount: store.session.turnCount,
          durable: store.durable,
          host,
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
