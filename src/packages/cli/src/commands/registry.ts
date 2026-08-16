import type { AppStore } from "../store.js";
import type { CliConfigPatch } from "../config.js";
import type { ContentStore } from "@cantilune/content";
import type { ClusterController } from "../wiring/clusterControl.js";
import type { SwarmController } from "../wiring/swarmControl.js";
import type { ControlPlaneController } from "../wiring/controlPlaneControl.js";
import type { EvalController } from "../wiring/evalControl.js";
import type { PetriController } from "../wiring/petriControl.js";
import type { ObserveController } from "../wiring/observeControl.js";
import type { ReplayController } from "../wiring/replayControl.js";
import type { CollaborationSnapshot } from "@cantilune/core";

/**
 * Side-effect channel for commands that must do more than mutate view state:
 * rebooting the runtime after a provider switch, writing config to disk,
 * quitting the app. Injected by the TUI; absent in headless/inspect runs, so
 * handlers must treat every member as optional.
 */
export interface CommandServices {
  readonly persistConfig?: (patch: CliConfigPatch) => Promise<void>;
  /**
   * Tear down the current runtime and finish releasing its handles before the
   * command may return. A replacement runtime must never boot concurrently
   * with shutdown of the handle it supersedes.
   */
  readonly resetRuntime?: (mode?: "preserve" | "clear") => Promise<RuntimeResetResult | void>;
  readonly exit?: () => void;
  readonly notify?: (level: "info" | "warn" | "error", text: string) => void;
  readonly listProviders?: () => readonly { id: string; label: string }[];
  readonly pick?: (
    title: string,
    options: readonly { id: string; label: string }[],
  ) => Promise<string | null>;
  /**
   * The content-addressed store backing the current runtime. Present once a
   * runtime handle has booted; undefined before first boot or after shutdown.
   * /content cat|ls|stats|gc handlers fetch through this and stash results in
   * store.viewArgs so the (synchronous) view renders pre-fetched data.
   */
  readonly contentStore?: () => ContentStore | undefined;
  /**
   * The cluster supervisor controller (ADR-0015) bound to the current runtime
   * handle's backends. Present once a runtime handle has booted; undefined
   * before first boot or after shutdown. /cluster start|stop|activate handlers
   * drive the real ClusterSupervisor through this; the cluster view renders
   * the captured event log.
   */
  readonly clusterControl?: () => ClusterController | undefined;
  /**
   * The multi-agent swarm controller (ADR-0019), bound to the current runtime
   * handle's backends. Present once a runtime handle has booted; undefined
   * before first boot or after shutdown. /swarm start|stop|status|activate|wait
   * handlers drive the real `CantiluneSwarm` (a `ClusterSupervisor` with a
   * pluggable `CantilunOS`-per-agent factory) through this; the swarm view
   * renders the agent pool + captured event log.
   */
  readonly swarmControl?: () => SwarmController | undefined;
  /**
   * The read-only control-plane service controller (ADR-0006), bootstrapped
   * once with a genesis schema revision + active binding. /schema * handlers
   * prefetch through this and stash results in store.viewArgs. Schema
   * `/schema commit` still does not self-sign FourView certificates.
   * `/mcp connect|disconnect` commits a same-schema tool-surface epoch.
   */
  readonly controlPlane?: () => ControlPlaneController | undefined;
  /**
   * The evaluation harness controller (ADR-0011), lazily built from the
   * CLI LLM adapter + in-memory evaluation ports. Present once a runtime
   * handle has booted; undefined before first boot or after shutdown.
   * /eval list|run|report|compare handlers drive the real EvaluationEngine
   * through this; eval views render genuine run + attempt records.
   */
  readonly evalControl?: () => EvalController | undefined;
  /**
   * The Petri-net engine controller (ADR-0017), driving the real
   * `@cantilune/petri` firing engine over a read-only projection of the
   * current runtime snapshot. /petri fire|transitions|reach|invariants
   * handlers drive genuine token-game semantics through this; the petri views
   * render real fire/enable/reachability/invariant results.
   */
  readonly petriControl?: () => PetriController | undefined;
  /**
   * Observability controller — `/observe*` calls `@cantilune/observability`
   * `observeCommitted` and stashes a FourViewBundle projection in viewArgs.
   */
  readonly observeControl?: () => ObserveController | undefined;
  /**
   * Replay controller — `/replay*` calls `CoordinationRuntime.replay` and
   * stashes the verification result in viewArgs (fail-closed on mismatch).
   */
  readonly replayControl?: () => ReplayController | undefined;
  /**
   * Load a committed CollaborationSnapshot by ref from durable storage.
   * Used by `/world diff` (two independent loads; fail-closed when missing).
   */
  readonly getSnapshot?: (ref: string) => CollaborationSnapshot | undefined;
  /** Current durable head snapshot ref, when a runtime is connected. */
  readonly headSnapshotRef?: () => string | undefined;
  /**
   * Optional LLM summarizer for `/compact`. Absent ⇒ honest truncation
   * (omitted), never a fake "summarize" label.
   */
  readonly summarizeCompact?: (droppedText: string) => Promise<string | undefined>;
  /** Injected tool executor catalog for `/tools` / `/tools test`. */
  readonly listInjectedTools?: () => Promise<readonly { name: string; description: string }[]>;
  /** Host capability probe for `/status` (injectable so unit tests stay offline). */
  readonly probeHost?: () => Promise<import("../wiring/hostCapabilities.js").HostCapabilityReport>;
}

