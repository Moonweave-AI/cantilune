import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAdapter } from "@cantilune/adapter";
import type { BootConfig, CantilunOS, RunResult } from "@cantilune/boot";
import {
  actorId,
  actorRef,
  ALWAYS_CONDITION,
  coordinationIntent,
  matchBinding,
  operationTypeId,
} from "@cantilune/core";
import { buildLlmConfig, createCliRuntimeBoot, missingApiKeyVar } from "../runtimeSync.js";
import { ensureCliPrincipal, loadConfig } from "../config.js";
import { createCliToolSet } from "../wiring/cliToolSet.js";

type LifecycleActorKind = "agent" | "human" | "tool" | "reviewer" | "runtime" | "environment";

/**
 * Write the initiator's finished loop back to the committed world (ADR-0015 §4).
 *
 * Headless runs the initiator via `os.run` outside the supervisor live set, so
 * without this the initiator stays `active` and `waitForCompletion` cannot
 * converge after peers finish. This is the same `signal_done` the supervisor
 * already commits for every agent it started.
 */
export function commitParticipantDone(
  runtime: {
    proposeAndCommit: (intent: unknown, options: { principal: unknown }) => unknown;
  },
  participant: { readonly id: string; readonly kind: string },
): void {
  const kind = participant.kind as LifecycleActorKind;
  const ref = actorRef(actorId(participant.id), kind);
  runtime.proposeAndCommit(
    coordinationIntent(ref, operationTypeId("signal_done"), [matchBinding("from", participant.id)]),
    { principal: ref },
  );
}

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
  readonly maxTimeMs?: number;
  readonly workspace?: string;
  readonly contractProvider?: string;
  readonly contractModel?: string;
  readonly judgeProvider?: string;
  readonly judgeModel?: string;
  readonly swarmDirectory?: string;
  readonly swarmListen?: string;
  readonly swarmRole?: "supervisor" | "worker";
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
  readonly swarmDirectory?: string;
  readonly swarmListen?: string;
  readonly swarmRole?: "supervisor" | "worker";
  readonly contractProvider?: string;
  readonly contractModel?: string;
  readonly judgeProvider?: string;
  readonly judgeModel?: string;
  readonly instructionFile?: string;
  readonly storagePath?: string;
  readonly maxTurns?: number;
  readonly maxTimeMs?: number;
  readonly workspace?: string;
}

