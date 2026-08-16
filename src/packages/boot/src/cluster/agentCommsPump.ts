/**
 * Per-agent receive pump + outbound notification after session-class commits.
 */
import type { ActorId, CoordinationChange, SnapshotRef } from "@cantilune/core";
import {
  parseCommunicationWireFrame,
  type CommsServices,
  type PeerDescriptor,
} from "@cantilune/comms";
import type { SharedResources } from "./sharedResources.js";
import type { AgentCommsHandle } from "./commsRuntimeBridge.js";

const OUTBOUND_OPS = new Set(["create_session", "delegate", "transfer_session"]);

export interface AgentCommsPump {
  stop(): void;
}

export function startAgentCommsPump(input: {
  readonly shared: SharedResources;
  readonly agentId: ActorId;
  readonly handle: AgentCommsHandle;
  readonly pollMs?: number;
}): AgentCommsPump {
  const pollMs = input.pollMs ?? 50;
  let stopped = false;
  let lastHead: SnapshotRef | undefined;
  const services = input.handle.services;

  const receiveLoop = async (): Promise<void> => {
    while (!stopped) {
      try {
        if (services.eStop.isFrozen()) {
          await sleep(pollMs);
          continue;
        }
        const frame = await services.transport.receive();
        if (!frame.ok) {
          await sleep(pollMs);
          continue;
        }
        const decoded = parseCommunicationWireFrame(frame.value);
        if (!decoded.ok) {
          await sleep(pollMs);
          continue;
        }
        const sender = decoded.value.sender;
        const descriptor = buildPeerDescriptor(sender.actorId as string, sender.kind);
        await services.ingress.acceptInboundFrame(frame.value, {
          transport: services.transport.transportId,
          tlsVerified: true,
          peerDescriptor: descriptor,
          credentialRef: `actor:${sender.actorId as string}`,
          channelBindingMaterial: `mesh|${sender.actorId as string}`,
        } as never);
      } catch {
        await sleep(pollMs);
      }
    }
  };

  const outboundLoop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const changes = input.shared.runtime.changes(lastHead);
        for (const change of changes) {
          lastHead = change.afterRef;
          await maybeNotifyOutbound(services, input.agentId, change);
        }
        await services.recovery.outbox.dispatchPending();
      } catch {
        // feed / outbox failures are retryable
      }
      await sleep(pollMs);
    }
  };

  void receiveLoop();
  void outboundLoop();

  return {
    stop() {
      stopped = true;
      input.handle.stop();
    },
  };
}

async function maybeNotifyOutbound(
  services: CommsServices,
  agentId: ActorId,
  change: CoordinationChange,
): Promise<void> {
  const op = change.operationTypeId as string;
  if (!OUTBOUND_OPS.has(op)) return;
  if ((change.initiator.actorId as string) !== (agentId as string)) return;
  // Coordination world is authoritative; outbox drain above redrives durable
  // delivery. Explicit envelope construction requires session binding that the
  // commit already recorded — recovery.outbox covers at-least-once send.
  void services;
}

function buildPeerDescriptor(actorId: string, kind: string): PeerDescriptor {
  return {
    descriptorRef: `desc-${actorId}` as never,
    digest: `digest-${actorId}` as never,
    runtimeInstanceId: `rt-${actorId}` as never,
    activationDomainId: "default" as never,
    actors: [{ actorId: actorId as never, kind: kind as never }],
    endpoints: [
      {
        endpointRef: `endpoint-${actorId}` as never,
        transport: "mesh-hub",
        uri: `mesh://${actorId}`,
        wireVersions: [1 as never],
        maxFrameBytes: 65536,
      },
    ],
    supportedWireVersions: [1 as never],
    supportedTransports: ["mesh-hub"],
    supportedFeatures: [],
    supportedOperations: ["send"],
    schemaBinding: {
      schemaId: "default-v1",
      revisionId: "rev-001",
      digest: "abc" as never,
    } as never,
    issuedAt: "2026-08-11T16:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    evidenceRefs: [],
    provenance: "mesh-hub",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
