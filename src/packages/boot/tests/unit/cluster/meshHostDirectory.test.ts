import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { actorId } from "@cantilune/core";
import {
  createMemoryMeshHostDirectory,
  loadMeshHostDirectory,
  saveMeshHostDirectory,
} from "../../../src/cluster/meshHostDirectory.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("meshHostDirectory", () => {
  it("rejects publish without fingerprint", () => {
    const dir = createMemoryMeshHostDirectory();
    expect(() =>
      dir.publish({
        actorId: actorId("a"),
        host: "127.0.0.1",
        port: 9000,
        fingerprint: "",
        role: "worker",
      }),
    ).toThrow(/fingerprint/);
  });

  it("round-trips through save/load", () => {
    const root = mkdtempSync(join(tmpdir(), "mesh-dir-"));
    dirs.push(root);
    const path = join(root, "hosts.json");
    const dir = createMemoryMeshHostDirectory();
    dir.publish({
      actorId: actorId("sup"),
      host: "127.0.0.1",
      port: 9100,
      fingerprint: "abc123",
      role: "supervisor",
    });
    saveMeshHostDirectory(path, dir);
    const loaded = loadMeshHostDirectory(path);
    expect(loaded.get(actorId("sup"))?.fingerprint).toBe("abc123");
    expect(loaded.list()).toHaveLength(1);
  });
});
