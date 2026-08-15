import {
  closeSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ACTOR_KINDS,
  operationTypeId,
  collaborationSnapshot,
  snapshotRef,
  epochId,
  timestamp,
  actorId as coreActorId,
  participant,
  changeId,
  sessionId,
  linkId,
  artifactId,
  capabilityId,
  evidenceId,
} from "@cantilune/core";
import type { ActorKind, CollaborationSnapshot, Timestamp } from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createFileContentStore } from "@cantilune/content/file";
import { isSha256ContentRef } from "@cantilune/content";
import {
  createCoordinationRuntime,
  runtimeDependenciesWithStaticSchema,
  createDefaultSchema,
  createDefaultHandlers,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import type { Clock, ContentRefAuthority, IdGenerator } from "@cantilune/runtime";
import {
  createMemoryRuntimePersistence,
  createFileRuntimePersistence,
  readFileRuntimeActiveBinding,
  MemoryResourceLockTable,
} from "@cantilune/runtime/memory";
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";
import type { AvailableTemplate, SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import type {
  BootConfig,
  BootMemoryOSConfig,
  BootFileOSConfig,
  CantilunOS,
  CantilunOSRunOptions,
  LlmAdapter,
  AgentEvent,
  RunResult,
  RunOptions,
} from "./types.js";
import {
  createAgentLoopHistory,
  requireAgentLoopHistory,
  runAgentLoop,
  validateAgentLoopLimits,
} from "./agentLoop.js";
import { createTerminationController } from "./termination/index.js";
import { mergeToolExecutors } from "./toolMerge.js";
import { wrapCoordinationRuntime } from "./runtimeAdapter.js";

/**
 * Default operations aligned with @cantilune/runtime defaultSchema.ts.
 * Single source: if runtime adds operations, update here or use dynamic provider.
 */
export const DEFAULT_TEMPLATES: readonly AvailableTemplate[] = Object.freeze(
  [
    {
      operationTypeId: operationTypeId("introduce_artifact"),
      description: "Introduce a new work artifact",
      requiredRoles: ["task", "from"],
      contentRefInputs: [
        {
          name: "contentRef",
          description: "The sha256 ContentRef returned by write_content",
          required: true,
        },
      ],
    },
    {
      operationTypeId: operationTypeId("delegate"),
      description: "Delegate task to another participant",
      requiredRoles: ["task", "from", "to", "capability"],
    },
    {
      operationTypeId: operationTypeId("create_session"),
      description: "Create a communication session",
      requiredRoles: ["from"],
    },
    {
      operationTypeId: operationTypeId("fork_branch"),
      description: "Open a parallel branch",
      requiredRoles: ["from"],
    },
    {
      operationTypeId: operationTypeId("publish_artifact"),
      description: "Publish a work artifact",
      requiredRoles: ["task", "from"],
    },
    {
      operationTypeId: operationTypeId("transfer_session"),
      description: "Transfer session controller",
      requiredRoles: ["session", "from", "to"],
    },
    {
      operationTypeId: operationTypeId("register_participant"),
      description: "Register a new agent participant in the cluster",
      requiredRoles: ["from", "participant"],
    },
    {
      operationTypeId: operationTypeId("signal_done"),
      description: "Signal that this agent has completed its work",
      requiredRoles: ["from"],
    },
    {
      operationTypeId: operationTypeId("retire_participant"),
      description: "Retire a participant from the coordination world",
      requiredRoles: ["from", "participant"],
    },
    {
      operationTypeId: operationTypeId("emit_heartbeat"),
      description: "Emit a heartbeat signal proving agent liveness",
      requiredRoles: ["from"],
      scalarInputs: [
        {
          name: "turnCount",
          type: "nonNegativeInteger" as const,
          description: "Completed Agent loop turns as a canonical decimal string",
          required: true,
        },
        {
          name: "lastAction",
          type: "string" as const,
          description: "Most recent Agent loop action",
          required: true,
        },
      ],
    },
  ].map((template) =>
    Object.freeze({
      ...template,
      requiredRoles: Object.freeze([...template.requiredRoles]),
      ...(template.contentRefInputs === undefined
        ? {}
        : {
            contentRefInputs: Object.freeze(
              template.contentRefInputs.map((input) => Object.freeze({ ...input })),
            ),
          }),
      ...(template.scalarInputs === undefined
        ? {}
        : {
            scalarInputs: Object.freeze(
              template.scalarInputs.map((input) => Object.freeze({ ...input })),
            ),
          }),
    }),
  ),
);

/**
 * Boot dependencies injected by the caller.
 * Boot does NOT construct runtime itself — caller provides a ready runtime.
 * This keeps boot decoupled from runtime's complex dependency graph.
 */
export interface BootDependencies {
  readonly runtime: SyscallRuntime;
  readonly contentStore: SyscallContentStore;
  readonly llmAdapter: LlmAdapter;
  readonly config: BootConfig;
}

function preLoopFailure(
  message: string,
  options: RunOptions | undefined,
  retryable = false,
): RunResult {
  emitBootEvent(options, {
    kind: "error",
    turn: 0,
    phase: "perceive",
    message,
    retryable,
  });
  return {
    ok: false,
    summary: `Failed to observe instruction: ${message}`,
    turns: 0,
    elapsedMs: 0,
    producedRefs: [],
    terminationReason: "error",
    operations: { committed: 0, rejected: 0 },
    toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 },
    error: { phase: "perceive", message, retryable },
  };
}

function preLoopAborted(): RunResult {
  return {
    ok: false,
    summary: "Run aborted by caller before instruction observation.",
    turns: 0,
    elapsedMs: 0,
    producedRefs: [],
    terminationReason: "aborted",
    operations: { committed: 0, rejected: 0 },
    toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 },
  };
}

