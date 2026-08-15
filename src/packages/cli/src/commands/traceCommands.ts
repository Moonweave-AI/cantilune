import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

function openView(view: ViewType) {
  return (args: Record<string, unknown>, store: AppStore): void => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = args;
  };
}

export function registerTraceCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/trace",
      description: "Show recent coordination trace (last 50 commits)",
      category: view,
      args: [
        { name: "since", description: "Start from snapshot ref", required: false, type: "string" },
      ],
      handler: openView("trace"),
    },
    {
      name: "/trace obs",
      description: "Observation entries only",
      category: view,
      handler: openView("trace-obs"),
    },
    {
      name: "/trace rewrites",
      description: "Rewrite / admit decisions only",
      category: view,
      handler: openView("trace-rewrites"),
    },
    {
      name: "/trace search",
      description: "Search trace by keyword",
      category: view,
      args: [{ name: "keyword", description: "Search keyword", required: true, type: "string" }],
      handler: openView("trace-search"),
    },
    {
      name: "/trace validate",
      description: "Validate trace integrity + replay chain",
      category: view,
      handler: openView("trace-validate"),
    },
  ];
}
