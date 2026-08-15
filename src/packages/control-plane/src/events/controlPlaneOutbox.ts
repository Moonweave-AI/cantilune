import type { ControlPlaneEventEnvelope } from "../ports/controlPlaneStore.js";

export interface OutboxEntry {
  readonly id: string;
  readonly event: ControlPlaneEventEnvelope;
  readonly delivered: boolean;
  readonly attempts: number;
}

export interface ControlPlaneOutbox {
  enqueue(event: ControlPlaneEventEnvelope): void;
  pending(): readonly OutboxEntry[];
  markDelivered(id: string): void;
  replayPending(handler: (event: ControlPlaneEventEnvelope) => Promise<void>): Promise<number>;
}

export function createControlPlaneOutbox(): ControlPlaneOutbox {
  const entries: OutboxEntry[] = [];
  let seq = 0;

  return {
    enqueue(event) {
      seq += 1;
      entries.push({ id: `outbox-${seq}`, event, delivered: false, attempts: 0 });
    },
    pending() {
      return entries.filter((entry) => !entry.delivered);
    },
    markDelivered(id) {
      const entry = entries.find((item) => item.id === id);
      if (entry !== undefined) {
        (entry as { delivered: boolean }).delivered = true;
      }
    },
    async replayPending(handler) {
      let delivered = 0;
      for (const entry of entries) {
        if (entry.delivered) {
          continue;
        }
        await handler(entry.event);
        (entry as { delivered: boolean; attempts: number }).delivered = true;
        (entry as { attempts: number }).attempts += 1;
        delivered += 1;
      }
      return delivered;
    },
  };
}
