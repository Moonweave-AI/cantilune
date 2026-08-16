import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPathEtcdLocator,
  createProcessEtcdLauncher,
  etcdBinaryName,
  resolveEtcdBinary,
  sleepSync,
  startEmbeddedEtcd,
} from "../../../src/memory/embedEtcd.js";

describe("embedEtcd", () => {
  it("names the official binary per OS and resolves an explicit path", () => {
    expect(etcdBinaryName("win32")).toBe("etcd.exe");
    expect(etcdBinaryName("linux")).toBe("etcd");
    expect(resolveEtcdBinary({ CANTILUNE_ETCD_BIN: "   " })).toBeUndefined();
    expect(resolveEtcdBinary({ PATH: "", Path: "" })).toBeUndefined();
    expect(createPathEtcdLocator().locate({ CANTILUNE_ETCD_BIN: "" })).toBeUndefined();
    sleepSync(1);
  });

  it("reuses a listener without spawning and fail-closes when the binary is missing", () => {
    const reused = startEmbeddedEtcd({
      dataDir: "unused",
      alreadyListening: true,
      clientUrl: "http://127.0.0.1:2379",
    });
    expect(reused.startedByUs).toBe(false);
    expect(reused.endpoints).toEqual(["http://127.0.0.1:2379"]);
    reused.stop();

    expect(() =>
      startEmbeddedEtcd({
        dataDir: "unused",
        locator: { locate: () => undefined },
      }),
    ).toThrow(/official etcd/);
  });

  it("spawns the official binary with the embed cluster flags", () => {
    const spawned: { bin?: string; args?: readonly string[] } = {};
    const handle = startEmbeddedEtcd({
      dataDir: "var/etcd",
      locator: { locate: () => "/opt/etcd" },
      launcher: {
        spawn(bin, args) {
          spawned.bin = bin;
          spawned.args = args;
          return { pid: 4242, kill() {} };
        },
      },
    });
    expect(handle.startedByUs).toBe(true);
    expect(handle.pid).toBe(4242);
    expect(spawned.bin).toBe("/opt/etcd");
    expect(spawned.args).toContain("--initial-cluster-state");
    expect(spawned.args).toContain("new");
    handle.stop();
  });

  it("resolves the official binary from extra dirs or PATH", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-etcd-bin-"));
    const bin = join(dir, etcdBinaryName());
    writeFileSync(bin, "");
    try {
      expect(resolveEtcdBinary({}, [dir])).toBe(bin);
      expect(resolveEtcdBinary({ PATH: dir })).toBe(bin);
      expect(createPathEtcdLocator().locate({ CANTILUNE_ETCD_BIN: bin })).toBe(bin);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can spawn and kill a child through the process launcher", () => {
    const launcher = createProcessEtcdLauncher();
    const handle = launcher.spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      process.cwd(),
    );
    expect(handle.pid).toEqual(expect.any(Number));
    handle.kill();
    handle.kill();
  });
});
