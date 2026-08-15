/**
 * Child process entry: prepare and commit one epoch transition against a
 * file-backed durable world, atomically advancing the head and the active
 * schema epoch binding (ADR-0014). The parent process then crashes this
 * child (by reading its exit) and restarts a fresh process that must recover
 * the binding from the durable bundle alone.
 *
 * Usage: node epochTransitionChild.mjs <dir>
 * Requires: pnpm build (imports from dist).
 *
 * On success prints the new epoch id to stdout and exits 0. The bundle on disk
 * now carries the new head AND the new schemaBinding together.
 */
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
} from "../../../core/dist/index.js";
import {
  AdmissionRegistry,
  createActiveSchemaContext,
  createCoordinationRuntime,
  createDefaultHandlers,
  createDefaultSchema,
  createMemoryEpochAdministration,
  createMutableBindingHolder,
  createMutableSchemaContextHolder,
  templateAwarePolicyEvaluator,
  schemaContentDigest,
} from "../../dist/index.js";
import { createFileRuntimePersistence } from "../../dist/memory/index.js";
import { MemoryResourceLockTable } from "../../dist/memory/index.js";

const dir = process.argv[2];
if (dir === undefined) {
  console.error("usage: epochTransitionChild.mjs <dir>");
  process.exit(2);
}

const schema = createDefaultSchema();
const initialBinding = {
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
  runtimeHead: "snap-S0",
  admissionId: schemaAdmissionId("bootstrap"),
  activatedBy: "bootstrap",
  activatedAt: "2026-08-14T00:00:00Z",
};

const persistence = createFileRuntimePersistence({ dir });
const durable = persistence.durable;
const locks = persistence.locks;
const schemaHolder = createMutableSchemaContextHolder(
  createActiveSchemaContext(schema, initialBinding.epochId, initialBinding),
);
const bindingHolder = createMutableBindingHolder(initialBinding);
const registry = new AdmissionRegistry(locks);

const epochAdmin = createMemoryEpochAdministration({
  durable,
  registry,
  locks,
  schemaHolder,
  bindingHolder,
  domainId: initialBinding.activationDomainId,
  idGen: {
    snapshotRef: () => "snap-epoch-after",
    changeId: () => "chg-epoch",
    sessionId: () => "session-epoch",
    linkId: () => "link-epoch",
    artifactId: () => "artifact-epoch",
    capabilityId: () => "cap-epoch",
    evidenceId: () => "ev-epoch",
  },
  resolveSchema: () => schema,
  preparationTtlMs: 60_000,
});

const prepared = await epochAdmin.prepareEpochTransition({
  admissionId: schemaAdmissionId("adm-epoch-child"),
  domainId: initialBinding.activationDomainId,
  expectedBindingGeneration: initialBinding.bindingGeneration,
  expectedHead: durable.head(),
  expectedEpochId: initialBinding.epochId,
  expectedEpochOrdinal: initialBinding.epochOrdinal,
  targetSchemaRef: initialBinding.schemaRef,
  targetEpochId: epochId("43"),
  targetEpochOrdinal: epochOrdinal(2),
  planDigest: "ss02-crash-test",
});

if (!prepared.ok) {
  console.error(`prepare failed: ${JSON.stringify(prepared)}`);
  process.exit(1);
}

const committed = await epochAdmin.commitEpochTransition(prepared.value);
if (!committed.ok) {
  console.error(`commit failed: ${JSON.stringify(committed)}`);
  process.exit(1);
}

// The head and the binding are now durable together. Print the new epoch.
const newHead = durable.head();
const newBinding = durable.activeBinding();
process.stdout.write(`${String(newBinding.epochId)}@${String(newHead)}`);
process.exit(0);