function initialRunGate(
  options: RunOptions | undefined,
  configurationError: string | undefined,
): RunResult | undefined {
  if (options?.signal?.aborted) return preLoopAborted();
  if (configurationError !== undefined) {
    return preLoopConfigurationFailure(configurationError, options);
  }
  return undefined;
}

function preLoopConfigurationFailure(message: string, options: RunOptions | undefined): RunResult {
  emitBootEvent(options, {
    kind: "error",
    turn: 0,
    phase: "configuration",
    message,
    retryable: false,
  });
  return {
    ok: false,
    summary: message,
    turns: 0,
    elapsedMs: 0,
    producedRefs: [],
    terminationReason: "error",
    operations: { committed: 0, rejected: 0 },
    toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 },
    error: { phase: "configuration", message, retryable: false },
  };
}

function emitBootEvent(options: RunOptions | undefined, event: AgentEvent): void {
  try {
    const observer = options?.onEvent;
    if (observer === undefined) return;
    const result = (observer as (event: AgentEvent) => unknown)(structuredClone(event));
    try {
      void Promise.resolve(result).catch(() => undefined);
    } catch {
      // A hostile thenable is telemetry input, never execution authority.
    }
  } catch {
    // UI/telemetry callbacks are not execution authorities.
  }
}

function singleFlightFailure(options: CantilunOSRunOptions | undefined): RunResult {
  const message =
    "CantilunOS.run is single-flight because one OS owns one ordered private history; " +
    "await the active run or create a separate OS instance.";
  emitBootEvent(options, {
    kind: "error",
    turn: 0,
    phase: "configuration",
    message,
    retryable: true,
  });
  return {
    ok: false,
    summary: message,
    turns: 0,
    elapsedMs: 0,
    producedRefs: [],
    terminationReason: "error",
    operations: { committed: 0, rejected: 0 },
    toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 },
    error: { phase: "configuration", message, retryable: true },
  };
}

function containsUnsafeHistoryOverride(options: CantilunOSRunOptions | undefined): boolean {
  return (
    options !== undefined && Object.prototype.hasOwnProperty.call(options as object, "history")
  );
}

function observerOnlyRunOptions(options: CantilunOSRunOptions | undefined): RunOptions | undefined {
  if (options === undefined) return undefined;
  return {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
    ...(options.onEvent === undefined ? {} : { onEvent: options.onEvent }),
  };
}

