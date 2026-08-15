import { join } from "node:path";
import { getProvider } from "@cantilune/adapter";
import {
  BOOT_EPOCH_ID,
  bootCantilune,
  requireAgentLoopHistory,
  wrapCoordinationRuntime,
} from "@cantilune/boot";
import type {
  AgentLoopHistory,
  BootConfig,
  CantilunOS,
  EmbeddingAdapter,
  LlmAdapter,
  LlmConfig,
} from "@cantilune/boot";
import { createFileContentStore } from "@cantilune/content/file";
import { createMemoryContentStore } from "@cantilune/content/memory";
import type {
  ActorKind,
  CollaborationSnapshot,
  CoordinationChange,
  LinkEndpoint,
} from "@cantilune/core";
import { actorId as coreActorId, epochId } from "@cantilune/core";
import {
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  runtimeDependenciesWithStaticSchema,
  templateAwarePolicyEvaluator,
} from "@cantilune/runtime";
import type { Clock, IdGenerator, ResourceLockTable } from "@cantilune/runtime";
import {
  createFileRuntimePersistence,
  createMemoryRuntimePersistence,
  MemoryResourceLockTable,
} from "@cantilune/runtime/memory";
import type { ChangeLogEntry, EpochInfo, RuntimeState, SnapshotData } from "./store.js";
import { createCliInitialSnapshot } from "./cliWorld.js";

export const NO_RUNTIME_MESSAGE =
  "No runtime connected — use `/provider` and start an agent loop to populate runtime state";

export const INSPECT_ONLY_LLM_CONFIG: LlmConfig = {
  provider: "inspect",
  model: "none",
};

export const INSPECT_ONLY_ADAPTER: LlmAdapter = {
  async chat() {
    throw new Error("Inspect mode is read-only and does not invoke LLM");
  },
};

export function envKeyForProvider(provider: string): string {
  return getProvider(provider)?.envKeyName ?? "";
}

/**
 * The env var `provider` authenticates with, when it is not already populated.
 *
 * Returning this before a run turns an opaque upstream `401 You didn't provide
 * an API key` into a statement about this machine's configuration.
 */
export function missingApiKeyVar(provider: string): string | null {
  const envKeyName = envKeyForProvider(provider);
  if (envKeyName.length === 0) return null;
  const value = process.env[envKeyName] ?? "";
  return value.length > 0 ? null : envKeyName;
}

export function buildLlmConfig(provider: string, model: string, baseUrl?: string): LlmConfig {
  const envKey = envKeyForProvider(provider);
  return {
    provider,
    model,
    ...(envKey.length > 0 ? { apiKey: () => process.env[envKey] ?? "" } : {}),
    ...(baseUrl !== undefined && baseUrl.length > 0 ? { baseUrl } : {}),
  };
}

export function createEmptyRuntimeState(): RuntimeState {
  return {
    snapshot: null,
    changeLog: [],
    epoch: null,
  };
}

function endpointLabel(endpoint: LinkEndpoint): string {
  if (endpoint.kind === "participant") {
    return String(endpoint.actorId);
  }
  return String(endpoint.artifactId);
}

export function snapshotToData(snapshot: CollaborationSnapshot): SnapshotData {
  return {
    snapshotRef: String(snapshot.snapshotRef),
    epochId: String(snapshot.epochId),
    participants: [...snapshot.participants.values()].map((entry) => ({
      id: String(entry.actorId),
      kind: entry.kind,
      status: entry.status,
    })),
    artifacts: [...snapshot.artifacts.values()].map((entry) => ({
      id: String(entry.artifactId),
      kind: entry.kind,
      lifecycle: entry.lifecycle,
    })),
    sessions: [...snapshot.sessions.values()].map((entry) => ({
      id: String(entry.sessionId),
      initiator: String(entry.controller),
      status: entry.visibility,
    })),
    capabilities: [...snapshot.capabilities.values()].map((entry) => ({
      id: String(entry.capabilityId),
      kind: entry.kind,
      holder: String(entry.holder),
    })),
    links: [...snapshot.links.values()].map((entry) => ({
      from: endpointLabel(entry.from),
      to: endpointLabel(entry.to),
      kind: entry.kind,
    })),
    auditTail: snapshot.auditTail.map((entry) => ({
      source: String(entry.source.actorId),
      payloadRef: String(entry.payloadRef),
      timestamp: String(entry.receivedAt),
    })),
    retired: snapshot.retiredEntities.map((entry) => ({
      id: String(entry.entityId),
      kind: entry.entityKind,
      retiredAt: String(entry.retiredAt),
    })),
  };
}

export function changeLogFromChanges(changes: readonly CoordinationChange[]): ChangeLogEntry[] {
  return changes.map((change) => ({
    changeId: String(change.changeId),
    operationTypeId: String(change.operationTypeId),
    initiator: String(change.initiator.actorId),
    beforeRef: String(change.beforeRef),
    afterRef: String(change.afterRef),
    timestamp: String(change.recordedAt),
  }));
}

