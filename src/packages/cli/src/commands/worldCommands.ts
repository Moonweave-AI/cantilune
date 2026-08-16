import type { SlashCommand, CommandCategory, CommandServices } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";
import { diffSnapshotsByRef } from "../wiring/worldDiff.js";

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
      description: "Diff two snapshot refs (loads each from durable store)",
      category: view,
      args: [
        { name: "refA", description: "Before snapshot ref", required: false, type: "string" },
        { name: "refB", description: "After snapshot ref", required: false, type: "string" },
      ],
      handler(args, store, services: CommandServices | undefined) {
        const getSnapshot = services?.getSnapshot;
        if (getSnapshot === undefined) {
          openView("world-diff", {
            worldDiffError: "no runtime connected — cannot load snapshots by ref",
          })(args, store);
          return;
        }
        const result = diffSnapshotsByRef(
          {
            getSnapshot,
            headRef: () => services?.headSnapshotRef?.(),
          },
          {
            ...(typeof args.refA === "string" ? { refA: args.refA } : {}),
            ...(typeof args.refB === "string" ? { refB: args.refB } : {}),
          },
        );
        if (!result.ok) {
          openView("world-diff", { worldDiffError: result.message })(args, store);
          return;
        }
        openView("world-diff", {
          refA: result.refA,
          refB: result.refB,
          worldDiffLeft: result.left,
          worldDiffRight: result.right,
        })(args, store);
      },
    },
    {
      name: "/world retired",
      description: "List retired participants and artifacts",
      category: view,
      handler: openView("world-retired"),
    },
  ];
}
