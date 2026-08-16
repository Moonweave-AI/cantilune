/**
 * NetTransport cross-process system test (ADR-0018 T3).
 *
 * A genuinely independent child process completes mTLS to the parent and
 * writes a strict-wire-v1 frame. A second case kills the child after a
 * truncated header; the parent must not parse a frame, and a restarted
 * child redrives a complete frame (at-least-once at the record boundary).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NetTransport } from "../../src/transports/net/netTransport.js";
import { issueSelfSignedMtlsPair } from "../../src/security/mtlsMaterial.js";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const childScript = join(packageRoot, "tests", "support", "netTransportDispatchChild.mjs");
const distNet = join(packageRoot, "dist", "transports", "net", "netTransport.js");
const repoRoot = join(packageRoot, "..", "..");

if (!existsSync(distNet)) {
  throw new Error(
    `NetTransport cross-process evidence requires a built package: ${distNet} is missing. ` +
      `Run \`pnpm --filter @cantilune/comms... build\` first.`,
  );
}

function spawnChild(
  configPath: string,
): Promise<{ readonly code: number; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [childScript, configPath], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? -1, stderr });
    });
  });
}

async function pollReceive(
  transport: NetTransport,
  attempts = 40,
): Promise<Awaited<ReturnType<NetTransport["receive"]>>> {
  for (let i = 0; i < attempts; i += 1) {
    const received = await transport.receive();
    if (received.ok) {
      return received;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return transport.receive();
}

describe("NetTransport cross-process delivery", () => {
  let dir: string;
  let issued: ReturnType<typeof issueSelfSignedMtlsPair>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cantilune-nettransport-xproc-"));
    issued = issueSelfSignedMtlsPair();
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("a child process sends a frame the parent reads and parses (strict wire v1)", async () => {
    const parent = new NetTransport({
      endpointId: "net-parent",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      listen: { host: "127.0.0.1", port: 0 },
      pinnedPeerFingerprints: [issued.b.fingerprint],
      expectedPeerActorRef: issued.b.actorRef,
    });
    const addr = await parent.listen();
    const messageId = "msg-net-xproc-001";
    const configPath = join(dir, "full.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mode: "full",
        messageId,
        connect: { host: "127.0.0.1", port: addr.port },
        tls: { cert: issued.b.cert, key: issued.b.key, ca: issued.ca.cert },
        pinnedPeerFingerprints: [issued.a.fingerprint],
        expectedPeerActorRef: issued.a.actorRef,
      }),
    );
    const result = await spawnChild(configPath);
    expect(result.code).toBe(0);
    const received = await pollReceive(parent);
    expect(received.ok).toBe(true);
    if (!received.ok) {
      await parent.close();
      return;
    }
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.messageId).toBe(messageId as never);
    }
    await parent.close();
  });

  it("a truncated mid-send write does not yield a frame; a restart redrives", async () => {
    const parent = new NetTransport({
      endpointId: "net-parent-crash",
      tls: { cert: issued.a.cert, key: issued.a.key, ca: issued.ca.cert },
      listen: { host: "127.0.0.1", port: 0 },
      pinnedPeerFingerprints: [issued.b.fingerprint],
      expectedPeerActorRef: issued.b.actorRef,
    });
    const addr = await parent.listen();
    const partialPath = join(dir, "partial.json");
    writeFileSync(
      partialPath,
      JSON.stringify({
        mode: "partial",
        connect: { host: "127.0.0.1", port: addr.port },
        tls: { cert: issued.b.cert, key: issued.b.key, ca: issued.ca.cert },
        pinnedPeerFingerprints: [issued.a.fingerprint],
      }),
    );
    const partial = await spawnChild(partialPath);
    expect(partial.code).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const empty = await parent.receive();
    expect(empty.ok).toBe(false);

    const messageId = "msg-net-xproc-002";
    const fullPath = join(dir, "redrive.json");
    writeFileSync(
      fullPath,
      JSON.stringify({
        mode: "full",
        messageId,
        connect: { host: "127.0.0.1", port: addr.port },
        tls: { cert: issued.b.cert, key: issued.b.key, ca: issued.ca.cert },
        pinnedPeerFingerprints: [issued.a.fingerprint],
        expectedPeerActorRef: issued.a.actorRef,
      }),
    );
    const redrive = await spawnChild(fullPath);
    expect(redrive.code).toBe(0);
    const received = await pollReceive(parent);
    expect(received.ok).toBe(true);
    if (received.ok) {
      const parsed = parseCommunicationWireFrame(received.value);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.messageId).toBe(messageId as never);
      }
    }
    await parent.close();
  });
});
