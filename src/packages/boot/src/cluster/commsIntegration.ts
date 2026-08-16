/**
 * Comms mesh factories for the cluster boot layer.
 *
 * In-process agents share a true N-to-N {@link MeshTransportRouter} hub.
 * File/net factories attach physical backends for identity / S4; routing is
 * still hub-based within a single supervisor process.
 */
import { join } from "node:path";
import type { ActorId } from "@cantilune/core";
import { connectFileTransportPair, createNetTransportPair } from "@cantilune/comms";
import type { CommunicationTransport } from "@cantilune/comms/ports";
import { MeshTransportRouter } from "./meshTransportRouter.js";

/** In-process N-to-N hub (no physical backend). */
export function createLoopbackMeshRouter(): MeshTransportRouter {
  return new MeshTransportRouter();
}

/**
 * Same-host mesh: each allocate() also constructs a FileTransport pair under
 * `rootDir/pair-N` (peer half closed; agent half retained for P2 identity).
 */
export function createFileMeshRouter(rootDir: string): MeshTransportRouter {
  const router = new MeshTransportRouter();
  let pairSeq = 0;
  router.setTransportFactory(() => {
    pairSeq += 1;
    return connectFileTransportPair(join(rootDir, `pair-${String(pairSeq)}`));
  });
  return router;
}

/**
 * Net-backed mesh hook: each allocate() also constructs a localhost mTLS
 * NetTransport pair (peer half closed). Full multi-host listen/connect is S4.
 */
export function createNetMeshRouter(): MeshTransportRouter {
  const router = new MeshTransportRouter();
  router.setTransportFactory(() => createNetTransportPair());
  return router;
}

export {
  createDirectoryNetMeshRouter,
  connectDirectoryPeer,
  type DirectoryNetMeshOptions,
} from "./directoryNetMesh.js";

/** Allocate via the router (hub endpoint). */
export function allocateLoopbackTransport(
  agentId: ActorId,
  router: MeshTransportRouter,
): CommunicationTransport {
  return router.allocate(agentId);
}
