import type { ContentDigest } from "@cantilune/core";

export interface ArtifactSubject {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly commitSha: string;
  readonly treeDigest: ContentDigest;
  readonly artifactDigest: ContentDigest;
  readonly lockfileDigest: ContentDigest;
  readonly toolchainDigest: ContentDigest;
  readonly buildProvenanceDigest: ContentDigest;
}

export interface ProductReleaseSubject {
  readonly artifactSubject: ArtifactSubject;
  readonly releaseChannel: string;
  readonly releaseOrdinal: number;
}
