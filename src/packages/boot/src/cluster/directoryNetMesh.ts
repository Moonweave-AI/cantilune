/**
 * Directory-backed Net mesh (ADR-0019 S4): listen locally, publish
 * host+port+fingerprint, connect to peers from {@link MeshHostDirectory}
 * with pinned fingerprints. Fail-closed when a peer entry lacks a fingerprint.
 */
import type { ActorId } from "@cantilune/core";
import {
  NetTransport,
  issueSelfSignedMtlsPair,
  type NetTransportTlsMaterial,
} from "@cantilune/comms";
import { MeshTransportRouter } from "./meshTransportRouter.js";
import type { MeshHostDirectory } from "./meshHostDirectory.js";

export interface DirectoryNetMeshOptions {
  readonly directory: MeshHostDirectory;
  readonly localActorId: ActorId;
  readonly listenHost: string;
  readonly listenPort: number;
  readonly role: "supervisor" | "worker";
}

function leafTls(
  identity: { readonly cert: string; readonly key: string },
  caCert: string,
): NetTransportTlsMaterial {
  return { cert: identity.cert, key: identity.key, ca: caCert };
}

/**
 * Build a hub router whose physical factory listens for the local actor and
 * pins every directory peer fingerprint on connect.
 */
export function createDirectoryNetMeshRouter(
  options: DirectoryNetMeshOptions,
): MeshTransportRouter {
  const issued = issueSelfSignedMtlsPair();
  const localFp = issued.a.fingerprint;
  const router = new MeshTransportRouter();

  router.setPhysicalTransportFactory(() => {
    const pinned = options.directory
      .list()
      .filter((e) => e.actorId !== options.localActorId)
      .map((e) => {
        if (e.fingerprint.length === 0) {
          throw new Error(`MeshHostEntry for ${e.actorId as string} missing fingerprint`);
        }
        return e.fingerprint;
      });

    const local = new NetTransport({
      endpointId: options.localActorId as string,
      tls: leafTls(issued.a, issued.ca.cert),
      listen: { host: options.listenHost, port: options.listenPort },
      pinnedPeerFingerprints: pinned.length > 0 ? pinned : [issued.b.fingerprint],
      onListening: (addr) => {
        options.directory.publish({
          actorId: options.localActorId,
          host: addr.host,
          port: addr.port,
          fingerprint: localFp,
          role: options.role,
        });
      },
    });

    void local.listen().then((addr) => {
      options.directory.publish({
        actorId: options.localActorId,
        host: addr.host,
        port: addr.port,
        fingerprint: localFp,
        role: options.role,
      });
    });

    return local;
  });

  return router;
}

/** Connect a NetTransport to a directory peer with fingerprint pin. */
export async function connectDirectoryPeer(input: {
  readonly directory: MeshHostDirectory;
  readonly peerActorId: ActorId;
  readonly localTls: NetTransportTlsMaterial;
  readonly localEndpointId: string;
}): Promise<NetTransport> {
  const entry = input.directory.get(input.peerActorId);
  if (entry === undefined) {
    throw new Error(`Peer ${input.peerActorId as string} not in mesh host directory`);
  }
  if (entry.fingerprint.length === 0) {
    throw new Error(`Peer ${input.peerActorId as string} has empty fingerprint`);
  }
  const transport = new NetTransport({
    endpointId: input.localEndpointId,
    tls: input.localTls,
    connect: { host: entry.host, port: entry.port },
    pinnedPeerFingerprints: [entry.fingerprint],
    expectedPeerActorRef: input.peerActorId as string,
  });
  await transport.connect();
  return transport;
}