export function parseHeadlessArgs(argv: readonly string[]): ParsedHeadlessArgs {
  let instruction = "";
  let provider: string | undefined;
  let model: string | undefined;
  let json = false;
  let baseUrl: string | undefined;
  let ephemeral = false;
  let swarm = false;
  let swarmDirectory: string | undefined;
  let swarmListen: string | undefined;
  let swarmRole: "supervisor" | "worker" | undefined;
  let contractProvider: string | undefined;
  let contractModel: string | undefined;
  let judgeProvider: string | undefined;
  let judgeModel: string | undefined;
  let instructionFile: string | undefined;
  let storagePath: string | undefined;
  let maxTurns: number | undefined;
  let maxTimeMs: number | undefined;
  let workspace: string | undefined;

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--ephemeral") {
      ephemeral = true;
    } else if (arg === "--swarm") {
      swarm = true;
    } else if (arg === "--swarm-directory") {
      swarmDirectory = argv[++i] ?? swarmDirectory;
    } else if (arg === "--swarm-listen") {
      swarmListen = argv[++i] ?? swarmListen;
    } else if (arg === "--swarm-role") {
      const role = argv[++i];
      if (role === "supervisor" || role === "worker") swarmRole = role;
    } else if (arg === "--contract-provider") {
      contractProvider = argv[++i] ?? contractProvider;
    } else if (arg === "--contract-model") {
      contractModel = argv[++i] ?? contractModel;
    } else if (arg === "--judge-provider") {
      judgeProvider = argv[++i] ?? judgeProvider;
    } else if (arg === "--judge-model") {
      judgeModel = argv[++i] ?? judgeModel;
    } else if (arg === "--provider") {
      provider = argv[++i] ?? provider;
    } else if (arg === "--model") {
      model = argv[++i] ?? model;
    } else if (arg === "--base-url") {
      baseUrl = argv[++i] ?? baseUrl;
    } else if (arg === "--instruction-file") {
      instructionFile = argv[++i] ?? instructionFile;
    } else if (arg === "--storage-path") {
      storagePath = argv[++i] ?? storagePath;
    } else if (arg === "--max-turns") {
      maxTurns = parsePositiveFlag(argv[++i]);
    } else if (arg === "--max-time-ms") {
      maxTimeMs = parsePositiveFlag(argv[++i]);
    } else if (arg === "--workspace") {
      workspace = argv[++i] ?? workspace;
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
    ...(swarmDirectory !== undefined ? { swarmDirectory } : {}),
    ...(swarmListen !== undefined ? { swarmListen } : {}),
    ...(swarmRole !== undefined ? { swarmRole } : {}),
    ...(contractProvider !== undefined ? { contractProvider } : {}),
    ...(contractModel !== undefined ? { contractModel } : {}),
    ...(judgeProvider !== undefined ? { judgeProvider } : {}),
    ...(judgeModel !== undefined ? { judgeModel } : {}),
    ...(instructionFile !== undefined ? { instructionFile } : {}),
    ...(storagePath !== undefined ? { storagePath } : {}),
    ...(maxTurns !== undefined ? { maxTurns } : {}),
    ...(maxTimeMs !== undefined ? { maxTimeMs } : {}),
    ...(workspace !== undefined ? { workspace } : {}),
  };
}

