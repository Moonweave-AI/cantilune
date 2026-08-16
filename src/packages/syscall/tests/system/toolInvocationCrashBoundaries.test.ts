/**
 * ADR-0016 cross-process crash boundary tests (the lift gate).
 *
 * Each boundary kills a child process mid-`useTool` against a FILE-backed
 * content store (so state survives process death), then restarts a fresh
 * child against the same store and asserts exactly-once recovery:
 *  - boundary 1 (pre-dispatch): no journal entry → fresh dispatch → one execute.
 *  - boundary 2 (post-side-effect/pre-output, idempotent): dispatched entry →
 *    reconcile(known) → reuse, no second execute.
 *  - boundary 2 (post-side-effect/pre-output, non-idempotent): dispatched entry
 *    → ambiguous, no second execute.
 *  - boundary 3 (post-output/pre-receipt, idempotent): dispatched entry →
 *    reconcile(known) → reuse, no second execute.
 *  - read tier: dispatched entry → safe re-dispatch.
 *
 * Requires: pnpm build (core, content, syscall) — the child imports from dist.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const childScript = join(here, "..", "..", "support", "toolInvocationCrashChild.mjs");

function runChild(storeDir: string, crashAt: string, tier: string, callId: string, args: object) {
  const result = spawnSync(
    process.execPath,
    [childScript, storeDir, crashAt, tier, callId, JSON.stringify(args)],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "" },
      timeout: 30_000,
    },
  );
  return result;
}

function parseChildOut(result: { stdout: string; status: number | null }) {
  const line = result.stdout.trim().split("\n").pop();
  return line ? JSON.parse(line) : null;
}

function sideEffectCount(storeDir: string, prefix: string): number {
  const sidecar = join(storeDir, "side-effect.log");
  if (!existsSync(sidecar)) return 0;
  const lines = readFileSync(sidecar, "utf8").split("\n").filter(Boolean);
  return lines.filter((l) => l.startsWith(prefix)).length;
}

describe("ADR-0016 external-tool exactly-once — cross-process crash boundaries", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cantilune-syscall-crash-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("boundary 1 (pre-dispatch): restart dispatches fresh — side effect lands exactly once", () => {
    // Crash before execute is ever called (no dispatched entry survives).
    const crash = runChild(dir, "pre-dispatch", "idempotent", "call-b1", { x: 1 });
    expect(crash.status).not.toBe(0);

    // Restart: no dispatched journal entry exists → fresh dispatch → one execute.
    const restart = runChild(dir, "none", "idempotent", "call-b1", { x: 1 });
    expect(restart.status).toBe(0);
    const out = parseChildOut(restart);
    expect(out.ok).toBe(true);
    expect(out.executes).toBe(1);
    expect(out.reconciles).toBe(0);
    // The crash wrote no execute side effect; the restart wrote exactly one.
    expect(sideEffectCount(dir, "execute#")).toBe(1);
  });

  it("boundary 2 idempotent (post-side-effect/pre-output): restart reconciles(known) — no second execute", () => {
    // Crash after the side effect lands but before the output is durable.
    const crash = runChild(dir, "post-dispatch", "idempotent", "call-b2i", { x: 2 });
    expect(crash.status).not.toBe(0);
    // The side effect landed in the crashed process.
    expect(sideEffectCount(dir, "execute#")).toBe(1);

    // Restart: dispatched entry exists, idempotent → reconcile(known) → reuse.
    const restart = runChild(dir, "none", "idempotent", "call-b2i", { x: 2 });
    expect(restart.status).toBe(0);
    const out = parseChildOut(restart);
    expect(out.ok).toBe(true);
    // reconcile returned the prior output → execute NOT called again.
    expect(out.executes).toBe(0);
    expect(out.reconciles).toBe(1);
    // Still only one execute side effect in total across both processes.
    expect(sideEffectCount(dir, "execute#")).toBe(1);
  });

  it("boundary 2 non-idempotent (post-side-effect/pre-output): restart reports ambiguous — no re-dispatch", () => {
    const crash = runChild(dir, "post-dispatch", "non-idempotent", "call-b2n", { x: 3 });
    expect(crash.status).not.toBe(0);
    expect(sideEffectCount(dir, "execute#")).toBe(1);

    const restart = runChild(dir, "none", "non-idempotent", "call-b2n", { x: 3 });
    expect(restart.status).toBe(0);
    const out = parseChildOut(restart);
    expect(out.ok).toBe(false);
    expect(out.disposition).toBe("ambiguous");
    expect(out.executes).toBe(0); // NOT re-dispatched
    expect(sideEffectCount(dir, "execute#")).toBe(1);
  });

  it("boundary 3 idempotent (post-output/pre-receipt): restart reconciles(known) — no second execute", () => {
    const crash = runChild(dir, "post-output", "idempotent", "call-b3", { x: 4 });
    expect(crash.status).not.toBe(0);
    expect(sideEffectCount(dir, "execute#")).toBe(1);

    const restart = runChild(dir, "none", "idempotent", "call-b3", { x: 4 });
    expect(restart.status).toBe(0);
    const out = parseChildOut(restart);
    expect(out.ok).toBe(true);
    expect(out.executes).toBe(0);
    expect(out.reconciles).toBe(1);
    expect(sideEffectCount(dir, "execute#")).toBe(1);
  });

  it("read tier (post-dispatch crash): restart re-dispatches safely (no side effect to double)", () => {
    const crash = runChild(dir, "post-dispatch", "read", "call-read", { x: 5 });
    expect(crash.status).not.toBe(0);

    const restart = runChild(dir, "none", "read", "call-read", { x: 5 });
    expect(restart.status).toBe(0);
    const out = parseChildOut(restart);
    expect(out.ok).toBe(true);
    expect(out.executes).toBe(1); // re-dispatched (read tier, safe)
    expect(out.reconciles).toBe(0);
  });
});
