import { describe, expect, it } from "vitest";
import {
  activationDomainId,
  actorId,
  actorRef,
  bindingGeneration,
  changeId,
  contentDigest,
  coordinationChange,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  matchBinding,
  operationTypeId,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  snapshotRef,
  timestamp,
  withSnapshotRef,
  type SchemaEpochBinding,
} from "@cantilune/core";
import { createDurableCoordinatorFromEnv } from "../../../src/memory/createDurableCoordinatorFromEnv.js";
import {
  assertSafeIdent,
  createPostgresDurableCoordinator,
  quoteIdent,
} from "../../../src/memory/postgresDurableCoordinator.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { encodeSnapshot } from "../../../src/codec/snapshotCodec.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import { createMemorySqlHarness } from "../../support/memorySqlExecutor.js";

const t0 = buildConfigT0();
const recipe = replayRecipe({
  epochId: epochId("42"),
  operationTypeId: operationTypeId("introduce_artifact"),
  matchBindings: [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
  visibility: "external",
});
const change = coordinationChange({
  changeId: changeId("chg-001"),
  recordedAt: timestamp("2026-08-07T10:00:00Z"),
  epochId: epochId("42"),
  operationTypeId: operationTypeId("introduce_artifact"),
  beforeRef: t0.snapshotRef,
  afterRef: snapshotRef("snap-S1"),
  matchBindings: recipe.matchBindings,
  initiator: actorRef(actorId("planner-p"), "agent"),
  visibility: "external",
});
const after = withSnapshotRef(t0, snapshotRef("snap-S1"));

function sampleBinding(epoch: string, admission: string): SchemaEpochBinding {
  return {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(2),
    epochId: epochId(epoch),
    epochOrdinal: epochOrdinal(2),
    schemaRef: {
      schemaId: schemaId("s"),
      revisionId: schemaRevisionId("r"),
      digest: schemaDigest("d"),
    },
    policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("pd")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("hd")),
    runtimeHead: t0.snapshotRef,
    admissionId: schemaAdmissionId(admission),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-14T00:00:00Z",
  };
}

function openCoordinator(
  extras: {
    leaseOwner?: string;
    leaseToken?: string;
    initial?: typeof t0;
    schema?: string;
    harness?: ReturnType<typeof createMemorySqlHarness>;
  } = {},
) {
  const harness = extras.harness ?? createMemorySqlHarness();
  const durable = createPostgresDurableCoordinator({
    connectionString: "postgres://cantilune/test",
    executor: harness.executor,
    initial: extras.initial ?? t0,
    leaseOwner: extras.leaseOwner ?? "writer-a",
    leaseToken: extras.leaseToken ?? "token-a",
    ...(extras.schema !== undefined ? { schema: extras.schema } : {}),
  });
  return { durable, harness };
}

