import type { ContentDigest } from "@cantilune/core";
import type {
  DagSemanticEvidence,
  MorphismSemanticEvidence,
  PetriSemanticEvidence,
  PiSemanticEvidence,
} from "../evidence/evidenceFamilies.js";
import type { FormalFourProjectionEvidenceBundle } from "../evidence/formalFourProjectionCertificate.js";
import { formalFourProjectionComplete } from "../evidence/formalFourProjectionCertificate.js";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import { verifyDagSemanticEvidence } from "./dagVerifier.js";
import { verifyMorphismSemanticEvidence } from "./morphismVerifier.js";
import { verifyPetriSemanticEvidence } from "./petriVerifier.js";
import { verifyPiSemanticEvidence } from "./piVerifier.js";

export interface FourProjectionSemanticBundle {
  readonly dag: { readonly semantic: DagSemanticEvidence; readonly digest: ContentDigest };
  readonly petri: { readonly semantic: PetriSemanticEvidence; readonly digest: ContentDigest };
  readonly pi: { readonly semantic: PiSemanticEvidence; readonly digest: ContentDigest };
  readonly morphism: {
    readonly semantic: MorphismSemanticEvidence;
    readonly digest: ContentDigest;
  };
}

export function computeFourProjectionBundleDigest(
  bundle: FormalFourProjectionEvidenceBundle,
): ContentDigest {
  return computeEvidenceDigest({
    profile: "fourProjection",
    subject: bundle.subject,
    projections: {
      dag: bundle.dagDigest,
      petri: bundle.petriDigest,
      pi: bundle.piDigest,
      morphism: bundle.morphismDigest,
    },
    sharedExecution: bundle.sharedExecutionDigest,
  });
}

/** Orchestrates DAG · Petri · π · Morphism projection verification. */
export function verifyFourProjections(input: {
  readonly subject: AdmissionSubject;
  readonly semantics: FourProjectionSemanticBundle;
  readonly bundle?: FormalFourProjectionEvidenceBundle;
}): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  violations.push(
    ...verifyDagSemanticEvidence({
      semantic: input.semantics.dag.semantic,
      digest: input.semantics.dag.digest,
      subject: input.subject,
    }),
    ...verifyPetriSemanticEvidence({
      semantic: input.semantics.petri.semantic,
      digest: input.semantics.petri.digest,
      subject: input.subject,
    }),
    ...verifyPiSemanticEvidence({
      semantic: input.semantics.pi.semantic,
      digest: input.semantics.pi.digest,
      subject: input.subject,
    }),
    ...verifyMorphismSemanticEvidence({
      semantic: input.semantics.morphism.semantic,
      digest: input.semantics.morphism.digest,
      subject: input.subject,
    }),
  );

  if (input.bundle === undefined) {
    return violations;
  }

  if (!formalFourProjectionComplete(input.bundle)) {
    violations.push(
      conformanceViolation("projection_invalid", "formal four-projection bundle incomplete"),
    );
    return violations;
  }

  const bundleSubject = input.bundle.subject;
  if (
    bundleSubject.admissionId !== input.subject.admissionId ||
    bundleSubject.activationDomainId !== input.subject.activationDomainId ||
    bundleSubject.fromEpochId !== input.subject.fromEpochId ||
    bundleSubject.toEpochId !== input.subject.toEpochId
  ) {
    violations.push(
      conformanceViolation(
        "subject_mismatch",
        "four-projection bundle subject does not match verification subject",
        "bundle.subject",
      ),
    );
  }

  const digestPairs: Array<{
    readonly label: "dag" | "petri" | "pi" | "morphism";
    readonly bundleDigest: ContentDigest;
    readonly semanticDigest: ContentDigest;
  }> = [
    {
      label: "dag",
      bundleDigest: input.bundle.dagDigest,
      semanticDigest: input.semantics.dag.digest,
    },
    {
      label: "petri",
      bundleDigest: input.bundle.petriDigest,
      semanticDigest: input.semantics.petri.digest,
    },
    { label: "pi", bundleDigest: input.bundle.piDigest, semanticDigest: input.semantics.pi.digest },
    {
      label: "morphism",
      bundleDigest: input.bundle.morphismDigest,
      semanticDigest: input.semantics.morphism.digest,
    },
  ];

  for (const pair of digestPairs) {
    if ((pair.bundleDigest as string) !== (pair.semanticDigest as string)) {
      violations.push(
        conformanceViolation(
          "digest_mismatch",
          `${pair.label} bundle digest does not match semantic projection digest`,
          `bundle.${pair.label}Digest`,
        ),
      );
    }
  }

  return violations;
}
