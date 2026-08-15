#!/usr/bin/env node

export interface CliArgs {
  readonly mode: "tui" | "headless" | "inspect";
  /**
   * Left undefined when the flag was absent, so the persisted config in
   * `~/.cantilune/config.json` stays authoritative. Substituting a default here
   * would silently outrank whatever the user last selected with `/provider`.
   */
  readonly provider?: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly passthrough: readonly string[];
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  let provider: string | undefined;
  let model: string | undefined;
  let baseUrl: string | undefined;
  const passthrough: string[] = [];
  let mode: CliArgs["mode"] = "tui";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--provider") {
      provider = argv[++i] ?? provider;
    } else if (arg === "--model") {
      model = argv[++i] ?? model;
    } else if (arg === "--base-url") {
      baseUrl = argv[++i] ?? baseUrl;
    } else if (arg === "--headless") {
      mode = "headless";
    } else if (arg === "run") {
      mode = "headless";
      continue;
    } else if (arg === "inspect") {
      mode = "inspect";
    } else if (arg !== undefined) {
      passthrough.push(arg);
    }
  }

  return {
    mode,
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    passthrough,
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.mode === "headless") {
    const { headlessRunner } = await import("./headless/headlessRunner.js");
    const extraArgs = [
      ...args.passthrough.filter((a) => a !== "run"),
      ...(args.provider !== undefined ? ["--provider", args.provider] : []),
      ...(args.model !== undefined ? ["--model", args.model] : []),
      ...(args.baseUrl !== undefined ? ["--base-url", args.baseUrl] : []),
    ];
    const code = await headlessRunner(extraArgs);
    process.exitCode = code;
    return;
  }

  if (args.mode === "inspect") {
    const { inspectRunner } = await import("./headless/inspectRunner.js");
    const code = await inspectRunner(args.passthrough.filter((a) => a !== "inspect"));
    process.exitCode = code;
    return;
  }

  const { render } = await import("ink");
  const React = await import("react");
  const { App } = await import("./app.js");

  render(
    React.createElement(App, {
      ...(args.provider !== undefined ? { provider: args.provider } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.baseUrl !== undefined ? { baseUrl: args.baseUrl } : {}),
    }),
  );
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

export { createStore } from "./store.js";
export type {
  AppStore,
  ChatMessage,
  SessionState,
  TuiMode,
  ViewType,
  ToolCallDisplay,
} from "./store.js";
export { createCommandRegistry } from "./commands/registry.js";
export type { SlashCommand, CommandRegistry, CommandCategory } from "./commands/registry.js";
