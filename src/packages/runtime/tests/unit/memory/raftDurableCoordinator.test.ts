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
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import {
  createRaftDurableCoordinator,
} from "../../../src/memory/raftDurableCoordinator.js";
import { createRaftDurableFromEnv } from "../../../src/memory/createRaftDurableFromEnv.js";
import { encodeSnapshot } from "../../../src/codec/snapshotCodec.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import type { RaftKv } from "../../../src/memory/raftKv.js";

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
    namespace?: string;
    kv?: RaftKv;
  } = {},
) {
  const kv = extras.kv ?? createMemoryRaftKv();
  const durable = createRaftDurableCoordinator({
    kv,
    initial: extras.initial ?? t0,
    leaseOwner: extras.leaseOwner ?? "writer-a",
    leaseToken: extras.leaseToken ?? "token-a",
    ...(extras.namespace !== undefined ? { namespace: extras.namespace } : {}),
  });
  return { durable, kv };
}

describe("createRaftDurableCoordinator", () => {
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
    const kv = createMemoryRaftKv();
    const first = openCoordinator({ kv, leaseOwner: "a", leaseToken: "t-a" });
    openCoordinator({ kv, leaseOwner: "b", leaseToken: "t-b", initial: t0 });
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
    const inner = createMemoryRaftKv();
    const kv: RaftKv = {
      get: (key) => inner.get(key),
      range: (prefix) => inner.range(prefix),
      grantLease: (ttl) => inner.grantLease(ttl),
      keepAlive: (id) => inner.keepAlive(id),
      revokeLease: (id) => inner.revokeLease(id),
      txn(compare, success, failure) {
        if (success.some((op) => op.kind === "put" && op.key.includes("/changes/"))) {
          return { succeeded: false, entries: [] };
        }
        return inner.txn(compare, success, failure);
      },
    };
    const durable = createRaftDurableCoordinator({
      kv,
      initial: t0,
      leaseOwner: "writer-a",
      leaseToken: "token-a",
    });
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

  it("starts with no head when initial is omitted and fences if the lease vanishes", () => {
    const kv = createMemoryRaftKv();
    const durable = createRaftDurableCoordinator({ kv, leaseOwner: "later", leaseToken: "later-t" });
    expect(durable.head()).toBeUndefined();
    expect(durable.changes()).toEqual([]);
    kv.txn([], [{ kind: "delete", key: "cantilune/durable/meta/lease" }]);
    expect(durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe })).toEqual({
      ok: false,
      reason: "fencing_stale",
    });
  });

  it("derives a recipe when the sidecar row is missing", () => {
    const { durable, kv } = openCoordinator();
    expect(durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(true);
    kv.txn([], [{ kind: "delete", key: `cantilune/durable/recipes/${change.changeId}` }]);
    expect(durable.recipeForChange(change)?.operationTypeId).toBe(change.operationTypeId);
  });

  it("does not overwrite an existing head when a second opener supplies initial", () => {
    const kv = createMemoryRaftKv();
    openCoordinator({ kv });
    const other = withSnapshotRef(t0, snapshotRef("snap-other"));
    const second = openCoordinator({ kv, initial: other, leaseOwner: "b", leaseToken: "t-b" });
    expect(second.durable.head()).toBe(t0.snapshotRef);
    expect(second.durable.get(t0.snapshotRef)?.snapshotRef).toBe(t0.snapshotRef);
  });

  it("decodes a JSON snapshot payload and fails closed on corrupt rows", () => {
    const { durable, kv } = openCoordinator();
    kv.txn(
      [],
      [
        {
          kind: "put",
          key: `cantilune/durable/snapshots/${t0.snapshotRef}`,
          value: JSON.stringify(encodeSnapshot(t0)),
        },
      ],
    );
    expect(durable.get(t0.snapshotRef)?.snapshotRef).toBe(t0.snapshotRef);

    kv.txn(
      [],
      [{ kind: "put", key: `cantilune/durable/snapshots/${t0.snapshotRef}`, value: "{\"not\":\"a snapshot\"}" }],
    );
    expect(() => durable.get(t0.snapshotRef)).toThrow(/invalid snapshot payload/);

    kv.txn(
      [],
      [{ kind: "put", key: "cantilune/durable/changes/00000000000000000001", value: "{\"not\":\"a change\"}" }],
    );
    expect(() => durable.changes()).toThrow(/invalid change payload/);

    kv.txn([], [{ kind: "put", key: "cantilune/durable/meta/binding", value: "{\"not\":\"a binding\"}" }]);
    expect(() => durable.activeBinding()).toThrow(/invalid epoch binding/);

    kv.txn([], [{ kind: "put", key: `cantilune/durable/recipes/${change.changeId}`, value: "15" }]);
    expect(() => durable.recipeForChange(change)).toThrow(/invalid recipe payload/);
  });

  it("fails closed when the fencing lease row is malformed", () => {
    const { durable, kv } = openCoordinator();
    kv.txn(
      [],
      [{ kind: "put", key: "cantilune/durable/meta/lease", value: JSON.stringify({ owner: "", token: "t-a" }) }],
    );
    expect(() => durable.compareAndSwapHead(t0.snapshotRef, after)).toThrow(
      /expected non-empty string at lease.owner/,
    );
  });

  it("rethrows unexpected KV failures from commit", () => {
    const inner = createMemoryRaftKv();
    const kv: RaftKv = {
      get(key) {
        if (key.endsWith("/meta/head")) {
          throw new Error("disk full");
        }
        return inner.get(key);
      },
      range: (prefix) => inner.range(prefix),
      grantLease: (ttl) => inner.grantLease(ttl),
      keepAlive: (id) => inner.keepAlive(id),
      revokeLease: (id) => inner.revokeLease(id),
      txn: (compare, success, failure) => inner.txn(compare, success, failure),
    };
    const durable = createRaftDurableCoordinator({
      kv,
      initial: t0,
      leaseOwner: "writer-a",
      leaseToken: "token-a",
    });
    expect(() => durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe })).toThrow(
      "disk full",
    );
  });

  it("rejects an unsafe namespace identifier", () => {
    expect(() =>
      createRaftDurableCoordinator({
        kv: createMemoryRaftKv(),
        namespace: "cantilune;drop",
      }),
    ).toThrow(/simple identifier/);
  });
});

describe("createRaftDurableFromEnv", () => {
  it("returns undefined when Raft is not configured", () => {
    expect(createRaftDurableFromEnv({ env: {} })).toBeUndefined();
    expect(
      createRaftDurableFromEnv({ env: { CANTILUNE_RAFT_ENDPOINTS: "   " } }),
    ).toBeUndefined();
  });

  it("opens a coordinator from an injected KV", () => {
    const opened = createRaftDurableFromEnv({
      env: { CANTILUNE_RAFT_ENDPOINTS: "http://127.0.0.1:2379" },
      kv: createMemoryRaftKv(),
      initial: t0,
      leaseOwner: "env-writer",
      leaseToken: "env-token",
    });
    expect(opened?.durable.head()).toBe(t0.snapshotRef);
    expect(opened?.durable.commit({ expectedHead: t0.snapshotRef, after, change, recipe }).ok).toBe(
      true,
    );
    opened?.dispose();
  });

});
