import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFileEndpointIdentityVerifier,
  writeFileEndpointIdentity,
  resolveStoreOwner,
  fileEndpointIdentityPath,
} from "../../src/security/fileEndpointIdentity.js";
import { createProcessEStopGate } from "../../src/adapters/process/processEStopGate.js";
import { FileTransport } from "../../src/transports/file/fileTransport.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("fileEndpointIdentity", () => {
  it("accepts matching owner+pid for the expected ActorRef", () => {
    const dir = mkdtempSync(join(tmpdir(), "file-id-"));
    dirs.push(dir);
    writeFileEndpointIdentity(dir, "agent-a");
    const verifier = createFileEndpointIdentityVerifier();
    const result = verifier.verifyFileIdentity({
      expectedActorRef: "agent-a",
      storeRoot: dir,
      presentedPid: process.pid,
      presentedOwner: resolveStoreOwner(dir),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authenticationMethod).toBe("file-owner-pid");
  });

  it("rejects a forged pid", () => {
    const dir = mkdtempSync(join(tmpdir(), "file-id-forge-"));
    dirs.push(dir);
    writeFileEndpointIdentity(dir, "agent-a");
    const verifier = createFileEndpointIdentityVerifier();
    const result = verifier.verifyFileIdentity({
      expectedActorRef: "agent-a",
      storeRoot: dir,
      presentedPid: process.pid + 99999,
      presentedOwner: resolveStoreOwner(dir),
    });
    expect(result.ok).toBe(false);
  });

  it("FileTransport receive fail-closes and freezes E-Stop on forged peer identity", async () => {
    const dir = mkdtempSync(join(tmpdir(), "file-id-recv-"));
    dirs.push(dir);
    const aRoot = join(dir, "a-id");
    const bRoot = join(dir, "b-id");
    writeFileEndpointIdentity(aRoot, "agent-a");
    writeFileEndpointIdentity(bRoot, "agent-b");
    // Forge B's identity pid after write.
    writeFileSync(
      fileEndpointIdentityPath(bRoot),
      JSON.stringify({
        actorRef: "agent-b",
        storeRoot: bRoot,
        pid: 1,
        owner: "forged",
        issuedAt: new Date().toISOString(),
      }),
      "utf8",
    );

    const eStop = createProcessEStopGate();
    const a = new FileTransport({
      outboxDir: join(dir, "a-out"),
      inboxDir: join(dir, "b-out"),
      endpointId: "a",
      eStopGate: eStop,
      identityStoreRoot: aRoot,
      localActorRef: "agent-a",
      peerIdentityStoreRoot: bRoot,
      expectedPeerActorRef: "agent-b",
    });

    const received = await a.receive();
    // Empty inbox would be retryable; forged identity fails first when peer root set.
    // receive checks identity before peek — forged identity fails closed.
    expect(received.ok).toBe(false);
    expect(eStop.isFrozen()).toBe(true);
  });
});
