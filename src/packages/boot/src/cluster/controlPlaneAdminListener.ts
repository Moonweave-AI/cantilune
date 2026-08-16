/**
 * Supervisor-host admin listener: already-admitted NetTransport envelopes only.
 * Deny-by-default lives in ControlPlaneAdminSession; this file only pumps bytes.
 */
import type { CommunicationTransport } from "@cantilune/comms/ports";
import {
  decodeControlPlaneAdminEnvelope,
  type ControlPlaneAdminHandler,
} from "@cantilune/control-plane";

export interface ControlPlaneAdminListener {
  readonly stop: () => Promise<void>;
}

export interface ControlPlaneAdminListenerOptions {
  readonly transport: CommunicationTransport;
  readonly session: ControlPlaneAdminHandler;
  readonly pollIntervalMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Accepts already-admitted admin envelopes over an existing CommunicationTransport
 * (NetTransport in production). Unknown / undecodable frames are dropped with
 * no control-plane mutation.
 */
export function startControlPlaneAdminListener(
  options: ControlPlaneAdminListenerOptions,
): ControlPlaneAdminListener {
  let running = true;
  const pollMs = options.pollIntervalMs ?? 20;
  const loop = (async () => {
    while (running) {
      const received = await options.transport.receive();
      if (!running) {
        break;
      }
      if (!received.ok) {
        await delay(pollMs);
        continue;
      }
      const envelope = decodeControlPlaneAdminEnvelope(received.value);
      if (envelope === undefined) {
        continue;
      }
      try {
        await options.session.handle(envelope);
      } catch {
        // Keep the supervisor listener up; a single bad handle must not halt admin.
      }
    }
  })();

  return {
    stop: async () => {
      running = false;
      await loop;
    },
  };
}
