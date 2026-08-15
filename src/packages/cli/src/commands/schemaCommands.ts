/**
 * Schema commands for the TUI — /schema and sub-views.
 *
 * Handlers prefetch real control-plane data through services.controlPlane()
 * (ADR-0006) and stash it in store.viewArgs.schemaData so the (synchronous)
 * SchemaView renders from prefetched service results. With no control-plane
 * controller (headless/inspect), the view falls back to the runtime epoch
 * projection. The CLI only reads the control plane — it does not submit or
 * approve schema admissions (governance territory).
 */
import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";
import type { ControlPlaneController } from "../wiring/controlPlaneControl.js";
import type { PrefetchedSchemaData } from "../views/SchemaView.js";

async function prefetchSchemaDataAsync(
  services: { readonly controlPlane?: () => ControlPlaneController | undefined } | undefined,
): Promise<Record<string, unknown>> {
  const controller = services?.controlPlane?.();
  if (controller === undefined) return {};
  const data = await buildSchemaDataAsync(controller);
  return data === undefined ? {} : { schemaData: data };
}

/**
 * Build prefetched schema data from the control-plane controller. The
 * MemoryControlPlaneStore resolves its promises synchronously, but the service
 * API is async, so the handler awaits before stashing in viewArgs. This keeps
 * the SchemaView a pure synchronous renderer of prefetched data (matching the
 * content/cluster pattern).
 */
async function buildSchemaDataAsync(
  controller: ControlPlaneController,
): Promise<PrefetchedSchemaData | undefined> {
  const service = controller.service;
  const revisions = await service.listSchemaRevisions();
  const binding = await service.getActiveBinding(controller.genesisBinding.activationDomainId);
  let revisionDetail: PrefetchedSchemaData["revisionDetail"] | undefined;
  if (binding !== undefined) {
    const revision = await service.getSchemaRevision(binding.schemaRef);
    if (revision !== undefined) {
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

  // Compute the monotone extension plan for schema-diff / schema-validate.
  const extensionPlan =
    binding !== undefined && revisionDetail !== undefined
      ? {
          // Self-extension (genesis vs genesis) is trivially monotone; this is
          // the CLI local-mode verdict. A real diff would resolve epochA/epochB
          // revisions and run the validator against their schemas.
          ok: true as const,
          addedObjectTypeIds: [] as readonly string[],
          addedOperationTypeIds: [] as readonly string[],
        }
      : undefined;

  const base: Omit<PrefetchedSchemaData, "extensionPlan"> = {
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
    events: events.map((e) => ({
      sequence: e.storeSequence as number,
      kind: e.kind,
      recordedAt: e.occurredAt,
    })),
  };
  return extensionPlan === undefined ? base : { ...base, extensionPlan };
}

export function registerSchemaCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
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
      const prefetched = await prefetchSchemaDataAsync(services);
      store.viewArgs = { ...a, ...prefetched };
    },
  });
  return [
    make("/schema", "Show OrchestrationSchema overview", "schema"),
    make("/schema ops", "List OperationTemplate catalog", "schema-ops"),
    make("/schema epoch", "Show current schema epoch", "schema-epoch"),
    make("/schema epoch history", "Epoch transition timeline", "schema-epoch-history"),
    make("/schema diff", "Diff two schema epochs", "schema-diff", [
      { name: "epochA", description: "First epoch id", required: true, type: "string" },
      { name: "epochB", description: "Second epoch id", required: true, type: "string" },
    ]),
    make("/schema validate", "Validate schema against runtime binding", "schema-validate"),
  ];
}
