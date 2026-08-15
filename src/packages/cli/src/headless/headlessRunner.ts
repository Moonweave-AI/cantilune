import { createAdapter } from "@cantilune/adapter";
import type { BootConfig, CantilunOS, RunResult } from "@cantilune/boot";
import { buildLlmConfig, createCliRuntimeBoot } from "../runtimeSync.js";
import { ensureCliPrincipal, loadConfig } from "../config.js";
import { exportJson } from "../render/jsonExporter.js";

export interface HeadlessOptions {
  readonly instruction: string;
  readonly provider: string;
  readonly model: string;
  readonly json: boolean;
  readonly baseUrl?: string;
  readonly durable?: "memory" | "file";
  readonly storagePath?: string;
  readonly principalId?: string;
  readonly compatibleEpochIds?: readonly string[];
  readonly maxTurns?: number;
  readonly boot?: (
    provider: string,
    model: string,
    baseUrl?: string,
    runtimeConfig?: Partial<BootConfig>,
  ) => CantilunOS;
  /** Run as a multi-agent swarm (ADR-0019) instead of a single agent. */
  readonly swarm?: boolean;
  /**
   * Override the swarm boot (parallel to `boot`): given the same runtime config,
   * return a `run` function that drives the swarm to completion and returns the
   * `ClusterResult`. Tests inject a fake; production builds a real
   * `CantiluneSwarm` from the resolved config.
   */
  readonly swarmBoot?: (
    runtimeConfig: Partial<BootConfig>,
    instruction: string,
  ) => Promise<RunResult>;
}

export interface ParsedHeadlessArgs {
  readonly instruction: string;
  /** Undefined when absent, so the persisted config supplies the value. */
  readonly provider?: string;
  readonly model?: string;
  readonly json: boolean;
  readonly baseUrl?: string;
  readonly ephemeral: boolean;
  readonly swarm: boolean;
}

export function parseHeadlessArgs(argv: readonly string[]): ParsedHeadlessArgs {
  let instruction = "";
  let provider: string | undefined;
  let model: string | undefined;
  let json = false;
  let baseUrl: string | undefined;
  let ephemeral = false;
  let swarm = false;

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--ephemeral") {
      ephemeral = true;
    } else if (arg === "--swarm") {
      swarm = true;
    } else if (arg === "--provider") {
      provider = argv[++i] ?? provider;
    } else if (arg === "--model") {
      model = argv[++i] ?? model;
    } else if (arg === "--base-url") {
      baseUrl = argv[++i] ?? baseUrl;
    } else if (arg !== undefined && !arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  instruction = positional.join(" ").trim();
  return {
    instruction,
    json,
    ephemeral,
    swarm,
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
  };
}

function defaultBoot(
  provider: string,
  model: string,
  baseUrl?: string,
  runtimeConfig?: Partial<BootConfig>,
): CantilunOS {
  const llmConfig = buildLlmConfig(provider, model, baseUrl);
  const adapter = createAdapter(llmConfig);
  const durable = runtimeConfig?.durable ?? "file";
  return createCliRuntimeBoot(adapter, {
    ...runtimeConfig,
    durable,
    contentStore: durable === "file" ? "file" : "memory",
    ...(durable === "file" && runtimeConfig?.storagePath === undefined
      ? { storagePath: "./.cantilune/os" }
      : {}),
    llm: llmConfig,
  }).os;
}

/** A minimal failed RunResult for the headless swarm path. */
function swarmFailedResult(summary: string, rejected: number): RunResult {
  return {
    ok: false,
    summary,
    turns: 0,
    elapsedMs: 0,
    producedRefs: [],
    operations: { committed: 0, rejected },
  };
}

/** Find the first registered agent and the first active initiator on the head. */
function findWorkerAndInitiator(
  head: { participants: ReadonlyMap<string, { status: string; kind: string }> } | undefined,
): { workerId: string | undefined; initiator: { id: string; kind: string } | undefined } {
  let workerId: string | undefined;
  let initiator: { id: string; kind: string } | undefined;
  if (head === undefined) return { workerId, initiator };
  for (const [id, p] of head.participants) {
    if (workerId === undefined && p.status === "registered" && p.kind === "agent") {
      workerId = id;
    }
    if (initiator === undefined && p.status === "active") {
      initiator = { id, kind: p.kind };
    }
    if (workerId !== undefined && initiator !== undefined) break;
  }
  return { workerId, initiator };
}

