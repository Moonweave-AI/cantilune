/**
 * Persisted CLI configuration.
 *
 * Provider/model selection used to live only in memory, so every restart
 * required re-passing flags. This stores the non-secret parts of the setup in
 * `~/.cantilune/config.json`. API keys are deliberately excluded — they stay in
 * environment variables so a config file is never a credential leak.
 */
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { readFile, mkdir } from "node:fs/promises";
import {
  atomicWriteFileSync,
  createFileRuntimePersistence,
  withFileLock,
} from "@cantilune/runtime/memory";
import { actorId } from "@cantilune/core";
import { isThemeName, type ThemeName } from "./theme/palette.js";
import { createCliInitialSnapshot } from "./cliWorld.js";

export interface CliConfig {
  readonly provider: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly layout?: "focus" | "observe";
  /** Omitted means "detect from the terminal" rather than a fixed palette. */
  readonly theme?: ThemeName;
  readonly durable?: "memory" | "file";
  readonly storagePath?: string;
  readonly maxTurns?: number;
  /** Stable local actor identity; not a credential or authorization token. */
  readonly principalId?: string;
  /** Explicitly reviewed legacy epoch aliases for the built-in static schema. */
  readonly compatibleEpochIds?: readonly string[];
  /** Dedicated goal-contract compiler provider (ADR-0013). */
  readonly contractProvider?: string;
  readonly contractModel?: string;
  /** Dedicated LLM judge provider (ADR-0020). */
  readonly judgeProvider?: string;
  readonly judgeModel?: string;
  /** Additional judge models for quorum (same provider as judgeProvider). */
  readonly judgeQuorumModels?: readonly string[];
  /** Mesh host directory path for S4 multi-host swarm. */
  readonly swarmDirectoryPath?: string;
  readonly swarmListen?: string;
  readonly swarmRole?: "supervisor" | "worker";
  /** MCP server specs. Live `/mcp connect|disconnect` schedules epoch-bound attach. */
  readonly mcpServers?: readonly string[];
  /** Web search provider for tools. */
  readonly searchProvider?: "tavily" | "serper" | "brave" | "none";
}

export const DEFAULT_CONFIG: CliConfig = {
  provider: "openai",
  model: "gpt-4o",
  layout: "focus",
  durable: "file",
  storagePath: "./.cantilune/os",
};

