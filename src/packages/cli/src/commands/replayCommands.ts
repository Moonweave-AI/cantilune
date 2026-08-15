import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

function openView(view: ViewType) {
  return (args: Record<string, unknown>, store: AppStore): void => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = args;
  };
}

export function registerReplayCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/replay from",
      description: "Replay from snapshot ref",
      category: view,
      args: [
        { name: "ref", description: "Snapshot ref to replay from", required: true, type: "string" },
      ],
      handler: openView("replay"),
    },
    {
      name: "/replay recipe",
      description: "Show replay recipe for change id",
      category: view,
      args: [
        { name: "changeId", description: "Change identifier", required: true, type: "string" },
      ],
      handler: openView("replay-recipe"),
    },
    {
      name: "/replay bundle",
      description: "Show bundled replay manifest",
      category: view,
      handler: openView("replay-bundle"),
    },
  ];
}