/**
 * Default swarm boot (ADR-0019): build a real `CantiluneSwarm` from the
 * resolved runtime config, start it, and drive it to completion. The headless
 * instruction seeds the assigned task of a worker manifest this boot attempts to
 * activate from the first registered (non-active) agent on the runtime head; if
 * no registered agent is available the boot returns a real, non-hanging result
 * rather than waiting forever. Full swarm configuration (multiple manifests,
 * cross-process world) is driven by the TUI `/swarm` family + the L7 tests; this
 * default is the one-worker headless entry.
 */
async function defaultSwarmBoot(
  runtimeConfig: Partial<BootConfig>,
  instruction: string,
): Promise<RunResult> {
  const { bootSwarm } = await import("@cantilune/boot");
  const { createDefaultConditionRegistry } = await import("@cantilune/runtime");
  const { actorId, actorRef, coordinationIntent, matchBinding, operationTypeId, ALWAYS_CONDITION } =
    await import("@cantilune/core");
  const llmConfig = buildLlmConfig(
    runtimeConfig.llm?.provider ?? "anthropic",
    runtimeConfig.llm?.model ?? "claude",
    runtimeConfig.llm?.baseUrl,
  );
  const adapter = createAdapter(llmConfig);
  const durable = runtimeConfig.durable ?? "file";
  const boot = createCliRuntimeBoot(adapter, {
    ...runtimeConfig,
    durable,
    contentStore: durable === "file" ? "file" : "memory",
    ...(durable === "file" && runtimeConfig?.storagePath === undefined
      ? { storagePath: "./.cantilune/os" }
      : {}),
    llm: llmConfig,
  });
  const syscallRuntime = boot.syscallRuntime();
  const contentStore = boot.contentStore();
  const swarm = bootSwarm({
    runtime: syscallRuntime,
    contentStore,
    storagePath: runtimeConfig.storagePath ?? "./.cantilune/swarm",
    llmAdapterFactory: () => adapter,
    conditionRegistry: createDefaultConditionRegistry(),
    feedDrainIntervalMs: 200,
    heartbeatCheckIntervalMs: 15_000,
  });
  swarm.start();
  try {
    // Find the first registered (non-active) agent on the head to admit as the
    // worker; the instruction is its assigned task. If none is registered the
    // head has only the active principal, and there is nothing to activate —
    // return a real result instead of hanging on waitForCompletion.
    const head = syscallRuntime.getHead() as
      { participants: ReadonlyMap<string, { status: string; kind: string }> } | undefined;
    const { workerId, initiator } = findWorkerAndInitiator(head);
    if (workerId === undefined || initiator === undefined) {
      return swarmFailedResult(
        "swarm has no registered agent to activate (use /swarm activate in the TUI)",
        0,
      );
    }
    // Seed the worker manifest with the instruction as its assigned task.
    const manifestRef = await contentStore.put(
      JSON.stringify({
        agentId: workerId,
        kind: "agent",
        systemPrompt: "cantilune swarm agent",
        assignedTask: instruction,
        startCondition: ALWAYS_CONDITION,
        heartbeatIntervalMs: 5_000,
        designedBy: initiator.id,
      }),
      { mimeType: "application/json", createdBy: "cli:headless-swarm" },
    );
    const intent = coordinationIntent(
      actorRef(actorId(initiator.id), initiator.kind as "agent"),
      operationTypeId("activate_participant"),
      [matchBinding("from", initiator.id), matchBinding("participant", workerId)],
      undefined,
      [manifestRef],
    );
    const activate = syscallRuntime.proposeAndCommit(intent, {
      principal: actorRef(actorId(initiator.id), initiator.kind as "agent"),
    });
    if (!("ok" in activate) || !activate.ok) {
      return swarmFailedResult("swarm activation rejected by the runtime", 1);
    }
    const result = await swarm.waitForCompletion();
    // The headless swarm path surfaces the cluster result as a single
    // RunResult whose `ok`/`summary`/`turns`/`elapsedMs` come from the real
    // ClusterResult. There is no single-agent operation tally or produced-ref
    // set across a pool (each agent owns its own), so those are reported as
    // empty/zero — NOT fabricated: the swarm's per-agent results live in the
    // ClusterResult, and the headless single-line view intentionally collapses
    // to the cluster-level aggregate.
    return {
      ok: result.ok,
      summary: result.summary,
      turns: result.totalTurns,
      elapsedMs: result.totalElapsedMs,
      producedRefs: [],
      operations: { committed: 0, rejected: 0 },
    };
  } finally {
    await swarm.shutdown();
  }
}