async function observeInstructionForRun(
  instruction: string,
  principalId: string,
  principal: { readonly actorId: string; readonly kind: string },
  contentStore: SyscallContentStore,
  runtime: SyscallRuntime,
  options: CantilunOSRunOptions | undefined,
): Promise<RunResult | undefined> {
  let inputRef: Awaited<ReturnType<typeof contentStore.put>>;
  try {
    inputRef = await contentStore.put(instruction, {
      mimeType: "text/plain",
      createdBy: principalId,
    });
  } catch (error) {
    return preLoopFailure(
      `instruction content store error: ${error instanceof Error ? error.message : String(error)}`,
      options,
      true,
    );
  }
  if (typeof inputRef !== "string" || !isSha256ContentRef(inputRef)) {
    return preLoopFailure("instruction content store returned an invalid ContentRef", options);
  }
  if (options?.signal?.aborted) return preLoopAborted();

  let rawObserveResult: unknown;
  try {
    rawObserveResult = runtime.observe({ source: principal, payloadRef: inputRef }, { principal });
  } catch (error) {
    return preLoopFailure(
      `runtime observation error: ${error instanceof Error ? error.message : String(error)}`,
      options,
      true,
    );
  }
  try {
    const observeResult = requireBootObserveResult(rawObserveResult);
    return observeResult.ok
      ? undefined
      : preLoopFailure(observeResult.message ?? "runtime rejected the observation", options);
  } catch (error) {
    return preLoopFailure(error instanceof Error ? error.message : String(error), options);
  }
}

function requireBootObserveResult(value: unknown): {
  readonly ok: boolean;
  readonly message?: string;
} {
  let detached: unknown;
  try {
    detached = structuredClone(value);
  } catch {
    throw new TypeError("runtime returned a non-cloneable observation result");
  }
  if (detached === null || typeof detached !== "object" || Array.isArray(detached)) {
    throw new TypeError("runtime returned an invalid observation result");
  }
  const record = detached as Record<string, unknown>;
  if (
    (record["ok"] !== true && record["ok"] !== false) ||
    (record["message"] !== undefined && typeof record["message"] !== "string")
  ) {
    throw new TypeError("runtime returned an invalid observation result");
  }
  return {
    ok: record["ok"],
    ...(typeof record["message"] === "string" ? { message: record["message"] } : {}),
  };
}

/**
 * Boot the Cantilune OS — production entry point.
 *
 * Usage:
 * ```ts
 * import { bootCantilune } from "@cantilune/boot";
 *
 * const os = bootCantilune({
 *   runtime,       // SyscallRuntime (from @cantilune/runtime)
 *   contentStore,  // SyscallContentStore (from @cantilune/content)
 *   llmAdapter,    // LlmAdapter (your LLM wrapper)
 *   config: { durable: "file", contentStore: "file", llm: { provider: "openai", model: "gpt-4o" } },
 * });
 * const result = await os.run("Add OAuth to login page");
 * ```
 *
 * Design: os.run() enters the agent loop. All decisions by LLM. All governance by runtime admission.
 */
