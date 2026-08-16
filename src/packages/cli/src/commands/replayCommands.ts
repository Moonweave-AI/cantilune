import type { SlashCommand, CommandCategory, CommandServices } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";
import type { ReplayController } from "../wiring/replayControl.js";

function openReplayView(
  view: ViewType,
  stash: Record<string, unknown>,
): (args: Record<string, unknown>, store: AppStore) => void {
  return (args, store) => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = { ...args, ...stash };
  };
}

function readController(services: CommandServices | undefined): ReplayController | undefined {
  return services?.replayControl?.();
}

function prefetch(
  services: CommandServices | undefined,
  args: Record<string, unknown>,
  defaults: { readonly fromRef?: string; readonly changeId?: string } = {},
): Record<string, unknown> {
  const controller = readController(services);
  if (controller === undefined) {
    return { replayError: "no replay controller (runtime not connected)" };
  }
  const fromRef =
    typeof args.ref === "string" && args.ref.length > 0
      ? args.ref
      : (defaults.fromRef ?? "");
  const toRef = typeof args.to === "string" ? args.to : undefined;
  const changeId =
    typeof args.changeId === "string" ? args.changeId : defaults.changeId;
  const result = controller.replay({
    ...(fromRef.length > 0 ? { fromRef } : {}),
    ...(toRef !== undefined ? { toRef } : {}),
    ...(changeId !== undefined ? { changeId } : {}),
  });
  if (!result.ok) {
    return { replayError: result.message, ref: fromRef };
  }
  return {
    replayProjection: result.projection,
    ref: result.projection.fromRef,
  };
}

export function registerReplayCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/replay from",
      description: "Replay from snapshot ref via CoordinationRuntime.replay",
      category: view,
      args: [
        { name: "ref", description: "Snapshot ref to replay from", required: true, type: "string" },
        { name: "to", description: "Optional terminal snapshot ref", required: false, type: "string" },
      ],
      handler(args, store, services) {
        openReplayView("replay", prefetch(services, args))(args, store);
      },
    },
    {
      name: "/replay recipe",
      description: "Show replay recipe for change id",
      category: view,
      args: [
        { name: "changeId", description: "Change identifier", required: true, type: "string" },
        {
          name: "ref",
          description: "Snapshot ref to replay from (default: head genesis / earliest)",
          required: false,
          type: "string",
        },
      ],
      handler(args, store, services) {
        const changeId = typeof args.changeId === "string" ? args.changeId : undefined;
        openReplayView(
          "replay-recipe",
          prefetch(services, args, changeId !== undefined ? { changeId } : {}),
        )(args, store);
      },
    },
    {
      name: "/replay bundle",
      description: "Show bundled replay manifest",
      category: view,
      args: [
        {
          name: "ref",
          description: "Snapshot ref to replay from",
          required: false,
          type: "string",
        },
      ],
      handler(args, store, services) {
        openReplayView("replay-bundle", prefetch(services, args))(args, store);
      },
    },
  ];
}
