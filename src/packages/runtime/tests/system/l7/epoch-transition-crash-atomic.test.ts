import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  activationDomainId,
  bindingGeneration,
  contentDigest,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaRevisionId,
  snapshotRef,
  type SchemaEpochBinding,
} from "@cantilune/core";
import {
  AdmissionRegistry,
  createActiveSchemaContext,
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  createMemoryEpochAdministration,
  createMutableBindingHolder,
  createMutableSchemaContextHolder,
  runtimeDependenciesWithStaticSchema,
  schemaContentDigest,
  templateAwarePolicyEvaluator,
} from "../../../src/index.js";
import { createFileRuntimePersistence, readFileRuntimeActiveBinding } from "../../../src/memory/fileDurablePersistence.js";
import { MemoryResourceLockTable } from "../../../src/memory/index.js";
import { createDeterministicIdGenerator } from "../../support/deterministicIds.js";
import { createFixedClock } from "../../support/fixedClock.js";
import { buildConfigT0 } from "@cantilune/test-fixtures";

const here = fileURLToPath(import.meta.url);
const childScript = resolve(here, "../../../support/epochTransitionChild.mjs");

function initialBindingFor(schema: ReturnType<typeof createDefaultSchema>, runtimeHead: string): SchemaEpochBinding {
  return {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schema.schemaId,
      revisionId: schemaRevisionId("rev-001"),
      digest: schemaContentDigest(schema),
    },
    policyRef: policyRef(policyId("policy"), policyRevisionId("1"), contentDigest("policy-1")),
    handlerManifestRef: handlerManifestRef(
      handlerManifestId("handlers"),
      handlerManifestDigest("handlers-1"),
    ),
    runtimeHead: snapshotRef(runtimeHead),
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-14T00:00:00Z",
  };
}

/**
 * Seed a file-backed world with a T0 at epoch 42 and an initial binding, then
 * hand the directory to the child process. The child commits an epoch
 * transition to epoch 43 (advancing head + binding atomically) and exits.
 */
function seedWorld(dir: string): { readonly t0: ReturnType<typeof buildConfigT0>; readonly schema: ReturnType<typeof createDefaultSchema> } {
  const t0 = buildConfigT0();
  const schema = createDefaultSchema();
  const binding = initialBindingFor(schema, t0.snapshotRef);
  // createFileRuntimePersistence writes the T0 bundle. We then need to also
  // publish the initial binding so the child's prepareEpochTransition sees a
  // consistent binding holder. The child constructs its own holders; the
  // bundle only needs the T0 snapshot. The child seeds the binding in memory
  // and commits the transition, which writes head+binding atomically.
  createFileRuntimePersistence({ dir, initial: t0 });
  return { t0, schema };
}

describe("L7 epoch transition crash atomicity (ADR-0014, SS-02)", () => {
  it("a fresh process recovers the active binding from the durable bundle after the committing process exits", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-epoch-crash-"));
    try {
      const { t0, schema } = seedWorld(dir);

      // The child process commits the epoch transition (head CAS + binding
      // published atomically) and exits. This simulates a process that ran the
      // full commit and then terminated — the crash window of SS-02 is the gap
      // between the durable CAS and the in-memory holder update; here we prove
      // that gap is harmless because the binding is durable.
      const child = spawnSync(process.execPath, [childScript, dir], {
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(child.status).toBe(0);
      expect(child.stderr).toBe("");
      const [newEpochId, newHead] = child.stdout.split("@");
      expect(newEpochId).toBe("43");
      expect(newHead).toBeDefined();

      // Fresh process: load the bundle. No in-memory journal or holders exist.
      // The durable bundle must carry the active binding matching the new head.
      const binding = readFileRuntimeActiveBinding(dir);
      expect(binding).toBeDefined();
      if (binding === undefined) return;
      expect(binding.epochId).toBe(epochId("43"));
      expect(binding.admissionId).toBe(schemaAdmissionId("adm-epoch-child"));
      expect(binding.bindingGeneration).toBe(bindingGeneration(2));

      // Reload the full persistence and confirm the head advanced.
      const reloaded = createFileRuntimePersistence({ dir });
      const headRef = reloaded.durable.head();
      expect(headRef).toBe(newHead);
      const head = reloaded.durable.get(headRef as never);
      expect(head?.epochId).toBe(epochId("43"));

      // The runtime must start under the new epoch when the binding's epoch is
      // declared compatible (the boot path does this automatically via
      // readFileRuntimeActiveBinding). Simulate that by passing the durable
      // binding's epoch as a compatible epoch id.
      const runtime = createCoordinationRuntime(
        runtimeDependenciesWithStaticSchema({
          durable: reloaded.durable,
          clock: createFixedClock(),
          idGen: createDeterministicIdGenerator(),
          schema,
          activeEpochId: epochId("43"),
          compatibleEpochIds: [epochId("43")],
          policy: templateAwarePolicyEvaluator(),
          handlers: createDefaultHandlers(),
          locks: reloaded.locks,
          contentRefAuthority: { isAvailable: () => true },
        }),
      );
      expect(runtime.getHead()?.epochId).toBe(epochId("43"));

      // recoverEpochTransition must succeed from the durable bundle alone,
      // with an empty in-memory committed journal (the defining SS-02 lift
      // condition). Construct a fresh epoch admin whose in-memory journal is
      // empty and confirm recovery reconstructs the holders.
      const schemaHolder = createMutableSchemaContextHolder(
        createActiveSchemaContext(schema, epochId("43")),
      );
      const bindingHolder = createMutableBindingHolder(initialBindingFor(schema, t0.snapshotRef));
      const freshAdmin = createMemoryEpochAdministration({
        durable: reloaded.durable,
        registry: new AdmissionRegistry(reloaded.locks),
        locks: reloaded.locks,
        schemaHolder,
        bindingHolder,
        domainId: activationDomainId("default"),
        idGen: createDeterministicIdGenerator(),
        resolveSchema: () => schema,
      });
      const recovery = await freshAdmin.recoverEpochTransition(
        schemaAdmissionId("adm-epoch-child"),
      );
      expect(recovery.ok).toBe(true);
      if (!recovery.ok) return;
      // The holders are reconstructed from the durable binding.
      expect(bindingHolder.get().epochId).toBe(epochId("43"));
      expect(bindingHolder.get().bindingGeneration).toBe(bindingGeneration(2));
      expect(schemaHolder.get().epochId).toBe(epochId("43"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a legacy bundle without schemaBinding is tolerated (backward compatible)", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-epoch-legacy-"));
    try {
      const { t0, schema } = seedWorld(dir);
      // The seed writes a bundle with no epoch transition; readFileRuntimeActiveBinding
      // returns undefined because no binding was ever published (legacy form).
      const binding = readFileRuntimeActiveBinding(dir);
      expect(binding).toBeUndefined();

      // The runtime still starts under the T0 epoch via the static path.
      const reloaded = createFileRuntimePersistence({ dir });
      const runtime = createCoordinationRuntime(
        runtimeDependenciesWithStaticSchema({
          durable: reloaded.durable,
          clock: createFixedClock(),
          idGen: createDeterministicIdGenerator(),
          schema,
          activeEpochId: t0.epochId,
          policy: templateAwarePolicyEvaluator(),
          handlers: createDefaultHandlers(),
          locks: reloaded.locks,
          contentRefAuthority: { isAvailable: () => true },
        }),
      );
      expect(runtime.getHead()?.epochId).toBe(t0.epochId);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