export const DEFAULT_SCHEMA_ID = "default-schema";

export function epochFromSnapshot(snapshot: CollaborationSnapshot, changeCount = 0): EpochInfo {
  return {
    epochId: String(snapshot.epochId),
    ordinal: changeCount + 1,
    schemaId: DEFAULT_SCHEMA_ID,
  };
}

export function buildRuntimeState(
  snapshot: CollaborationSnapshot | undefined,
  changes: readonly CoordinationChange[],
): RuntimeState {
  if (snapshot === undefined) {
    return createEmptyRuntimeState();
  }
  return {
    snapshot: snapshotToData(snapshot),
    changeLog: changeLogFromChanges(changes),
    epoch: epochFromSnapshot(snapshot, changes.length),
  };
}

export interface CliRuntimeHandle {
  readonly os: CantilunOS;
  privateHistory(): AgentLoopHistory | null;
  syncRuntime(): RuntimeState;
  shutdown(): Promise<void>;
  /**
   * The content-addressed store backing this runtime. Content views (/content
   * cat|ls|stats|gc) read and, under a human --confirm boundary, garbage-collect
   * blobs through it. Always present: the CLI builds a memory store even when
   * durable=file is not configured.
   */
  contentStore(): CliContentStore;
  /**
   * The wrapped syscall runtime (coordination runtime + syscall surface) used by
   * the agent loop. /cluster start instantiates a ClusterSupervisor against the
   * same coordination world this runtime owns.
   */
  syscallRuntime(): ReturnType<typeof wrapCoordinationRuntime>;
  /**
   * The on-disk storage path backing this runtime's durable world, or undefined
   * for an in-memory runtime. /cluster start uses it for the swarm's per-agent
   * comms store path; absent in memory mode, where a temp path is substituted.
   */
  storagePath(): string | undefined;
}

function wallClock(): Clock {
  return { now: () => new Date().toISOString() as ReturnType<Clock["now"]> };
}

function uuidIdGenerator(): IdGenerator {
  return {
    changeId: () => crypto.randomUUID() as ReturnType<IdGenerator["changeId"]>,
    snapshotRef: () => crypto.randomUUID() as ReturnType<IdGenerator["snapshotRef"]>,
    sessionId: () => crypto.randomUUID() as ReturnType<IdGenerator["sessionId"]>,
    linkId: () => crypto.randomUUID() as ReturnType<IdGenerator["linkId"]>,
    artifactId: () => crypto.randomUUID() as ReturnType<IdGenerator["artifactId"]>,
    capabilityId: () => crypto.randomUUID() as ReturnType<IdGenerator["capabilityId"]>,
    evidenceId: () => crypto.randomUUID() as ReturnType<IdGenerator["evidenceId"]>,
  };
}

type CliDurable =
  | ReturnType<typeof createMemoryRuntimePersistence>["durable"]
  | ReturnType<typeof createFileRuntimePersistence>["durable"];
type CliContentStore =
  ReturnType<typeof createMemoryContentStore> | ReturnType<typeof createFileContentStore>;

interface CliBackends {
  readonly durable: CliDurable;
  readonly locks: ResourceLockTable;
  readonly contentStore: CliContentStore;
  readonly durableBackend: BootConfig["durable"];
  readonly contentBackend: BootConfig["contentStore"];
}

function assertResumedCliPrincipal(
  durable: CliDurable,
  bootParticipantId: ReturnType<typeof coreActorId>,
  pid: string,
  pkind: ActorKind,
): void {
  const durableHead = durable.head();
  const resumed = durableHead === undefined ? undefined : durable.get(durableHead);
  const resumedPrincipal = resumed?.participants.get(bootParticipantId);
  if (resumedPrincipal === undefined) {
    throw new Error(
      `CLI principal ${pid} is not registered in the resumed file world. ` +
        "Restore the principalId that created this world or register the new identity first.",
    );
  }
  if (resumedPrincipal.kind !== pkind || resumedPrincipal.status !== "active") {
    throw new Error(
      `CLI principal ${pid} must be active as ${pkind}; durable world has ` +
        `${resumedPrincipal.kind}/${resumedPrincipal.status}.`,
    );
  }
}

function createCliBackends(
  config: Partial<BootConfig>,
  initial: CollaborationSnapshot,
  bootParticipantId: ReturnType<typeof coreActorId>,
  pid: string,
  pkind: ActorKind,
): CliBackends {
  if (config.durable !== "file" || config.storagePath === undefined) {
    const memoryPersistence = createMemoryRuntimePersistence({ initial });
    return {
      durable: memoryPersistence.durable,
      locks: new MemoryResourceLockTable(),
      contentStore: createMemoryContentStore(),
      durableBackend: "memory",
      contentBackend: "memory",
    };
  }

  const filePersistence = createFileRuntimePersistence({
    dir: join(config.storagePath, "runtime"),
    initial,
  });
  assertResumedCliPrincipal(filePersistence.durable, bootParticipantId, pid, pkind);
  return {
    durable: filePersistence.durable,
    locks: filePersistence.locks,
    contentStore: createFileContentStore(join(config.storagePath, "content")),
    durableBackend: "file",
    contentBackend: "file",
  };
}

