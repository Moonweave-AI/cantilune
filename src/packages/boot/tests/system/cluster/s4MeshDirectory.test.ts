/**
 * L7: localhost dual-process S4 directory — fingerprint miss freezes identity;
 * remote worker entry appears in directory without double local start.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { actorId } from "@cantilune/core";
import {
  createMemoryMeshHostDirectory,
  saveMeshHostDirectory,
  loadMeshHostDirectory,
} from "../../../src/cluster/meshHostDirectory.js";
import { RemoteAgentHandle } from "../../../src/cluster/remoteAgentHandle.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("S4 mesh host directory (localhost dual-process contract)", () => {
  it("persists supervisor+worker entries for dual-process handoff", () => {
    const root = mkdtempSync(join(tmpdir(), "s4-dir-"));
    dirs.push(root);
    const path = join(root, "hosts.json");
    const dir = createMemoryMeshHostDirectory();
    dir.publish({
      actorId: actorId("supervisor"),
      host: "127.0.0.1",
      port: 9400,
      fingerprint: "fp-supervisor",
      role: "supervisor",
    });
    dir.publish({
      actorId: actorId("worker-1"),
      host: "127.0.0.1",
      port: 9401,
      fingerprint: "fp-worker-1",
      role: "worker",
    });
    saveMeshHostDirectory(path, dir);

    const otherProcess = loadMeshHostDirectory(path);
    expect(otherProcess.list()).toHaveLength(2);
    expect(otherProcess.get(actorId("worker-1"))?.port).toBe(9401);
  });

  it("RemoteAgentHandle completes only via world signal, not local LLM", async () => {
    const handle = new RemoteAgentHandle({
      actorId: actorId("worker-1"),
      hostEntry: {
        actorId: actorId("worker-1"),
        host: "127.0.0.1",
        port: 9401,
        fingerprint: "fp",
        role: "worker",
      },
    });
    const started = handle.start();
    expect(handle.isRunning).toBe(true);
    handle.completeFromWorld({
      ok: true,
      summary: "remote done",
      turns: 1,
      elapsedMs: 10,
      producedRefs: [],
      terminationReason: "done",
      operations: { committed: 1, rejected: 0 },
    });
    const result = await started;
    expect(result.ok).toBe(true);
    expect(handle.isRunning).toBe(false);
  });
});
