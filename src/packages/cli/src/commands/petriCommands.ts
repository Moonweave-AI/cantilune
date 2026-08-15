/**
 * Petri commands for the TUI — /petri and sub-views (ADR-0017).
 *
 * Handlers prefetch real engine results through services.petriControl() and
 * stash them in store.viewArgs.petriData so the (synchronous) PetriView renders
 * from prefetched firing/reachability/invariant results. With no controller
 * (headless/inspect), the view falls back to the runtime marking projection.
 * The Petri engine is a read-only analysis lens: firing mutates only an
 * in-memory marking, never the runtime world.
 */
import type { SlashCommand, CommandCategory, CommandServices } from "./registry.js";
import type { AppStore } from "../store.js";
import type {
  PetriController,
  PetriFireSnapshot,
  PetriReachSnapshot,
  PetriInvariantsSnapshot,
  PetriSnapshot,
} from "../wiring/petriControl.js";

function readController(services: CommandServices | undefined): PetriController | undefined {
  return services?.petriControl?.();
}

async function prefetchMarking(
  services: CommandServices | undefined,
  store: AppStore,
  args: Record<string, unknown>,
): Promise<void> {
  const controller = readController(services);
  const snapshot = controller?.project(store.runtime) ?? null;
  store.viewArgs = { ...args, petriData: snapshot, petriKind: "marking" };
}

async function prefetchTransitions(
  services: CommandServices | undefined,
  store: AppStore,
  args: Record<string, unknown>,
): Promise<void> {
  const controller = readController(services);
  const snapshot = controller?.project(store.runtime) ?? null;
  store.viewArgs = { ...args, petriData: snapshot, petriKind: "transitions" };
}

async function prefetchFire(
  services: CommandServices | undefined,
  store: AppStore,
  args: Record<string, unknown>,
): Promise<void> {
  const controller = readController(services);
  const op = typeof args.op === "string" ? args.op : "";
  let bindings: Record<string, string> | undefined;
  if (typeof args.bindings === "string" && args.bindings.trim() !== "") {
    try {
      const parsed = JSON.parse(args.bindings) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          record[key] = typeof value === "string" ? value : String(value);
        }
        bindings = record;
      }
    } catch {
      bindings = undefined;
    }
  }
  const fireSnapshot = controller?.fire(store.runtime, op, bindings) ?? null;
  store.viewArgs = { ...args, petriData: fireSnapshot, petriKind: "fire" };
}

async function prefetchReach(
  services: CommandServices | undefined,
  store: AppStore,
  args: Record<string, unknown>,
): Promise<void> {
  const controller = readController(services);
  const goal = typeof args.goal === "string" ? args.goal : "";
  const reachSnapshot = controller?.reach(store.runtime, goal) ?? null;
  store.viewArgs = { ...args, petriData: reachSnapshot, petriKind: "reach" };
}

async function prefetchInvariants(
  services: CommandServices | undefined,
  store: AppStore,
  args: Record<string, unknown>,
): Promise<void> {
  const controller = readController(services);
  const invSnapshot = controller?.invariants(store.runtime) ?? null;
  store.viewArgs = { ...args, petriData: invSnapshot, petriKind: "invariants" };
}

export function registerPetriCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/petri",
      description: "Show current Petri net marking (places + tokens)",
      category: view,
      handler: async (a, store, services) => {
        store.mode = "view";
        store.activeView = "petri";
        await prefetchMarking(services, store, a);
      },
    },
    {
      name: "/petri transitions",
      description: "List enabled transitions (real token-game enablement)",
      category: view,
      handler: async (a, store, services) => {
        store.mode = "view";
        store.activeView = "petri-transitions";
        await prefetchTransitions(services, store, a);
      },
    },
    {
      name: "/petri fire",
      description: "Fire a transition (real consume/produce over arc structure)",
      category: "operation" as CommandCategory,
      args: [
        {
          name: "op",
          description: "Operation template id or transition id",
          required: true,
          type: "string",
        },
        {
          name: "bindings",
          description: "JSON bindings map (forward-compat no-op)",
          required: false,
          type: "string",
        },
      ],
      handler: async (a, store, services) => {
        store.mode = "view";
        store.activeView = "petri-fire";
        await prefetchFire(services, store, a);
      },
    },
    {
      name: "/petri reach",
      description: "Bounded reachability analysis toward a goal place",
      category: view,
      args: [
        {
          name: "goal",
          description: "Goal place id or name (target ≥ 1 token)",
          required: true,
          type: "string",
        },
      ],
      handler: async (a, store, services) => {
        store.mode = "view";
        store.activeView = "petri-reach";
        await prefetchReach(services, store, a);
      },
    },
    {
      name: "/petri invariants",
      description: "Compute Petri net S-invariants (real incidence-matrix basis)",
      category: view,
      handler: async (a, store, services) => {
        store.mode = "view";
        store.activeView = "petri-invariants";
        await prefetchInvariants(services, store, a);
      },
    },
  ];
}

export type { PetriSnapshot, PetriFireSnapshot, PetriReachSnapshot, PetriInvariantsSnapshot };