export function configDir(): string {
  return join(homedir(), ".cantilune");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(
  source: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const value = source[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  return strings.length === value.length ? [...new Set(strings)] : undefined;
}

/** Narrow arbitrary JSON into a CliConfig, discarding anything unrecognized. */
export function parseConfig(raw: unknown): CliConfig {
  if (!isRecord(raw)) return DEFAULT_CONFIG;

  const layout = readString(raw, "layout");
  const durable = readString(raw, "durable");
  const normalizedDurable = durable === "memory" ? "memory" : "file";
  const configuredStoragePath = readString(raw, "storagePath");
  const storagePath =
    configuredStoragePath ??
    (normalizedDurable === "file" ? DEFAULT_CONFIG.storagePath : undefined);
  const baseUrl = readString(raw, "baseUrl");
  const principalId = readString(raw, "principalId");
  const theme = raw["theme"];
  const maxTurns = raw["maxTurns"];
  const compatibleEpochIds = readStringArray(raw, "compatibleEpochIds");
  const contractProvider = readString(raw, "contractProvider");
  const contractModel = readString(raw, "contractModel");
  const judgeProvider = readString(raw, "judgeProvider");
  const judgeModel = readString(raw, "judgeModel");
  const judgeQuorumModels = readStringArray(raw, "judgeQuorumModels");
  const swarmDirectoryPath = readString(raw, "swarmDirectoryPath");
  const swarmListen = readString(raw, "swarmListen");
  const swarmRoleRaw = readString(raw, "swarmRole");
  const swarmRole =
    swarmRoleRaw === "supervisor" || swarmRoleRaw === "worker" ? swarmRoleRaw : undefined;
  const mcpServers = readStringArray(raw, "mcpServers");
  const searchProviderRaw = readString(raw, "searchProvider");
  const searchProvider =
    searchProviderRaw === "tavily" ||
    searchProviderRaw === "serper" ||
    searchProviderRaw === "brave" ||
    searchProviderRaw === "none"
      ? searchProviderRaw
      : undefined;

  return {
    provider: readString(raw, "provider") ?? DEFAULT_CONFIG.provider,
    model: readString(raw, "model") ?? DEFAULT_CONFIG.model,
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    layout: layout === "observe" ? "observe" : "focus",
    ...(isThemeName(theme) ? { theme } : {}),
    durable: normalizedDurable,
    ...(storagePath !== undefined ? { storagePath } : {}),
    ...(typeof maxTurns === "number" && Number.isFinite(maxTurns) ? { maxTurns } : {}),
    ...(principalId !== undefined ? { principalId } : {}),
    ...(compatibleEpochIds !== undefined ? { compatibleEpochIds } : {}),
    ...(contractProvider !== undefined ? { contractProvider } : {}),
    ...(contractModel !== undefined ? { contractModel } : {}),
    ...(judgeProvider !== undefined ? { judgeProvider } : {}),
    ...(judgeModel !== undefined ? { judgeModel } : {}),
    ...(judgeQuorumModels !== undefined ? { judgeQuorumModels } : {}),
    ...(swarmDirectoryPath !== undefined ? { swarmDirectoryPath } : {}),
    ...(swarmListen !== undefined ? { swarmListen } : {}),
    ...(swarmRole !== undefined ? { swarmRole } : {}),
    ...(mcpServers !== undefined ? { mcpServers } : {}),
    ...(searchProvider !== undefined ? { searchProvider } : {}),
  };
}

/** Generate the stable, non-secret actor id persisted in CLI config. */
export function createCliPrincipalId(): string {
  return `cli-${randomUUID().slice(0, 8)}`;
}

/**
 * Ensure interactive/headless runs reuse one actor identity across restarts.
 * The durable world rejects observations from actors it does not contain, so
 * silently minting a fresh id on every process start makes recovery impossible.
 */
export async function ensureCliPrincipal(
  config: CliConfig,
  path = configPath(),
): Promise<CliConfig> {
  if (config.durable !== "file" || config.storagePath === undefined) {
    return ensureNonFilePrincipal(config, path);
  }

  if (config.principalId !== undefined && fileWorldExists(config.storagePath)) {
    assertConfiguredPrincipalIsActive(config, config.principalId);
    return config;
  }

  // Establish/read T0 before publishing config. Runtime initialization
  // serializes the missing-bundle decision, so concurrent first boots may
  // propose different candidates but all observe one durable winner.
  const candidate = config.principalId ?? createCliPrincipalId();
  const runtimeDir = join(config.storagePath, "runtime");
  const persistence = createFileRuntimePersistence({
    dir: runtimeDir,
    initial: createCliInitialSnapshot(candidate),
  });
  const winner = principalFromDurableWorld(persistence.durable);
  if (config.principalId !== undefined && winner !== config.principalId) {
    throw new Error(
      `Configured CLI principal ${config.principalId} lost the concurrent first-boot race to ${winner}. ` +
        "Refusing to adopt a different durable identity; reload config and choose that active participant explicitly.",
    );
  }
  const next = { ...config, principalId: winner };
  await persistAndVerifyFilePrincipal(next, path, winner);
  return next;
}

function isFirstBootConflict(error: unknown): error is Error {
  return error instanceof Error && error.message.includes("already won first boot");
}

async function ensureNonFilePrincipal(config: CliConfig, path: string): Promise<CliConfig> {
  if (config.principalId !== undefined) return config;
  const next = { ...config, principalId: createCliPrincipalId() };
  try {
    await saveConfig(next, path);
    return next;
  } catch (error) {
    if (!isFirstBootConflict(error)) throw error;
    const winner = await loadConfig(path);
    if (winner.principalId === undefined) throw error;
    return winner;
  }
}

function assertConfiguredPrincipalIsActive(config: CliConfig, configured: string): void {
  const runtimeDir = join(config.storagePath!, "runtime");
  const { durable } = createFileRuntimePersistence({ dir: runtimeDir });
  const headRef = durable.head();
  const head = headRef === undefined ? undefined : durable.get(headRef);
  const entry = head?.participants.get(actorId(configured));
  if (entry?.kind === "agent" && entry.status === "active") return;
  throw new Error(
    `Configured CLI principal ${configured} is not an active Agent in the durable world. ` +
      "Set principalId to an already registered active participant; refusing to rewrite an explicit identity.",
  );
}

function fileWorldExists(storagePath: string): boolean {
  return existsSync(join(storagePath, "runtime", "durable.bundle.json"));
}

async function persistAndVerifyFilePrincipal(
  config: CliConfig & { readonly principalId: string },
  path: string,
  winner: string,
): Promise<void> {
  try {
    await saveConfig(config, path);
  } catch (error) {
    if (!isFirstBootConflict(error)) throw error;
    const configWinner = await loadConfig(path);
    if (configWinner.principalId !== winner) {
      throw new Error(
        `CLI config principal ${configWinner.principalId ?? "<missing>"} does not match durable principal ${winner}; ` +
          "another first-boot process wrote stale config, refusing to boot either identity.",
        { cause: error },
      );
    }
  }

  const verifiedWinner = principalFromExistingFileWorld(config);
  if (verifiedWinner === undefined) {
    throw new Error("The CLI file world disappeared while persisting its principal configuration.");
  }
  if (verifiedWinner !== winner) {
    throw new Error(
      `CLI durable principal changed from ${winner} to ${verifiedWinner} during configuration; retry from a fresh config read.`,
    );
  }
  const persisted = await loadConfig(path);
  if (persisted.principalId !== verifiedWinner) {
    throw new Error(
      `CLI config principal ${persisted.principalId ?? "<missing>"} does not match durable principal ${verifiedWinner}; ` +
        "another first-boot process won the config write, so this process must reload before booting.",
    );
  }
}

function principalFromExistingFileWorld(config: CliConfig): string | undefined {
  if (config.durable !== "file" || config.storagePath === undefined) return undefined;
  const runtimeDir = join(config.storagePath, "runtime");
  if (!fileWorldExists(config.storagePath)) return undefined;

  const { durable } = createFileRuntimePersistence({ dir: runtimeDir });
  return principalFromDurableWorld(durable);
}

function principalFromDurableWorld(
  durable: ReturnType<typeof createFileRuntimePersistence>["durable"],
): string {
  const headRef = durable.head();
  const head = headRef === undefined ? undefined : durable.get(headRef);
  const candidates =
    head === undefined
      ? []
      : [...head.participants.values()].filter(
          (entry) => entry.kind === "agent" && entry.status === "active",
        );
  if (candidates.length !== 1 || candidates[0] === undefined) {
    throw new Error(
      "The existing CLI file world has no configured principal and does not contain exactly one " +
        "active Agent. Set principalId to an already registered active participant before resuming.",
    );
  }
  return String(candidates[0].actorId);
}

/** Load config from disk. Missing or corrupt files yield defaults, never throw. */
export async function loadConfig(path = configPath()): Promise<CliConfig> {
  try {
    const text = await readFile(path, "utf-8");
    return parseConfig(JSON.parse(text));
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Persist config, creating the directory tree if needed. */
export async function saveConfig(config: CliConfig, path = configPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  withFileLock(dirname(path), () => {
    saveConfigIfPrincipalCompatible(config, path);
  });
}

function saveConfigIfPrincipalCompatible(config: CliConfig, path: string): void {
  const existing = loadConfigSync(path);
  if (existing?.principalId !== undefined && existing.principalId !== config.principalId) {
    throw new Error(
      `CLI config principal ${existing.principalId} already won first boot; ` +
        `refusing to overwrite it with ${config.principalId ?? "<missing>"}.`,
    );
  }
  atomicWriteFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

function loadConfigSync(path: string): CliConfig | undefined {
  try {
    return parseConfig(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch {
    return undefined;
  }
}

/**
 * A config update, where an explicit `undefined` clears the stored value.
 *
 * `Partial<CliConfig>` cannot express that under `exactOptionalPropertyTypes`,
 * but clearing matters: a `baseUrl` overridden for one provider must not linger
 * on disk and silently redirect the next provider's requests.
 */
export type CliConfigPatch = { readonly [K in keyof CliConfig]?: CliConfig[K] | undefined };

/** Merge a patch into the on-disk config and write it back. */
export async function updateConfig(patch: CliConfigPatch, path = configPath()): Promise<CliConfig> {
  await mkdir(dirname(path), { recursive: true });
  let next = DEFAULT_CONFIG;
  withFileLock(dirname(path), () => {
    const current = loadConfigSync(path) ?? DEFAULT_CONFIG;
    const merged: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete merged[key];
      else merged[key] = value;
    }
    next = parseConfig(merged);
    saveConfigIfPrincipalCompatible(next, path);
  });
  return next;
}