export function parsePositiveFlag(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const value = Number(text);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function headlessWorkspaceDir(
  runtimeConfig?: Partial<BootConfig>,
  workspace?: string,
): string {
  return workspace ?? runtimeConfig?.storagePath ?? process.cwd();
}

export function selectHeadlessSwarmMode(
  workerId: string | undefined,
  initiator: { readonly id: string } | undefined,
): "activate-registered-worker" | "initiator-with-supervisor" {
  return workerId !== undefined && initiator !== undefined
    ? "activate-registered-worker"
    : "initiator-with-supervisor";
}

export function writeSwarmTrace(
  storagePath: string | undefined,
  events: readonly { readonly kind?: string }[],
  status: {
    readonly running: boolean;
    readonly scheduler: {
      readonly startedTotal: number;
      readonly completedTotal: number;
      readonly consumedTurns: number;
    };
  },
): void {
  if (storagePath === undefined || storagePath.length === 0) return;
  mkdirSync(storagePath, { recursive: true });
  const started = events.filter((event) => event.kind === "agent_started").length;
  writeFileSync(
    join(storagePath, "cluster-events.jsonl"),
    events.length === 0 ? "" : `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
  );
  writeFileSync(
    join(storagePath, "swarm-status.json"),
    `${JSON.stringify(
      {
        running: status.running,
        startedTotal: status.scheduler.startedTotal,
        completedTotal: status.scheduler.completedTotal,
        consumedTurns: status.scheduler.consumedTurns,
        agentStarted: started,
      },
      null,
      2,
    )}\n`,
  );
}

function defaultBoot(
  provider: string,
  model: string,
  baseUrl?: string,
  runtimeConfig?: Partial<BootConfig>,
  sensors?: {
    readonly contractProvider?: string;
    readonly contractModel?: string;
    readonly judgeProvider?: string;
    readonly judgeModel?: string;
  },
): CantilunOS {
  const llmConfig = buildLlmConfig(provider, model, baseUrl);
  const adapter = createAdapter(llmConfig);
  const durable = runtimeConfig?.durable ?? "file";
  const contractLlm =
    sensors?.contractProvider !== undefined && sensors.contractModel !== undefined
      ? createAdapter(buildLlmConfig(sensors.contractProvider, sensors.contractModel, baseUrl))
      : undefined;
  const judgeLlm =
    sensors?.judgeProvider !== undefined && sensors.judgeModel !== undefined
      ? createAdapter(buildLlmConfig(sensors.judgeProvider, sensors.judgeModel, baseUrl))
      : undefined;
  const workspace = headlessWorkspaceDir(runtimeConfig);
  const toolSet = createCliToolSet({ workingDirectory: workspace });
  return createCliRuntimeBoot(
    adapter,
    {
      ...runtimeConfig,
      durable,
      contentStore: durable === "file" ? "file" : "memory",
      tools: runtimeConfig?.tools ?? [toolSet.tools],
      ...(durable === "file" && runtimeConfig?.storagePath === undefined
        ? { storagePath: "./.cantilune/os" }
        : {}),
      llm: llmConfig,
    },
    {
      ...(contractLlm !== undefined ? { contractLlm } : {}),
      ...(judgeLlm !== undefined ? { judgeLlm } : {}),
    },
  ).os;
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
 * Default swarm boot (ADR-0019): one supervisor plus either a pre-registered
 * worker (legacy activate path) or the initiator OS running the instruction
 * while the supervisor watches register/activate (TUI-equivalent).
 */
async function defaultSwarmBoot(
  runtimeConfig: Partial<BootConfig>,
  instruction: string,
): Promise<RunResult> {
  const { bootSwarm } = await import("@cantilune/boot");
  const { createDefaultConditionRegistry } = await import("@cantilune/runtime");
  const llmConfig = buildLlmConfig(
    runtimeConfig.llm?.provider ?? "anthropic",
    runtimeConfig.llm?.model ?? "claude",
    runtimeConfig.llm?.baseUrl,
  );
  const adapter = createAdapter(llmConfig);
  const durable = runtimeConfig.durable ?? "file";
  const storagePath =
    runtimeConfig.storagePath ?? (durable === "file" ? "./.cantilune/os" : undefined);
  const workspace = headlessWorkspaceDir(
    { ...runtimeConfig, ...(storagePath !== undefined ? { storagePath } : {}) },
    undefined,
  );
  const toolSet = createCliToolSet({ workingDirectory: workspace });
  const boot = createCliRuntimeBoot(adapter, {
    ...runtimeConfig,
    durable,
    contentStore: durable === "file" ? "file" : "memory",
    tools: runtimeConfig.tools ?? [toolSet.tools],
    ...(storagePath !== undefined ? { storagePath } : {}),
    llm: llmConfig,
  });
  const syscallRuntime = boot.syscallRuntime();
  const contentStore = boot.contentStore();
  const clusterEvents: { kind?: string }[] = [];
  const swarm = bootSwarm({
    runtime: syscallRuntime,
    contentStore,
    storagePath: storagePath ?? "./.cantilune/swarm",
    llmAdapterFactory: () => adapter,
    conditionRegistry: createDefaultConditionRegistry(),
    feedDrainIntervalMs: 200,
    heartbeatCheckIntervalMs: 15_000,
    completionPollMs: 200,
    ...(runtimeConfig.maxTimeMs !== undefined
      ? { schedulerPolicy: { maxWallClockMs: runtimeConfig.maxTimeMs } }
      : {}),
    eventListener: (event) => {
      clusterEvents.push(event);
    },
  });
  swarm.start();
  try {
    const head = syscallRuntime.getHead() as
      { participants: ReadonlyMap<string, { status: string; kind: string }> } | undefined;
    const { workerId, initiator } = findWorkerAndInitiator(head);
    if (selectHeadlessSwarmMode(workerId, initiator) === "initiator-with-supervisor") {
      const initiatorResult = await boot.os.run(instruction);
      if (initiator !== undefined) {
        commitParticipantDone(syscallRuntime, initiator);
      }
      const peerResult = await swarm.waitForCompletion();
      writeSwarmTrace(storagePath, clusterEvents, swarm.status());
      return {
        ok: initiatorResult.ok && peerResult.ok,
        summary: initiatorResult.summary,
        turns: initiatorResult.turns + swarm.status().scheduler.consumedTurns,
        elapsedMs: initiatorResult.elapsedMs + peerResult.totalElapsedMs,
        producedRefs: initiatorResult.producedRefs,
        operations: initiatorResult.operations,
      };
    }
    const manifestRef = await contentStore.put(
      JSON.stringify({
        agentId: workerId,
        kind: "agent",
        systemPrompt: "cantilune swarm agent",
        assignedTask: instruction,
        startCondition: ALWAYS_CONDITION,
        heartbeatIntervalMs: 5_000,
        designedBy: initiator!.id,
      }),
      { mimeType: "application/json", createdBy: "cli:headless-swarm" },
    );
    const intent = coordinationIntent(
      actorRef(actorId(initiator!.id), initiator!.kind as "agent"),
      operationTypeId("activate_participant"),
      [matchBinding("from", initiator!.id), matchBinding("participant", workerId!)],
      undefined,
      [manifestRef],
    );
    const activate = syscallRuntime.proposeAndCommit(intent, {
      principal: actorRef(actorId(initiator!.id), initiator!.kind as "agent"),
    });
    if (!("ok" in activate) || !activate.ok) {
      return swarmFailedResult("swarm activation rejected by the runtime", 1);
    }
    const result = await swarm.waitForCompletion();
    writeSwarmTrace(storagePath, clusterEvents, swarm.status());
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
    await boot.os.shutdown();
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
    | "maxTimeMs"
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
    ...(options.maxTimeMs !== undefined ? { maxTimeMs: options.maxTimeMs } : {}),
    ...(includeLlm
      ? { llm: buildLlmConfig(options.provider, options.model, options.baseUrl) }
      : {}),
  };
}

/** Write a RunResult to the isolated world and to stdout. */
export function writeResult(result: RunResult, json: boolean, storagePath?: string): void {
  if (storagePath !== undefined && storagePath.length > 0) {
    mkdirSync(storagePath, { recursive: true });
    writeFileSync(join(storagePath, "result.json"), `${JSON.stringify(result)}\n`);
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  process.stdout.write(`${result.summary}\n`);
  process.stdout.write(`turns=${result.turns} elapsedMs=${result.elapsedMs} ok=${result.ok}\n`);
}

async function runSwarmHeadless(options: HeadlessOptions): Promise<RunResult> {
  // Multi-agent swarm path (ADR-0019): boot a CantiluneSwarm instead of a single
  // CantilunOS and drive it to completion.
  const swarmBoot = options.swarmBoot ?? defaultSwarmBoot;
  const runtimeConfig = buildRuntimeConfig(options, true);
  const result = await swarmBoot(runtimeConfig, options.instruction);
  writeResult(result, options.json, options.storagePath);
  return result;
}

async function runSingleAgentHeadless(options: HeadlessOptions): Promise<RunResult> {
  const sensors = {
    ...(options.contractProvider !== undefined
      ? { contractProvider: options.contractProvider }
      : {}),
    ...(options.contractModel !== undefined ? { contractModel: options.contractModel } : {}),
    ...(options.judgeProvider !== undefined ? { judgeProvider: options.judgeProvider } : {}),
    ...(options.judgeModel !== undefined ? { judgeModel: options.judgeModel } : {}),
  };
  const boot =
    options.boot ??
    ((provider, model, baseUrl, runtimeConfig) =>
      defaultBoot(provider, model, baseUrl, runtimeConfig, sensors));
  const hasRuntimeConfig =
    options.durable !== undefined ||
    options.storagePath !== undefined ||
    options.principalId !== undefined ||
    options.compatibleEpochIds !== undefined ||
    options.maxTurns !== undefined ||
    options.maxTimeMs !== undefined;
  const runtimeConfig = buildRuntimeConfig(options, false);
  const os = hasRuntimeConfig
    ? boot(options.provider, options.model, options.baseUrl, runtimeConfig)
    : boot(options.provider, options.model, options.baseUrl);
  try {
    const result = await os.run(options.instruction);
    writeResult(result, options.json, options.storagePath);
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
  let instruction = parsed.instruction;
  if (parsed.instructionFile !== undefined && parsed.instructionFile.length > 0) {
    instruction = readFileSync(parsed.instructionFile, "utf8");
  }
  if (instruction.trim().length === 0) {
    process.stderr.write(
      'Usage: cantilune run "instruction" [--headless] [--swarm] [--instruction-file PATH] [--storage-path DIR] [--provider X] [--model Y] [--base-url URL] [--ephemeral] [--json]\n',
    );
    return 1;
  }

  // Flags win, then the persisted config, then the built-in defaults — headless
  // runs pick up whatever `/provider` last selected in the TUI.
  const { assertRequiredHostCapabilities } = await import("../wiring/hostCapabilities.js");
  await assertRequiredHostCapabilities();
  const config = await ensureCliPrincipal(await loadConfig());
  const provider = parsed.provider ?? config.provider;
  const missingKey = missingApiKeyVar(provider);
  if (missingKey !== null) {
    process.stderr.write(`missing ${missingKey} for provider ${provider}\n`);
    return 1;
  }
  const baseUrl = parsed.baseUrl ?? config.baseUrl;
  const durable = parsed.ephemeral ? "memory" : (config.durable ?? "file");
  const storagePath = parsed.storagePath ?? (durable === "file" ? config.storagePath : undefined);
  const result = await runHeadless({
    ...parsed,
    instruction,
    provider,
    model: parsed.model ?? config.model,
    durable,
    ...(storagePath !== undefined ? { storagePath } : {}),
    ...(config.principalId !== undefined ? { principalId: config.principalId } : {}),
    ...(config.compatibleEpochIds !== undefined
      ? { compatibleEpochIds: config.compatibleEpochIds }
      : {}),
    ...(parsed.maxTurns !== undefined
      ? { maxTurns: parsed.maxTurns }
      : config.maxTurns !== undefined
        ? { maxTurns: config.maxTurns }
        : {}),
    ...(parsed.maxTimeMs !== undefined ? { maxTimeMs: parsed.maxTimeMs } : {}),
    ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    ...((parsed.contractProvider ?? config.contractProvider) !== undefined
      ? { contractProvider: parsed.contractProvider ?? config.contractProvider }
      : {}),
    ...((parsed.contractModel ?? config.contractModel) !== undefined
      ? { contractModel: parsed.contractModel ?? config.contractModel }
      : {}),
    ...((parsed.judgeProvider ?? config.judgeProvider) !== undefined
      ? { judgeProvider: parsed.judgeProvider ?? config.judgeProvider }
      : {}),
    ...((parsed.judgeModel ?? config.judgeModel) !== undefined
      ? { judgeModel: parsed.judgeModel ?? config.judgeModel }
      : {}),
    ...((parsed.swarmDirectory ?? config.swarmDirectoryPath) !== undefined
      ? { swarmDirectory: parsed.swarmDirectory ?? config.swarmDirectoryPath }
      : {}),
    ...((parsed.swarmListen ?? config.swarmListen) !== undefined
      ? { swarmListen: parsed.swarmListen ?? config.swarmListen }
      : {}),
    ...((parsed.swarmRole ?? config.swarmRole) !== undefined
      ? { swarmRole: parsed.swarmRole ?? config.swarmRole }
      : {}),
  });
  return result.ok ? 0 : 1;
}
