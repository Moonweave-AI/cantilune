import type { Result, ContentDigest } from "@cantilune/core";
import { err, ok } from "@cantilune/core";
import { verificationRunId } from "../foundation/conformanceId.js";
import type { ConformanceProfile } from "../foundation/conformanceProfile.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import type { VerificationDecision } from "../foundation/verificationDecision.js";
import { initialConformanceStatus } from "../foundation/conformanceStatus.js";
import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import type { RuleInventory } from "../manifest/ruleInventory.js";
import {
  verifyEngineeringAdmissionEvidence,
  ENGINEERING_ADMISSION_VERIFIER_BUILD,
} from "../verifier/engineeringAdmissionVerifier.js";
import type {
  EngineeringAdmissionEvidenceBundle,
  EngineeringAdmissionEvidenceSubject,
} from "../evidence/engineeringAdmissionEvidence.js";
import type {
  CommonTrajectoryEvidence,
  CrossEpochEvidence,
  FormalAdmissionEvidence,
  OperationalProjectionEvidence,
  ReplayEvidence,
} from "../evidence/evidenceFamilies.js";
import type { FormalFourProjectionEvidenceBundle } from "../evidence/formalFourProjectionCertificate.js";
import type {
  AdmissionSubject,
  RuleOccurrenceSubject,
  TrajectorySubject,
} from "../subject/admissionSubject.js";
import {
  verifyCrossEpochAdmission,
  verifyCrossEpochEvidence,
  verifyFormalAdmissionEvidence,
  verifyOperationalProjectionEvidence,
} from "../verifier/admissionVerifier.js";
import {
  verifyFourProjections,
  computeFourProjectionBundleDigest,
  type FourProjectionSemanticBundle,
} from "../verifier/projectionVerifier.js";
import {
  verifyProbabilityEvidence,
  type ProbabilityEvidenceBundle,
} from "../verifier/probabilityVerifier.js";
import { verifyReplayEvidence } from "../verifier/replayVerifier.js";
import { verifyTrajectoryEvidence } from "../verifier/trajectoryVerifier.js";
import {
  policyAllowsProfile,
  policyAllowsScope,
  type VerificationPolicy,
  DEFAULT_VERIFICATION_POLICY,
} from "../policy/verificationPolicy.js";
import type { EvidenceStore } from "../ports/evidenceStore.js";
import type { TrustStore } from "../ports/trustStore.js";
import type { RevocationStore } from "../ports/revocationStore.js";
import type { VerificationCache, VerificationCacheKey } from "../ports/verificationCache.js";
import { cacheKeyString } from "../ports/verificationCache.js";
import type { AuditSink } from "../ports/auditSink.js";
import type { DpoReplayPort } from "../ports/dpoReplayPort.js";
import { computeEvidenceDigest } from "../canonical/evidenceDigest.js";
import { verifyPackageEvidence } from "../verifier/packageVerifier.js";
import {
  verifyDpoReplayWithPort,
  type DpoReplayExecutionEvidence,
} from "../verifier/dpoReplayVerifier.js";

let verificationRunCounter = 0;

function nextRunId(prefix: string, now: string): ReturnType<typeof verificationRunId> {
  verificationRunCounter += 1;
  return verificationRunId(`${prefix}-${now}-${verificationRunCounter}`);
}

export interface ConformanceEngineDeps {
  readonly evidenceStore: EvidenceStore;
  readonly trustStore: TrustStore;
  readonly revocationStore: RevocationStore;
  readonly cache: VerificationCache;
  readonly audit: AuditSink;
  readonly dpoReplayPort?: DpoReplayPort;
  readonly policy?: VerificationPolicy;
  readonly now?: () => string;
}

function fail(
  violations: ConformanceViolation[],
): Result<VerificationDecision, ConformanceViolation[]> {
  return err(violations);
}

function success(
  profile: ConformanceProfile,
  evidenceRootDigest: string,
  now: string,
  cacheKey?: string,
): VerificationDecision {
  const decision: VerificationDecision = {
    runId: nextRunId(`run-${profile}`, now),
    profile,
    status: {
      ...initialConformanceStatus(),
      machine: "verified",
      humanReview: "pending",
      release: "notEvaluated",
    },
    violations: [],
    evidenceRootDigest,
    decidedAt: now,
  };
  return cacheKey === undefined ? decision : { ...decision, cacheKey };
}

function cachedDecision(
  deps: ConformanceEngineDeps,
  key: VerificationCacheKey,
): VerificationDecision | undefined {
  return deps.cache.get(key);
}

