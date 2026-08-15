/**
 * Cluster commands for the TUI — /cluster, /cluster status, /cluster topology,
 * and the operation verbs /cluster start|stop|activate (ADR-0015).
 *
 * The view commands (cluster, status, topology) prefetch the cluster
 * controller's status (if present) and stash it in store.viewArgs so the view
 * renders the live supervisor event log alongside the world projection. The
 * operation verbs (start, stop, activate) drive the real ClusterSupervisor
 * through services.clusterControl().
 */
import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore } from "../store.js";
import type { AgentManifest } from "@cantilune/core";

export function registerClusterCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  const operation = "operation" as CommandCategory;
  return [
    {
      name: "/cluster",
      description: "Show the cluster overview (supervisor + world projection)",
      category: view,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        store.mode = "view";
        store.activeView = "cluster";
        store.viewArgs = prefetchClusterStatus(services);
      },
    },
    {
      name: "/cluster status",
      description: "Show liveness and supervisor event log",
      category: view,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        store.mode = "view";
        store.activeView = "cluster-status";
        store.viewArgs = prefetchClusterStatus(services);
      },
    },
    {
      name: "/cluster topology",
      description: "Show projected links and sessions",
      category: view,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        store.mode = "view";
        store.activeView = "cluster-topology";
        store.viewArgs = prefetchClusterStatus(services);
      },
    },
    {
      name: "/cluster start",
      description: "Start the cluster supervisor (trusted-change feed)",
      category: operation,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        const controller = services?.clusterControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected — start an agent loop first");
          return;
        }
        const result = controller.start();
        notify(
          store,
          services,
          result.ok ? "info" : "warn",
          result.message ?? (result.ok ? "supervisor started" : "failed to start supervisor"),
        );
        store.viewArgs = prefetchClusterStatus(services);
      },
    },
    {
      name: "/cluster stop",
      description: "Stop the cluster supervisor (governed E-Stop)",
      category: operation,
      handler: (_args: Record<string, unknown>, store: AppStore, services): void => {
        const controller = services?.clusterControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected");
          return;
        }
        controller.stop();
        notify(store, services, "info", "supervisor stopped");
        store.viewArgs = prefetchClusterStatus(services);
      },
    },
    {
      name: "/cluster activate",
      description: "Activate a registered agent: /cluster activate <agentId>",
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
        const controller = services?.clusterControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no runtime connected");
          return;
        }
        const agentId = args.agentId;
        if (typeof agentId !== "string" || agentId.trim() === "") {
          notify(store, services, "warn", "usage: /cluster activate <agentId>");
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
        store.viewArgs = prefetchClusterStatus(services);
      },
    },
  ];
}

function prefetchClusterStatus(services?: {
  readonly clusterControl?: () => unknown;
}): Record<string, unknown> {
  const controller = services?.clusterControl?.() as
    { readonly status?: () => unknown } | undefined;
  if (controller === undefined) return {};
  const status = controller.status?.();
  return status === undefined ? {} : { clusterStatus: status };
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