export function createCliRuntimeBoot(
  llmAdapter: LlmAdapter,
  config?: Partial<BootConfig>,
  extras?: {
    /** Embedder for the controller's semantic residual engine; undefined → Jaccard fallback. */
    readonly embedder?: EmbeddingAdapter;
    /** Dedicated adapter for goal-contract compilation; undefined → no LLM, default system contract. */
    readonly contractLlm?: LlmAdapter;
  },
): CliRuntimeHandle {
  if (config?.llm === undefined) {
    throw new Error("LLM configuration required — provide provider and model in BootConfig.llm");
  }
  // A malformed private transcript must fail before file persistence can create
  // or resume a coordination world.
  const restoredHistory =
    config.history === undefined ? undefined : requireAgentLoopHistory(config.history);

  const pid = config.principalId ?? `boot-${crypto.randomUUID().slice(0, 8)}`;
  const pkind = (config.principalKind ?? "agent") as ActorKind;
  const bootParticipantId = coreActorId(pid);
  const t0 = createCliInitialSnapshot(pid, pkind);

  const { durable, locks, contentStore, durableBackend, contentBackend } = createCliBackends(
    config,
    t0,
    bootParticipantId,
    pid,
    pkind,
  );

  const coordinationRuntime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: wallClock(),
      idGen: uuidIdGenerator(),
      schema: createDefaultSchema(),
      activeEpochId: BOOT_EPOCH_ID,
      compatibleEpochIds: (config.compatibleEpochIds ?? []).map((value) => epochId(value)),
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      locks,
      contentRefAuthority: contentStore,
    }),
  );
  const wrappedRuntime = wrapCoordinationRuntime(coordinationRuntime);
  // Resolve the controller's optional sensors. `extras` wins over `config` so the
  // caller can hand-construct them from the live LLM config (the adapter package
  // builds the embedder from the same LlmConfig); but values already present in
  // `config` are still honored when `extras` is omitted.
  const embedder = extras?.embedder ?? config.embedder;
  const contractLlm = extras?.contractLlm ?? config.contractLlm;
  const finalConfig: BootConfig = {
    durable: durableBackend,
    contentStore: contentBackend,
    llm: config.llm,
    principalId: pid,
    principalKind: pkind,
    ...(config.tools !== undefined ? { tools: config.tools } : {}),
    ...(config.maxTurns !== undefined ? { maxTurns: config.maxTurns } : {}),
    ...(config.maxTimeMs !== undefined ? { maxTimeMs: config.maxTimeMs } : {}),
    ...(config.maxContextMessages !== undefined
      ? { maxContextMessages: config.maxContextMessages }
      : {}),
    ...(config.systemPrompt !== undefined ? { systemPrompt: config.systemPrompt } : {}),
    ...(config.initialMessages !== undefined ? { initialMessages: config.initialMessages } : {}),
    ...(restoredHistory !== undefined ? { history: restoredHistory } : {}),
    ...(config.onHistoryCheckpoint !== undefined
      ? { onHistoryCheckpoint: config.onHistoryCheckpoint }
      : {}),
    ...(config.compatibleEpochIds !== undefined
      ? { compatibleEpochIds: config.compatibleEpochIds }
      : {}),
    ...(config.storagePath !== undefined ? { storagePath: config.storagePath } : {}),
    // Inject the controller's optional sensors without falling back to the
    // loop adapter: `embedder` undefined degrades the residual engine to
    // Jaccard; `contractLlm` undefined compiles the default system contract
    // with no LLM call. Neither is required; both are one-time per run.
    ...(embedder !== undefined ? { embedder } : {}),
    ...(contractLlm !== undefined ? { contractLlm } : {}),
  };
  const os = bootCantilune({
    runtime: wrappedRuntime,
    contentStore,
    llmAdapter,
    config: finalConfig,
  });

  return {
    os,
    privateHistory: () => os.privateHistory?.() ?? null,
    syncRuntime() {
      return buildRuntimeState(coordinationRuntime.getHead(), durable.changes());
    },
    shutdown: () => os.shutdown(),
    contentStore: () => contentStore,
    syscallRuntime: () => wrappedRuntime,
    storagePath: () => config.storagePath,
  };
}

export function hasRuntimeData(runtime: RuntimeState): boolean {
  return runtime.snapshot !== null || runtime.changeLog.length > 0 || runtime.epoch !== null;
}
