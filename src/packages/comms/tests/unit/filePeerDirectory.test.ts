import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFilePeerDirectory } from "../../src/adapters/file/filePeerDirectory.js";
import { buildTestPeerDescriptor } from "../support/envelopeFixtures.js";

describe("createFilePeerDirectory", () => {
  it("round-trips descriptors and pin sets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-peer-dir-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const descriptor = buildTestPeerDescriptor();
      directory.register(descriptor);
      const loaded = await directory.resolve(descriptor.descriptorRef);
      expect(loaded?.digest).toBe(descriptor.digest);
      expect(directory.getPinnedFingerprints("peer-a")).toEqual([]);
      directory.setPinnedFingerprints("peer-a", ["AA".repeat(32), "not-a-pin"]);
      expect(directory.getPinnedFingerprints("peer-a")).toEqual(["aa".repeat(32)]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fail-closes on corrupt peer or pin JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-peer-corrupt-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const descriptor = buildTestPeerDescriptor();
      directory.register(descriptor);
      writeFileSync(join(dir, "peers", "desc-test-001.json"), "{", "utf8");
      expect(await directory.resolve(descriptor.descriptorRef)).toBeUndefined();
      writeFileSync(join(dir, "peers", "peer-a.pins.json"), "{", "utf8");
      expect(directory.getPinnedFingerprints("peer-a")).toEqual([]);
      writeFileSync(
        join(dir, "peers", "peer-b.pins.json"),
        JSON.stringify({ fingerprints: 1 }),
        "utf8",
      );
      expect(directory.getPinnedFingerprints("peer-b")).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
