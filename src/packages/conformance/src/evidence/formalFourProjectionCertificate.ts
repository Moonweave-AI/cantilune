import type { ContentDigest } from "@cantilune/core";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { assertSha256HexDigest } from "../canonical/evidenceDigest.js";

/** Formal four-projection certificate: DAG · Petri · π · Morphism. */
export interface FormalFourProjectionCertificate {
  readonly subject: AdmissionSubject;
  readonly dagDigest: ContentDigest;
  readonly petriDigest: ContentDigest;
  readonly piDigest: ContentDigest;
  readonly morphismDigest: ContentDigest;
  readonly sharedExecutionDigest: ContentDigest;
  readonly verifierBuild: string;
  readonly proofManifestRef: string;
  readonly evidenceDigest: ContentDigest;
}

export interface FormalFourProjectionEvidenceBundle {
  readonly subject: AdmissionSubject;
  readonly dagDigest: ContentDigest;
  readonly petriDigest: ContentDigest;
  readonly piDigest: ContentDigest;
  readonly morphismDigest: ContentDigest;
  readonly sharedExecutionDigest: ContentDigest;
  readonly evidenceRef: string;
}

export function formalFourProjectionComplete(bundle: FormalFourProjectionEvidenceBundle): boolean {
  try {
    assertSha256HexDigest(bundle.dagDigest as string, "dagDigest");
    assertSha256HexDigest(bundle.petriDigest as string, "petriDigest");
    assertSha256HexDigest(bundle.piDigest as string, "piDigest");
    assertSha256HexDigest(bundle.morphismDigest as string, "morphismDigest");
    assertSha256HexDigest(bundle.sharedExecutionDigest as string, "sharedExecutionDigest");
  } catch {
    return false;
  }
  return bundle.evidenceRef.length > 0;
}