describe("createPostgresDurableCoordinator", () => {
  it("commits a recipe and reads it back", () => {
    const { durable } = openCoordinator();
    const result = durable.commit({
      expectedHead: t0.snapshotRef,
      after,
      change,
      recipe,
      idempotencyKey: change.changeId,
    });
    expect(result).toEqual({ ok: true });
    expect(durable.head()).toBe(after.snapshotRef);
    expect(durable.get(after.snapshotRef)?.snapshotRef).toBe(after.snapshotRef);
    expect(durable.changes().map((entry) => entry.changeId)).toEqual([change.changeId]);
    expect(durable.recipeForChange(change)?.epochId).toBe(recipe.epochId);
    expect(durable.since(t0.snapshotRef).map((entry) => entry.changeId)).toEqual([change.changeId]);
  });

  it("rejects a CAS when the expected head does not match", () => {
    const { durable } = openCoordinator();
    expect(durable.compareAndSwapHead(snapshotRef("snap-wrong"), after)).toBe(false);
    expect(durable.head()).toBe(t0.snapshotRef);
  });

  it("rejects a stale writer fail-closed", () => {
    const harness = createMemorySqlHarness();
    const first = openCoordinator({ harness, leaseOwner: "a", leaseToken: "t-a" });
    openCoordinator({ harness, leaseOwner: "b", leaseToken: "t-b", initial: t0 });
    const result = first.durable.commit({
      expectedHead: t0.snapshotRef,
      after,
      change,
      recipe,
    });
    expect(result).toEqual({ ok: false, reason: "fencing_stale" });
    expect(() => first.durable.compareAndSwapHead(t0.snapshotRef, after)).toThrow("fencing_stale");
    expect(first.durable.head()).toBe(t0.snapshotRef);
  });

  it("atomically advances the head and epoch binding", () => {
    const { durable } = openCoordinator();
    const epochAfter = { ...t0, snapshotRef: snapshotRef("snap-E1"), epochId: epochId("43") };
    const binding = sampleBinding("43", "adm-1");
    expect(durable.activeBinding()).toBeUndefined();
    expect(durable.compareAndSwapHeadWithBinding(t0.snapshotRef, epochAfter, binding)).toBe(true);
    expect(durable.head()).toBe(snapshotRef("snap-E1"));
    expect(durable.activeBinding()?.epochId).toBe(epochId("43"));
    expect(durable.activeBinding()?.admissionId).toBe(schemaAdmissionId("adm-1"));
  });

  it("leaves the binding unchanged when head CAS fails", () => {
    const { durable } = openCoordinator();
    const seeded = { ...t0, snapshotRef: snapshotRef("snap-seed") };
    const existing = sampleBinding("42", "adm-0");
    expect(durable.compareAndSwapHeadWithBinding(t0.snapshotRef, seeded, existing)).toBe(true);
    expect(
      durable.compareAndSwapHeadWithBinding(
        snapshotRef("snap-wrong"),
        after,
        sampleBinding("43", "adm-1"),
      ),
    ).toBe(false);
    expect(durable.activeBinding()?.epochId).toBe(epochId("42"));
  });

  it("compareAndSwapHead leaves the binding unchanged", () => {
    const { durable } = openCoordinator();
    const epochAfter = { ...t0, snapshotRef: snapshotRef("snap-E1"), epochId: epochId("43") };
    expect(
      durable.compareAndSwapHeadWithBinding(
        t0.snapshotRef,
        epochAfter,
        sampleBinding("43", "adm-1"),
      ),
    ).toBe(true);
    const observed = { ...epochAfter, snapshotRef: snapshotRef("snap-obs") };
    expect(durable.compareAndSwapHead(epochAfter.snapshotRef, observed)).toBe(true);
    expect(durable.activeBinding()?.epochId).toBe(epochId("43"));
  });

  it("rejects head mismatch, duplicate change, and a broken first chain", () => {
    const { durable } = openCoordinator();
    expect(
      durable.commit({
        expectedHead: snapshotRef("snap-wrong"),
        after,
        change,
        recipe,
      }),
    ).toEqual({ ok: false, reason: "head_mismatch" });

    expect(durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(true);
    const duplicate = coordinationChange({
      ...change,
      beforeRef: after.snapshotRef,
      afterRef: snapshotRef("snap-S2"),
    });
    expect(
      durable.commit({
        expectedHead: after.snapshotRef,
        after: withSnapshotRef(after, snapshotRef("snap-S2")),
        change: duplicate,
        recipe,
      }),
    ).toEqual({ ok: false, reason: "duplicate_change_id" });

    const fresh = openCoordinator();
    const brokenFirst = coordinationChange({
      ...change,
      beforeRef: snapshotRef("snap-unlinked"),
    });
    expect(
      fresh.durable.commit({
        expectedHead: t0.snapshotRef,
        after,
        change: brokenFirst,
        recipe,
      }),
    ).toEqual({ ok: false, reason: "chain_broken" });
  });

  it("rejects a broken chain after the first change and after_ref collision", () => {
    const { durable } = openCoordinator();
    expect(durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(true);
    const broken = coordinationChange({
      ...change,
      changeId: changeId("chg-002"),
      beforeRef: snapshotRef("snap-unlinked"),
      afterRef: snapshotRef("snap-S2"),
    });
    expect(
      durable.commit({
        expectedHead: after.snapshotRef,
        after: withSnapshotRef(after, snapshotRef("snap-S2")),
        change: broken,
        recipe,
      }),
    ).toEqual({ ok: false, reason: "chain_broken" });

    const colliding = coordinationChange({
      ...change,
      changeId: changeId("chg-003"),
      beforeRef: after.snapshotRef,
      afterRef: after.snapshotRef,
    });
    expect(
      durable.commit({
        expectedHead: after.snapshotRef,
        after,
        change: colliding,
        recipe,
      }),
    ).toEqual({ ok: false, reason: "after_ref_collision" });
  });

  it("rejects a changelog append failure and rolls the snapshot write back", () => {
    const { durable, harness } = openCoordinator();
    harness.state.failNextInsertChange = true;
    const result = durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe });
    expect(result).toEqual({ ok: false, reason: "changelog_append_failed" });
    expect(durable.head()).toBe(t0.snapshotRef);
    expect(durable.get(after.snapshotRef)).toBeUndefined();
  });

  it("finds the first change after an epoch-only head advance", () => {
    const { durable } = openCoordinator();
    const epochHead = { ...t0, snapshotRef: snapshotRef("snap-E1"), epochId: epochId("43") };
    expect(durable.compareAndSwapHead(t0.snapshotRef, epochHead)).toBe(true);
    const epochRecipe = { ...recipe, epochId: epochId("43") };
    const epochChange = coordinationChange({
      ...change,
      epochId: epochId("43"),
      beforeRef: epochHead.snapshotRef,
      afterRef: snapshotRef("snap-after-epoch"),
    });
    expect(
      durable.commit({
        expectedHead: epochHead.snapshotRef,
        after: { ...epochHead, snapshotRef: epochChange.afterRef },
        change: epochChange,
        recipe: epochRecipe,
      }).ok,
    ).toBe(true);
    expect(durable.since(t0.snapshotRef).map((entry) => entry.changeId)).toEqual([
      epochChange.changeId,
    ]);
  });

  it("returns an empty since when the from-ref is unknown or already the tip", () => {
    const { durable } = openCoordinator();
    expect(durable.since(snapshotRef("snap-missing"))).toEqual([]);
    expect(durable.get(snapshotRef("snap-missing"))).toBeUndefined();
    expect(durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(true);
    expect(durable.since(after.snapshotRef)).toEqual([]);
  });

  it("starts with no head when initial is omitted and fences if the lease row vanishes", () => {
    const harness = createMemorySqlHarness();
    const durable = createPostgresDurableCoordinator({
      connectionString: "postgres://cantilune/test",
      executor: harness.executor,
    });
    expect(durable.head()).toBeUndefined();
    expect(durable.changes()).toEqual([]);
    const seeded = openCoordinator({ harness, leaseOwner: "later", leaseToken: "later-t" });
    harness.state.lease = undefined;
    expect(seeded.durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe })).toEqual({
      ok: false,
      reason: "fencing_stale",
    });
  });

  it("derives a recipe when the sidecar row is missing", () => {
    const { durable, harness } = openCoordinator();
    expect(durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(true);
    harness.state.recipes.delete(change.changeId);
    expect(durable.recipeForChange(change)?.operationTypeId).toBe(change.operationTypeId);
  });

  it("does not overwrite an existing head when a second opener supplies initial", () => {
    const harness = createMemorySqlHarness();
    openCoordinator({ harness });
    const other = withSnapshotRef(t0, snapshotRef("snap-other"));
    const second = openCoordinator({ harness, initial: other, leaseOwner: "b", leaseToken: "t-b" });
    expect(second.durable.head()).toBe(t0.snapshotRef);
    expect(second.durable.get(t0.snapshotRef)?.snapshotRef).toBe(t0.snapshotRef);
  });

  it("decodes a JSON-string snapshot payload", () => {
    const { durable, harness } = openCoordinator();
    harness.state.snapshots.set(t0.snapshotRef, JSON.stringify(encodeSnapshot(t0)));
    expect(durable.get(t0.snapshotRef)?.snapshotRef).toBe(t0.snapshotRef);
  });

  it("fails closed on corrupt snapshot, change, binding, and recipe payloads", () => {
    const { durable, harness } = openCoordinator();
    harness.state.snapshots.set(t0.snapshotRef, { not: "a snapshot" });
    expect(() => durable.get(t0.snapshotRef)).toThrow(/invalid snapshot payload/);

    harness.state.snapshots.set(t0.snapshotRef, encodeSnapshot(t0));
    harness.state.changes.push({
      seq: 1,
      changeId: "bad",
      beforeRef: t0.snapshotRef,
      afterRef: "x",
      payload: { not: "a change" },
    });
    expect(() => durable.changes()).toThrow(/invalid change payload/);

    harness.state.binding = { not: "a binding" };
    expect(() => durable.activeBinding()).toThrow(/invalid epoch binding/);

    harness.state.recipes.set(change.changeId, 15);
    expect(() => durable.recipeForChange(change)).toThrow(/invalid recipe payload/);
  });

  it("fails closed when the fencing lease row is malformed", () => {
    const { durable, harness } = openCoordinator();
    harness.state.lease = { owner: "", token: "t-a" };
    expect(() => durable.compareAndSwapHead(t0.snapshotRef, after)).toThrow(
      /expected non-empty string at lease.owner/,
    );
  });

  it("rethrows unexpected SQL failures from commit", () => {
    const { durable, harness } = openCoordinator();
    const original = harness.executor.query.bind(harness.executor);
    harness.executor.query = (sql, params) => {
      if (sql.includes("select_head")) {
        throw new Error("disk full");
      }
      return original(sql, params);
    };
    expect(() => durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe })).toThrow(
      "disk full",
    );
  });

  it("rejects an unsafe schema identifier", () => {
    expect(() =>
      createPostgresDurableCoordinator({
        connectionString: "postgres://cantilune/test",
        schema: "cantilune;drop",
        executor: createMemorySqlHarness().executor,
      }),
    ).toThrow(/simple SQL identifier/);
    expect(() => assertSafeIdent("ok_name", "schema")).not.toThrow();
    expect(quoteIdent('a"b')).toBe('"a""b"');
  });
});

