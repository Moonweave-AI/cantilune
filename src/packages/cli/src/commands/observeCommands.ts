import type { SlashCommand, CommandCategory, CommandServices } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";
import type { ObserveController } from "../wiring/observeControl.js";

function openObserveView(
  view: ViewType,
  stash: Record<string, unknown>,
): (args: Record<string, unknown>, store: AppStore) => void {
  return (args, store) => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = { ...args, ...stash };
  };
}

function readController(services: CommandServices | undefined): ObserveController | undefined {
  return services?.observeControl?.();
}

function prefetch(
  services: CommandServices | undefined,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const controller = readController(services);
  if (controller === undefined) {
    return { observeError: "no observability controller (runtime not connected)" };
  }
  const sinceRef = typeof args.since === "string" ? args.since : undefined;
  const result = controller.observe(sinceRef !== undefined ? { sinceRef } : undefined);
  if (!result.ok) {
    return { observeError: result.message };
  }
  return { observeProjection: result.projection };
}

export function registerObserveCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/observe",
      description: "Four-view bundle summary (dependency/resource/communication/structure)",
      category: view,
      args: [
        {
          name: "since",
          description: "Snapshot ref for observation cut start (default: genesis of change feed)",
          required: false,
          type: "string",
        },
      ],
      handler(args, store, services) {
        openObserveView("observe", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/observe dependency",
      description: "Dependency directed graph lens",
      category: view,
      handler(args, store, services) {
        openObserveView("observe-dependency", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/observe resource",
      description: "Resource allocation matrix lens",
      category: view,
      handler(args, store, services) {
        openObserveView("observe-resource", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/observe communication",
      description: "Communication network lens",
      category: view,
      handler(args, store, services) {
        openObserveView("observe-communication", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/observe structure",
      description: "Structure bipartite graph lens",
      category: view,
      handler(args, store, services) {
        openObserveView("observe-structure", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/observe spine",
      description: "EventSpine timeline (commit trajectory)",
      category: view,
      args: [
        {
          name: "since",
          description: "Snapshot ref for observation cut start",
          required: false,
          type: "string",
        },
      ],
      handler(args, store, services) {
        openObserveView("observe-spine", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/observe diagnostic",
      description: "Cross-lens diagnostic panel",
      category: view,
      handler(args, store, services) {
        openObserveView("observe-diagnostic", prefetch(services, args))(args, store);
      },
    },
  ];
}
