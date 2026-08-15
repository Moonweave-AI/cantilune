import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

function openView(view: ViewType, extra: Record<string, unknown> = {}) {
  return (args: Record<string, unknown>, store: AppStore): void => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = { ...extra, ...args };
  };
}

export function registerWorldCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/world",
      description:
        "Show current world state: participants + artifacts + sessions + capabilities + links",
      category: view,
      handler: openView("world"),
    },
    {
      name: "/world actors",
      description: "List participants + status + kind",
      category: view,
      handler: openView("world-actors"),
    },
    {
      name: "/world tasks",
      description: "List work artifacts + lifecycle",
      category: view,
      handler: openView("world-tasks"),
    },
    {
      name: "/world sessions",
      description: "List active coordination sessions",
      category: view,
      handler: openView("world-sessions"),
    },
    {
      name: "/world caps",
      description: "List capabilities + holders",
      category: view,
      handler: openView("world-caps"),
    },
    {
      name: "/world links",
      description: "List artifact links + wiring",
      category: view,
      handler: openView("world-links"),
    },
    {
      name: "/world diff",
      description: "Diff two snapshot refs",
      category: view,
      args: [
        { name: "refA", description: "Before snapshot ref", required: false, type: "string" },
        { name: "refB", description: "After snapshot ref", required: false, type: "string" },
      ],
      handler: openView("world-diff"),
    },
    {
      name: "/world retired",
      description: "List retired participants and artifacts",
      category: view,
      handler: openView("world-retired"),
    },
  ];
}
