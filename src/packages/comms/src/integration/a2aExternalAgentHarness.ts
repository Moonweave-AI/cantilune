import { type Result, ok } from "@cantilune/core";
import { type CommsViolation } from "../foundation/commsViolation.js";
import { decodeA2AFrame, encodeA2AFrame } from "../transports/a2a/a2aCodec.js";
import { A2A_PROFILE_PINNED } from "../foundation/commsLimits.js";

export interface A2AExternalAgentEndpoint {
  readonly agentId: string;
  readonly profile: typeof A2A_PROFILE_PINNED;
}

/** In-process external A2A agent broker for interop drills (simulates remote peer). */
export class A2AExternalAgentBroker {
  private readonly inboxes = new Map<string, Uint8Array[]>();
  private readonly profiles = new Map<string, string>();

  registerAgent(agent: A2AExternalAgentEndpoint): void {
    this.inboxes.set(agent.agentId, []);
    this.profiles.set(agent.agentId, agent.profile);
  }

  async sendTo(agentId: string, frame: Uint8Array): Promise<Result<void, CommsViolation>> {
    const inbox = this.inboxes.get(agentId);
    if (inbox === undefined) {
      return {
        ok: false,
        error: {
          code: "transport_failed",
          phase: "send",
          message: `unknown external agent: ${agentId}`,
          retryable: false,
        },
      };
    }
    inbox.push(frame);
    return ok(undefined);
  }

  async receiveFrom(agentId: string): Promise<Result<Uint8Array, CommsViolation>> {
    const inbox = this.inboxes.get(agentId);
    if (inbox === undefined || inbox.length === 0) {
      return {
        ok: false,
        error: {
          code: "transport_failed",
          phase: "receive",
          message: "external agent inbox empty",
          retryable: true,
        },
      };
    }
    return ok(inbox.shift()!);
  }

  /** Simulates external agent validating pinned profile and echoing ack frame. */
  async runExternalAgentLoop(agentId: string): Promise<void> {
    const received = await this.receiveFrom(agentId);
    if (!received.ok) {
      return;
    }
    const decoded = decodeA2AFrame(received.value);
    if (!decoded.ok) {
      return;
    }
    if (decoded.value.header.profile !== A2A_PROFILE_PINNED) {
      return;
    }
    const ackBody = new TextEncoder().encode(
      JSON.stringify({ ack: true, kind: decoded.value.header.messageKind }),
    );
    const ackFrame = encodeA2AFrame(
      {
        profile: A2A_PROFILE_PINNED,
        wireVersion: decoded.value.header.wireVersion,
        messageKind: "ack",
      },
      ackBody,
    );
    await this.sendTo(agentId, ackFrame);
  }
}

export function createA2AExternalAgentBroker(): A2AExternalAgentBroker {
  return new A2AExternalAgentBroker();
}
