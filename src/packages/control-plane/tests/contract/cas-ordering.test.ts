import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bindingGeneration } from "@cantilune/core";
import { MemoryControlPlaneStore } from "../../src/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../src/file/fileControlPlaneStore.js";
import { bootstrapDefaultControlPlane } from "../../src/engine/controlPlaneService.js";

describe("CAS out-of-order / replay properties", () => {
  it("concurrent casActiveBindingDurable: only one writer wins", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-cas-race-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      const start = genesisBinding.bindingGeneration as number;
      const attempts = Array.from({ length: 8 }, (_, index) =>
        Promise.resolve().then(() =>
          fileStore.casActiveBindingDurable({
            domainId: genesisBinding.activationDomainId,
            expectedGeneration: genesisBinding.bindingGeneration,
            nextBinding: {
              ...genesisBinding,
              bindingGeneration: bindingGeneration(start + 1),
              activatedBy: `racer-${String(index)}`,
            },
          }),
        ),
      );
      const results = await Promise.all(attempts);
      expect(results.filter((won) => won)).toHaveLength(1);
      expect(results.filter((won) => !won)).toHaveLength(7);
      expect(memory.getActiveBinding(genesisBinding.activationDomainId)?.bindingGeneration).toBe(
        bindingGeneration(start + 1),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("out-of-order expectedGeneration does not apply", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-cas-ooo-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      const start = genesisBinding.bindingGeneration as number;
      expect(
        fileStore.casActiveBindingDurable({
          domainId: genesisBinding.activationDomainId,
          expectedGeneration: genesisBinding.bindingGeneration,
          nextBinding: {
            ...genesisBinding,
            bindingGeneration: bindingGeneration(start + 1),
          },
        }),
      ).toBe(true);

      expect(
        fileStore.casActiveBindingDurable({
          domainId: genesisBinding.activationDomainId,
          expectedGeneration: bindingGeneration(0),
          nextBinding: {
            ...genesisBinding,
            bindingGeneration: bindingGeneration(start + 2),
          },
        }),
      ).toBe(false);
      expect(
        fileStore.casActiveBindingDurable({
          domainId: genesisBinding.activationDomainId,
          expectedGeneration: bindingGeneration(start + 2),
          nextBinding: {
            ...genesisBinding,
            bindingGeneration: bindingGeneration(start + 3),
          },
        }),
      ).toBe(false);
      expect(memory.getActiveBinding(genesisBinding.activationDomainId)?.bindingGeneration).toBe(
        bindingGeneration(start + 1),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("replay of the same expectedGeneration does not double-apply", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-cas-replay-"));
    try {
      const memory = new MemoryControlPlaneStore();
      const { genesisBinding } = bootstrapDefaultControlPlane(memory);
      const fileStore = createFileControlPlaneStore(dir, memory);
      const start = genesisBinding.bindingGeneration as number;
      const cas = {
        domainId: genesisBinding.activationDomainId,
        expectedGeneration: genesisBinding.bindingGeneration,
        nextBinding: {
          ...genesisBinding,
          bindingGeneration: bindingGeneration(start + 1),
        },
      };
      expect(fileStore.casActiveBindingDurable(cas)).toBe(true);
      expect(fileStore.casActiveBindingDurable(cas)).toBe(false);
      expect(fileStore.casActiveBindingDurable(cas)).toBe(false);
      expect(memory.getActiveBinding(genesisBinding.activationDomainId)?.bindingGeneration).toBe(
        bindingGeneration(start + 1),
      );

      const restarted = new MemoryControlPlaneStore();
      createFileControlPlaneStore(dir, restarted);
      expect(restarted.getActiveBinding(genesisBinding.activationDomainId)?.bindingGeneration).toBe(
        bindingGeneration(start + 1),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
