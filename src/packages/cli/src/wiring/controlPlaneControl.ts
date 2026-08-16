/**
 * Control-plane wiring for the CLI (ADR-0006).
 *
 * Default: FileControlPlaneStore at `{storagePath}/control-plane`.
 * Memory store only when `ephemeral: true` (tests / `--ephemeral`).
 * `/schema admit` submits prepare; TUI never self-signs approval.
 * `/schema commit` is fail-closed without an approved admission + epochAdmin.
 */
import { join } from "node:path";
import {
  bootstrapDefaultControlPlane,
  commitToolSurfaceEpoch,
  computeMonotoneExtensionPlan,
  createControlPlaneService,
  createFileControlPlaneStore,
  createReconciliationService,
  type AdministrationContext,
  type ControlPlaneService,
  type FileControlPlaneStore,
  type ReconciliationService,
  type SchemaExtensionPlan,
  type SchemaRevision,
} from "@cantilune/control-plane";
import { MemoryControlPlaneStore } from "@cantilune/control-plane/memory";
import {
  activationDomainId,
  actorId,
  actorRef,
  idempotencyKey,
  schemaAdmissionId,
  type Result,
  type SchemaAdmissionReceipt,
  type SchemaRef,
} from "@cantilune/core";
import type { OrchestrationSchema } from "@cantilune/runtime";

export interface ControlPlaneControllerOptions {
  readonly ephemeral?: boolean;
  readonly storagePath?: string;
}

export interface SchemaAdmitResult {
  readonly ok: boolean;
  readonly message: string;
  readonly admissionId?: string;
  readonly receipt?: SchemaAdmissionReceipt;
}

export interface ControlPlaneController {
  readonly service: ControlPlaneService;
  readonly genesisRevision: ReturnType<typeof bootstrapDefaultControlPlane>["genesisRevision"];
  readonly genesisBinding: ReturnType<typeof bootstrapDefaultControlPlane>["genesisBinding"];
  readonly reconciliation: ReconciliationService;
  readonly fileStore: FileControlPlaneStore | undefined;
  readonly ephemeral: boolean;
  monotoneExtension(
    fromSchema: OrchestrationSchema,
    toSchema: OrchestrationSchema,
    fromRef: SchemaRef,
    toRef: SchemaRef,
  ): Result<SchemaExtensionPlan, unknown>;
  resolveRevision(epochOrRevision: string): Promise<SchemaRevision | undefined>;
  admitCandidate(candidateKey: string): Promise<SchemaAdmitResult>;
  commitToolSurfaceEpoch(currentEpoch: string): SchemaAdmitResult;
  commitAdmission(admissionId: string): Promise<SchemaAdmitResult>;
  getCommitReceipt(admissionId: string): SchemaAdmissionReceipt | undefined;
}

let cached: { readonly key: string; readonly controller: ControlPlaneController } | undefined;

function cliAdminContext(): AdministrationContext {
  return {
    principal: {
      actorRef: actorRef(actorId("cli-operator"), "reviewer"),
      roles: ["schema-qualifier", "schema-proposer"],
      scopes: ["control-plane"],
    },
    issuedAt: new Date().toISOString(),
    sessionId: "cli-schema-session",
  };
}

function recoverBootstrapped(
  memory: MemoryControlPlaneStore,
): ReturnType<typeof bootstrapDefaultControlPlane> {
  const domain = activationDomainId("default");
  const binding = memory.getActiveBinding(domain);
  const revisions = memory.listRevisions();
  const revision =
    (binding !== undefined ? memory.getRevision(binding.schemaRef) : undefined) ?? revisions[0];
  if (binding === undefined || revision === undefined) {
    return bootstrapDefaultControlPlane(memory);
  }
  return {
    service: createControlPlaneService({ store: memory, defaultDomainId: domain }),
    genesisRevision: revision,
    genesisBinding: binding,
  };
}

function cacheKey(options: ControlPlaneControllerOptions | undefined): string {
  if (options?.ephemeral === true || options?.storagePath === undefined) {
    return "memory";
  }
  return `file:${options.storagePath}`;
}

