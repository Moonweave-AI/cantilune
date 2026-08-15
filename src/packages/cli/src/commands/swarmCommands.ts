/**
 * Swarm commands for the TUI — `/swarm`, `/swarm status`, and the operation verbs
 * `/swarm start|stop|activate|wait` (ADR-0019).
 *
 * The view commands (swarm, status) prefetch the swarm controller's status (if
 * present) and stash it in `store.viewArgs` so the view renders the live swarm
 * agent map + event log. The operation verbs drive the real `CantiluneSwarm`
 * through `services.swarmControl()`.
 *
 * `/swarm activate` reuses the exact active-initiator authority of
 * `/cluster activate` (the swarm admits a participant into the same
 * collaboration world — ADR-0019 §1).
 */
import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore } from "../store.js";
import type { AgentManifest } from "@cantilune/core";

export function registerSwarmCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  const operation = "operation" as CommandCategory;
  return [
    {
      name: "/swarm",
      description: "Show the swarm overview (agent pool + world projection)",
      category: view,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        store.mode = "view";
        store.activeView = "swarm";
        store.viewArgs = prefetchSwarmStatus(services);
      },
    },
    {
      name: "/swarm status",
      description: "Show the swarm agent map and supervisor event log",
      category: view,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        store.mode = "view";
        store.activeView = "swarm-status";
        store.viewArgs = prefetchSwarmStatus(services);
      },
    },
    {
      name: "/swarm start",
      description: "Start the swarm supervisor (boots the CantilunOS pool)",
      category: operation,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        const controller = services?.swarmControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected — start an agent loop first");
          return;
        }
        const result = controller.start();
        notify(
          store,
          services,
          result.ok ? "info" : "warn",
          result.message ?? (result.ok ? "swarm started" : "failed to start swarm"),
        );
        store.viewArgs = prefetchSwarmStatus(services);
      },
    },
    {
      name: "/swarm stop",
      description: "Stop the swarm supervisor (governed E-Stop)",
      category: operation,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        const controller = services?.swarmControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected");
          return;
        }
        controller.stop();
        notify(store, services, "info", "swarm stopped");
        store.viewArgs = prefetchSwarmStatus(services);
      },
    },
    {
      name: "/swarm activate",
      description: "Activate a registered agent into the swarm: /swarm activate <agentId>",
      category: operation,
      args: [
        {
          name: "agentId",
          description: "Registered participant id to activate",
          required: true,
          type: "string",
        },
      ],
      handler: async (args: Record<string, unknown>, store: AppStore, services): Promise<void> => {
        const controller = services?.swarmControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected");
          return;
        }
        const agentId = args.agentId;
        if (typeof agentId !== "string" || agentId.trim() === "") {
          notify(store, services, "warn", "usage: /swarm activate <agentId>");
          return;
        }
        const result = await controller.activate(agentId.trim(), buildManifest(args));
        notify(
          store,
          services,
          result.ok ? "info" : "warn",
          result.ok
            ? `activated ${agentId.trim()}`
            : `activation failed: ${result.message ?? "rejected"}`,
        );
        store.viewArgs = prefetchSwarmStatus(services);
      },
    },
    {
      name: "/swarm wait",
      description: "Drive the swarm until every non-retired participant is done",
      category: operation,
      handler: async (_args: Record<string, unknown>, store: AppStore, services): Promise<void> => {
        const controller = services?.swarmControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected");
          return;
        }
        const result = await controller.waitForCompletion();
        notify(
          store,
          services,
          result.ok ? "info" : "warn",
          result.ok ? `swarm complete — ${result.summary}` : `swarm incomplete — ${result.summary}`,
        );
        store.viewArgs = prefetchSwarmStatus(services);
      },
    },
  ];
}

function prefetchSwarmStatus(services?: {
  readonly swarmControl?: () => unknown;
}): Record<string, unknown> {
  const controller = services?.swarmControl?.() as { readonly status?: () => unknown } | undefined;
  if (controller === undefined) return {};
  const status = controller.status?.();
  return status === undefined ? {} : { swarmStatus: status };
}

function buildManifest(args: Record<string, unknown>): Partial<AgentManifest> {
  const manifest: Partial<AgentManifest> = {};
  const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : undefined;
  const assignedTask = typeof args.assignedTask === "string" ? args.assignedTask : undefined;
  return {
    ...manifest,
    ...(systemPrompt !== undefined ? { systemPrompt } : {}),
    ...(assignedTask !== undefined ? { assignedTask } : {}),
  };
}

function notify(
  store: AppStore,
  services:
    { readonly notify?: (level: "info" | "warn" | "error", text: string) => void } | undefined,
  level: "info" | "warn" | "error",
  text: string,
): void {
  if (services !== undefined) {
    services.notify?.(level, text);
  } else {
    store.notice = { level, text };
  }
}