export function createConformanceEngine(deps: ConformanceEngineDeps) {
  const policy = deps.policy ?? DEFAULT_VERIFICATION_POLICY;
  const now = deps.now ?? (() => new Date().toISOString());

  return {
    inspectCandidate(
      manifest: ConformanceTargetManifest,
    ): Result<VerificationDecision, ConformanceViolation[]> {
      const violations: ConformanceViolation[] = [];
      if (!policyAllowsScope(policy, manifest.claimScope)) {
        violations.push(
          conformanceViolation(
            "scope_escalation",
            `claim scope ${manifest.claimScope} not allowed`,
          ),
        );
      }
      if (!policyAllowsProfile(policy, manifest.requestedProfile)) {
        violations.push(
          conformanceViolation("profile_insufficient", "requested profile exceeds policy minimum"),
        );
      }
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok({
        runId: verificationRunId(`inspect-${now()}`),
        profile: manifest.requestedProfile,
        status: initialConformanceStatus(),
        violations: [],
        evidenceRootDigest: manifest.evidenceRootDigest,
        decidedAt: now(),
      });
    },

    verifyEngineeringAdmission(input: {
      readonly bundle: EngineeringAdmissionEvidenceBundle & {
        readonly communicationDigest?: ContentDigest;
      };
      readonly subject: EngineeringAdmissionEvidenceSubject;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const verified = verifyEngineeringAdmissionEvidence(input);
      if (!verified.ok) {
        return fail([
          conformanceViolation(
            verified.error.code === "conformance_missing"
              ? "missing_evidence"
              : "admission_invalid",
            verified.error.message,
          ),
        ]);
      }
      return ok({
        runId: verificationRunId(`eadm-${now()}`),
        profile: "engineeringAdmission",
        status: {
          ...initialConformanceStatus(),
          machine: "verified",
          humanReview: "pending",
          release: "notEvaluated",
        },
        violations: [],
        evidenceRootDigest: verified.value.evidenceDigest as string,
        decidedAt: now(),
      });
    },

    /** @deprecated Use verifyEngineeringAdmission */
    verifyFourViewEvidence(input: {
      readonly bundle: EngineeringAdmissionEvidenceBundle & {
        readonly communicationDigest?: ContentDigest;
      };
      readonly subject: EngineeringAdmissionEvidenceSubject;
    }) {
      return this.verifyEngineeringAdmission(input);
    },

    verifyReplay(input: {
      readonly evidence: ReplayEvidence;
      readonly subject: RuleOccurrenceSubject;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const violations = verifyReplayEvidence(input);
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok(success("fixedEpochRule", input.evidence.replayDigest as string, now()));
    },

    async verifyDpoReplay(input: {
      readonly evidence: DpoReplayExecutionEvidence;
      readonly subject: RuleOccurrenceSubject;
    }): Promise<Result<VerificationDecision, ConformanceViolation[]>> {
      if (deps.dpoReplayPort === undefined) {
        return fail([
          conformanceViolation(
            "tool_unavailable",
            "DPO replay port not configured on conformance engine",
          ),
        ]);
      }
      const violations = await verifyDpoReplayWithPort({
        evidence: input.evidence,
        subject: input.subject,
        replayPort: deps.dpoReplayPort,
      });
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok(success("fixedEpochRule", input.evidence.replayDigest as string, now()));
    },

    verifyOperationalProjection(input: {
      readonly evidence: OperationalProjectionEvidence;
      readonly evidenceDigest: ContentDigest;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const violations = verifyOperationalProjectionEvidence(input);
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok(success("operationalProjection", input.evidenceDigest as string, now()));
    },

    verifyFourProjection(input: {
      readonly bundle: FormalFourProjectionEvidenceBundle;
      readonly semantics: FourProjectionSemanticBundle;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      if (input.semantics === undefined) {
        return fail([
          conformanceViolation(
            "projection_invalid",
            "four-projection verification requires semantic evidence bundle",
          ),
        ]);
      }

      const violations = verifyFourProjections({
        subject: input.bundle.subject,
        semantics: input.semantics,
        bundle: input.bundle,
      });
      if (violations.length > 0) {
        return fail(violations);
      }
      const digest = computeFourProjectionBundleDigest(input.bundle);
      return ok(success("fourProjection", digest as string, now()));
    },

    verifyAdmission(input: {
      readonly subject: AdmissionSubject;
      readonly admission: FormalAdmissionEvidence;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const violations = verifyFormalAdmissionEvidence(input);
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok(success("crossEpochProduct", input.admission.admissionDigest as string, now()));
    },

    verifyEpochChain(input: {
      readonly subject: AdmissionSubject;
      readonly epochChain: CrossEpochEvidence;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const violations = verifyCrossEpochEvidence(input);
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok(success("crossEpochProduct", input.epochChain.chainDigest as string, now()));
    },

    verifyTrajectory(input: {
      readonly subject: TrajectorySubject;
      readonly evidence: CommonTrajectoryEvidence;
      readonly evidenceDigest: ContentDigest;
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const violations = verifyTrajectoryEvidence(input);
      if (violations.length > 0) {
        return fail(violations);
      }
      return ok(success("fullProductTrajectory", input.evidenceDigest as string, now()));
    },

    verifyCanonicalProtocol(input: {
      readonly operational: {
        readonly evidence: OperationalProjectionEvidence;
        readonly evidenceDigest: ContentDigest;
      };
      readonly probability: {
        readonly bundle: ProbabilityEvidenceBundle;
        readonly evidenceDigest: ContentDigest;
      };
      readonly admission: {
        readonly subject: AdmissionSubject;
        readonly admission: FormalAdmissionEvidence;
        readonly epochChain: CrossEpochEvidence;
      };
    }): Result<VerificationDecision, ConformanceViolation[]> {
      const violations: ConformanceViolation[] = [];

      violations.push(
        ...verifyOperationalProjectionEvidence(input.operational),
        ...verifyProbabilityEvidence(input.probability),
        ...verifyCrossEpochAdmission({
          admission: input.admission.admission,
          epochChain: input.admission.epochChain,
          subject: input.admission.subject,
        }),
      );

      if (violations.length > 0) {
        return fail(violations);
      }

      const rootDigest = computeEvidenceDigest({
        profile: "canonicalProtocol",
        operationalDigest: input.operational.evidenceDigest,
        probabilityDigest: input.probability.evidenceDigest,
        admissionDigest: input.admission.admission.admissionDigest,
        epochChainDigest: input.admission.epochChain.chainDigest,
      });
      return ok(success("canonicalProtocol", rootDigest as string, now()));
    },

    async verifyPackage(input: {
      readonly manifest: ConformanceTargetManifest;
      readonly inventory: RuleInventory;
      readonly observedRuleIds: readonly string[];
      readonly evidenceArtifactDigests: readonly string[];
    }): Promise<Result<VerificationDecision, ConformanceViolation[]>> {
      const packageViolations = await verifyPackageEvidence(
        {
          manifest: input.manifest,
          inventory: input.inventory,
          observedRuleIds: input.observedRuleIds,
          evidenceArtifactDigests: input.evidenceArtifactDigests,
        },
        {
          evidenceStore: deps.evidenceStore,
          trustStore: deps.trustStore,
          revocationStore: deps.revocationStore,
          policy,
        },
      );
      if (packageViolations.length > 0) {
        return fail(packageViolations);
      }
      const key: VerificationCacheKey = {
        subjectDigest: input.manifest.evidenceRootDigest,
        evidenceRootDigest: input.manifest.evidenceRootDigest,
        verifierBuild: ENGINEERING_ADMISSION_VERIFIER_BUILD,
        policyVersion: policy.policyVersion,
        trustRootSetVersion: deps.trustStore.version,
        revocationCheckpoint: deps.revocationStore.checkpoint,
      };
      const cached = cachedDecision(deps, key);
      if (cached !== undefined) {
        return ok({ ...cached, cacheKey: cacheKeyString(key) });
      }
      const decision = success(
        input.manifest.requestedProfile,
        input.manifest.evidenceRootDigest,
        now(),
        cacheKeyString(key),
      );
      deps.cache.set(key, decision);
      deps.audit.emit({
        kind: "verification_completed",
        runId: decision.runId as string,
        profile: decision.profile,
        subjectDigest: input.manifest.evidenceRootDigest,
        decisionDigest: decision.evidenceRootDigest,
        at: now(),
      });
      return ok(decision);
    },

    listMissingEvidence(input: {
      readonly inventory: RuleInventory;
      readonly observedRuleIds: readonly string[];
    }): readonly string[] {
      const declared = new Set(input.inventory.entries.map((entry) => entry.ruleId));
      const observed = new Set(input.observedRuleIds);
      return [...declared].filter((ruleId) => !observed.has(ruleId));
    },

    explainDecision(decision: VerificationDecision): string {
      if (decision.violations.length > 0) {
        return decision.violations.map((v) => `${v.code}: ${v.message}`).join("; ");
      }
      return `profile=${decision.profile} machine=${decision.status.machine} release=${decision.status.release}`;
    },

    evaluateAdmissionGate(decision: VerificationDecision): "blocked" | "conditional" {
      if (decision.status.machine !== "verified" || decision.violations.length > 0) {
        return "blocked";
      }
      return "conditional";
    },

    evaluateReleaseGate(decision: VerificationDecision): "blocked" | "conditional" {
      if (decision.status.release === "blocked" || decision.status.release === "revoked") {
        return "blocked";
      }
      if (decision.status.humanReview !== "approved") {
        return "conditional";
      }
      return decision.status.release === "accepted" ? "conditional" : "blocked";
    },
  };
}

export type ConformanceEngine = ReturnType<typeof createConformanceEngine>;
