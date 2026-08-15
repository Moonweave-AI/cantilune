import { buildConfigT0 } from "@cantilune/test-fixtures";
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
  type CoordinationRuntime,
  type RuntimeEpochAdministration,
  type IdGenerator,
} from "@cantilune/runtime";
import { createMemoryRuntimePersistence, MemoryResourceLockTable } from "@cantilune/runtime/memory";
import type { CollaborationSnapshot, ContentRef, SchemaEpochBinding } from "@cantilune/core";
import { epochOrdinal } from "@cantilune/core";
import { createRuntimeCommsPorts } from "../../src/integration/runtimeCommsPorts.js";

function createCommsIdGenerator(): IdGenerator {
  let snap = 0;
  let chg = 0;
  return {
    snapshotRef: () => {
      snap += 1;
      return `snap-comms-${snap}` as never;
    },
    changeId: () => {
      chg += 1;
      return `chg-comms-${chg}` as never;
    },
    sessionId: () => "session-comms-001" as never,
    linkId: () => "link-comms-001" as never,
    artifactId: () => "artifact-comms-001" as never,
    capabilityId: () => "cap-comms-001" as never,
    evidenceId: () => "ev-comms-001" as never,
  };
}

export function buildCommsRuntimeHarness(options?: {
  readonly initial?: CollaborationSnapshot;
  readonly binding?: SchemaEpochBinding;
  /** Test-owned refs made authoritative for observation-focused comms scenarios. */
  readonly availableContentRefs?: readonly ContentRef[];
}): {
  readonly runtime: CoordinationRuntime;
  readonly epochAdmin: RuntimeEpochAdministration;
  readonly binding: SchemaEpochBinding;
  readonly runtimePorts: ReturnType<typeof createRuntimeCommsPorts>;
} {
  const t0 = options?.initial ?? buildConfigT0();
  const schema = createDefaultSchema();
  const binding: SchemaEpochBinding =
    options?.binding ??
    ({
      activationDomainId: "default" as never,
      bindingGeneration: 1 as never,
      epochId: t0.epochId,
      epochOrdinal: epochOrdinal(1),
      schemaRef: {
        schemaId: schema.schemaId,
        revisionId: "rev-001",
        digest: schemaContentDigest(schema),
      } as never,
      policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
      handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
      runtimeHead: t0.snapshotRef,
      admissionId: "adm-genesis" as never,
      activatedBy: "bootstrap",
      activatedAt: "2026-08-11T16:00:00Z",
    } as SchemaEpochBinding);

  const { durable } = createMemoryRuntimePersistence({ initial: t0 });
  const locks = new MemoryResourceLockTable();
  const schemaHolder = createMutableSchemaContextHolder(
    createActiveSchemaContext(schema, t0.epochId, binding),
  );
  const bindingHolder = createMutableBindingHolder(binding);
  const idGen = createCommsIdGenerator();
  const availableContentRefs = new Set(options?.availableContentRefs ?? []);

  const runtime = createCoordinationRuntime(
    runtimeDependenciesWithStaticSchema({
      durable,
      clock: { now: () => "2026-08-11T16:00:00Z" },
      idGen,
      schema,
      activeEpochId: t0.epochId,
      handlers: createDefaultHandlers(),
      locks,
      // Production wiring uses the content package's durable store.  This
      // allowlist is deliberately test-only and fails closed for every ref a
      // scenario did not explicitly provision.
      contentRefAuthority: { isAvailable: (ref) => availableContentRefs.has(ref) },
    }),
  );

  const epochAdmin = createMemoryEpochAdministration({
    durable,
    registry: new AdmissionRegistry(locks),
    locks,
    schemaHolder,
    bindingHolder,
    domainId: binding.activationDomainId,
    idGen,
    resolveSchema: () => schema,
  });

  const runtimePorts = createRuntimeCommsPorts({ runtime, epochAdmin });

  return { runtime, epochAdmin, binding, runtimePorts };
}