/** Build the partial runtime config shared by both headless paths. */
function buildRuntimeConfig(
  options: Pick<
    HeadlessOptions,
    | "durable"
    | "storagePath"
    | "principalId"
    | "compatibleEpochIds"
    | "maxTurns"
    | "provider"
    | "model"
    | "baseUrl"
  >,
  includeLlm: boolean,
): Partial<BootConfig> {
  return {
    ...(options.durable !== undefined ? { durable: options.durable } : {}),
    ...(options.storagePath !== undefined ? { storagePath: options.storagePath } : {}),
    ...(options.principalId !== undefined ? { principalId: options.principalId } : {}),
    ...(options.compatibleEpochIds !== undefined
      ? { compatibleEpochIds: options.compatibleEpochIds }
      : {}),
    ...(options.maxTurns !== undefined ? { maxTurns: options.maxTurns } : {}),
    ...(includeLlm
      ? { llm: buildLlmConfig(options.provider, options.model, options.baseUrl) }
      : {}),
  };
}

/** Write a RunResult to stdout in the requested format. */
function writeResult(result: RunResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${exportJson(result)}\n`);
  } else {
    process.stdout.write(`${result.summary}\n`);
    process.stdout.write(`turns=${result.turns} elapsedMs=${result.elapsedMs} ok=${result.ok}\n`);
  }
}

async function runSwarmHeadless(options: HeadlessOptions): Promise<RunResult> {
  // Multi-agent swarm path (ADR-0019): boot a CantiluneSwarm instead of a single
  // CantilunOS and drive it to completion.
  const swarmBoot = options.swarmBoot ?? defaultSwarmBoot;
  const runtimeConfig = buildRuntimeConfig(options, true);
  const result = await swarmBoot(runtimeConfig, options.instruction);
  writeResult(result, options.json);
  return result;
}

async function runSingleAgentHeadless(options: HeadlessOptions): Promise<RunResult> {
  const boot = options.boot ?? defaultBoot;
  const hasRuntimeConfig =
    options.durable !== undefined ||
    options.storagePath !== undefined ||
    options.principalId !== undefined ||
    options.compatibleEpochIds !== undefined ||
    options.maxTurns !== undefined;
  const runtimeConfig = buildRuntimeConfig(options, false);
  const os = hasRuntimeConfig
    ? boot(options.provider, options.model, options.baseUrl, runtimeConfig)
    : boot(options.provider, options.model, options.baseUrl);
  try {
    const result = await os.run(options.instruction);
    writeResult(result, options.json);
    return result;
  } finally {
    await os.shutdown();
  }
}

export async function runHeadless(options: HeadlessOptions): Promise<RunResult> {
  return options.swarm === true ? runSwarmHeadless(options) : runSingleAgentHeadless(options);
}

export async function headlessRunner(argv: readonly string[]): Promise<number> {
  const parsed = parseHeadlessArgs(argv);
  if (parsed.instruction.length === 0) {
    process.stderr.write(
      'Usage: cantilune run "instruction" [--headless] [--swarm] [--provider X] [--model Y] [--base-url URL] [--ephemeral] [--json]\n',
    );
    return 1;
  }

  // Flags win, then the persisted config, then the built-in defaults — headless
  // runs pick up whatever `/provider` last selected in the TUI.
  const config = await ensureCliPrincipal(await loadConfig());
  const baseUrl = parsed.baseUrl ?? config.baseUrl;
  const durable = parsed.ephemeral ? "memory" : (config.durable ?? "file");
  const result = await runHeadless({
    ...parsed,
    provider: parsed.provider ?? config.provider,
    model: parsed.model ?? config.model,
    durable,
    ...(durable === "file" && config.storagePath !== undefined
      ? { storagePath: config.storagePath }
      : {}),
    ...(config.principalId !== undefined ? { principalId: config.principalId } : {}),
    ...(config.compatibleEpochIds !== undefined
      ? { compatibleEpochIds: config.compatibleEpochIds }
      : {}),
    ...(config.maxTurns !== undefined ? { maxTurns: config.maxTurns } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
  });
  return result.ok ? 0 : 1;
}