export interface RuntimeResetResult {
  readonly history: "preserved" | "cleared";
  readonly reason?: "memory_world_replaced" | "explicit_clear";
}

export interface SlashCommand {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly description: string;
  readonly category: CommandCategory;
  readonly args?: readonly CommandArg[];
  readonly handler: (
    args: Record<string, unknown>,
    store: AppStore,
    services?: CommandServices,
  ) => void | Promise<void>;
}

export interface CommandArg {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly type: "string" | "number" | "boolean";
}

export type CommandCategory = "view" | "control" | "operation" | "session" | "export" | "help";

export interface CommandRegistry {
  register(command: SlashCommand): void;
  getAll(): readonly SlashCommand[];
  getByCategory(category: CommandCategory): readonly SlashCommand[];
  find(input: string): readonly SlashCommand[];
  parse(input: string): { command: SlashCommand; args: Record<string, unknown> } | null;
  execute(input: string, store: AppStore, services?: CommandServices): Promise<void>;
}

function normalizeCommandName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function commandSearchKeys(command: SlashCommand): readonly string[] {
  const keys = [command.name, ...(command.aliases ?? [])].map(normalizeCommandName);
  return keys;
}

function scoreMatch(query: string, candidate: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (c === q) return 100;
  if (c.startsWith(q)) return 80;
  if (c.includes(q)) return 50;
  const qParts = q.split(/\s+/).filter(Boolean);
  if (qParts.every((part) => c.includes(part))) return 30;
  return 0;
}

function parseFlagValue(raw: string, type: CommandArg["type"]): unknown {
  if (type === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error(`Expected number for flag, got "${raw}"`);
    return n;
  }
  if (type === "boolean") {
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    throw new Error(`Expected boolean for flag, got "${raw}"`);
  }
  return raw;
}

/**
 * Parse one `--flag` token.
 *
 * `nextIndex` is the index the caller should resume from, so it always moves
 * past this token — by one for a self-contained flag, by two when the flag also
 * consumed the following token as its value.
 */
function parseFlagToken(
  token: string,
  tokens: string[],
  startIndex: number,
  argDefs: readonly CommandArg[],
): { args: Record<string, unknown>; nextIndex: number } {
  const args: Record<string, unknown> = {};
  const findDef = (name: string): CommandArg | undefined =>
    argDefs.find((a) => a.name === `--${name}` || a.name === name);

  const eqIdx = token.indexOf("=");
  if (eqIdx >= 0) {
    const flagName = token.slice(2, eqIdx);
    const flagValue = token.slice(eqIdx + 1);
    const def = findDef(flagName);
    args[flagName] = def ? parseFlagValue(flagValue, def.type) : flagValue;
    return { args, nextIndex: startIndex + 1 };
  }

  const flagName = token.slice(2);
  const def = findDef(flagName);
  const next = tokens[startIndex + 1];

  // A following non-flag token is the flag's value; otherwise the flag is bare
  // and reads as `true`, which covers `--verbose` as well as `--verbose false`.
  if (next !== undefined && !next.startsWith("--")) {
    args[flagName] = def ? parseFlagValue(next, def.type) : next;
    return { args, nextIndex: startIndex + 2 };
  }

  args[flagName] = true;
  return { args, nextIndex: startIndex + 1 };
}

