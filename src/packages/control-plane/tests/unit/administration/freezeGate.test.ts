import { describe, expect, it } from "vitest";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { ensureControlPlaneNotFrozen } from "../../../src/administration/freezeGate.js";

describe("freeze gate", () => {
  it("passes when store is not frozen", () => {
    const store = new MemoryControlPlaneStore();
    expect(() => ensureControlPlaneNotFrozen(store, "commit")).not.toThrow();
  });

  it("throws violation when store is frozen", () => {
    const store = new MemoryControlPlaneStore();
    store.setFrozen(true);
    expect(() => ensureControlPlaneNotFrozen(store, "prepare")).toThrow("control plane frozen");
    try {
      ensureControlPlaneNotFrozen(store, "prepare");
    } catch (error) {
      expect((error as { violation: { code: string } }).violation.code).toBe(
        "control_plane_frozen",
      );
    }
  });
});
