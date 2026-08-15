import { describe, expect, it } from "vitest";
import {
  exportDurableBundle,
  importDurableBundle,
  importDurableBundleTyped,
  serializeDurableBundle,
  deserializeDurableBundle,
} from "../../../src/memory/durableBundle.js";
import { snapshotRef } from "@cantilune/core";
import { buildTestRuntime } from "../../support/buildTestRuntime.js";
import { proposeAndCommitOrThrow, introduceIntent } from "../../support/scenario/scenarioRunner.js";

describe("durableBundle", () => {
  it("round-trips export and import", () => {
    const { durable, store, recipeSidecar, t0, runtime } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    const imported = importDurableBundle(serializeDurableBundle(bundle));
    expect("code" in imported).toBe(false);
    if ("code" in imported) {
      return;
    }
    expect(imported.t0.snapshotRef).toBe(t0.snapshotRef);
    expect(imported.durable.head()).toBe(durable.head());
    expect(imported.durable.changes()).toHaveLength(1);
  });

  it("rejects non-object bundle", () => {
    const result = importDurableBundle(null);
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.code).toBe("codec_invalid");
  });

  it("rejects bundle missing required fields", () => {
    const result = importDurableBundle({ t0Ref: "snap-S0" });
    expect("code" in result).toBe(true);
  });

  it("rejects bundle missing t0 snapshot", () => {
    const { durable, store, recipeSidecar } = buildTestRuntime({ eventCount: 8 });
    const bundle = exportDurableBundle(durable, store, recipeSidecar, snapshotRef("snap-missing"));
    const result = importDurableBundle(serializeDurableBundle(bundle));
    expect("code" in result).toBe(true);
    if (!("code" in result)) {
      return;
    }
    expect(result.message).toContain("missing t0");
  });

  it("rejects duplicate changeId on import", () => {
    const { durable, store, recipeSidecar, t0, runtime } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    const serialized = serializeDurableBundle(bundle) as Record<string, unknown>;
    const changes = serialized.changes as unknown[];
    serialized.changes = [...changes, changes[0]];
    const result = importDurableBundle(serialized);
    expect("code" in result).toBe(true);
  });

  it("deserializes via deserializeDurableBundle", () => {
    const { durable, store, recipeSidecar, t0 } = buildTestRuntime({ eventCount: 8 });
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    const imported = deserializeDurableBundle(serializeDurableBundle(bundle));
    expect("code" in imported).toBe(false);
  });

  it("rejects bundle with invalid change wire", () => {
    const { durable, store, recipeSidecar, t0 } = buildTestRuntime({ eventCount: 8 });
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    const serialized = serializeDurableBundle(bundle) as Record<string, unknown>;
    serialized.changes = [{ bad: true }];
    const result = importDurableBundle(serialized);
    expect("code" in result).toBe(true);
  });

  it("rejects malformed, mismatched, duplicate, or missing legacy recipe copies", () => {
    const { durable, store, recipeSidecar, t0, runtime } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);

    const malformed = serializeDurableBundle(bundle) as Record<string, unknown>;
    malformed.recipes = [{ changeId: 7, recipe: {} }];
    expect(importDurableBundle(malformed)).toMatchObject({ code: "codec_invalid" });

    const mismatched = serializeDurableBundle(bundle) as Record<string, unknown>;
    const recipes = mismatched.recipes as { changeId: string; recipe: unknown }[];
    recipes[0] = { changeId: recipes[0]!.changeId, recipe: { forged: true } };
    expect(importDurableBundle(mismatched)).toMatchObject({ code: "codec_invalid" });

    const duplicate = serializeDurableBundle(bundle) as Record<string, unknown>;
    const duplicateRecipes = duplicate.recipes as unknown[];
    duplicate.recipes = [...duplicateRecipes, duplicateRecipes[0]];
    expect(importDurableBundle(duplicate)).toMatchObject({ code: "codec_invalid" });

    const missing = serializeDurableBundle(bundle) as Record<string, unknown>;
    missing.recipes = [];
    expect(importDurableBundle(missing)).toMatchObject({ code: "codec_invalid" });
  });

  it("throws from importDurableBundleTyped on invalid bundle", () => {
    expect(() => importDurableBundleTyped({} as never)).toThrow();
  });

  it("tolerates an absent schemaBinding (legacy bundle)", () => {
    const { durable, store, recipeSidecar, t0, runtime } = buildTestRuntime({ eventCount: 8 });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    expect(bundle.schemaBinding).toBeUndefined();
    const imported = importDurableBundle(serializeDurableBundle(bundle));
    expect("code" in imported).toBe(false);
    if ("code" in imported) return;
    expect(imported.schemaBinding).toBeUndefined();
    expect(imported.durable.activeBinding()).toBeUndefined();
  });

  it("rejects a schemaBinding whose epoch does not match the head epoch", () => {
    const { durable, store, recipeSidecar, t0 } = buildTestRuntime({ eventCount: 8 });
    const bundle = exportDurableBundle(durable, store, recipeSidecar, t0.snapshotRef);
    const serialized = serializeDurableBundle(bundle) as Record<string, unknown>;
    serialized.schemaBinding = {
      activationDomainId: "default",
      bindingGeneration: 2,
      epochId: "mismatch-99",
      epochOrdinal: 2,
      schemaRef: { schemaId: "s", revisionId: "r", digest: "d" },
      policyRef: { policyId: "p", revisionId: "r", digest: "d" },
      handlerManifestRef: { manifestId: "h", digest: "d" },
      runtimeHead: "snap-S0",
      admissionId: "adm-1",
      activatedBy: "bootstrap",
      activatedAt: "2026-08-14T00:00:00Z",
    };
    const imported = importDurableBundle(serialized);
    expect("code" in imported).toBe(true);
    if (!("code" in imported)) return;
    expect(imported.code).toBe("codec_invalid");
    expect(imported.message).toContain("does not match head epoch");
  });
});