function assignPositionalArgs(
  positional: readonly string[],
  positionalDefs: readonly CommandArg[],
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (let i = 0; i < positionalDefs.length; i++) {
    const def = positionalDefs[i];
    if (def === undefined) continue;
    const value = positional[i];
    if (value !== undefined) {
      args[def.name] = parseFlagValue(value, def.type);
    } else if (def.required) {
      throw new Error(`Missing required argument: ${def.name}`);
    }
  }
  return args;
}

function validateRequiredArgs(argDefs: readonly CommandArg[], args: Record<string, unknown>): void {
  for (const def of argDefs) {
    if (def.required && args[def.name] === undefined) {
      throw new Error(`Missing required argument: ${def.name}`);
    }
  }
}

function collectInputTokens(
  tokens: string[],
  argDefs: readonly CommandArg[],
  firstArgIndex: number,
): { positional: string[]; flags: Record<string, unknown> } {
  const positional: string[] = [];
  const flags: Record<string, unknown> = {};

  let i = firstArgIndex;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === undefined) {
      i += 1;
      continue;
    }
    if (token.startsWith("--")) {
      const parsed = parseFlagToken(token, tokens, i, argDefs);
      Object.assign(flags, parsed.args);
      i = parsed.nextIndex;
    } else {
      positional.push(token);
      i += 1;
    }
  }

  return { positional, flags };
}

export function createCommandRegistry(): CommandRegistry {
  const commands: SlashCommand[] = [];

  function register(command: SlashCommand): void {
    const normalizedName = normalizeCommandName(command.name);
    if (commands.some((c) => normalizeCommandName(c.name) === normalizedName)) {
      throw new Error(`Command already registered: ${normalizedName}`);
    }
    commands.push({ ...command, name: normalizedName });
  }

  function getAll(): readonly SlashCommand[] {
    return [...commands];
  }

  function getByCategory(category: CommandCategory): readonly SlashCommand[] {
    return commands.filter((c) => c.category === category);
  }

  function find(input: string): readonly SlashCommand[] {
    const query = input.trim();
    if (query.length === 0) return getAll();

    const scored = commands
      .flatMap((command) => {
        const scores = commandSearchKeys(command).map((key) => scoreMatch(query, key));
        const best = Math.max(...scores, scoreMatch(query, command.description));
        return best > 0 ? [{ command, score: best }] : [];
      })
      .sort((a, b) => b.score - a.score || a.command.name.localeCompare(b.command.name));

    return scored.map((entry) => entry.command);
  }

  /**
   * Longest-prefix match over the leading tokens.
   *
   * Command names are multi-word (`/world actors`, `/schema epoch history`), so
   * matching only the first token would resolve every one of them to its
   * parent and silently reinterpret the subcommand word as a positional
   * argument. Longest first, so `/schema epoch history` wins over
   * `/schema epoch`.
   */
  function resolveCommand(
    tokens: readonly string[],
  ): { command: SlashCommand; wordCount: number } | undefined {
    for (let wordCount = tokens.length; wordCount >= 1; wordCount--) {
      const candidate = normalizeCommandName(tokens.slice(0, wordCount).join(" "));
      const command = commands.find((entry) => commandSearchKeys(entry).includes(candidate));
      if (command !== undefined) return { command, wordCount };
    }
    return undefined;
  }

  function parse(input: string): { command: SlashCommand; args: Record<string, unknown> } | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) return null;

    const tokens = trimmed.split(/\s+/);
    const resolved = resolveCommand(tokens);
    if (resolved === undefined) return null;

    const { command, wordCount } = resolved;
    const argDefs = command.args ?? [];
    const positionalDefs = argDefs.filter((a) => !a.name.startsWith("--"));
    const { positional, flags } = collectInputTokens(tokens, argDefs, wordCount);
    const args = {
      ...flags,
      ...assignPositionalArgs(positional, positionalDefs),
    };
    validateRequiredArgs(argDefs, args);

    return { command, args };
  }

  async function execute(
    input: string,
    store: AppStore,
    services?: CommandServices,
  ): Promise<void> {
    const parsed = parse(input);
    if (parsed === null) {
      throw new Error(`Unknown command: ${input}`);
    }
    await parsed.command.handler(parsed.args, store, services);
  }

  return {
    register,
    getAll,
    getByCategory,
    find,
    parse,
    execute,
  };
}
