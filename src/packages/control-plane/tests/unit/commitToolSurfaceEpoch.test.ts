import { describe, expect, it } from "vitest";
import { MemoryControlPlaneStore } from "../../src/memory/memoryControlPlaneStore.js";
import { bootstrapDefaultControlPlane } from "../../src/engine/controlPlaneService.js";
import { commitToolSurfaceEpoch } from "../../src/engine/commitToolSurfaceEpoch.js";

describe("commitToolSurfaceEpoch", () => {
  it("advances the same-schema epoch and stores a receipt", () => {
    const store = new MemoryControlPlaneStore();
    const { genesisBinding } = bootstrapDefaultControlPlane(store);
    const result = commitToolSurfaceEpoch({
      store,
      operator: "cli-operator",
      currentEpoch: genesisBinding.epochId as string,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.fromBinding.epochId).toBe(genesisBinding.epochId);
    expect(result.value.toBinding.epochId).not.toBe(genesisBinding.epochId);
    expect(result.value.toBinding.schemaRef).toEqual(genesisBinding.schemaRef);
    expect(store.getCommitReceipt(result.value.admissionId)).toEqual(result.value);
    expect(store.getActiveBinding(genesisBinding.activationDomainId)?.epochId).toBe(
      result.value.toBinding.epochId,
    );
  });

  it("fail-closes when the control plane is frozen", () => {
    const store = new MemoryControlPlaneStore();
    bootstrapDefaultControlPlane(store);
    store.setFrozen(true);
    const result = commitToolSurfaceEpoch({ store, operator: "cli-operator" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("control_plane_frozen");
  });

  it("fail-closes without an active binding", () => {
    const store = new MemoryControlPlaneStore();
    const result = commitToolSurfaceEpoch({ store, operator: "cli-operator" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toMatch(/no active schema binding/);
  });
});
