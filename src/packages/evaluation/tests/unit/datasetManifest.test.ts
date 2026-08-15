import { describe, it, expect } from "vitest";
import { isDatasetUsable } from "../../src/datasets/datasetManifest.js";
import type { DatasetManifest } from "../../src/datasets/datasetManifest.js";
import { datasetId } from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeDataset(overrides: Partial<DatasetManifest> = {}): DatasetManifest {
  return {
    datasetId: datasetId("d1"),
    datasetVersion: 1,
    sourceRef: "source-1",
    collectorRef: "collector-1",
    collectionDate: "2026-01-01",
    license: "CC-BY-4.0",
    allowedUses: ["evaluation"],
    attribution: "Cantilune project",
    privacyClassification: "public",
    consentOrLegalBasis: "public",
    residencyPolicy: "us",
    splitManifestRefs: [],
    splitDigests: [],
    deduplicationEvidenceRef: "dedup-1",
    contaminationStatus: "clean",
    contaminationMethod: "fingerprint",
    retentionPolicy: "1y",
    deletionPolicy: "on-request",
    restrictedArtifactRef: "",
    publicArtifactRef: "public-1",
    privacyReviewStatus: "approved",
    legalReviewStatus: "approved",
    manifestDigest: d("md"),
    status: "active",
    ...overrides,
  };
}

describe("DatasetManifest", () => {
  it("is usable when active with clean contamination and approvals", () => {
    expect(isDatasetUsable(makeDataset())).toBe(true);
  });

  it("is not usable when contaminated", () => {
    expect(isDatasetUsable(makeDataset({ contaminationStatus: "confirmed" }))).toBe(false);
  });

  it("is not usable when suspected contamination", () => {
    expect(isDatasetUsable(makeDataset({ contaminationStatus: "suspected" }))).toBe(false);
  });

  it("is not usable when contamination not checked", () => {
    expect(isDatasetUsable(makeDataset({ contaminationStatus: "notChecked" }))).toBe(false);
  });

  it("is not usable when privacy not approved", () => {
    expect(isDatasetUsable(makeDataset({ privacyReviewStatus: "notStarted" }))).toBe(false);
  });

  it("is not usable when legal not approved", () => {
    expect(isDatasetUsable(makeDataset({ legalReviewStatus: "rejected" }))).toBe(false);
  });

  it("is not usable when not active", () => {
    expect(isDatasetUsable(makeDataset({ status: "quarantined" }))).toBe(false);
  });
});
