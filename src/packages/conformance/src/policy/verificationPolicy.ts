import type { ClaimScope, ConformanceProfile } from "../foundation/conformanceProfile.js";
import { profileSatisfiesRequirements } from "../foundation/conformanceProfile.js";

export interface VerificationPolicy {
  readonly policyVersion: string;
  readonly policyDigest: string;
  readonly allowedClaimScopes: readonly ClaimScope[];
  readonly minimumProfile: ConformanceProfile;
  readonly requireHumanReview: boolean;
  readonly maxRuleCount: number;
}

export const DEFAULT_VERIFICATION_POLICY: VerificationPolicy = {
  policyVersion: "conformance-policy/m2",
  policyDigest: "0000000000000000000000000000000000000000000000000000000000000000",
  allowedClaimScopes: ["generic", "reference"],
  minimumProfile: "engineeringAdmission",
  requireHumanReview: true,
  maxRuleCount: 10_000,
};

export function policyAllowsScope(policy: VerificationPolicy, scope: ClaimScope): boolean {
  return policy.allowedClaimScopes.includes(scope);
}

export function policyAllowsProfile(
  policy: VerificationPolicy,
  profile: ConformanceProfile,
): boolean {
  return profileSatisfiesRequirements(profile, policy.minimumProfile);
}
