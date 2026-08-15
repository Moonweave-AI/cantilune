import type { ConformanceProfile } from "./conformanceProfile.js";

/** C0–C9 evidence classes — requirement set, not integer rank. */
export type EvidenceClass =
  | "C0_candidateManifest"
  | "C1_ruleInventory"
  | "C2_proofManifest"
  | "C3_theoryBaseline"
  | "C4_operationalProjection"
  | "C5_fourProjectionSemantics"
  | "C6_replayRecipe"
  | "C7_crossEpochChain"
  | "C8_engineeringAdmission"
  | "C9_releaseCertificate";

export const PROFILE_EVIDENCE_REQUIREMENTS: Record<ConformanceProfile, readonly EvidenceClass[]> = {
  operationalProjection: ["C0_candidateManifest", "C4_operationalProjection"],
  completeProjection: [
    "C0_candidateManifest",
    "C4_operationalProjection",
    "C5_fourProjectionSemantics",
  ],
  fourProjection: [
    "C0_candidateManifest",
    "C2_proofManifest",
    "C3_theoryBaseline",
    "C5_fourProjectionSemantics",
  ],
  engineeringAdmission: ["C0_candidateManifest", "C8_engineeringAdmission"],
  fixedEpochRule: ["C0_candidateManifest", "C1_ruleInventory", "C6_replayRecipe"],
  crossEpochProduct: ["C0_candidateManifest", "C7_crossEpochChain", "C8_engineeringAdmission"],
  canonicalProtocol: [
    "C0_candidateManifest",
    "C4_operationalProjection",
    "C5_fourProjectionSemantics",
    "C7_crossEpochChain",
    "C8_engineeringAdmission",
  ],
  canonicalProtocolWithFms: [
    "C0_candidateManifest",
    "C4_operationalProjection",
    "C5_fourProjectionSemantics",
    "C7_crossEpochChain",
    "C8_engineeringAdmission",
    "C2_proofManifest",
  ],
  fullProductTrajectory: [
    "C0_candidateManifest",
    "C1_ruleInventory",
    "C2_proofManifest",
    "C3_theoryBaseline",
    "C4_operationalProjection",
    "C5_fourProjectionSemantics",
    "C6_replayRecipe",
    "C7_crossEpochChain",
    "C8_engineeringAdmission",
    "C9_releaseCertificate",
  ],
};

export function profileSatisfiesRequirements(
  holder: ConformanceProfile,
  required: ConformanceProfile,
): boolean {
  const requiredClasses = PROFILE_EVIDENCE_REQUIREMENTS[required];
  const holderSet = new Set(PROFILE_EVIDENCE_REQUIREMENTS[holder]);
  return requiredClasses.every((evidenceClass) => holderSet.has(evidenceClass));
}
