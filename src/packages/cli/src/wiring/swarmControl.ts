/**
 * Swarm control wiring (ADR-0019) for the CLI.
 *
 * Builds a real {@link CantiluneSwarm} from the live runtime handle's backends
 * and drives it behind `/swarm start|stop|status|activate|wait`. The swarm is
 * bootstrapped via `bootSwarm` (ADR-0019): ONE shared durable world plus a pool
 * of `CantilunOS` agent instances (one per `active` participant), reusing the
 * full single-Agent boot stack. The runtime stays the sole mutator; the swarm
 * boots agent OS instances that submit `CoordinationIntent`s through the
 * runtime ports — no second world, no mock.
 *
 * Authority (ADR-0015 §1, shared with `clusterControl`): activation is
 * admitted by the runtime's own admission gateway (the active-initiator rule).
 * `activate` stores an agent manifest in the content store and commits
 * `activate_participant` as the principal of the active initiator participant
 * found on the runtime head. This is the SAME authority as `/cluster
 * activate` — the swarm admits participants into the same collaboration
 * world; it does not mint its own.
 *
 * Safety: `stop()` calls `supervisor.stop()` (the governed E-Stop) and clears
 * the timers; nothing is force-killed. `shutdown()` additionally releases the
 * per-agent `CantilunOS` pool.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentStore } from "@cantilune/content";
import {
  actorId as coreActorId,
  actorRef,
  coordinationIntent,
  matchBinding,
  operationTypeId,
  deserializeManifest,
  ALWAYS_CONDITION,
  type ActorId,
  type ActorKind,
  type AgentManifest,
  type ContentRef,
  type Participant,
} from "@cantilune/core";
import {
  bootSwarm,
  loadMeshHostDirectory,
  saveMeshHostDirectory,
  createMemoryMeshHostDirectory,
  type CantiluneSwarm,
  type ClusterEvent,
  type ClusterResult,
  type LlmAdapterFactory,
  type LlmAdapter,
  type SchedulerSnapshot,
  type MeshHostDirectory,
  type MeshHostEntry,
} from "@cantilune/boot";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, ProposeResult } from "@cantilune/syscall";
import type { CliConfig } from "../config.js";

/** A captured swarm lifecycle event for the view (mirrors ClusterEventRecord). */
export interface SwarmEventRecord {
  readonly kind: ClusterEvent["kind"];
  readonly actorId?: string;
  readonly lastHeartbeatMs?: number;
  readonly seq?: number;
  readonly summary?: string;
  readonly timestamp: number;
}

export interface SwarmControllerStatus {
  readonly running: boolean;
  readonly agents: ReadonlyMap<string, { readonly status: string; readonly heartbeat: unknown }>;
  readonly events: readonly SwarmEventRecord[];
  /**
   * Queue, concurrency, and budget state behind dispatch decisions. Absent
   * before the first `/swarm start`, when there is no scheduler to project.
   */
  readonly scheduler?: SchedulerSnapshot;
}

export interface ActivateResult {
  readonly ok: boolean;
  readonly message?: string;
}

export interface SwarmController {
  start(): ActivateResult;
  stop(): void;
  status(): SwarmControllerStatus;
  /**
   * Store an agent manifest and commit `activate_participant` for the given
   * registered participant id. Returns ok=false with a reason if the runtime
   * rejects (e.g. initiator not active, participant not registered). Same
   * active-initiator authority as `/cluster activate`.
   */
  activate(agentId: string, manifest?: Partial<AgentManifest>): Promise<ActivateResult>;
  /** Drive the swarm until every non-retired participant is `done`. */
  waitForCompletion(): Promise<ClusterResult>;
  /** Stop the supervisor + release the per-agent CantilunOS pool. */
  shutdown(): Promise<void>;
  /** List mesh host directory entries (ADR-0019 S4). */
  listHosts(): readonly MeshHostEntry[];
  /** Publish this process listen address into the mesh directory. */
  joinMesh(listen: string): ActivateResult;
}

interface SwarmBackends {
  readonly contentStore: ContentStore | undefined;
  readonly syscallRuntime: SyscallRuntime | undefined;
  readonly storagePath: string | undefined;
}

const MAX_EVENTS = 200;

