import { describe, expect, it } from "vitest";
import {
  bindingGeneration,
  idempotencyKey,
  preparedAdmissionId,
  policyId,
  policyRevisionId,
  runtimeInstanceId,
  schemaAdmissionId,
  schemaRevisionId,
  storeSequence,
} from "@cantilune/core";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { bootstrapDefaultControlPlane } from "../../../src/engine/controlPlaneService.js";
import { createSchemaRevision } from "../../../src/schema/schemaRevision.js";
import { buildOrchestrationSchema } from "@cantilune/runtime";
import type { SchemaRevision } from "../../../src/schema/schemaRevision.js";
import { createPolicyRevision } from "../../../src/policy/policyRevision.js";

describe("memory control plane store", () => {
  it("filters revisions and handles idempotency claims", () => {
    const store = new MemoryControlPlaneStore();
    bootstrapDefaultControlPlane(store);
    expect(store.listRevisions("default-v1")).toHaveLength(1);
    expect(store.listRevisions("missing")).toHaveLength(0);

    const claim = store.claimIdempotency({
      key: idempotencyKey("idem-1"),
      digest: "digest-a",
    });
    expect(claim).toBe("claimed");
    expect(store.claimIdempotency({ key: idempotencyKey("idem-1"), digest: "digest-a" })).toBe(
      "replay",
    );
    expect(store.claimIdempotency({ key: idempotencyKey("idem-1"), digest: "digest-b" })).toBe(
      "conflict",
    );
    store.releaseIdempotency(idempotencyKey("idem-1"));
    expect(store.claimIdempotency({ key: idempotencyKey("idem-1"), digest: "digest-a" })).toBe(
      "claimed",
    );
  });

  it("rejects digest mismatch on getRevision and duplicate idempotent register", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisRevision } = bootstrapDefaultControlPlane(store);
    const wrongDigest = store.getRevision({
      ...genesisRevision.schemaRef,
      digest: genesisRevision.schemaRef.digest,
    });
    expect(wrongDigest).toBeDefined();
    store.registerRevision(genesisRevision);
    const candidate = createSchemaRevision({
      schema: genesisRevision.schema,
      revisionId: schemaRevisionId("rev-dup-key"),
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    store.registerRevision(candidate);
    expect(() =>
      store.registerRevision({
        ...candidate,
        schemaRef: { ...candidate.schemaRef, revisionId: schemaRevisionId("rev-other") },
      }),
    ).not.toThrow();
  });

  it("consumes prepared tokens once and snapshots/restores state", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisBinding, genesisRevision } = bootstrapDefaultControlPlane(store);
    const preparedId = preparedAdmissionId("prep-consume");
    store.putPrepared({
      preparedId,
      admissionId: schemaAdmissionId("adm-consume"),
      activationDomainId: genesisBinding.activationDomainId,
      fromSchemaRef: genesisRevision.schemaRef,
      toSchemaRef: genesisRevision.schemaRef,
      fromEpochId: genesisBinding.epochId,
      toEpochId: genesisBinding.epochId,
      fromEpochOrdinal: genesisBinding.epochOrdinal,
      toEpochOrdinal: genesisBinding.epochOrdinal,
      expectedBindingGeneration: genesisBinding.bindingGeneration,
      expectedRuntimeHead: genesisBinding.runtimeHead,
      planDigest: "plan" as never,
      runtimePreparedId: "runtime-prep",
      issuedAt: "2026-08-11T00:00:00Z",
      expiresAt: "2026-08-11T01:00:00Z",
      consumed: false,
    });
    expect(store.consumePrepared(preparedId)).toBeDefined();
    expect(store.consumePrepared(preparedId)).toBeUndefined();

    const snapshot = store.snapshot();
    const restored = new MemoryControlPlaneStore();
    restored.restoreSnapshot(snapshot);
    expect(restored.getActiveBinding(genesisBinding.activationDomainId)?.epochId).toBe(
      genesisBinding.epochId,
    );
    expect(restored.isFrozen()).toBe(false);
  });

  it("guards event append ordering and duplicate ids", () => {
    const store = new MemoryControlPlaneStore();
    bootstrapDefaultControlPlane(store);
    const first = store.nextEvent("SchemaRevisionRegistered", "actor", { ok: true });
    store.appendEvent(first);
    expect(() =>
      store.appendEvent({
        ...first,
        storeSequence: storeSequence((first.storeSequence as number) - 1),
      }),
    ).toThrow("event_sequence_regression");
    const duplicate = store.nextEvent("SchemaRevisionRegistered", "actor", { ok: true });
    store.appendEvent(duplicate);
    const duplicateRetry = {
      ...duplicate,
      storeSequence: storeSequence((duplicate.storeSequence as number) + 1),
    };
    expect(() => store.appendEvent(duplicateRetry)).toThrow("duplicate_event_id");
    expect(store.readEvents(first.storeSequence)).toHaveLength(1);
  });

  it("handles CAS on active binding", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisBinding } = bootstrapDefaultControlPlane(store);
    const failed = store.casActiveBinding({
      domainId: genesisBinding.activationDomainId,
      expectedGeneration: bindingGeneration(999),
      nextBinding: genesisBinding,
    });
    expect(failed).toBe(false);
    expect(store.getPolicy(genesisBinding.policyRef)).toBeDefined();
  });

  it("detaches active binding ingress, reads, snapshots, and restore input", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisBinding } = bootstrapDefaultControlPlane(store);
    const callerBinding = {
      ...genesisBinding,
      bindingGeneration: bindingGeneration((genesisBinding.bindingGeneration as number) + 1),
      schemaRef: { ...genesisBinding.schemaRef },
      policyRef: { ...genesisBinding.policyRef },
      handlerManifestRef: { ...genesisBinding.handlerManifestRef },
    };
    expect(
      store.casActiveBinding({
        domainId: genesisBinding.activationDomainId,
        expectedGeneration: genesisBinding.bindingGeneration,
        nextBinding: callerBinding,
      }),
    ).toBe(true);

    const authoritativeDigest = callerBinding.schemaRef.digest;
    Object.assign(callerBinding.schemaRef, { digest: "caller-mutated" });
    const firstRead = store.getActiveBinding(genesisBinding.activationDomainId)!;
    expect(firstRead.schemaRef.digest).toBe(authoritativeDigest);
    expect(() => Object.assign(firstRead.schemaRef, { digest: "escaped" })).toThrow(TypeError);

    const snapshot = store.snapshot();
    const snapshotBinding = snapshot.activeBindings.get(genesisBinding.activationDomainId)!;
    expect(() =>
      Object.assign(snapshotBinding, { bindingGeneration: bindingGeneration(999) }),
    ).toThrow(TypeError);
    (snapshot.activeBindings as Map<unknown, unknown>).clear();
    expect(store.getActiveBinding(genesisBinding.activationDomainId)?.schemaRef.digest).toBe(
      authoritativeDigest,
    );

    const restoreSnapshot = store.snapshot();
    const mutableRestoreBinding = {
      ...restoreSnapshot.activeBindings.get(genesisBinding.activationDomainId)!,
      schemaRef: {
        ...restoreSnapshot.activeBindings.get(genesisBinding.activationDomainId)!.schemaRef,
      },
      policyRef: {
        ...restoreSnapshot.activeBindings.get(genesisBinding.activationDomainId)!.policyRef,
      },
      handlerManifestRef: {
        ...restoreSnapshot.activeBindings.get(genesisBinding.activationDomainId)!
          .handlerManifestRef,
      },
    };
    const restoreSource = {
      ...restoreSnapshot,
      activeBindings: new Map([[genesisBinding.activationDomainId, mutableRestoreBinding]]),
    };
    const restored = new MemoryControlPlaneStore();
    restored.restoreSnapshot(restoreSource);
    Object.assign(mutableRestoreBinding.schemaRef, { digest: "restore-mutated" });
    expect(restored.getActiveBinding(genesisBinding.activationDomainId)?.schemaRef.digest).toBe(
      authoritativeDigest,
    );
  });

  it("detaches policy authority on store ingress, reads, snapshots, and restore", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisRevision } = bootstrapDefaultControlPlane(store);
    const created = createPolicyRevision({
      policyId: policyId("store-policy"),
      revisionId: policyRevisionId("1"),
      compatibleSchemaRefs: [genesisRevision.schemaRef],
      rules: [{ ruleId: "deny-all", decision: "deny" }],
      createdBy: "admin",
      createdAt: "2026-08-13T00:00:00Z",
    });
    const callerRules = created.rules.map((rule) => ({ ...rule }));
    const callerPolicy = {
      ...created,
      policyRef: { ...created.policyRef },
      compatibleSchemaRefs: created.compatibleSchemaRefs.map((ref) => ({ ...ref })),
      rules: callerRules,
    };
    store.registerPolicy(callerPolicy);
    callerRules[0]!.decision = "allow";

    const read = store.getPolicy(created.policyRef)!;
    expect(read.rules[0]?.decision).toBe("deny");
    expect(() => Object.assign(read.rules[0]!, { decision: "allow" })).toThrow(TypeError);

    const snapshot = store.snapshot();
    const snapshotPolicy = snapshot.policies.values().next().value!;
    expect(() => Object.assign(snapshotPolicy.rules[0]!, { decision: "allow" })).toThrow(TypeError);
    (snapshot.policies as Map<unknown, unknown>).clear();
    expect(store.getPolicy(created.policyRef)?.rules[0]?.decision).toBe("deny");

    const restoreSnapshot = store.snapshot();
    const policyKey = `${created.policyRef.policyId}@${created.policyRef.revisionId}`;
    const restorePolicy = restoreSnapshot.policies.get(policyKey)!;
    const mutablePolicy = {
      ...restorePolicy,
      policyRef: { ...restorePolicy.policyRef },
      compatibleSchemaRefs: restorePolicy.compatibleSchemaRefs.map((ref) => ({ ...ref })),
      rules: restorePolicy.rules.map((rule) => ({ ...rule })),
    };
    const restored = new MemoryControlPlaneStore();
    restored.restoreSnapshot({
      ...restoreSnapshot,
      policies: new Map([[policyKey, mutablePolicy]]),
    });
    mutablePolicy.rules[0]!.decision = "allow";
    expect(restored.getPolicy(created.policyRef)?.rules[0]?.decision).toBe("deny");
  });

  it("detaches revision ingress, get, list, and snapshot from store authority", () => {
    const store = new MemoryControlPlaneStore();
    const sourceSchema = buildOrchestrationSchema("authority-boundary");
    const created = createSchemaRevision({
      schema: sourceSchema,
      revisionId: schemaRevisionId("rev-authority"),
      provenanceEvidence: ["evidence://original"],
      createdBy: "author",
      createdAt: "2026-08-11T00:00:00Z",
    });
    const lookupRef = { ...created.schemaRef };
    const callerRevision: SchemaRevision = {
      ...created,
      schemaRef: { ...created.schemaRef },
      schema: sourceSchema,
      provenanceEvidence: ["evidence://original"],
    };
    store.registerRevision(callerRevision);

    (sourceSchema.objectTypes as Map<unknown, unknown>).clear();
    (sourceSchema.operationTypes as Map<unknown, unknown>).clear();
    (sourceSchema.templates as unknown as unknown[]).length = 0;
    (callerRevision.schemaRef as { digest: string }).digest = "mutated";
    (callerRevision.provenanceEvidence as string[]).push("evidence://mutated");

    const firstGet = store.getRevision(lookupRef)!;
    const secondGet = store.getRevision(lookupRef)!;
    const listed = store.listRevisions("authority-boundary")[0]!;
    const snapshot = store.snapshot();
    const snapshotted = snapshot.revisions.values().next().value!;

    expect(firstGet).not.toBe(secondGet);
    expect(listed).not.toBe(firstGet);
    expect(snapshotted).not.toBe(firstGet);
    expect(firstGet.schema.objectTypes.size).toBeGreaterThan(0);
    expect(firstGet.schema.operationTypes.size).toBeGreaterThan(0);
    expect(firstGet.schema.templates.length).toBeGreaterThan(0);
    expect(firstGet.provenanceEvidence).toEqual(["evidence://original"]);

    expect(() => (firstGet.schema.objectTypes as unknown as Map<unknown, unknown>).clear()).toThrow(
      TypeError,
    );
    expect(() =>
      (listed.schema.operationTypes as unknown as Map<unknown, unknown>).clear(),
    ).toThrow(TypeError);
    expect(() =>
      (snapshotted.schema.objectTypes as unknown as Map<unknown, unknown>).clear(),
    ).toThrow(TypeError);
    expect(() => {
      (firstGet.schemaRef as { digest: string }).digest = "escaped";
    }).toThrow(TypeError);

    (snapshot.revisions as Map<string, SchemaRevision>).clear();
    const authoritative = store.getRevision(lookupRef)!;
    expect(authoritative.schema.objectTypes.size).toBeGreaterThan(0);
    expect(authoritative.schema.operationTypes.size).toBeGreaterThan(0);
    expect(authoritative.schemaRef.digest).toBe(lookupRef.digest);
    expect(authoritative.provenanceEvidence).toEqual(["evidence://original"]);
  });

  it("snapshots and restores fleet bindings", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisBinding } = bootstrapDefaultControlPlane(store);
    const instance = runtimeInstanceId("memory-fleet");
    store.replaceFleetBindings([
      [
        instance,
        {
          runtimeInstanceId: instance,
          desiredBinding: genesisBinding,
          status: "pending",
          drift: true,
        },
      ],
    ]);
    expect(store.getFleetBindings().get(instance)?.status).toBe("pending");
    const snapshot = store.snapshot();
    expect(snapshot.fleetBindings?.get(instance)?.status).toBe("pending");

    const restored = new MemoryControlPlaneStore();
    restored.restoreSnapshot(snapshot);
    expect(restored.getFleetBindings().get(instance)?.desiredBinding.epochId).toBe(
      genesisBinding.epochId,
    );

    const withoutFleet = { ...snapshot };
    delete (withoutFleet as { fleetBindings?: unknown }).fleetBindings;
    const empty = new MemoryControlPlaneStore();
    empty.replaceFleetBindings(snapshot.fleetBindings ?? []);
    empty.restoreSnapshot(withoutFleet);
    expect(empty.getFleetBindings().size).toBe(0);
  });
});
