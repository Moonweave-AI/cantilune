import { describe, expect, it } from "vitest";
import { contentDigest, handlerManifestId, operationTypeId } from "@cantilune/core";
import {
  createHandlerManifest,
  validateHandlerManifestAgainstSchema,
} from "../../../src/manifest/handlerManifest.js";
import { buildAdmissionHarness } from "../../support/buildAdmissionHarness.js";

describe("handler manifest", () => {
  it("creates manifest with canonical digest", () => {
    const manifest = createHandlerManifest({
      manifestId: handlerManifestId("handlers-a"),
      bindings: [
        {
          operationTypeId: operationTypeId("introduce_artifact"),
          templateRef: buildAdmissionHarness().genesisRevision.schema.templates[0]!.templateRef,
          handlerRevision: "1",
          artifactRef: "artifact://introduce",
          artifactDigest: contentDigest("artifact-introduce"),
          runtimeCompatibility: "runtime/1",
        },
      ],
      createdAt: "2026-08-11T00:00:00Z",
    });
    expect(manifest.manifestRef.manifestId).toBe("handlers-a");
    expect(manifest.canonicalDigest).toBeDefined();
  });

  it("rejects missing operation binding", () => {
    const harness = buildAdmissionHarness();
    const manifest = createHandlerManifest({
      manifestId: handlerManifestId("handlers-b"),
      bindings: [],
      createdAt: "2026-08-11T00:00:00Z",
    });
    const result = validateHandlerManifestAgainstSchema(manifest, [
      harness.genesisRevision.schema.templates[0]!.operationTypeId,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("handler_manifest_mismatch");
  });

  it("rejects empty artifact digest", () => {
    const harness = buildAdmissionHarness();
    const template = harness.genesisRevision.schema.templates[0]!;
    const manifest = createHandlerManifest({
      manifestId: handlerManifestId("handlers-c"),
      bindings: [
        {
          operationTypeId: template.operationTypeId,
          templateRef: template.templateRef,
          handlerRevision: "1",
          artifactRef: "artifact://x",
          artifactDigest: contentDigest(""),
          runtimeCompatibility: "runtime/1",
        },
      ],
      createdAt: "2026-08-11T00:00:00Z",
    });
    const result = validateHandlerManifestAgainstSchema(manifest, [template.operationTypeId]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("empty artifact digest");
  });

  it("accepts complete manifest coverage", () => {
    const harness = buildAdmissionHarness();
    const manifest = createHandlerManifest({
      manifestId: handlerManifestId("handlers-d"),
      bindings: harness.genesisRevision.schema.templates.map((template) => ({
        operationTypeId: template.operationTypeId,
        templateRef: template.templateRef,
        handlerRevision: template.templateRef.revision,
        artifactRef: `artifact://${template.operationTypeId}`,
        artifactDigest: contentDigest(`artifact-${template.operationTypeId}`),
        runtimeCompatibility: "runtime/1",
      })),
      createdAt: "2026-08-11T00:00:00Z",
    });
    const operationIds = harness.genesisRevision.schema.templates.map((t) => t.operationTypeId);
    expect(validateHandlerManifestAgainstSchema(manifest, operationIds).ok).toBe(true);
  });
});