function recordEvent(events: SwarmEventRecord[], event: ClusterEvent): void {
  const record: SwarmEventRecord = {
    kind: event.kind,
    timestamp: Date.now(),
    ...("actorId" in event ? { actorId: event.actorId as string } : {}),
    ...("lastHeartbeatMs" in event ? { lastHeartbeatMs: event.lastHeartbeatMs } : {}),
    ...("seq" in event ? { seq: event.seq } : {}),
    ...("summary" in event ? { summary: event.summary } : {}),
  };
  events.push(record);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function parseListen(listen: string): { host: string; port: number } | undefined {
  const trimmed = listen.trim();
  const idx = trimmed.lastIndexOf(":");
  if (idx <= 0) return undefined;
  const host = trimmed.slice(0, idx);
  const port = Number(trimmed.slice(idx + 1));
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || host.length === 0) {
    return undefined;
  }
  return { host, port };
}

function resolveMeshDirectory(cliConfig: CliConfig | undefined): MeshHostDirectory | undefined {
  if (cliConfig?.swarmDirectoryPath === undefined) return undefined;
  return loadMeshHostDirectory(cliConfig.swarmDirectoryPath);
}

/**
 * Commit `activate_participant` for a registered agent under the
 * active-initiator authority. This is the SAME logic as
 * `clusterControl.activate` — the swarm admits a participant into the same
 * collaboration world. Duplicated (not imported from clusterControl) so the
 * swarm controller stays a standalone unit; the authority rule is identical
 * and any drift would be a governance regression to catch in review.
 */
async function commitActivateParticipant(
  contentStore: ContentStore,
  syscallRuntime: SyscallRuntime,
  agentId: string,
  manifest?: Partial<AgentManifest>,
): Promise<ActivateResult> {
  const head = syscallRuntime.getHead();
  if (head === undefined) {
    return { ok: false, message: "no snapshot on the runtime head" };
  }
  const participants = head.participants as ReadonlyMap<ActorId, Participant>;

  let initiator: Participant | undefined;
  for (const [, p] of participants) {
    if (p.status === "active") {
      initiator = p;
      break;
    }
  }
  if (initiator === undefined) {
    return { ok: false, message: "no active initiator participant on the runtime head" };
  }
  const target = participants.get(coreActorId(agentId));
  if (target === undefined) {
    return { ok: false, message: `participant not registered: ${agentId}` };
  }
  if (target.status === "active") {
    return { ok: false, message: `participant already active: ${agentId}` };
  }
  if (target.kind !== "agent") {
    return { ok: false, message: `participant is not an agent: ${agentId}` };
  }

  const manifestRecord: AgentManifest = {
    agentId: coreActorId(agentId) as string,
    kind: "agent" as ActorKind,
    systemPrompt: manifest?.systemPrompt ?? "cantilune swarm agent",
    assignedTask: manifest?.assignedTask ?? "execute assigned task",
    startCondition: manifest?.startCondition ?? ALWAYS_CONDITION,
    heartbeatIntervalMs: manifest?.heartbeatIntervalMs ?? 5_000,
    designedBy: initiator.actorId,
    ...(manifest?.model !== undefined ? { model: manifest.model } : {}),
    ...(manifest?.provider !== undefined ? { provider: manifest.provider } : {}),
    ...(manifest?.maxTurns !== undefined ? { maxTurns: manifest.maxTurns } : {}),
    ...(manifest?.maxTimeMs !== undefined ? { maxTimeMs: manifest.maxTimeMs } : {}),
  };
  const manifestRef = await contentStore.put(JSON.stringify(manifestRecord), {
    mimeType: "application/json",
    createdBy: "cli:swarm-activate",
  });

  const intent = coordinationIntent(
    actorRef(initiator.actorId, initiator.kind),
    operationTypeId("activate_participant"),
    [matchBinding("from", initiator.actorId as string), matchBinding("participant", agentId)],
    undefined,
    [manifestRef as ContentRef],
  );
  const result = syscallRuntime.proposeAndCommit(intent, {
    principal: actorRef(initiator.actorId, initiator.kind),
  }) as ProposeResult;
  if (!result.ok) {
    return { ok: false, message: result.message ?? "activate_participant rejected" };
  }
  return { ok: true };
}

