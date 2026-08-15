/**
 * MeshTransportRouter — N-to-N agent transport allocation.
 *
 * Each agent gets a dedicated transport endpoint. Messages dispatched
 * from one agent are routed to the target via the hub.
 * Uses LoopbackTransport from @cantilune/comms for in-process transport pairs.
 */
import type { ActorId } from "@cantilune/core";
import type { CommunicationTransport } from "@cantilune/comms/ports";

/**
 * Manages transport endpoints for in-process multi-agent communication.
 * Agents share a routing table; actual transport implementation is injected.
 */
export class MeshTransportRouter {
  private readonly transports = new Map<string, CommunicationTransport>();
  private transportFactory: (() => [CommunicationTransport, CommunicationTransport]) | undefined;

  /** Set the factory used to create connected transport pairs. */
  setTransportFactory(factory: () => [CommunicationTransport, CommunicationTransport]): void {
    this.transportFactory = factory;
  }

  /**
   * Allocate a transport endpoint for a new agent.
   * If no factory is set, stores a placeholder that will fail on use.
   */
  allocate(agentId: ActorId): CommunicationTransport {
    const agentKey = agentId as string;
    const existing = this.transports.get(agentKey);
    if (existing !== undefined) return existing;

    if (this.transportFactory !== undefined) {
      const [agentSide] = this.transportFactory();
      this.transports.set(agentKey, agentSide);
      return agentSide;
    }

    const placeholder: CommunicationTransport = {
      transportId: `mesh-${agentKey}`,
      async dispatch() {
        return { ok: false, value: undefined } as never;
      },
      async receive() {
        return { ok: false, value: undefined } as never;
      },
      async handshake() {
        return { ok: false, value: undefined } as never;
      },
    };
    this.transports.set(agentKey, placeholder);
    return placeholder;
  }

  /** Get the transport for an existing agent. */
  getTransport(agentId: ActorId): CommunicationTransport | undefined {
    return this.transports.get(agentId as string);
  }

  /** Deallocate an agent's transport. */
  deallocate(agentId: ActorId): void {
    this.transports.delete(agentId as string);
  }

  /** Get the number of agents currently allocated. */
  get size(): number {
    return this.transports.size;
  }

  /** Get all allocated agent IDs. */
  agentIds(): ActorId[] {
    return [...this.transports.keys()] as ActorId[];
  }
}