function buildController(
  options: ControlPlaneControllerOptions | undefined,
): ControlPlaneController {
  const ephemeral = options?.ephemeral === true || options?.storagePath === undefined;
  const memory = new MemoryControlPlaneStore();
  let fileStore: FileControlPlaneStore | undefined;
  if (!ephemeral && options?.storagePath !== undefined) {
    fileStore = createFileControlPlaneStore(join(options.storagePath, "control-plane"), memory);
  }
  const empty = memory.listRevisions().length === 0;
  const bootstrapped = empty ? bootstrapDefaultControlPlane(memory) : recoverBootstrapped(memory);
  if (fileStore !== undefined && empty) {
    fileStore.persist();
  }
  const reconciliation = createReconciliationService(fileStore !== undefined ? { fileStore } : {});

  async function resolveRevision(epochOrRevision: string): Promise<SchemaRevision | undefined> {
    const revisions = await Promise.all(
      (await bootstrapped.service.listSchemaRevisions()).map((summary) =>
        bootstrapped.service.getSchemaRevision(summary.schemaRef),
      ),
    );
    const binding = await bootstrapped.service.getActiveBinding(
      bootstrapped.genesisBinding.activationDomainId,
    );
    if (binding !== undefined && (binding.epochId as string) === epochOrRevision) {
      return bootstrapped.service.getSchemaRevision(binding.schemaRef);
    }
    return revisions.find(
      (revision) =>
        revision !== undefined &&
        ((revision.schemaRef.revisionId as string) === epochOrRevision ||
          (revision.schemaRef.digest as string) === epochOrRevision ||
          `${revision.schemaRef.revisionId as string}@${(revision.schemaRef.digest as string).slice(0, 12)}` ===
            epochOrRevision),
    );
  }

  return {
    service: bootstrapped.service,
    genesisRevision: bootstrapped.genesisRevision,
    genesisBinding: bootstrapped.genesisBinding,
    reconciliation,
    fileStore,
    ephemeral,
    monotoneExtension: (fromSchema, toSchema, fromRef, toRef) =>
      computeMonotoneExtensionPlan(fromSchema, toSchema, fromRef, toRef) as Result<
        SchemaExtensionPlan,
        unknown
      >,
    resolveRevision,
    async admitCandidate(candidateKey) {
      const candidate = await resolveRevision(candidateKey);
      if (candidate === undefined) {
        return { ok: false, message: `unknown schema revision or epoch: ${candidateKey}` };
      }
      const binding = await bootstrapped.service.getActiveBinding(
        bootstrapped.genesisBinding.activationDomainId,
      );
      if (binding === undefined) {
        return { ok: false, message: "no active schema binding" };
      }
      const admissionId = schemaAdmissionId(`cli-admit-${Date.now()}`);
      const submitted = await bootstrapped.service.submitSchemaAdmission({
        context: cliAdminContext(),
        request: {
          admissionId,
          activationDomainId: binding.activationDomainId,
          expectedBindingGeneration: binding.bindingGeneration,
          expectedSchemaRef: binding.schemaRef,
          expectedEpochId: binding.epochId,
          expectedEpochOrdinal: binding.epochOrdinal,
          expectedRuntimeHead: binding.runtimeHead,
          candidateSchemaRef: candidate.schemaRef,
          requestedBy: "cli-operator",
          requestedAt: new Date().toISOString(),
          idempotencyKey: idempotencyKey(`cli-admit-${admissionId as string}`),
        },
      });
      if (fileStore !== undefined) {
        fileStore.persist();
      }
      if (!submitted.ok) {
        return { ok: false, message: submitted.error.message };
      }
      return {
        ok: true,
        message: `admission submitted (prepare only; TUI does not self-sign): ${submitted.value.request.admissionId as string}`,
        admissionId: submitted.value.request.admissionId as string,
      };
    },
    commitToolSurfaceEpoch(currentEpoch) {
      const committed = commitToolSurfaceEpoch({
        store: memory,
        operator: "cli-operator",
        currentEpoch,
      });
      if (fileStore !== undefined) {
        fileStore.persist();
      }
      if (!committed.ok) {
        return { ok: false, message: committed.error.message };
      }
      return {
        ok: true,
        message: `tool-surface epoch committed: ${committed.value.toBinding.epochId as string}`,
        admissionId: committed.value.admissionId as string,
        receipt: committed.value,
      };
    },
    getCommitReceipt(admissionId) {
      return memory.getCommitReceipt(schemaAdmissionId(admissionId));
    },
    async commitAdmission(admissionId) {
      const record = await bootstrapped.service.getSchemaAdmission(schemaAdmissionId(admissionId));
      if (record === undefined) {
        return { ok: false, message: `no admission ${admissionId}` };
      }
      if (record.state !== "authorized" && record.state !== "prepared") {
        return {
          ok: false,
          message: `admission ${admissionId} is ${record.state}; commit requires an approved/prepared record plus epochAdmin + conformance attestation. TUI does not self-sign.`,
        };
      }
      return {
        ok: false,
        message:
          "commitAdmissionTransaction requires FullControlPlaneService (epochAdmin + four-view attestation). TUI will not mint approval or a valid certificate.",
      };
    },
  };
}

/** Build (once per storage key) and return the CLI control-plane controller. */
export function getControlPlaneController(
  options?: ControlPlaneControllerOptions,
): ControlPlaneController {
  const key = cacheKey(options);
  if (cached !== undefined && cached.key === key) {
    return cached.controller;
  }
  const controller = buildController(options);
  cached = { key, controller };
  return controller;
}

/** Reset the cached controller (used by tests to get a fresh genesis). */
export function resetControlPlaneController(): void {
  cached = undefined;
}
