/**
 * Shared resources — single instances shared across all agents in a cluster.
 */
import type { ActorId } from "@cantilune/core";
import type { SyscallRuntime, SyscallContentStore } from "@cantilune/syscall";
import type { HumanInterface, ClusterEventListener } from "./clusterTypes.js";
import type { MeshTransportRouter } from "./meshTransportRouter.js";
import { createLoopbackMeshRouter } from "./commsIntegration.js";

export interface SharedResources {
  readonly runtime: SyscallRuntime;
  readonly contentStore: SyscallContentStore;
  readonly meshTransport: MeshTransportRouter;
  readonly storagePath: string;
  readonly humanInterface: HumanInterface | undefined;
  readonly eventListener: ClusterEventListener | undefined;
}

export function createSharedResources(opts: {
  runtime: SyscallRuntime;
  contentStore: SyscallContentStore;
  storagePath: string;
  humanInterface?: HumanInterface;
  eventListener?: ClusterEventListener;
}): SharedResources {
  return {
    runtime: opts.runtime,
    contentStore: opts.contentStore,
    meshTransport: createLoopbackMeshRouter(),
    storagePath: opts.storagePath,
    humanInterface: opts.humanInterface,
    eventListener: opts.eventListener,
  };
}

/** Get the comms storage directory for a specific agent. */
export function commsStorePath(shared: SharedResources, agentId: ActorId): string {
  return `${shared.storagePath}/comms/${agentId as string}`;
}
