/**
 * Cluster control wiring (ADR-0015) for the CLI.
 *
 * Builds a real {@link ClusterSupervisor} from the live runtime handle's
 * backends and drives it behind /cluster start|stop|status|activate. The
 * supervisor consumes the trusted committed-change feed of the SAME
 * coordination runtime the agent loop owns — no second world, no mock. Its
 * lifecycle events are captured for the cluster view to render.
 *
 * Authority (ADR-0015 §1): activation is admitted by the runtime's own
 * admission gateway (the active-initiator rule). `activate` stores an agent
 * manifest in the content store and commits `activate_participant` as the
 * principal of the active initiator participant found on the runtime head.
 *
 * Safety: `stop()` calls `supervisor.stop()` (the governed E-Stop) and clears
 * the timers; nothing is force-killed. The supervisor never writes a second
 * durable world — it only reads the feed and submits intents through the
 * existing `proposeAndCommit` boundary.
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
  ClusterSupervisor,
  createSharedResources,
  type ClusterEvent,
  type LlmAdapterFactory,
  type LlmAdapter,
} from "@cantilune/boot";
import { createDefaultConditionRegistry } from "@cantilune/runtime";
import type { SyscallRuntime, ProposeResult } from "@cantilune/syscall";

/** A captured cluster lifecycle event for the view. */
export interface ClusterEventRecord {
  readonly kind: ClusterEvent["kind"];
  readonly actorId?: string;
  readonly lastHeartbeatMs?: number;
  readonly seq?: number;
  readonly summary?: string;
  readonly timestamp: number;
}

export interface ClusterStatus {
  readonly running: boolean;
  readonly events: readonly ClusterEventRecord[];
}

export interface ActivateResult {
  readonly ok: boolean;
  readonly message?: string;
}

export interface ClusterController {
  start(): ActivateResult;
  stop(): void;
  status(): ClusterStatus;
  /**
   * Store an agent manifest and commit `activate_participant` for the given
   * registered participant id. Returns ok=false with a reason if the runtime
   * rejects (e.g. initiator not active, participant not registered).
   */
  activate(agentId: string, manifest?: Partial<AgentManifest>): Promise<ActivateResult>;
}

/**
 * Optional live swarm (or another ClusterSupervisor owner) on the same runtime.
 *
 * When present, this controller must not open a second feed watcher — two
 * supervisors draining one `activate_participant` would start two agent loops.
 */
export interface ClusterSupervisorSibling {
  start(): ActivateResult;
  stop(): void;
  status(): { readonly running: boolean; readonly events: readonly ClusterEventRecord[] };
  activate(agentId: string, manifest?: Partial<AgentManifest>): Promise<ActivateResult>;
}

interface ClusterBackends {
  readonly contentStore: ContentStore | undefined;
  readonly syscallRuntime: SyscallRuntime | undefined;
  readonly storagePath: string | undefined;
}

const MAX_EVENTS = 200;

function recordEvent(events: ClusterEventRecord[], event: ClusterEvent): void {
  const record: ClusterEventRecord = {
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

/** Build a controller bound to a runtime handle's backends + an LLM factory. */
export function createClusterController(
  backends: () => ClusterBackends,
  llmFactory: () => LlmAdapter,
  sibling?: () => ClusterSupervisorSibling | undefined,
): ClusterController {
  let supervisor: ClusterSupervisor | undefined;
  let attachedSibling: ClusterSupervisorSibling | undefined;
  const events: ClusterEventRecord[] = [];

  return {
    start(): ActivateResult {
      if (attachedSibling !== undefined) return { ok: true, message: "already running" };
      if (supervisor !== undefined) return { ok: true, message: "already running" };
      const liveSibling = sibling?.();
      if (liveSibling !== undefined) {
        const result = liveSibling.start();
        if (result.ok) attachedSibling = liveSibling;
        return result;
      }
      const { contentStore, syscallRuntime, storagePath } = backends();
      if (syscallRuntime === undefined || contentStore === undefined) {
        return { ok: false, message: "no runtime connected — start an agent loop first" };
      }
      const commsPath =
        storagePath !== undefined
          ? join(storagePath, "comms")
          : join(tmpdir(), "cantilune-cluster-comms");
      const shared = createSharedResources({
        runtime: syscallRuntime,
        contentStore,
        storagePath: commsPath,
      });
      const conditionRegistry = createDefaultConditionRegistry();
      // The CLI uses one LLM adapter for every agent in the cluster; the
      // manifest's model/provider are advisory and the live CLI adapter is the
      // authority (it already carries the human-configured provider).
      const llmAdapterFactory: LlmAdapterFactory = () => llmFactory();
      supervisor = new ClusterSupervisor({
        shared,
        conditionRegistry,
        llmAdapterFactory,
        feedDrainIntervalMs: 500,
        heartbeatCheckIntervalMs: 15_000,
        eventListener: (event) => recordEvent(events, event),
      });
      supervisor.start();
      return { ok: true };
    },

    stop(): void {
      if (attachedSibling !== undefined) {
        attachedSibling.stop();
        attachedSibling = undefined;
        return;
      }
      if (supervisor === undefined) return;
      supervisor.stop();
      supervisor = undefined;
    },

    status(): ClusterStatus {
      if (attachedSibling !== undefined) {
        const live = attachedSibling.status();
        return { running: live.running, events: live.events };
      }
      return { running: supervisor !== undefined, events: [...events] };
    },

    async activate(agentId: string, manifest?: Partial<AgentManifest>): Promise<ActivateResult> {
      if (attachedSibling !== undefined) {
        return attachedSibling.activate(agentId, manifest);
      }
      const { contentStore, syscallRuntime } = backends();
      if (syscallRuntime === undefined || contentStore === undefined) {
        return { ok: false, message: "no runtime connected" };
      }
      const head = syscallRuntime.getHead();
      if (head === undefined) {
        return { ok: false, message: "no snapshot on the runtime head" };
      }
      const participants = head.participants as ReadonlyMap<ActorId, Participant>;

      // The active-initiator authority (ADR-0015 §1): the first active
      // participant on the head admits the activation. This mirrors the
      // supervisor's own supervisorPrincipal default.
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
        systemPrompt: manifest?.systemPrompt ?? "cantilune cluster agent",
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
        createdBy: "cli:cluster-activate",
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
    },
  };
}

/** Re-exported for tests that need to deserialize a manifest from the store. */
export { deserializeManifest };
