/**
 * Schema commands — prefetch real control-plane revisions and monotone plans.
 * `/schema admit` submits prepare only. `/schema commit` is fail-closed without
 * independent attestation. `/schema rollout` reads the durable fleet journal.
 */
import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";
import type { ControlPlaneController } from "../wiring/controlPlaneControl.js";
import type { PrefetchedSchemaData, SchemaOperationRow } from "../views/SchemaView.js";

async function prefetchSchemaDataAsync(
  services: { readonly controlPlane?: () => ControlPlaneController | undefined } | undefined,
  viewArgs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = services?.controlPlane?.();
  if (controller === undefined) return {};
  const data = await buildSchemaDataAsync(controller, viewArgs);
  return data === undefined ? {} : { schemaData: data };
}

function operationRows(revision: {
  readonly schema: {
    readonly operationTypes: ReadonlyMap<
      string,
      {
        readonly requiredRoles: readonly string[];
        readonly defaultVisibility: string;
        readonly mayCreateSessions: boolean;
      }
    >;
  };
}): readonly SchemaOperationRow[] {
  return [...revision.schema.operationTypes.entries()].map(([id, declaration]) => ({
    id: id as string,
    roles: [...declaration.requiredRoles],
    visibility: declaration.defaultVisibility,
    mayCreateSessions: declaration.mayCreateSessions,
  }));
}

async function buildSchemaDataAsync(
  controller: ControlPlaneController,
  viewArgs: Record<string, unknown>,
): Promise<PrefetchedSchemaData | undefined> {
  const service = controller.service;
  const revisions = await service.listSchemaRevisions();
  const binding = await service.getActiveBinding(controller.genesisBinding.activationDomainId);
  let revisionDetail: PrefetchedSchemaData["revisionDetail"] | undefined;
  let operations: readonly SchemaOperationRow[] = [];
  if (binding !== undefined) {
    const revision = await service.getSchemaRevision(binding.schemaRef);
    if (revision !== undefined) {
      operations = operationRows(revision);
      revisionDetail = {
        schemaRef: {
          schemaId: revision.schemaRef.schemaId as string,
          revisionId: revision.schemaRef.revisionId as string,
          digest: revision.schemaRef.digest as string,
        },
        createdBy: revision.createdBy,
        createdAt: revision.createdAt,
        operationTypeIds: [...revision.schema.operationTypes.keys()].map((o) => o as string),
        objectTypeIds: [...revision.schema.objectTypes.keys()].map((o) => o as string),
      };
    }
  }
  const events = await service.readEvents();

  const epochA = typeof viewArgs.epochA === "string" ? viewArgs.epochA : undefined;
  const epochB = typeof viewArgs.epochB === "string" ? viewArgs.epochB : undefined;
  let extensionPlan: PrefetchedSchemaData["extensionPlan"];
  if (epochA !== undefined && epochB !== undefined) {
    const from = await controller.resolveRevision(epochA);
    const to = await controller.resolveRevision(epochB);
    if (from === undefined || to === undefined) {
      extensionPlan = {
        ok: false,
        message: `cannot resolve epoch/revision pair ${epochA} → ${epochB}`,
      };
    } else {
      const plan = controller.monotoneExtension(from.schema, to.schema, from.schemaRef, to.schemaRef);
      if (plan.ok) {
        extensionPlan = {
          ok: true,
          addedObjectTypeIds: plan.value.addedObjectTypeIds.map((id) => id as string),
          addedOperationTypeIds: plan.value.addedOperationTypeIds.map((id) => id as string),
        };
      } else {
        const violation = plan.error as { readonly message?: string };
        extensionPlan = {
          ok: false,
          message: violation.message ?? "non-monotone extension",
        };
      }
    }
  } else if (binding !== undefined && revisionDetail !== undefined) {
    const self = await service.getSchemaRevision(binding.schemaRef);
    if (self !== undefined) {
      const plan = controller.monotoneExtension(self.schema, self.schema, self.schemaRef, self.schemaRef);
      extensionPlan = plan.ok
        ? {
            ok: true,
            addedObjectTypeIds: plan.value.addedObjectTypeIds.map((id) => id as string),
            addedOperationTypeIds: plan.value.addedOperationTypeIds.map((id) => id as string),
          }
        : { ok: false, message: (plan.error as { message?: string }).message ?? "rejected" };
    }
  }

  const report = controller.reconciliation.report();
  const base: PrefetchedSchemaData = {
    revisions: revisions.map((r) => ({
      schemaRef: {
        schemaId: r.schemaRef.schemaId as string,
        revisionId: r.schemaRef.revisionId as string,
        digest: r.schemaRef.digest as string,
      },
      status: r.status,
      createdAt: r.createdAt,
    })),
    activeBinding:
      binding === undefined
        ? undefined
        : {
            epochId: binding.epochId as string,
            epochOrdinal: binding.epochOrdinal as number,
            schemaRef: {
              schemaId: binding.schemaRef.schemaId as string,
              revisionId: binding.schemaRef.revisionId as string,
              digest: binding.schemaRef.digest as string,
            },
            activatedBy: binding.activatedBy,
            activatedAt: binding.activatedAt,
          },
    revisionDetail,
    operations,
    events: events.map((e) => ({
      sequence: e.storeSequence as number,
      kind: e.kind,
      recordedAt: e.occurredAt,
    })),
    rollout: report,
    ephemeral: controller.ephemeral,
    ...(extensionPlan !== undefined ? { extensionPlan } : {}),
  };
  return base;
}

