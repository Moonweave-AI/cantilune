import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { createRaftDurableFromEnv } from "../../../src/memory/createRaftDurableFromEnv.js";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import { startProcessEtcdGateway } from "../../support/etcdJsonGateway.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-raft-env-"));
  dirs.push(dir);
  return dir;
}

describe("createRaftDurableFromEnv", () => {
  it("returns undefined when Raft is not configured", () => {
    expect(createRaftDurableFromEnv({ env: {} })).toBeUndefined();
  });

  it("accepts an injected MemoryRaftKv and disposes it", () => {
    const close = vi.fn();
    const kv = Object.assign(createMemoryRaftKv(), { close });
    const opened = createRaftDurableFromEnv({
      kv,
      initial: buildConfigT0(),
      namespace: "unit",
    });
    expect(opened?.durable.head()).toBe(buildConfigT0().snapshotRef);
    opened?.dispose();
    expect(close).toHaveBeenCalledOnce();
  });

  it("opens official JSON gateway endpoints through the worker", async () => {
    const gateway = await startProcessEtcdGateway();
    try {
      const opened = createRaftDurableFromEnv({
        env: { CANTILUNE_RAFT_ENDPOINTS: gateway.url, CANTILUNE_RAFT_NAMESPACE: "unit" },
        initial: buildConfigT0(),
        storagePath: tempDir(),
      });
      expect(opened?.durable.head()).toBe(buildConfigT0().snapshotRef);
      opened?.dispose();
    } finally {
      gateway.close();
    }
  });

  it("embeds official etcd, waits for ready, and stops the process on dispose", async () => {
    const gateway = await startProcessEtcdGateway();
    const stop = vi.fn();
    try {
      const opened = createRaftDurableFromEnv({
        env: {
          CANTILUNE_RAFT_EMBED: "1",
          CANTILUNE_RAFT_CLIENT_URL: gateway.url,
          CANTILUNE_RAFT_NAMESPACE: "embed",
        },
        initial: buildConfigT0(),
        storagePath: tempDir(),
        locator: { locate: () => "etcd" },
        launcher: {
          spawn() {
            return { pid: 99, kill: stop };
          },
        },
      });
      expect(opened?.embed?.startedByUs).toBe(true);
      expect(opened?.durable.head()).toBe(buildConfigT0().snapshotRef);
      opened?.dispose();
      expect(stop).toHaveBeenCalledOnce();
    } finally {
      gateway.close();
    }
  });

  it("stops a spawned embed when the member never becomes ready", () => {
    const stop = vi.fn();
    expect(() =>
      createRaftDurableFromEnv({
        env: {
          CANTILUNE_RAFT_EMBED: "1",
          CANTILUNE_RAFT_CLIENT_URL: "http://127.0.0.1:1",
        },
        storagePath: tempDir(),
        locator: { locate: () => "etcd" },
        launcher: {
          spawn() {
            return { pid: 1, kill: stop };
          },
        },
        waitTimeoutMs: 50,
      }),
    ).toThrow(/did not become ready/);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("fail-closes embed when the official binary is missing", () => {
    expect(() =>
      createRaftDurableFromEnv({
        env: { CANTILUNE_RAFT_EMBED: "1" },
        storagePath: tempDir(),
        locator: { locate: () => undefined },
      }),
    ).toThrow(/official etcd/);
  });
});
