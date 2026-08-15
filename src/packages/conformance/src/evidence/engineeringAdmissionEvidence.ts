import type { ContentDigest } from "@cantilune/core";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { admissionSubjectsEqual } from "../subject/admissionSubjectEquality.js";
import { assertSha256HexDigest } from "../canonical/evidenceDigest.js";

/**
 * Engineering admission evidence — dependency/resource/session/structure facets
 * for observability/control-plane admission observation.
 *
 * NOT the formal DAG/Petri/π/Morphism four-projection certificate.
 */
export interface EngineeringAdmissionEvidenceBundle extends AdmissionSubject {
  readonly dependencyDigest: ContentDigest;
  readonly resourceDigest: ContentDigest;
  readonly sessionDigest: ContentDigest;
  readonly structureDigest: ContentDigest;
  readonly verifierVersion: string;
  readonly evidenceRef: string;
}

/** Legacy bundles may supply communicationDigest instead of sessionDigest. */
export type EngineeringAdmissionEvidenceInputBundle = Omit<
  EngineeringAdmissionEvidenceBundle,
  "sessionDigest"
> & {
  readonly sessionDigest?: ContentDigest;
  readonly communicationDigest?: ContentDigest;
};

/** @deprecated Use EngineeringAdmissionEvidenceBundle */
export type FourViewEvidenceBundle = EngineeringAdmissionEvidenceBundle;

export type EngineeringAdmissionEvidenceSubject = AdmissionSubject;

/** @deprecated Use AdmissionSubject */
export type FourViewEvidenceSubject = AdmissionSubject;

export interface VerifiedEngineeringAdmissionEvidence {
  readonly subject: EngineeringAdmissionEvidenceSubject;
  readonly dependencyDigest: ContentDigest;
  readonly resourceDigest: ContentDigest;
  readonly sessionDigest: ContentDigest;
  readonly structureDigest: ContentDigest;
  readonly verifierBuild: string;
  readonly proofManifestRef: string;
  readonly evidenceDigest: ContentDigest;
}

/** @deprecated Use VerifiedEngineeringAdmissionEvidence */
export type VerifiedFourViewEvidence = VerifiedEngineeringAdmissionEvidence;

export function engineeringAdmissionEvidenceComplete(
  bundle: EngineeringAdmissionEvidenceBundle,
): boolean {
  try {
    assertSha256HexDigest(bundle.dependencyDigest as string, "dependencyDigest");
    assertSha256HexDigest(bundle.resourceDigest as string, "resourceDigest");
    assertSha256HexDigest(bundle.sessionDigest as string, "sessionDigest");
    assertSha256HexDigest(bundle.structureDigest as string, "structureDigest");
  } catch {
    return false;
  }
  return (
    bundle.admissionId.length > 0 &&
    bundle.activationDomainId.length > 0 &&
    bundle.extensionPlanDigest.length > 0 &&
    bundle.expectedRuntimeHead.length > 0 &&
    bundle.expectedBindingGeneration >= 0
  );
}

/** @deprecated Use engineeringAdmissionEvidenceComplete */
export const fourViewEvidenceComplete = engineeringAdmissionEvidenceComplete;

export function admissionSubjectsMatch(left: AdmissionSubject, right: AdmissionSubject): boolean {
  return admissionSubjectsEqual(left, right);
}

/** @deprecated Use admissionSubjectsMatch */
export const subjectsMatch = admissionSubjectsMatch;

/** Backward-compat: old bundles used communicationDigest instead of sessionDigest. */
export function normalizeEngineeringBundle(
  bundle: EngineeringAdmissionEvidenceBundle & {
    readonly communicationDigest?: ContentDigest;
  },
): EngineeringAdmissionEvidenceBundle {
  if ("sessionDigest" in bundle && bundle.sessionDigest !== undefined) {
    return bundle;
  }
  const legacy = bundle as EngineeringAdmissionEvidenceBundle & {
    communicationDigest: ContentDigest;
  };
  return {
    ...bundle,
    sessionDigest: legacy.communicationDigest,
  };
}

export type { SchemaRef } from "@cantilune/core";
