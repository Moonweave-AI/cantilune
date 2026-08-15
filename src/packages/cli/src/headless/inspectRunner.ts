import type { CantilunOS } from "@cantilune/boot";
import { createCommandRegistry } from "../commands/registry.js";
import { exportJson } from "../render/jsonExporter.js";
import {
  createCliRuntimeBoot,
  INSPECT_ONLY_ADAPTER,
  INSPECT_ONLY_LLM_CONFIG,
} from "../runtimeSync.js";
import { createStore } from "../store.js";
import type { AppStore } from "../store.js";

export interface InspectOptions {
  readonly command: string;
  readonly json: boolean;
  readonly boot?: () => { os: CantilunOS; syncRuntime: () => AppStore["runtime"] };
}

export interface ParsedInspectArgs {
  readonly command: string;
  readonly json: boolean;
}

export interface InspectRuntimeSnapshot {
  readonly provider: AppStore["provider"];
  readonly model: AppStore["model"];
  readonly connected: AppStore["connected"];
  readonly turnCount: number;
  readonly messageCount: number;
  readonly activeView: AppStore["activeView"];
  readonly viewArgs: AppStore["viewArgs"];
  readonly runtime: AppStore["runtime"];
}

export interface InspectPayload {
  readonly command: string;
  readonly runtime: InspectRuntimeSnapshot;
  readonly osReady: boolean;
}

function defaultBoot(): { os: CantilunOS; syncRuntime: () => AppStore["runtime"] } {
  return createCliRuntimeBoot(INSPECT_ONLY_ADAPTER, {
    durable: "memory",
    contentStore: "memory",
    llm: INSPECT_ONLY_LLM_CONFIG,
  });
}

export function parseInspectArgs(argv: readonly string[]): ParsedInspectArgs {
  let command = "/world";
  let json = true;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
    } else if (arg === "--no-json") {
      json = false;
    } else if (arg !== undefined && !arg.startsWith("-")) {
      command = arg.startsWith("/") ? arg : `/${arg}`;
    }
  }

  return { command, json };
}

export function snapshotRuntime(store: AppStore): InspectRuntimeSnapshot {
  return {
    provider: store.provider,
    model: store.model,
    connected: store.connected,
    turnCount: store.session.turnCount,
    messageCount: store.session.messages.length,
    activeView: store.activeView,
    viewArgs: store.viewArgs,
    runtime: store.runtime,
  };
}

export async function runInspect(options: InspectOptions): Promise<InspectPayload> {
  const boot = options.boot ?? defaultBoot;
  const handle = boot();
  const store = createStore({ connected: true, runtime: handle.syncRuntime() });
  const registry = createCommandRegistry();

  registry.register({
    name: "/world",
    description: "Inspect collaboration world snapshot",
    category: "view",
    handler: (_args, s) => {
      s.activeView = "world";
    },
  });

  registry.register({
    name: "/graph",
    description: "Inspect coordination graph",
    category: "view",
    handler: (_args, s) => {
      s.activeView = "graph";
    },
  });

  registry.register({
    name: "/petri",
    description: "Inspect Petri net view",
    category: "view",
    handler: (_args, s) => {
      s.activeView = "petri";
    },
  });

  try {
    await registry.execute(options.command, store);
    store.runtime = handle.syncRuntime();
    const payload = {
      command: options.command,
      runtime: snapshotRuntime(store),
      osReady: typeof handle.os.run === "function",
    };
    process.stdout.write(`${exportJson(payload)}\n`);
    return payload;
  } finally {
    await handle.os.shutdown();
  }
}

export async function inspectRunner(argv: readonly string[]): Promise<number> {
  const parsed = parseInspectArgs(argv);
  await runInspect(parsed);
  return 0;
}
