import type { ContentDigest, Result } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import type {
  EngineeringAdmissionEvidenceBundle,
  EngineeringAdmissionEvidenceSubject,
  EngineeringAdmissionEvidenceInputBundle,
  VerifiedEngineeringAdmissionEvidence,
} from "../evidence/engineeringAdmissionEvidence.js";
import {
  admissionSubjectsMatch,
  engineeringAdmissionEvidenceComplete,
  normalizeEngineeringBundle,
} from "../evidence/engineeringAdmissionEvidence.js";

export const ENGINEERING_ADMISSION_VERIFIER_BUILD = "conformance/3.0-m2";

export interface EngineeringAdmissionVerificationError {
  readonly code: "conformance_missing" | "conformance_invalid" | "conformance_stale";
  readonly message: string;
}

function extractBundleSubject(
  bundle: EngineeringAdmissionEvidenceBundle,
): EngineeringAdmissionEvidenceSubject {
  return {
    admissionId: bundle.admissionId,
    activationDomainId: bundle.activationDomainId,
    fromSchemaRef: bundle.fromSchemaRef,
    toSchemaRef: bundle.toSchemaRef,
    fromEpochId: bundle.fromEpochId,
    toEpochId: bundle.toEpochId,
    fromEpochOrdinal: bundle.fromEpochOrdinal,
    toEpochOrdinal: bundle.toEpochOrdinal,
    extensionPlanDigest: bundle.extensionPlanDigest,
    expectedRuntimeHead: bundle.expectedRuntimeHead,
    expectedBindingGeneration: bundle.expectedBindingGeneration,
  };
}

function verifiedDigest(
  subject: EngineeringAdmissionEvidenceSubject,
  bundle: EngineeringAdmissionEvidenceBundle,
): ContentDigest {
  return computeEvidenceDigest({
    profile: "engineeringAdmission",
    subject,
    facets: {
      dependency: bundle.dependencyDigest,
      resource: bundle.resourceDigest,
      session: bundle.sessionDigest,
      structure: bundle.structureDigest,
    },
    verifierBuild: ENGINEERING_ADMISSION_VERIFIER_BUILD,
    proofManifestRef: bundle.evidenceRef,
  });
}

export function verifyEngineeringAdmissionEvidence(input: {
  readonly bundle: EngineeringAdmissionEvidenceInputBundle;
  readonly subject: EngineeringAdmissionEvidenceSubject;
}): Result<VerifiedEngineeringAdmissionEvidence, EngineeringAdmissionVerificationError> {
  const bundle = normalizeEngineeringBundle(
    input.bundle as EngineeringAdmissionEvidenceBundle & {
      readonly communicationDigest?: ContentDigest;
    },
  );
  if (!engineeringAdmissionEvidenceComplete(bundle)) {
    return err({
      code: "conformance_missing",
      message: "engineering admission evidence bundle incomplete",
    });
  }
  const bundleSubject = extractBundleSubject(bundle);
  if (!admissionSubjectsMatch(bundleSubject, input.subject)) {
    return err({
      code: "conformance_invalid",
      message: "evidence not bound to admission subject",
    });
  }
  if (bundle.fromSchemaRef.digest !== input.subject.fromSchemaRef.digest) {
    return err({ code: "conformance_invalid", message: "from schema digest mismatch" });
  }
  if (bundle.toSchemaRef.digest !== input.subject.toSchemaRef.digest) {
    return err({ code: "conformance_invalid", message: "to schema digest mismatch" });
  }
  if (bundle.fromSchemaRef.schemaId !== input.subject.fromSchemaRef.schemaId) {
    return err({ code: "conformance_stale", message: "schema family mismatch" });
  }
  return ok({
    subject: input.subject,
    dependencyDigest: bundle.dependencyDigest,
    resourceDigest: bundle.resourceDigest,
    sessionDigest: bundle.sessionDigest,
    structureDigest: bundle.structureDigest,
    verifierBuild: ENGINEERING_ADMISSION_VERIFIER_BUILD,
    proofManifestRef: bundle.evidenceRef,
    evidenceDigest: verifiedDigest(input.subject, bundle),
  });
}