/** Build a swarm controller bound to a runtime handle's backends + an LLM factory. */
export function createSwarmController(
  backends: () => SwarmBackends,
  llmFactory: () => LlmAdapter,
  cliConfig?: CliConfig,
): SwarmController {
  let swarm: CantiluneSwarm | undefined;
  const events: SwarmEventRecord[] = [];
  let meshDirectory = resolveMeshDirectory(cliConfig);

  function projectStatus(): SwarmControllerStatus {
    if (swarm === undefined) {
      return { running: false, agents: new Map(), events: [...events] };
    }
    const live = swarm.status();
    return {
      running: live.running,
      agents: live.agents,
      events: [...events],
      scheduler: live.scheduler,
    };
  }

  return {
    start(): ActivateResult {
      if (swarm !== undefined) return { ok: true, message: "already running" };
      const { contentStore, syscallRuntime, storagePath } = backends();
      if (syscallRuntime === undefined || contentStore === undefined) {
        return { ok: false, message: "no runtime connected — start an agent loop first" };
      }
      const commsPath =
        storagePath !== undefined
          ? join(storagePath, "comms")
          : join(tmpdir(), "cantilune-swarm-comms");
      const conditionRegistry = createDefaultConditionRegistry();
      // The CLI uses one LLM adapter for every agent in the swarm; the
      // manifest's model/provider are advisory and the live CLI adapter is the
      // authority (it already carries the human-configured provider).
      const llmAdapterFactory: LlmAdapterFactory = () => llmFactory();
      swarm = bootSwarm({
        runtime: syscallRuntime,
        contentStore,
        storagePath: commsPath,
        llmAdapterFactory,
        conditionRegistry,
        feedDrainIntervalMs: 500,
        heartbeatCheckIntervalMs: 15_000,
        eventListener: (event) => recordEvent(events, event),
        ...(meshDirectory !== undefined ? { meshHostDirectory: meshDirectory } : {}),
        ...(cliConfig?.swarmRole !== undefined ? { swarmRole: cliConfig.swarmRole } : {}),
      });
      swarm.start();
      return { ok: true };
    },

    stop(): void {
      if (swarm === undefined) return;
      swarm.stop();
      swarm = undefined;
    },

    status(): SwarmControllerStatus {
      return projectStatus();
    },

    async activate(agentId: string, manifest?: Partial<AgentManifest>): Promise<ActivateResult> {
      const { contentStore, syscallRuntime } = backends();
      if (syscallRuntime === undefined || contentStore === undefined) {
        return { ok: false, message: "no runtime connected" };
      }
      return commitActivateParticipant(contentStore, syscallRuntime, agentId, manifest);
    },

    async waitForCompletion(): Promise<ClusterResult> {
      if (swarm === undefined) {
        return {
          ok: false,
          summary: "swarm not started",
          agentResults: new Map(),
          totalElapsedMs: 0,
          totalTurns: 0,
          reason: "stopped",
          diagnostic: "No swarm is running; start one with `/swarm start`.",
        };
      }
      return swarm.waitForCompletion();
    },

    async shutdown(): Promise<void> {
      if (swarm === undefined) return;
      await swarm.shutdown();
      swarm = undefined;
    },

    listHosts(): readonly MeshHostEntry[] {
      meshDirectory ??= resolveMeshDirectory(cliConfig) ?? createMemoryMeshHostDirectory();
      return meshDirectory.list();
    },

    joinMesh(listen: string): ActivateResult {
      const parsed = parseListen(listen);
      if (parsed === undefined) {
        return { ok: false, message: "usage: /swarm join <host:port>" };
      }
      if (cliConfig?.swarmDirectoryPath === undefined) {
        return {
          ok: false,
          message: "swarmDirectoryPath not configured — set it in CLI config before joining",
        };
      }
      meshDirectory ??= loadMeshHostDirectory(cliConfig.swarmDirectoryPath);
      const actorId = (cliConfig.principalId ?? "cli-local") as ActorId;
      // Fingerprint is required to publish; operator must supply via Net listen
      // material. Placeholder pin is rejected — require swarmListen fingerprint
      // from a prior directoryNetMesh publish or explicit env.
      const fingerprint = process.env.CANTILUNE_MESH_FINGERPRINT?.trim() ?? "";
      if (fingerprint.length === 0) {
        return {
          ok: false,
          message:
            "CANTILUNE_MESH_FINGERPRINT required to publish (deny-by-default empty fingerprint)",
        };
      }
      meshDirectory.publish({
        actorId,
        host: parsed.host,
        port: parsed.port,
        fingerprint,
        role: cliConfig.swarmRole ?? "worker",
      });
      saveMeshHostDirectory(cliConfig.swarmDirectoryPath, meshDirectory);
      return { ok: true, message: `published ${actorId as string} at ${listen}` };
    },
  };
}

/** Re-exported for tests that need to deserialize a manifest from the store. */
export { deserializeManifest };
