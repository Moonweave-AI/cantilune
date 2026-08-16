import type { ContentDigest } from "@cantilune/core";
import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import type {
  DagSemanticEvidence,
  MorphismSemanticEvidence,
  PetriSemanticEvidence,
  PiSemanticEvidence,
} from "./evidenceFamilies.js";
import type { AdmissionSubject } from "../subject/admissionSubject.js";
import {
  computeDagSemanticDigest,
  verifyDagSemanticEvidence,
} from "../verifier/dagVerifier.js";
import { computePetriSemanticDigest, verifyPetriSemanticEvidence } from "../verifier/petriVerifier.js";
import { computePiSemanticDigest, verifyPiSemanticEvidence } from "../verifier/piVerifier.js";
import {
  computeMorphismSemanticDigest,
  verifyMorphismSemanticEvidence,
} from "../verifier/morphismVerifier.js";
import type { ConformanceViolation } from "../foundation/conformanceViolation.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";

/**
 * Minimal committed-world view shapes from @cantilune/observability FourViewBundle.
 * Kept structural (no hard import) so conformance stays buildable without the peer.
 */
export interface CommittedWorldProjectionViews {
  readonly dependency: unknown;
  readonly resource: unknown;
  readonly communication: unknown;
  readonly structure: unknown;
  readonly spine?: unknown;
}

/**
 * Recompute C5 four-projection semantic digests from a committed-world
 * observability cut — not shape-only stubs.
 */
export function recomputeFourProjectionSemanticsFromWorld(input: {
  readonly subject: AdmissionSubject;
  readonly views: CommittedWorldProjectionViews;
}): {
  readonly dag: { readonly semantic: DagSemanticEvidence; readonly digest: ContentDigest };
  readonly petri: { readonly semantic: PetriSemanticEvidence; readonly digest: ContentDigest };
  readonly pi: { readonly semantic: PiSemanticEvidence; readonly digest: ContentDigest };
  readonly morphism: {
    readonly semantic: MorphismSemanticEvidence;
    readonly digest: ContentDigest;
  };
} {
  const { subject, views } = input;

  const dagSemantic: DagSemanticEvidence = {
    configDigest: computeEvidenceDigest({ lens: "dependency", view: views.dependency }),
    sccDigest: computeEvidenceDigest({ lens: "dependency-scc", view: views.dependency }),
    rankDigest: computeEvidenceDigest({ lens: "dependency-rank", spine: views.spine }),
    edgeCoverageDigest: computeEvidenceDigest({
      lens: "dependency-edges",
      view: views.dependency,
    }),
  };
  const petriSemantic: PetriSemanticEvidence = {
    declarationDigest: computeEvidenceDigest({ lens: "structure", view: views.structure }),
    markingDigest: computeEvidenceDigest({ lens: "resource", view: views.resource }),
    firingDigest: computeEvidenceDigest({ lens: "spine-firing", spine: views.spine }),
    registryDigest: computeEvidenceDigest({ lens: "structure-registry", view: views.structure }),
  };
  const piSemantic: PiSemanticEvidence = {
    nativeStepDigest: computeEvidenceDigest({ lens: "communication", view: views.communication }),
    actionDigest: computeEvidenceDigest({ lens: "communication-actions", view: views.communication }),
    freshnessDigest: computeEvidenceDigest({ lens: "spine-freshness", spine: views.spine }),
    registryDigest: computeEvidenceDigest({
      lens: "communication-registry",
      view: views.communication,
    }),
  };
  const morphismSemantic: MorphismSemanticEvidence = {
    mappingDigest: computeEvidenceDigest({ lens: "morphism-mapping", views }),
    structureDigest: computeEvidenceDigest({ lens: "morphism-structure", views }),
  };

  return {
    dag: {
      semantic: dagSemantic,
      digest: computeDagSemanticDigest({ semantic: dagSemantic, subject }),
    },
    petri: {
      semantic: petriSemantic,
      digest: computePetriSemanticDigest({ semantic: petriSemantic, subject }),
    },
    pi: {
      semantic: piSemantic,
      digest: computePiSemanticDigest({ semantic: piSemantic, subject }),
    },
    morphism: {
      semantic: morphismSemantic,
      digest: computeMorphismSemanticDigest({ semantic: morphismSemantic, subject }),
    },
  };
}

/** Verify claimed digests against recomputation from committed-world views. */
export function verifyFourProjectionsFromCommittedWorld(input: {
  readonly subject: AdmissionSubject;
  readonly views: CommittedWorldProjectionViews;
  readonly claimed: {
    readonly dagDigest: ContentDigest;
    readonly petriDigest: ContentDigest;
    readonly piDigest: ContentDigest;
    readonly morphismDigest: ContentDigest;
  };
}): ConformanceViolation[] {
  const recomputed = recomputeFourProjectionSemanticsFromWorld(input);
  const violations: ConformanceViolation[] = [];

  violations.push(
    ...verifyDagSemanticEvidence({
      semantic: recomputed.dag.semantic,
      digest: recomputed.dag.digest,
      subject: input.subject,
    }),
    ...verifyPetriSemanticEvidence({
      semantic: recomputed.petri.semantic,
      digest: recomputed.petri.digest,
      subject: input.subject,
    }),
    ...verifyPiSemanticEvidence({
      semantic: recomputed.pi.semantic,
      digest: recomputed.pi.digest,
      subject: input.subject,
    }),
    ...verifyMorphismSemanticEvidence({
      semantic: recomputed.morphism.semantic,
      digest: recomputed.morphism.digest,
      subject: input.subject,
    }),
  );

  const pairs: Array<{
    label: string;
    claimed: ContentDigest;
    recomputed: ContentDigest;
  }> = [
    { label: "dag", claimed: input.claimed.dagDigest, recomputed: recomputed.dag.digest },
    { label: "petri", claimed: input.claimed.petriDigest, recomputed: recomputed.petri.digest },
    { label: "pi", claimed: input.claimed.piDigest, recomputed: recomputed.pi.digest },
    {
      label: "morphism",
      claimed: input.claimed.morphismDigest,
      recomputed: recomputed.morphism.digest,
    },
  ];

  for (const pair of pairs) {
    if ((pair.claimed as string) !== (pair.recomputed as string)) {
      violations.push(
        conformanceViolation(
          "digest_mismatch",
          `${pair.label} claimed digest does not match recomputation from committed world`,
          `claimed.${pair.label}Digest`,
        ),
      );
    }
  }

  return violations;
}
