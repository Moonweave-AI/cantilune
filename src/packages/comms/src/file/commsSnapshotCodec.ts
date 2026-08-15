import { type CommsSnapshot } from "../ports/commsStore.js";
import type { MemoryCommsStore } from "../memory/memoryCommsStore.js";
import { commsStoreSequence } from "../foundation/messageId.js";
import {
  hydrateCommsPersistedSnapshot,
  type CommsPersistedSnapshot,
} from "../foundation/commsPersistedSnapshot.js";

export function serializeCommsSnapshot(memory: MemoryCommsStore): string {
  return JSON.stringify(memory.exportPersistedSnapshot());
}

export function hydrateCommsSnapshot(raw: CommsPersistedSnapshot): CommsPersistedSnapshot {
  return hydrateCommsPersistedSnapshot(raw);
}

export function toCommsSnapshot(raw: CommsPersistedSnapshot): CommsSnapshot {
  return {
    frozen: raw.frozen,
    lastSequence: commsStoreSequence(raw.sequence),
    peers: new Map(
      raw.peers as CommsSnapshot["peers"] extends ReadonlyMap<string, infer V>
        ? [string, V][]
        : never,
    ),
    sessions: new Map(
      raw.sessions as CommsSnapshot["sessions"] extends ReadonlyMap<string, infer V>
        ? [string, V][]
        : never,
    ),
    outbox: raw.outbox as CommsSnapshot["outbox"],
    inbox: raw.inbox as CommsSnapshot["inbox"],
    reconnects: new Map(
      raw.reconnects as CommsSnapshot["reconnects"] extends ReadonlyMap<string, infer V>
        ? [string, V][]
        : never,
    ),
    occurrences: raw.occurrences as CommsSnapshot["occurrences"],
    events: raw.events as CommsSnapshot["events"],
  };
}

export type { CommsPersistedSnapshot };
