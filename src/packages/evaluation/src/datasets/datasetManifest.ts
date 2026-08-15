import type { ContentDigest } from "@cantilune/core";
import type { DatasetId } from "../foundation/evaluationIds.js";
import type { DatasetStatus, PrivacyClassification } from "../foundation/evaluationStatus.js";

export interface DatasetManifest {
  readonly datasetId: DatasetId;
  readonly datasetVersion: number;
  readonly sourceRef: string;
  readonly collectorRef: string;
  readonly collectionDate: string;
  readonly license: string;
  readonly allowedUses: readonly string[];
  readonly attribution: string;
  readonly privacyClassification: PrivacyClassification;
  readonly consentOrLegalBasis: string;
  readonly residencyPolicy: string;
  readonly splitManifestRefs: readonly string[];
  readonly splitDigests: readonly ContentDigest[];
  readonly deduplicationEvidenceRef: string;
  readonly contaminationStatus: ContaminationStatus;
  readonly contaminationMethod: string;
  readonly retentionPolicy: string;
  readonly deletionPolicy: string;
  readonly restrictedArtifactRef: string;
  readonly publicArtifactRef: string;
  readonly privacyReviewStatus: ReviewCheckStatus;
  readonly legalReviewStatus: ReviewCheckStatus;
  readonly manifestDigest: ContentDigest;
  readonly status: DatasetStatus;
}

export type ContaminationStatus = "clean" | "suspected" | "confirmed" | "notChecked";

export type ReviewCheckStatus = "notStarted" | "inProgress" | "approved" | "rejected" | "expired";

/**
 * Strict dataset usability — only clean contamination status allowed for
 * publishable evaluation. suspected/notChecked must be resolved first.
 */
export function isDatasetUsable(manifest: DatasetManifest): boolean {
  return (
    manifest.status === "active" &&
    manifest.contaminationStatus === "clean" &&
    manifest.privacyReviewStatus === "approved" &&
    manifest.legalReviewStatus === "approved"
  );
}
