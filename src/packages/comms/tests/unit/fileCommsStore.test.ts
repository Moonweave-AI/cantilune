import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileCommsStore } from "../../src/file/fileCommsStore.js";
import { withFileLock, acquireFileLock } from "../../src/file/fileLock.js";
import { MemoryCommsStore } from "../../src/memory/memoryCommsStore.js";
import {
  hydrateCommsSnapshot,
  serializeCommsSnapshot,
  toCommsSnapshot,
} from "../../src/file/commsSnapshotCodec.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";

describe("file-backed comms store", () => {
  let dir: string;

  it("creates store and persists peer", () => {
    dir = mkdtempSync(join(tmpdir(), "comms-file-test-"));
    const store = createFileCommsStore(dir);
    const peer = buildTestPeerDescriptor();
    store.putPeer(peer);
    const reloaded = createFileCommsStore(dir);
    expect(reloaded.getPeer(peer.descriptorRef)).toBeDefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it("acquires and releases file lock", () => {
    dir = mkdtempSync(join(tmpdir(), "comms-lock-test-"));
    const result = withFileLock(dir, () => 42);
    expect(result).toBe(42);
    const lock = acquireFileLock(dir);
    lock.release();
    rmSync(dir, { recursive: true, force: true });
  });

  it("serializes and hydrates snapshot codec", () => {
    const memory = new MemoryCommsStore();
    memory.nextSequence();
    const raw = JSON.parse(serializeCommsSnapshot(memory));
    const hydrated = hydrateCommsSnapshot(raw);
    const snapshot = toCommsSnapshot(hydrated);
    expect(snapshot.lastSequence).toBe(memory.snapshot().lastSequence);
  });
});
