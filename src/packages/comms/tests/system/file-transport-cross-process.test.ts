/**
 * FileTransport cross-process system test (ADR-0018 D1, T1/T2).
 *
 * A genuinely independent child process writes a strict-wire-v1 frame into a
 * shared outbox directory; the parent process reads it via FileTransport and
 * parses it back through the strict codec. This is the real cross-process
 * topology the ADR targets — not an in-process mock.
 *
 * Requires `pnpm build` of @cantilune/comms (the child imports from dist/).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FileTransport } from "../../src/transports/file/fileTransport.js";
import { parseCommunicationWireFrame } from "../../src/codec/strictWireCodec.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const childScript = join(packageRoot, "tests", "support", "fileTransportDispatchChild.mjs");
const distCodec = join(packageRoot, "dist", "codec", "strictWireCodec.js");
const repoRoot = join(packageRoot, "..", "..");

// The child imports from dist/, so the suite needs a built package. The
// `pretest`/`pretest:coverage` hooks guarantee that. A silent skip here would
// let CI drop the cross-process evidence without anyone noticing, so a missing
// dist fails loudly instead.
if (!existsSync(distCodec)) {
  throw new Error(
    `FileTransport cross-process evidence requires a built package: ${distCodec} is missing. ` +
      `Run \`pnpm --filter @cantilune/comms... build\` first.`,
  );
}

function spawnDispatchChild(
  outboxDir: string,
  messageId: string,
): Promise<{ readonly code: number; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [childScript, outboxDir, messageId], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? -1, stderr });
    });
  });
}

describe("FileTransport cross-process delivery", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cantilune-filetransport-xproc-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("a child process writes a frame the parent reads and parses (strict wire v1)", async () => {
    const childOutbox = join(dir, "child-outbox");
    const parentInbox = childOutbox; // cross-link: parent reads child's outbox
    const parentOutbox = join(dir, "parent-outbox");
    const parent = new FileTransport({
      outboxDir: parentOutbox,
      inboxDir: parentInbox,
      endpointId: "file-parent",
    });

    const messageId = "msg-xproc-001";
    const result = await spawnDispatchChild(childOutbox, messageId);
    expect(result.code).toBe(0);

    const received = await parent.receive();
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    const parsed = parseCommunicationWireFrame(received.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.messageId).toBe(messageId as never);
  });

  it("at-least-once: the parent re-reads the frame until acknowledged", async () => {
    const childOutbox = join(dir, "child-outbox-2");
    const parent = new FileTransport({
      outboxDir: join(dir, "parent-outbox-2"),
      inboxDir: childOutbox,
      endpointId: "file-parent-2",
    });

    const messageId = "msg-xproc-002";
    const result = await spawnDispatchChild(childOutbox, messageId);
    expect(result.code).toBe(0);

    const first = await parent.receive();
    const second = await parent.receive();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // Acknowledge removes the frame; the third read sees an empty inbox.
    parent.acknowledge(messageId as never);
    const third = await parent.receive();
    expect(third.ok).toBe(false);
  });
});
