import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryControlPlaneStore } from "../../../src/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../../src/file/fileControlPlaneStore.js";
import { bootstrapDefaultControlPlane } from "../../../src/engine/controlPlaneService.js";
import { bindingGeneration, runtimeInstanceId } from "@cantilune/core";

describe("file control plane store", () => {
  it("persists, reloads journal, and recovers snapshot", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-"));
    try {
      const memory = new MemoryControlPlaneStore();
      bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      fileStore.appendJournal({ kind: "test-entry" });
      fileStore.persist();
      expect(fileStore.loadJournal()).toHaveLength(1);

      const reloaded = new MemoryControlPlaneStore();
      const recovered = createFileControlPlaneStore(dir, reloaded);
      const snapshot = recovered.recover();
      expect(snapshot.revisions.size).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /**
   * A corrupt snapshot used to be ignored, which started the control plane with
   * no bindings, no admissions and nothing frozen — and the next persist then
   * replaced the last good file with that empty state.
   */
  it("refuses to start on a corrupted snapshot instead of running empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-bad-"));
    try {
      writeFileSync(join(dir, "control-plane.snapshot.json"), "{not-json", "utf8");
      const memory = new MemoryControlPlaneStore();
      bootstrapDefaultControlPlane(memory);

      expect(() => createFileControlPlaneStore(dir, memory)).toThrow(
        /corrupt or unreadable .*refusing to start/s,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("quarantines the unreadable snapshot so it is not overwritten", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-quarantine-"));
    try {
      writeFileSync(join(dir, "control-plane.snapshot.json"), "{not-json", "utf8");
      expect(() => createFileControlPlaneStore(dir, new MemoryControlPlaneStore())).toThrow();

      const quarantined = readdirSync(dir).filter((name) => name.includes(".corrupt."));
      expect(quarantined).toHaveLength(1);
      expect(readFileSync(join(dir, quarantined[0] as string), "utf8")).toBe("{not-json");
      expect(existsSync(join(dir, "control-plane.snapshot.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty journal when missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-journal-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const fileStore = createFileControlPlaneStore(dir, memory);
      expect(fileStore.loadJournal()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists and reloads fleetBindings on the snapshot", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-fleet-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      const instance = runtimeInstanceId("runtime-file-fleet");
      memory.replaceFleetBindings([
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
      fileStore.persistFleetBindings(memory.getFleetBindings());
      expect(
        fileStore
          .loadJournal()
          .some((entry) => (entry as { kind?: string }).kind === "fleetBindings"),
      ).toBe(true);

      const reloaded = new MemoryControlPlaneStore();
      const recovered = createFileControlPlaneStore(dir, reloaded);
      expect(recovered.loadFleetBindings().get(instance)?.status).toBe("pending");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers fleetBindings from journal when the snapshot omits them", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-fleet-journal-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      fileStore.persist();
      const instance = runtimeInstanceId("runtime-journal-fleet");
      fileStore.appendJournal({ kind: "unrelated" });
      fileStore.appendJournal({ kind: "fleetBindings" });
      fileStore.appendJournal(null);
      fileStore.appendJournal({
        kind: "fleetBindings",
        bindings: [
          [
            instance,
            {
              runtimeInstanceId: instance,
              desiredBinding: genesisBinding,
              status: "pending",
              drift: true,
            },
          ],
        ],
      });

      const reloaded = new MemoryControlPlaneStore();
      const recovered = createFileControlPlaneStore(dir, reloaded);
      expect(recovered.loadFleetBindings().has(instance)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers fleetBindings from journal when no snapshot exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-fleet-journal-only-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      const instance = runtimeInstanceId("runtime-journal-only");
      fileStore.appendJournal({
        kind: "fleetBindings",
        bindings: [
          [
            instance,
            {
              runtimeInstanceId: instance,
              desiredBinding: genesisBinding,
              status: "pending",
              drift: true,
            },
          ],
        ],
      });

      const reloaded = new MemoryControlPlaneStore();
      const recovered = createFileControlPlaneStore(dir, reloaded);
      expect(recovered.loadFleetBindings().has(instance)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("performs durable CAS under file lock", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-file-cas-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      const nextBinding = {
        ...genesisBinding,
        bindingGeneration: bindingGeneration((genesisBinding.bindingGeneration as number) + 1),
      };
      expect(
        fileStore.casActiveBindingDurable({
          domainId: genesisBinding.activationDomainId,
          expectedGeneration: genesisBinding.bindingGeneration,
          nextBinding,
        }),
      ).toBe(true);
      expect(
        fileStore.casActiveBindingDurable({
          domainId: genesisBinding.activationDomainId,
          expectedGeneration: genesisBinding.bindingGeneration,
          nextBinding,
        }),
      ).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
