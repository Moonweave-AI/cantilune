import { describe, expect, it, afterEach } from "vitest";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  actorRef,
  actorId,
  collaborationSnapshot,
  epochId,
  participant,
  snapshotRef,
  type ParticipationStatus,
} from "@cantilune/core";
import { createDefaultSchema } from "../../../src/schema/defaultSchema.js";
import { createActiveSchemaContext } from "../../../src/engine/activeSchemaContext.js";
import { createCoordinationRuntime } from "../../../src/engine/coordinationRuntime.js";
import { createDefaultHandlers } from "../../../src/execution/handlers/index.js";
import { templateAwarePolicyEvaluator } from "../../../src/ports/policyEvaluator.js";
import { MemoryResourceLockTable } from "../../../src/memory/memoryLockTable.js";
import { AdmissionRegistry } from "../../../src/admission/admissionRegistry.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { introduceIntent } from "../../support/scenario/scenarioRunner.js";
import {
  createFileRuntimePersistence,
  readFileRuntimeIdentity,
} from "../../../src/memory/fileDurablePersistence.js";

const dirs: string[] = [];

function storage(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-symmetry-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function snapshotWith(status: ParticipationStatus, ref = "snap-0") {
  const aid = actorId("some-agent");
  return collaborationSnapshot({
    snapshotRef: snapshotRef(ref),
    epochId: epochId("e-1"),
    participants: new Map([[aid, participant(aid, "agent", status)]]),
  });
}

/**
 * The store previously accepted a snapshot the decoder rejected, so the world
 * became unloadable one operation after the bad commit rather than at it.
 */
describe("the durable store never writes what it cannot read", () => {
  it("exposes an identity only for a present and fully valid durable bundle", () => {
    const dir = storage();
    expect(readFileRuntimeIdentity(dir)).toBeUndefined();

    createFileRuntimePersistence({ dir, initial: snapshotWith("active", "genesis-a") });
    expect(readFileRuntimeIdentity(dir)).toEqual({ genesisRef: snapshotRef("genesis-a") });

    const bundlePath = join(dir, "durable.bundle.json");
    const validBundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>;
    writeFileSync(bundlePath, JSON.stringify({ ...validBundle, headRef: "missing-head" }), "utf8");
    expect(readFileRuntimeIdentity(dir)).toBeUndefined();

    writeFileSync(bundlePath, '{"t0Ref":"forged"}', "utf8");
    expect(readFileRuntimeIdentity(dir)).toBeUndefined();
  });

  it("round-trips a world through disk for every participation status", () => {
    for (const status of [
      "registered",
      "active",
      "waiting",
      "blocked",
      "done",
      "retired",
    ] as const) {
      const dir = storage();
      createFileRuntimePersistence({ dir, initial: snapshotWith(status) });

      // A second open is what a restart does, and what used to throw.
      const reopened = createFileRuntimePersistence({ dir });
      const head = reopened.durable.head();
      const loaded = head === undefined ? undefined : reopened.durable.get(head);

      expect(loaded?.participants.get(actorId("some-agent"))?.status).toBe(status);
    }
  });

  it("refuses the write and leaves the previous bundle intact when a snapshot cannot be decoded", () => {
    const dir = storage();
    const persistence = createFileRuntimePersistence({ dir, initial: snapshotWith("active") });
    const bundlePath = join(dir, "durable.bundle.json");
    const before = readFileSync(bundlePath, "utf8");

    // Stands in for a future encoder/validator drift: a status core does not know.
    const rogue = snapshotWith("teleported" as ParticipationStatus, "snap-1");

    expect(() => persistence.durable.compareAndSwapHead(persistence.t0Ref, rogue)).toThrow(
      /refusing to persist an unreadable durable bundle/,
    );

    expect(readFileSync(bundlePath, "utf8")).toBe(before);

    // And the world is still usable.
    const reopened = createFileRuntimePersistence({ dir });
    expect(reopened.durable.head()).toBe(persistence.t0Ref);
  });

  it("refuses every old handle after the directory is replaced by another generation", () => {
    const oldDir = storage();
    const replacementDir = storage();
    const old = createFileRuntimePersistence({
      dir: oldDir,
      initial: snapshotWith("active", "genesis-old"),
    });
    createFileRuntimePersistence({
      dir: replacementDir,
      initial: snapshotWith("active", "genesis-replacement"),
    });
    copyFileSync(join(replacementDir, "durable.bundle.json"), join(oldDir, "durable.bundle.json"));

    expect(() => old.durable.head()).toThrow(/generation changed/);
    expect(() => old.durable.get(old.t0Ref)).toThrow(/generation changed/);
    expect(() => old.durable.compareAndSwapHead(old.t0Ref, snapshotWith("active", "next"))).toThrow(
      /generation changed/,
    );
  });

  it("fails closed when a previously opened world's durable bundle disappears", () => {
    const dir = storage();
    const persistence = createFileRuntimePersistence({
      dir,
      initial: snapshotWith("active", "genesis-delete"),
    });
    const bundlePath = join(dir, "durable.bundle.json");
    unlinkSync(bundlePath);

    expect(() => persistence.durable.head()).toThrow(/ENOENT/);
    expect(() => persistence.durable.get(persistence.t0Ref)).toThrow(/ENOENT/);
    expect(() =>
      persistence.durable.compareAndSwapHead(
        persistence.t0Ref,
        snapshotWith("active", "must-not-resurrect"),
      ),
    ).toThrow(/ENOENT/);
    expect(existsSync(bundlePath)).toBe(false);
  });

  it("refreshes every public file-persistence view after another handle commits", () => {
    const dir = storage();
    const first = createFileRuntimePersistence({
      dir,
      initial: snapshotWith("active", "genesis-shared"),
    });
    const second = createFileRuntimePersistence({ dir });
    const schema = createDefaultSchema();
    const locks = new MemoryResourceLockTable();
    const runtime = createCoordinationRuntime({
      durable: second.durable,
      locks,
      registry: new AdmissionRegistry(locks),
      clock: createFixedClock(),
      idGen: createDeterministicIdGenerator({
        snapshotRefs: ["snap-shared-next"],
        changeIds: ["chg-shared-next"],
      }),
      schemaContext: createActiveSchemaContext(schema, epochId("e-1")),
      policy: templateAwarePolicyEvaluator(),
      handlers: createDefaultHandlers(),
      contentRefAuthority: { isAvailable: () => true },
    });
    const intent = introduceIntent(0, actorId("some-agent"));
    const committed = runtime.proposeAndCommit(intent, {
      principal: actorRef(actorId("some-agent"), "agent"),
    });
    expect("change" in committed).toBe(true);

    expect(first.durable.head()).toBe("snap-shared-next");
    expect(first.store.head()).toBe("snap-shared-next");
    expect(first.changelog.all()).toHaveLength(1);
    expect(first.sidecar.get(first.changelog.all()[0]!.changeId)).toBeDefined();
  });
});