describe("createDurableCoordinatorFromEnv", () => {
  it("returns undefined when the URL is missing or blank", () => {
    expect(createDurableCoordinatorFromEnv({ env: {} })).toBeUndefined();
    expect(
      createDurableCoordinatorFromEnv({ env: { CANTILUNE_DURABLE_DATABASE_URL: "   " } }),
    ).toBeUndefined();
    const previous = process.env.CANTILUNE_DURABLE_DATABASE_URL;
    delete process.env.CANTILUNE_DURABLE_DATABASE_URL;
    try {
      expect(createDurableCoordinatorFromEnv()).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.CANTILUNE_DURABLE_DATABASE_URL;
      } else {
        process.env.CANTILUNE_DURABLE_DATABASE_URL = previous;
      }
    }
  });

  it("opens a postgres coordinator when the URL is set", () => {
    const harness = createMemorySqlHarness();
    const durable = createDurableCoordinatorFromEnv({
      env: { CANTILUNE_DURABLE_DATABASE_URL: "  postgres://cantilune/test  " },
      executor: harness.executor,
      initial: t0,
      schema: "cantilune",
      leaseOwner: "env-writer",
      leaseToken: "env-token",
    });
    expect(durable?.head()).toBe(t0.snapshotRef);
    expect(durable?.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(true);
  });

  it("forwards only the injected executor when optional identity fields are omitted", () => {
    const harness = createMemorySqlHarness();
    const durable = createDurableCoordinatorFromEnv({
      env: { CANTILUNE_DURABLE_DATABASE_URL: "postgres://cantilune/test" },
      executor: harness.executor,
    });
    expect(durable?.head()).toBeUndefined();
  });
});
