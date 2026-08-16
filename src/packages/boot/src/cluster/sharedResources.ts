/**
 * Shared resources — single instances shared across all agents in a cluster.
 */
import type { ActorId } from "@cantilune/core";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import type { HumanInterface, ClusterEventListener } from "./clusterTypes.js";
import type { MeshTransportRouter } from "./meshTransportRouter.js";
import { createLoopbackMeshRouter } from "./commsIntegration.js";
import type { MeshHostDirectory } from "./meshHostDirectory.js";

export interface SharedResources {
  readonly runtime: SyscallRuntime;
  readonly contentStore: SyscallContentStore;
  readonly meshTransport: MeshTransportRouter;
  readonly storagePath: string;
  readonly humanInterface: HumanInterface | undefined;
  readonly eventListener: ClusterEventListener | undefined;
  /** Multi-host directory (ADR-0019 S4). Absent ⇒ all agents are local. */
  readonly meshHostDirectory: MeshHostDirectory | undefined;
  /** Local host role when directory is set. */
  readonly swarmRole: "supervisor" | "worker" | undefined;
}

export function createSharedResources(opts: {
  runtime: SyscallRuntime;
  contentStore: SyscallContentStore;
  storagePath: string;
  humanInterface?: HumanInterface;
  eventListener?: ClusterEventListener;
  /** Defaults to in-process loopback. Pass `createFileMeshRouter(dir)` or `createNetMeshRouter()`. */
  meshTransport?: MeshTransportRouter;
  meshHostDirectory?: MeshHostDirectory;
  swarmRole?: "supervisor" | "worker";
}): SharedResources {
  return {
    runtime: opts.runtime,
    contentStore: opts.contentStore,
    meshTransport: opts.meshTransport ?? createLoopbackMeshRouter(),
    storagePath: opts.storagePath,
    humanInterface: opts.humanInterface,
    eventListener: opts.eventListener,
    meshHostDirectory: opts.meshHostDirectory,
    swarmRole: opts.swarmRole,
  };
}

/** Get the comms storage directory for a specific agent. */
export function commsStorePath(shared: SharedResources, agentId: ActorId): string {
  return `${shared.storagePath}/comms/${agentId as string}`;
}
