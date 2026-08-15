/**
 * Tests for the control-plane controller and /schema command prefetch.
 *
 * Verifies that getControlPlaneController bootstraps a real ControlPlaneService
 * with a genesis schema revision and active binding, that /schema * handlers
 * prefetch real service data into store.viewArgs.schemaData, and that the
 * SchemaView renders from prefetched data (with a runtime-projection fallback
 * when no controller is connected).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerSchemaCommands } from "../../src/commands/schemaCommands.js";
import { createStore } from "../../src/store.js";
import {
  getControlPlaneController,
  resetControlPlaneController,
} from "../../src/wiring/controlPlaneControl.js";
import { renderSchemaViewOutput } from "../../src/views/SchemaView.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import type { PrefetchedSchemaData } from "../../src/views/SchemaView.js";

function registry() {
  const r = createCommandRegistry();
  for (const c of registerSchemaCommands()) r.register(c);
  return r;
}

describe("control-plane controller", () => {
  beforeEach(() => {
    resetControlPlaneController();
  });

  it("bootstraps a genesis schema revision and active binding", async () => {
    const controller = getControlPlaneController();
    expect(controller.genesisRevision).toBeDefined();
    expect(controller.genesisBinding).toBeDefined();
    const revisions = await controller.service.listSchemaRevisions();
    expect(revisions.length).toBeGreaterThanOrEqual(1);
    const binding = await controller.service.getActiveBinding(
      controller.genesisBinding.activationDomainId,
    );
    expect(binding).toBeDefined();
    expect(binding?.schemaRef.schemaId).toBe(controller.genesisRevision.schemaRef.schemaId);
  });

  it("the default schema declares operation types (the catalog is non-empty)", async () => {
    const controller = getControlPlaneController();
    const binding = await controller.service.getActiveBinding(
      controller.genesisBinding.activationDomainId,
    );
    const revision = await controller.service.getSchemaRevision(binding!.schemaRef);
    expect(revision).toBeDefined();
    expect(revision!.schema.operationTypes.size).toBeGreaterThan(0);
    expect(revision!.schema.objectTypes.size).toBeGreaterThan(0);
  });

  it("readEvents returns the event log (bootstrap writes directly, may be empty in local mode)", async () => {
    const controller = getControlPlaneController();
    const events = await controller.service.readEvents();
    // bootstrapDefaultControlPlane writes the genesis revision + binding
    // directly to the store (not through the admission event path), so the
    // local-mode event log may be empty until an admission is committed.
    expect(Array.isArray(events)).toBe(true);
  });

  it("monotoneExtension accepts a self-extension (genesis → genesis)", () => {
    const controller = getControlPlaneController();
    const ref = controller.genesisRevision.schemaRef;
    const plan = controller.monotoneExtension(
      controller.genesisRevision.schema,
      controller.genesisRevision.schema,
      ref,
      ref,
    );
    expect(plan.ok).toBe(true);
  });
});

describe("schema command prefetch", () => {
  beforeEach(() => {
    resetControlPlaneController();
  });

  it("/schema prefetches schemaData with revisions and active binding", async () => {
    const controller = getControlPlaneController();
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/schema", appStore, { controlPlane: () => controller });

    expect(appStore.activeView).toBe("schema");
    const data = appStore.viewArgs.schemaData as PrefetchedSchemaData;
    expect(data).toBeDefined();
    expect(data.revisions.length).toBeGreaterThanOrEqual(1);
    expect(data.activeBinding).toBeDefined();
    expect(data.revisionDetail).toBeDefined();
    expect(data.revisionDetail!.operationTypeIds.length).toBeGreaterThan(0);
  });

  it("/schema ops renders the declared operation catalog", async () => {
    const controller = getControlPlaneController();
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/schema ops", appStore, { controlPlane: () => controller });

    const data = appStore.viewArgs.schemaData as PrefetchedSchemaData;
    const output = renderSchemaViewOutput("schema-ops", appStore.viewArgs, sampleRuntime);
    expect(data.revisionDetail!.operationTypeIds.length).toBeGreaterThan(0);
    // The rendered table lists the declared operation ids.
    expect(output).toContain(data.revisionDetail!.operationTypeIds[0]);
  });

  it("/schema epoch renders the active binding epoch id", async () => {
    const controller = getControlPlaneController();
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/schema epoch", appStore, { controlPlane: () => controller });

    const data = appStore.viewArgs.schemaData as PrefetchedSchemaData;
    const output = renderSchemaViewOutput("schema-epoch", appStore.viewArgs, sampleRuntime);
    expect(output).toContain(data.activeBinding!.epochId);
    expect(output).toContain("schemaRef");
  });

  it("/schema epoch history renders the event timeline (empty in local bootstrap)", async () => {
    const controller = getControlPlaneController();
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/schema epoch history", appStore, { controlPlane: () => controller });

    const data = appStore.viewArgs.schemaData as PrefetchedSchemaData;
    const output = renderSchemaViewOutput("schema-epoch-history", appStore.viewArgs, sampleRuntime);
    // The bootstrap writes directly, so the event log is empty; the timeline
    // renders without throwing.
    expect(typeof output).toBe("string");
    expect(data.events).toBeDefined();
  });

  it("/schema validate renders a monotone-extension verdict", async () => {
    const controller = getControlPlaneController();
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/schema validate", appStore, { controlPlane: () => controller });

    const data = appStore.viewArgs.schemaData as PrefetchedSchemaData;
    expect(data.extensionPlan).toBeDefined();
    expect(data.extensionPlan!.ok).toBe(true);
    const output = renderSchemaViewOutput("schema-validate", appStore.viewArgs, sampleRuntime);
    expect(output).toContain("Monotone");
  });

  it("/schema with no controller falls back to the runtime projection", async () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });

    await reg.execute("/schema", appStore, {});

    expect(appStore.activeView).toBe("schema");
    expect(appStore.viewArgs.schemaData).toBeUndefined();
    const output = renderSchemaViewOutput("schema", appStore.viewArgs, sampleRuntime);
    // The fallback renders the runtime epoch's schema id.
    expect(output).toContain("orch-schema-v1");
  });

  it("/schema diff with a controller renders the monotone extension verdict", async () => {
    const controller = getControlPlaneController();
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/schema diff rev-001 rev-001", appStore, { controlPlane: () => controller });

    const data = appStore.viewArgs.schemaData as PrefetchedSchemaData;
    const output = renderSchemaViewOutput("schema-diff", appStore.viewArgs, sampleRuntime);
    expect(data.extensionPlan!.ok).toBe(true);
    expect(output).toContain("monotone extension");
  });
});
