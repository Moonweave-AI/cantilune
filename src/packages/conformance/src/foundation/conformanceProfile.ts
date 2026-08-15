import { profileSatisfiesRequirements } from "./profileEvidenceRequirements.js";

/** Verification profiles — each may only claim its own scope. */
export type ConformanceProfile =
  | "operationalProjection"
  | "completeProjection"
  | "fourProjection"
  | "fixedEpochRule"
  | "crossEpochProduct"
  | "canonicalProtocol"
  | "canonicalProtocolWithFms"
  | "fullProductTrajectory"
  | "engineeringAdmission";

export type ClaimScope = "generic" | "reference" | "product";

export { profileSatisfiesRequirements } from "./profileEvidenceRequirements.js";

/** @deprecated Use profileSatisfiesRequirements — integer rank conflates orthogonal profiles. */
export const PROFILE_RANK: Record<ConformanceProfile, number> = {
  operationalProjection: 1,
  completeProjection: 2,
  fourProjection: 3,
  engineeringAdmission: 4,
  fixedEpochRule: 5,
  crossEpochProduct: 6,
  canonicalProtocol: 7,
  canonicalProtocolWithFms: 8,
  fullProductTrajectory: 9,
};

/** @deprecated Use profileSatisfiesRequirements. */
export function profilePermits(holder: ConformanceProfile, required: ConformanceProfile): boolean {
  return profileSatisfiesRequirements(holder, required);
}