export function registerSchemaCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  const operation = "operation" as CommandCategory;
  const make = (
    name: string,
    description: string,
    viewName: ViewType,
    args?: SlashCommand["args"],
  ): SlashCommand => ({
    name,
    description,
    category: view,
    ...(args !== undefined ? { args } : {}),
    handler: async (a: Record<string, unknown>, store: AppStore, services) => {
      store.mode = "view";
      store.activeView = viewName;
      const prefetched = await prefetchSchemaDataAsync(services, a);
      store.viewArgs = { ...a, ...prefetched };
    },
  });
  return [
    make("/schema", "Show OrchestrationSchema overview", "schema"),
    make("/schema ops", "List OperationTemplate catalog", "schema-ops"),
    make("/schema epoch", "Show current schema epoch", "schema-epoch"),
    make("/schema epoch history", "Epoch transition timeline", "schema-epoch-history"),
    make("/schema diff", "Diff two schema epochs", "schema-diff", [
      { name: "epochA", description: "First epoch or revision id", required: true, type: "string" },
      { name: "epochB", description: "Second epoch or revision id", required: true, type: "string" },
    ]),
    make("/schema validate", "Validate schema against runtime binding", "schema-validate"),
    {
      name: "/schema admit",
      description: "Submit schema admission (prepare only; no TUI self-sign)",
      category: operation,
      args: [
        {
          name: "revision",
          description: "Candidate revision or epoch id",
          required: true,
          type: "string",
        },
      ],
      handler: async (args, store, services) => {
        const controller = services?.controlPlane?.();
        store.mode = "view";
        store.activeView = "schema-admit";
        if (controller === undefined) {
          store.viewArgs = { ...args, schemaData: { admitResult: { ok: false, message: "no control plane" } } };
          return;
        }
        const revision = typeof args.revision === "string" ? args.revision : "";
        const admitResult = await controller.admitCandidate(revision);
        const prefetched = await prefetchSchemaDataAsync(services, args);
        store.viewArgs = { ...args, ...prefetched, schemaData: { ...(prefetched.schemaData as object), admitResult } };
        services?.notify?.(admitResult.ok ? "info" : "error", admitResult.message);
      },
    },
    {
      name: "/schema commit",
      description: "Commit an approved admission (fail-closed without attestation)",
      category: operation,
      args: [
        { name: "admissionId", description: "Admission id", required: true, type: "string" },
      ],
      handler: async (args, store, services) => {
        const controller = services?.controlPlane?.();
        store.mode = "view";
        store.activeView = "schema-commit";
        if (controller === undefined) {
          store.viewArgs = {
            ...args,
            schemaData: { commitResult: { ok: false, message: "no control plane" } },
          };
          return;
        }
        const admissionId = typeof args.admissionId === "string" ? args.admissionId : "";
        const commitResult = await controller.commitAdmission(admissionId);
        const prefetched = await prefetchSchemaDataAsync(services, args);
        store.viewArgs = {
          ...args,
          ...prefetched,
          schemaData: { ...(prefetched.schemaData as object), commitResult },
        };
        services?.notify?.(commitResult.ok ? "info" : "warn", commitResult.message);
      },
    },
    make("/schema rollout", "Show fleet rollout report from durable journal", "schema-rollout"),
  ];
}
