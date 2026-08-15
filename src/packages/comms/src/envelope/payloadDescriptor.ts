import { type ContentDigest, type ContentRef } from "@cantilune/core";

export type PayloadClassification = "public" | "internal" | "restricted" | "credential";

export interface PayloadDescriptor {
  readonly contentRef: ContentRef;
  readonly contentDigest: ContentDigest;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly classification: PayloadClassification;
  readonly encryptionMetadataRef?: string;
}