export function bootCantilune(deps: BootDependencies): CantilunOS {
  const { runtime, contentStore, llmAdapter, config } = deps;
  const toolExecutor = config.tools ? mergeToolExecutors(config.tools) : undefined;
  const schemaProvider = createStaticSchemaProvider(DEFAULT_TEMPLATES);
  const principalId = config.principalId ?? `boot-${crypto.randomUUID().slice(0, 8)}`;
  const principalKind = config.principalKind ?? "agent";
  const principal = { actorId: principalId, kind: principalKind };

  const syscall = createSyscall({
    runtime,
    contentStore,
    principal,
    schemaProvider,
    ...(toolExecutor !== undefined ? { toolExecutor } : {}),
  });

  const maxTurns = config.maxTurns ?? 100;
  const maxTimeMs = config.maxTimeMs ?? 600_000;
  const maxContextMessages = config.maxContextMessages ?? 40;
  const loopConfigurationError = validateAgentLoopLimits({
    maxTurns,
    maxTimeMs,
    maxContext: maxContextMessages,
    perTurnTimeout: 120_000,
  });
  const terminationController = createTerminationController({
    // The contract compiler drafts acceptance criteria once per run and never
    // owns termination. It gets its own adapter so it cannot consume a call from
    // the loop's adapter (which would shift every scripted response sequence in
    // tests and add a billed call per run in production). When no dedicated
    // compiler adapter is provided, the controller compiles the default system
    // contract without any LLM call — it never falls back to the loop adapter.
    ...(config.contractLlm === undefined ? {} : { llm: config.contractLlm }),
    // ADR-0020: dedicated judge adapter for soft-criterion LLM judging. The
    // judge never owns termination and never overrides a hard failure; it must
    // not share the loop or contract adapter (self-assessment contamination).
    // When absent the controller keeps the structured_rubric placeholder
    // (ρ=0.3, fail-closed) and makes no judge LLM call.
    ...(config.judgeLlm === undefined ? {} : { judgeLlm: config.judgeLlm }),
    ...(config.embedder === undefined ? {} : { embedder: config.embedder }),
    ...(config.thresholds === undefined ? {} : { thresholds: config.thresholds }),
  });
  // Private to this OS instance: shared across user turns, never projected into
  // CollaborationSnapshot or the audit trail.
  const conversation =
    config.history === undefined
      ? createAgentLoopHistory(config.initialMessages)
      : requireAgentLoopHistory(config.history);
  const agentLoopConfig = {
    maxTurns,
    maxTimeMs,
    maxContextMessages,
    actorId: principalId,
    history: conversation,
    ...(config.systemPrompt !== undefined ? { systemPrompt: config.systemPrompt } : {}),
  };
  let runInProgress = false;
  let checkpointPoison: string | undefined;
  const checkpointPrivateHistory =
    config.onHistoryCheckpoint === undefined
      ? undefined
      : async (history: ReturnType<typeof requireAgentLoopHistory>): Promise<void> => {
          try {
            await config.onHistoryCheckpoint?.(history);
          } catch (error) {
            checkpointPoison =
              "This CantilunOS instance is fail-closed because its private history checkpoint " +
              "failed. Create a new OS from the last verified durable AgentLoopHistory before running again.";
            throw error;
          }
        };

  return {
    privateHistory(): ReturnType<typeof requireAgentLoopHistory> {
      return requireAgentLoopHistory(conversation);
    },

    async run(instruction: string, options?: CantilunOSRunOptions): Promise<RunResult> {
      if (runInProgress) return singleFlightFailure(options);

      if (checkpointPoison !== undefined) {
        return preLoopConfigurationFailure(checkpointPoison, options);
      }
      if (containsUnsafeHistoryOverride(options)) {
        return preLoopConfigurationFailure(
          "CantilunOS owns one private history; per-run history overrides are not allowed.",
          options,
        );
      }

      runInProgress = true;
      try {
        const gateResult = initialRunGate(options, loopConfigurationError);
        if (gateResult !== undefined) return gateResult;
        const observationFailure = await observeInstructionForRun(
          instruction,
          principalId,
          principal,
          contentStore,
          runtime,
          options,
        );
        if (observationFailure !== undefined) return observationFailure;

        const result = await runAgentLoop(
          syscall,
          llmAdapter,
          instruction,
          terminationController,
          checkpointPrivateHistory === undefined
            ? agentLoopConfig
            : { ...agentLoopConfig, onHistoryCheckpoint: checkpointPrivateHistory },
          observerOnlyRunOptions(options),
        );
        return result;
      } finally {
        runInProgress = false;
      }
    },

    async shutdown(): Promise<void> {
      const cs: unknown = contentStore;
      if (
        cs !== null &&
        typeof cs === "object" &&
        "flush" in cs &&
        typeof (cs as { flush: unknown }).flush === "function"
      ) {
        await (cs as { flush: () => Promise<void> }).flush();
      }
      const rt: unknown = runtime;
      if (
        rt !== null &&
        typeof rt === "object" &&
        "flush" in rt &&
        typeof (rt as { flush: unknown }).flush === "function"
      ) {
        await (rt as { flush: () => Promise<void> }).flush();
      }
    },
  };
}

/**
 * Epoch stamped on the snapshot a fresh boot starts from.
 *
 * Admission compares the head snapshot's epoch against the active schema
 * context's epoch and rejects the operation on any difference, so the two must
 * be wired from a single value rather than each picking its own default.
 */
export const BOOT_EPOCH_ID = epochId("boot-epoch-1");

const FILE_PRINCIPAL_RECORD = "principal.json";

interface FilePrincipalRecord {
  readonly actorId: string;
  readonly kind: ActorKind;
}

function isActorKind(value: unknown): value is ActorKind {
  return typeof value === "string" && (ACTOR_KINDS as readonly string[]).includes(value);
}

