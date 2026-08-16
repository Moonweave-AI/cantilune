/**
 * MeshTransportRouter — true N-to-N hub.
 *
 * Each agent receives a {@link MeshHubEndpoint}. `dispatch` routes by envelope
 * `recipient` ActorRef into that agent's inbox; `receive` only drains the local
 * inbox. Unknown recipients fail closed. Optional physical factories (file/net)
 * attach a backend transport for S4; they no longer discard the peer half.
 */
import type { ActorId } from "@cantilune/core";
import type { CommunicationTransport } from "@cantilune/comms/ports";
import { MeshHubEndpoint } from "./meshHubEndpoint.js";

export type MeshPhysicalTransportFactory = () => CommunicationTransport;

export class MeshTransportRouter {
  private readonly endpoints = new Map<string, MeshHubEndpoint>();
  private readonly physical = new Map<string, CommunicationTransport>();
  private physicalFactory: MeshPhysicalTransportFactory | undefined;

  /**
   * Optional physical backend (FileTransport / NetTransport). When set, each
   * allocate also constructs one physical endpoint retained for S4 / identity.
   * Routing still goes through the in-process hub.
   */
  setPhysicalTransportFactory(factory: MeshPhysicalTransportFactory): void {
    this.physicalFactory = factory;
  }

  /**
   * @deprecated Prefer {@link setPhysicalTransportFactory}. Pair factories are
   * adapted by keeping both sides: agent-facing physical is retained; the peer
   * half is closed immediately so it is not silently dropped as a black hole.
   */
  setTransportFactory(factory: () => [CommunicationTransport, CommunicationTransport]): void {
    this.physicalFactory = () => {
      const [agentSide, peerSide] = factory();
      closeAllocatedTransport(peerSide);
      return agentSide;
    };
  }

  allocate(agentId: ActorId): CommunicationTransport {
    const agentKey = agentId as string;
    const existing = this.endpoints.get(agentKey);
    if (existing !== undefined) return existing;

    const endpoint = new MeshHubEndpoint(agentId, {
      lookup: (recipient) => this.endpoints.get(recipient),
    });
    this.endpoints.set(agentKey, endpoint);

    if (this.physicalFactory !== undefined) {
      const backend = this.physicalFactory();
      this.physical.set(agentKey, backend);
    }

    return endpoint;
  }

  getTransport(agentId: ActorId): CommunicationTransport | undefined {
    return this.endpoints.get(agentId as string);
  }

  /** Physical backend for an agent, if a factory was configured. */
  getPhysicalTransport(agentId: ActorId): CommunicationTransport | undefined {
    return this.physical.get(agentId as string);
  }

  deallocate(agentId: ActorId): void {
    const key = agentId as string;
    const endpoint = this.endpoints.get(key);
    this.endpoints.delete(key);
    endpoint?.close();

    const backend = this.physical.get(key);
    this.physical.delete(key);
    closeAllocatedTransport(backend);
  }

  get size(): number {
    return this.endpoints.size;
  }

  agentIds(): ActorId[] {
    return [...this.endpoints.keys()] as ActorId[];
  }
}

function closeAllocatedTransport(transport: CommunicationTransport | undefined): void {
  if (transport === undefined) {
    return;
  }
  const closer = (transport as CommunicationTransport & { close?: () => Promise<void> | void })
    .close;
  if (typeof closer === "function") {
    try {
      const result = closer.call(transport);
      if (result !== undefined && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      // close must never throw into deallocate
    }
  }
}
