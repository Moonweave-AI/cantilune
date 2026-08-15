import { describe, expect, it } from "vitest";
import { hydrateCommsPersistedSnapshot } from "../../src/foundation/commsPersistedSnapshot.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";

describe("commsPersistedSnapshot", () => {
  it("hydrates partial snapshots with defaults", () => {
    const hydrated = hydrateCommsPersistedSnapshot({
      version: 1,
      frozen: false,
      sequence: 0,
      peers: [],
      sessions: [],
      outbox: [],
      inbox: [],
      deliveries: [],
      envelopes: [],
      acks: [],
      reconnects: [],
      closePlans: [],
      closeReceipts: [],
      forceCloses: [],
      occurrences: [],
      events: [],
      idempotency: [],
      deadLetters: [],
      delegations: [],
      delegationReceipts: [],
      handshakes: [],
    });
    expect(hydrated.version).toBe(1);
    expect(hydrated.sequence).toBe(0);
    expect(hydrated.peers).toEqual([]);
  });

  it("exports and restores via memory store", () => {
    const store = new MemoryCommsStore();
    store.nextSequence();
    const exported = store.exportPersistedSnapshot();
    const restored = new MemoryCommsStore();
    restored.restorePersistedSnapshot(exported);
    expect(restored.snapshot().lastSequence).toBe(store.snapshot().lastSequence);
  });
});
