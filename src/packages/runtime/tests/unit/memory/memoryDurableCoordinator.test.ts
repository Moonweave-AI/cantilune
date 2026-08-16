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
import { MemoryDurableCoordinator } from "../../../src/memory/memoryDurableCoordinator.js";
import { MemoryCollaborationStore } from "../../../src/memory/memoryStore.js";
import { MemoryChangeLog } from "../../../src/memory/memoryChangeLog.js";
import { RecipeSidecar } from "../../../src/replay/recipeSidecar.js";
import { buildConfigT0 } from "../../support/fixtures/config-t0.js";
import { replayRecipe } from "../../../src/replay/recipe.js";
import { matchBinding } from "@cantilune/core";

describe("MemoryDurableCoordinator.commit", () => {
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

  function coordinator() {
    const store = new MemoryCollaborationStore({ initial: t0 });
    return new MemoryDurableCoordinator(store, new MemoryChangeLog(), new RecipeSidecar());
  }

  it("commits first change successfully", () => {
    const durable = coordinator();
    const result = durable.commit({
      expectedHead: t0.snapshotRef,
      after,
      change,
      recipe,
      idempotencyKey: change.changeId,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects head mismatch duplicate and broken chain", () => {
    const durable = coordinator();
    expect(
      durable.commit({
        expectedHead: snapshotRef("snap-wrong"),
        after,
        change,
        recipe,
        idempotencyKey: change.changeId,
      }).ok,
    ).toBe(false);

    durable.commit({
      expectedHead: t0.snapshotRef,
      after,
      change,
      recipe,
      idempotencyKey: change.changeId,
    });
    expect(
      durable.commit({
        expectedHead: t0.snapshotRef,
        after,
        change,
        recipe,
        idempotencyKey: change.changeId,
      }).ok,
    ).toBe(false);

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
        idempotencyKey: broken.changeId,
      }).ok,
    ).toBe(false);
  });

  it("rejects after_ref collision", () => {
    const durable = coordinator();
    durable.commit({
      expectedHead: t0.snapshotRef,
      after,
      change,
      recipe,
      idempotencyKey: change.changeId,
    });
    const second = coordinationChange({
      ...change,
      changeId: changeId("chg-002"),
      beforeRef: after.snapshotRef,
      afterRef: after.snapshotRef,
    });
    expect(
      durable.commit({
        expectedHead: after.snapshotRef,
        after,
        change: second,
        recipe,
        idempotencyKey: second.changeId,
      }).ok,
    ).toBe(false);
  });

  it("finds the first change after an epoch-only head advance", () => {
    const durable = coordinator();
    const epochHead = {
      ...t0,
      snapshotRef: snapshotRef("snap-E1"),
      epochId: epochId("43"),
    };
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
});

describe("MemoryDurableCoordinator active binding (ADR-0014)", () => {
  const t0 = buildConfigT0();

  function coordinator() {
    const store = new MemoryCollaborationStore({ initial: t0 });
    return new MemoryDurableCoordinator(store, new MemoryChangeLog(), new RecipeSidecar());
  }

  it("has no active binding by default", () => {
    expect(coordinator().activeBinding()).toBeUndefined();
  });

  it("atomically advances the head and the binding", () => {
    const durable = coordinator();
    const after = { ...t0, snapshotRef: snapshotRef("snap-E1"), epochId: epochId("43") };
    const binding: SchemaEpochBinding = {
      activationDomainId: activationDomainId("default"),
      bindingGeneration: bindingGeneration(2),
      epochId: epochId("43"),
      epochOrdinal: epochOrdinal(2),
      schemaRef: {
        schemaId: schemaId("s"),
        revisionId: schemaRevisionId("r"),
        digest: schemaDigest("d"),
      },
      policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("pd")),
      handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("hd")),
      runtimeHead: t0.snapshotRef,
      admissionId: schemaAdmissionId("adm-1"),
      activatedBy: "bootstrap",
      activatedAt: "2026-08-14T00:00:00Z",
    };
    expect(durable.compareAndSwapHeadWithBinding(t0.snapshotRef, after, binding)).toBe(true);
    expect(durable.head()).toBe(snapshotRef("snap-E1"));
    expect(durable.activeBinding()?.epochId).toBe(epochId("43"));
    expect(durable.activeBinding()?.admissionId).toBe(schemaAdmissionId("adm-1"));
  });

  it("leaves the binding unchanged when the head CAS fails", () => {
    const durable = coordinator();
    const existing: SchemaEpochBinding = {
      activationDomainId: activationDomainId("default"),
      bindingGeneration: bindingGeneration(1),
      epochId: t0.epochId,
      epochOrdinal: epochOrdinal(1),
      schemaRef: {
        schemaId: schemaId("s"),
        revisionId: schemaRevisionId("r"),
        digest: schemaDigest("d"),
      },
      policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("pd")),
      handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("hd")),
      runtimeHead: t0.snapshotRef,
      admissionId: schemaAdmissionId("adm-0"),
      activatedBy: "bootstrap",
      activatedAt: "2026-08-14T00:00:00Z",
    };
    // Seed a binding via a successful CAS first.
    const after = { ...t0, snapshotRef: snapshotRef("snap-seed") };
    expect(durable.compareAndSwapHeadWithBinding(t0.snapshotRef, after, existing)).toBe(true);

    // Now a CAS with a stale expected head must fail and leave the binding.
    const stale = { ...after, snapshotRef: snapshotRef("snap-E1"), epochId: epochId("43") };
    expect(
      durable.compareAndSwapHeadWithBinding(snapshotRef("snap-wrong"), stale, {
        ...existing,
        epochId: epochId("43"),
      }),
    ).toBe(false);
    expect(durable.activeBinding()?.epochId).toBe(t0.epochId);
  });

  it("compareAndSwapHead leaves the binding unchanged (observation path)", () => {
    const durable = coordinator();
    const binding: SchemaEpochBinding = {
      activationDomainId: activationDomainId("default"),
      bindingGeneration: bindingGeneration(2),
      epochId: epochId("43"),
      epochOrdinal: epochOrdinal(2),
      schemaRef: {
        schemaId: schemaId("s"),
        revisionId: schemaRevisionId("r"),
        digest: schemaDigest("d"),
      },
      policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("pd")),
      handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("hd")),
      runtimeHead: t0.snapshotRef,
      admissionId: schemaAdmissionId("adm-1"),
      activatedBy: "bootstrap",
      activatedAt: "2026-08-14T00:00:00Z",
    };
    const after = { ...t0, snapshotRef: snapshotRef("snap-E1"), epochId: epochId("43") };
    expect(durable.compareAndSwapHeadWithBinding(t0.snapshotRef, after, binding)).toBe(true);

    // An observation-only head move must not clear or change the binding.
    const observed = { ...after, snapshotRef: snapshotRef("snap-obs") };
    expect(durable.compareAndSwapHead(after.snapshotRef, observed)).toBe(true);
    expect(durable.activeBinding()?.epochId).toBe(epochId("43"));
  });
});
