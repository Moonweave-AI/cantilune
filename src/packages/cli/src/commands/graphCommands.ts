import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

function openView(view: ViewType) {
  return (args: Record<string, unknown>, store: AppStore): void => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = args;
  };
}

export function registerGraphCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/graph",
      description: "Show coordination DAG (changes + dependencies)",
      category: view,
      args: [
        { name: "depth", description: "Max traversal depth", required: false, type: "number" },
        { name: "actor", description: "Filter by actor id", required: false, type: "string" },
        { name: "op", description: "Filter by operation type", required: false, type: "string" },
      ],
      handler: openView("graph"),
    },
    {
      name: "/graph path",
      description: "Shortest path between two change refs",
      category: view,
      args: [
        { name: "refA", description: "Source change ref", required: true, type: "string" },
        { name: "refB", description: "Target change ref", required: true, type: "string" },
      ],
      handler: openView("graph-path"),
    },
    {
      name: "/graph forks",
      description: "List fork points in the change DAG",
      category: view,
      handler: openView("graph-forks"),
    },
    {
      name: "/graph stats",
      description: "DAG statistics (nodes, edges, depth, branches)",
      category: view,
      handler: openView("graph-stats"),
    },
  ];
}