/**
 * Read the local identity bound to a file-backed world.
 *
 * The record contains no credential or authority token. It only prevents a
 * restart from silently minting a different `boot-*` id and then failing its
 * first observation because that new actor is absent from the durable world.
 */
function readFilePrincipal(storagePath: string): FilePrincipalRecord | undefined {
  try {
    const parsed = JSON.parse(
      readFileSync(join(storagePath, FILE_PRINCIPAL_RECORD), "utf8"),
    ) as Record<string, unknown>;
    if (typeof parsed["actorId"] !== "string" || !isActorKind(parsed["kind"])) {
      throw new Error("principal record has an invalid actorId or kind");
    }
    return { actorId: parsed["actorId"], kind: parsed["kind"] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(
      `Cannot read ${FILE_PRINCIPAL_RECORD}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function writeFilePrincipal(storagePath: string, principalRecord: FilePrincipalRecord): void {
  mkdirSync(storagePath, { recursive: true });
  const targetPath = join(storagePath, FILE_PRINCIPAL_RECORD);
  const temporaryPath = join(storagePath, `.principal-${crypto.randomUUID()}.tmp`);
  const descriptor = openSync(temporaryPath, "wx");
  try {
    writeFileSync(descriptor, `${JSON.stringify(principalRecord, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    // Publish a complete inode atomically. Writing directly to principal.json
    // with `wx` could leave a truncated identity record after process death.
    linkSync(temporaryPath, targetPath);
    syncDirectoryEntry(storagePath);
  } finally {
    removeTemporaryPrincipal(temporaryPath);
  }
}

function removeTemporaryPrincipal(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function syncDirectoryEntry(directory: string): void {
  let descriptor: number;
  try {
    descriptor = openSync(directory, "r");
  } catch {
    return;
  }
  try {
    fsyncSync(descriptor);
  } catch {
    // Windows cannot fsync directories; the fully synced file still prevents
    // a published identity from containing partial JSON.
  } finally {
    closeSync(descriptor);
  }
}

function configWithStoredPrincipal(
  config: BootFileOSConfig,
  storedPrincipal: FilePrincipalRecord | undefined,
): BootFileOSConfig {
  if (storedPrincipal === undefined || config.principalId !== undefined) return config;
  return {
    ...config,
    principalId: storedPrincipal.actorId,
    principalKind: storedPrincipal.kind,
  };
}

function persistDefaultFilePrincipal(
  storagePath: string,
  principalRecord: FilePrincipalRecord,
  shouldPersist: boolean,
): void {
  if (!shouldPersist) return;
  try {
    writeFilePrincipal(storagePath, principalRecord);
  } catch (error) {
    // A concurrent process may have created the record. It is safe only when
    // both processes converged on the same identity.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const concurrent = readFilePrincipal(storagePath);
    if (
      concurrent?.actorId !== principalRecord.actorId ||
      concurrent.kind !== principalRecord.kind
    ) {
      throw new Error("Concurrent file-world boot selected a different default principal.");
    }
  }
}

function principalFromResumedWorld(
  snapshot: CollaborationSnapshot,
  requested: FilePrincipalRecord,
  explicit: boolean,
): FilePrincipalRecord {
  const existing = snapshot.participants.get(coreActorId(requested.actorId));
  if (existing !== undefined) {
    if (existing.kind !== requested.kind) {
      throw new Error(
        `File world principal ${requested.actorId} has kind ${existing.kind}, not ${requested.kind}.`,
      );
    }
    if (existing.status !== "active") {
      throw new Error(
        `File world principal ${requested.actorId} is ${existing.status}; an active participant is required.`,
      );
    }
    return requested;
  }

  if (explicit) {
    throw new Error(
      `File world principal ${requested.actorId} is not registered in the resumed world. ` +
        "Register it from an existing active participant before booting with that identity.",
    );
  }

  // Migration for worlds created before principal.json existed. Adopting is
  // only unambiguous when exactly one active participant exists.
  const candidates = [...snapshot.participants.values()].filter(
    (entry) => entry.status === "active" && entry.kind === requested.kind,
  );
  if (candidates.length === 1 && candidates[0] !== undefined) {
    return { actorId: String(candidates[0].actorId), kind: candidates[0].kind };
  }

  throw new Error(
    "The resumed file world has no persisted default principal and its active identity is ambiguous. " +
      "Pass principalId and principalKind for an already registered active participant.",
  );
}

function initialBootSnapshot(config: Partial<Pick<BootConfig, "principalId" | "principalKind">>): {
  readonly pid: string;
  readonly pkind: ActorKind;
  readonly t0: ReturnType<typeof collaborationSnapshot>;
} {
  const pid = config.principalId ?? `boot-${crypto.randomUUID().slice(0, 8)}`;
  const pkind = (config.principalKind ?? "agent") as ActorKind;
  const bootParticipantId = coreActorId(pid);
  const t0 = collaborationSnapshot({
    // This is the immutable generation identity of a newly created world.
    // A fixed T0 ref lets a deleted/replaced directory masquerade as the old
    // world and inherit its private CLI transcript.
    snapshotRef: snapshotRef(`genesis-${crypto.randomUUID()}`),
    epochId: BOOT_EPOCH_ID,
    participants: new Map([[bootParticipantId, participant(bootParticipantId, pkind)]]),
  });
  return { pid, pkind, t0 };
}

function finalizeBootConfig(
  backends: Pick<BootConfig, "durable" | "contentStore"> & { storagePath?: string },
  config: BootMemoryOSConfig | BootFileOSConfig,
  pid: string,
  pkind: ActorKind,
): BootConfig {
  return {
    ...backends,
    llm: config.llm,
    principalId: pid,
    principalKind: pkind,
    ...(backends.storagePath !== undefined ? { storagePath: backends.storagePath } : {}),
    ...(config.tools !== undefined ? { tools: config.tools } : {}),
    ...(config.maxTurns !== undefined ? { maxTurns: config.maxTurns } : {}),
    ...(config.maxTimeMs !== undefined ? { maxTimeMs: config.maxTimeMs } : {}),
    ...(config.maxContextMessages !== undefined
      ? { maxContextMessages: config.maxContextMessages }
      : {}),
    ...(config.systemPrompt !== undefined ? { systemPrompt: config.systemPrompt } : {}),
    ...(config.initialMessages !== undefined ? { initialMessages: config.initialMessages } : {}),
    ...(config.history !== undefined ? { history: config.history } : {}),
    ...(config.onHistoryCheckpoint !== undefined
      ? { onHistoryCheckpoint: config.onHistoryCheckpoint }
      : {}),
    ...(config.compatibleEpochIds !== undefined
      ? { compatibleEpochIds: config.compatibleEpochIds }
      : {}),
  };
}

/** Bind the built-in schema to its canonical epoch and reviewed legacy aliases. */
function createBootCoordinationRuntime(
  durable: Parameters<typeof runtimeDependenciesWithStaticSchema>[0]["durable"],
  locks: Parameters<typeof runtimeDependenciesWithStaticSchema>[0]["locks"],
  contentRefAuthority: ContentRefAuthority,
  activeEpochId: Parameters<typeof runtimeDependenciesWithStaticSchema>[0]["activeEpochId"],
  compatibleEpochIds: Parameters<
    typeof runtimeDependenciesWithStaticSchema
  >[0]["compatibleEpochIds"] = [],
) {
  return createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: wallClock(),
      idGen: uuidIdGenerator(),
      schema: createDefaultSchema(),
      activeEpochId,
      compatibleEpochIds,
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks,
      contentRefAuthority,
    }),
  );
}

/**
 * Quick-start: creates a memory-backed OS with a REAL CoordinationRuntime.
 * Uses @cantilune/runtime's createCoordinationRuntime + memory adapters.
 * All admission, policy, and commit governance is real — no stubs.
 */
export function bootMemoryOS(llmAdapter: LlmAdapter, config: BootMemoryOSConfig): CantilunOS {
  if (config.llm === undefined) {
    throw new Error(
      "bootMemoryOS requires config.llm — provide { provider, model } matching your LlmAdapter.",
    );
  }
  if (config.history !== undefined) requireAgentLoopHistory(config.history);

  const { pid, pkind, t0 } = initialBootSnapshot(config);
  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const contentStore = createMemoryContentStore();
  const coordinationRuntime = createBootCoordinationRuntime(
    durable,
    new MemoryResourceLockTable(),
    contentStore,
    BOOT_EPOCH_ID,
  );
  const memoryRuntime = wrapCoordinationRuntime(coordinationRuntime);
  const finalConfig = finalizeBootConfig(
    { durable: "memory", contentStore: "memory" },
    config,
    pid,
    pkind,
  );
  return bootCantilune({ runtime: memoryRuntime, contentStore, llmAdapter, config: finalConfig });
}

/**
 * Production factory: file-backed durable runtime + content store.
 * Data survives process restarts via @cantilune/runtime and @cantilune/content file adapters.
 */
export function bootFileOS(llmAdapter: LlmAdapter, config: BootFileOSConfig): CantilunOS {
  if (config.llm === undefined) {
    throw new Error(
      "bootFileOS requires config.llm — provide { provider, model } matching your LlmAdapter.",
    );
  }
  if (!config.storagePath) {
    throw new Error(
      "bootFileOS requires config.storagePath — the directory for durable runtime and content data.",
    );
  }
  // Validate private input before opening or creating any durable world.
  if (config.history !== undefined) requireAgentLoopHistory(config.history);

  const storedPrincipal = readFilePrincipal(config.storagePath);
  const requestedConfig = configWithStoredPrincipal(config, storedPrincipal);
  const { pid: requestedPid, pkind: requestedKind, t0 } = initialBootSnapshot(requestedConfig);
  const runtimeDir = join(config.storagePath, "runtime");
  const { durable, locks } = createFileRuntimePersistence({ dir: runtimeDir, initial: t0 });
  const headRef = durable.head();
  const head = headRef === undefined ? undefined : durable.get(headRef);
  if (head === undefined) {
    throw new Error("bootFileOS could not resolve the durable head after initialization.");
  }
  const resolvedPrincipal = principalFromResumedWorld(
    head,
    { actorId: requestedPid, kind: requestedKind },
    config.principalId !== undefined || storedPrincipal !== undefined,
  );

  persistDefaultFilePrincipal(
    config.storagePath,
    resolvedPrincipal,
    config.principalId === undefined && storedPrincipal === undefined,
  );

  const compatibleEpochIds = (config.compatibleEpochIds ?? []).map((value) => epochId(value));
  // ADR-0014: a durable bundle carries the active schema epoch binding
  // atomically with the head. After a crash that left the in-memory holders
  // gone but the durable head+binding intact, the boot layer must accept the
  // advanced head's epoch so the runtime starts under it instead of refusing
  // with an epoch mismatch. The static schema content is still the caller's
  // compiled default schema (validated by digest below); only the epoch id is
  // learned from the durable binding, which is a full SchemaEpochBinding, not
  // a bare epoch string — preserving ADR-0012 §4's "epoch name is not evidence".
  const durableBinding = readFileRuntimeActiveBinding(runtimeDir);
  const effectiveCompatibleEpochIds =
    durableBinding !== undefined && !compatibleEpochIds.includes(durableBinding.epochId)
      ? [...compatibleEpochIds, durableBinding.epochId]
      : compatibleEpochIds;
  const contentStore = createFileContentStore(join(config.storagePath, "content"));
  const coordinationRuntime = createBootCoordinationRuntime(
    durable,
    locks,
    contentStore,
    BOOT_EPOCH_ID,
    effectiveCompatibleEpochIds,
  );
  const fileRuntime = wrapCoordinationRuntime(coordinationRuntime);
  const finalConfig = finalizeBootConfig(
    { durable: "file", contentStore: "file", storagePath: config.storagePath },
    config,
    resolvedPrincipal.actorId,
    resolvedPrincipal.kind,
  );
  return bootCantilune({ runtime: fileRuntime, contentStore, llmAdapter, config: finalConfig });
}

/** @internal Exported for unit tests — memory boot id/time adapters. */
export function wallClock(): Clock {
  return { now: () => timestamp(new Date().toISOString()) as Timestamp };
}

/** @internal Exported for unit tests — memory boot id/time adapters. */
export function uuidIdGenerator(): IdGenerator {
  return {
    changeId: () => changeId(crypto.randomUUID()),
    snapshotRef: () => snapshotRef(crypto.randomUUID()),
    sessionId: () => sessionId(crypto.randomUUID()),
    linkId: () => linkId(crypto.randomUUID()),
    artifactId: () => artifactId(crypto.randomUUID()),
    capabilityId: () => capabilityId(crypto.randomUUID()),
    evidenceId: () => evidenceId(crypto.randomUUID()),
  };
}
