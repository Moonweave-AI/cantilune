import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

function openView(view: ViewType) {
  return (args: Record<string, unknown>, store: AppStore): void => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = args;
  };
}

export function registerObserveCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/observe",
      description: "Four-view bundle summary (dependency/resource/communication/structure)",
      category: view,
      handler: openView("observe"),
    },
    {
      name: "/observe dependency",
      description: "Dependency directed graph lens",
      category: view,
      handler: openView("observe-dependency"),
    },
    {
      name: "/observe resource",
      description: "Resource allocation matrix lens",
      category: view,
      handler: openView("observe-resource"),
    },
    {
      name: "/observe communication",
      description: "Communication network lens",
      category: view,
      handler: openView("observe-communication"),
    },
    {
      name: "/observe structure",
      description: "Structure bipartite graph lens",
      category: view,
      handler: openView("observe-structure"),
    },
    {
      name: "/observe spine",
      description: "EventSpine timeline (commit trajectory)",
      category: view,
      handler: openView("observe-spine"),
    },
    {
      name: "/observe diagnostic",
      description: "Cross-lens diagnostic panel",
      category: view,
      handler: openView("observe-diagnostic"),
    },
  ];
}
