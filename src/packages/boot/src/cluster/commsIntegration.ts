/**
 * Comms integration for the cluster boot layer.
 *
 * Provides:
 * - LoopbackTransport-backed MeshTransportRouter factory
 * - Per-agent CommsServices creation with full saga pipeline
 * - No shortcuts — all messages go through the complete comms stack
 */
import type { ActorId } from "@cantilune/core";
import { LoopbackTransport } from "@cantilune/comms/memory";
import type { CommunicationTransport } from "@cantilune/comms/ports";
import { MeshTransportRouter } from "./meshTransportRouter.js";

/**
 * Create a MeshTransportRouter wired with LoopbackTransport pairs.
 * Each agent gets a connected LoopbackTransport; messages dispatched
 * from one side are received by the peer via the shared queue.
 */
export function createLoopbackMeshRouter(): MeshTransportRouter {
  const router = new MeshTransportRouter();
  router.setTransportFactory(() => LoopbackTransport.connectPair());
  return router;
}

/**
 * Allocate a LoopbackTransport directly for an agent without going through
 * the MeshTransportRouter (useful for testing and direct wiring).
 */
export function allocateLoopbackTransport(
  agentId: ActorId,
  router: MeshTransportRouter,
): CommunicationTransport {
  return router.allocate(agentId);
}
