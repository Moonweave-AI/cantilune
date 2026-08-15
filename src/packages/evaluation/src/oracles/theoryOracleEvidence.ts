import type { ContentDigest } from "@cantilune/core";
import type { OracleId } from "../foundation/evaluationIds.js";
import type { OracleResult, OracleSemanticLayer } from "../foundation/evaluationStatus.js";

/**
 * Controlled oracle registry entry — maps oracle codes to exact Lean symbols,
 * obligation IDs, theory commits, and scope ceilings.
 * Result is ONLY computed by a trusted evaluator, never by the caller.
 */
export interface OracleRegistryEntry {
  readonly oracleCode: string;
  readonly centralObligationId: string;
  readonly leanSymbol: LeanTheoremSymbol;
  readonly theoryCommit: string;
  readonly theoryBuildDigest: ContentDigest;
  readonly theoryManifestDigest: ContentDigest;
  readonly scopeCeiling: string;
  readonly semanticLayer: OracleSemanticLayer;
  readonly typedPremiseSchema: readonly PremiseField[];
  readonly checkerBuild: string;
  readonly checkerDigest: ContentDigest;
}

export interface PremiseField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

/**
 * Exact Lean symbol — must match a symbol in formal/proof-obligations.json.
 * Uses namespace-qualified form: `Cantilune.Core.Module.theorem_name`.
 */
export type LeanTheoremSymbol = string & { readonly __leanSymbol: unique symbol };

export function leanSymbol(s: string): LeanTheoremSymbol {
  if (!s.startsWith("Cantilune.")) {
    throw new Error(`Lean symbol must start with 'Cantilune.': ${s}`);
  }
  return s as LeanTheoremSymbol;
}

export const KNOWN_LEAN_SYMBOLS = {
  eventReplayUnique: "Cantilune.Core.DPOEvent.event_replay_unique" as LeanTheoremSymbol,
  epochReplayAgreement: "Cantilune.Core.DPOEvent.epoch_replay_agreement" as LeanTheoremSymbol,
  internalRankDecrease: "Cantilune.Core.InternalRank.internal_rank_decrease" as LeanTheoremSymbol,
  internalEventCountBound:
    "Cantilune.Core.InternalRank.internal_event_count_bound" as LeanTheoremSymbol,
  terminalPartitionExactlyOne:
    "Cantilune.Core.Terminal.terminal_partition_exactly_one" as LeanTheoremSymbol,
  deletionResourceSafe: "Cantilune.Core.Deletion.deletion_resource_safe" as LeanTheoremSymbol,
  deletionSessionSafe: "Cantilune.Core.Deletion.deletion_session_safe" as LeanTheoremSymbol,
  projectionStepSound: "Cantilune.Core.Projection.projection_step_sound" as LeanTheoremSymbol,
  projectionStepReflect: "Cantilune.Core.Projection.projection_step_reflect" as LeanTheoremSymbol,
  projectionPathSoundReflect:
    "Cantilune.Core.Projection.projection_path_sound_reflect" as LeanTheoremSymbol,
  projectionTerminalPreserved:
    "Cantilune.Core.Projection.projection_terminal_preserved" as LeanTheoremSymbol,
  signatureVersionPreserved:
    "Cantilune.Core.Admission.signature_version_preserved" as LeanTheoremSymbol,
  admissionVersionStrict: "Cantilune.Core.Admission.admission_version_strict" as LeanTheoremSymbol,
  admissionTargetUnique: "Cantilune.Core.Admission.admission_target_unique" as LeanTheoremSymbol,
  fourViewAdmissionComplete:
    "Cantilune.Core.FourView.four_view_admission_complete" as LeanTheoremSymbol,
  probabilityNonnegative: "Cantilune.Core.Probability.probability_nonnegative" as LeanTheoremSymbol,
  probabilityRowSumOne: "Cantilune.Core.Probability.probability_row_sum_one" as LeanTheoremSymbol,
  positiveEdgeNative: "Cantilune.Core.Probability.positive_edge_native" as LeanTheoremSymbol,
  stableProgressAtLeastEpsilon:
    "Cantilune.Core.Progress.stable_progress_at_least_epsilon" as LeanTheoremSymbol,
  expectedOpportunityEpochBound:
    "Cantilune.Core.Progress.expected_opportunity_epoch_bound" as LeanTheoremSymbol,
  stableRegionPersistent: "Cantilune.Core.Progress.stable_region_persistent" as LeanTheoremSymbol,
  noInternalOscillation: "Cantilune.Core.Progress.no_internal_oscillation" as LeanTheoremSymbol,
  branchEventIdentityPreserved:
    "Cantilune.Core.Branch.branch_event_identity_preserved" as LeanTheoremSymbol,
  prefixTrieFullAbstractionScoped:
    "Cantilune.Core.PrefixTrie.prefix_trie_full_abstraction_scoped" as LeanTheoremSymbol,
} as const;

/**
 * Theory oracle evidence — produced ONLY by a trusted evaluator.
 * The evaluator looks up the OracleRegistryEntry, executes the checker,
 * and fills in the result and evidence fields. Callers cannot set result directly.
 */
export interface TheoryOracleEvidence {
  readonly oracleId: OracleId;
  readonly oracleVersion: number;
  readonly oracleCode: string;
  readonly centralObligationId: string;
  readonly leanSymbol: LeanTheoremSymbol;
  readonly semanticLayer: OracleSemanticLayer;
  readonly theoryCommit: string;
  readonly theoryBuildDigest: ContentDigest;
  readonly theoryManifestDigest: ContentDigest;
  readonly proofManifestDigest: ContentDigest;
  readonly premiseEvidenceRefs: readonly string[];
  readonly inputEvidenceRefs: readonly string[];
  readonly scopeCeiling: string;
  readonly checkerBuild: string;
  readonly checkerDigest: ContentDigest;
  readonly expected: string;
  readonly observed: string;
  readonly result: OracleResult;
  readonly counterexampleRef: string | undefined;
  readonly evaluatorRef: string;
  readonly evaluatedAt: string;
  readonly oracleDigest: ContentDigest;
}

export interface OracleRegistry {
  register(entry: OracleRegistryEntry): void;
  get(oracleCode: string): OracleRegistryEntry | undefined;
  listAll(): readonly OracleRegistryEntry[];
  hasSymbol(symbol: LeanTheoremSymbol): boolean;
}

export function createOracleRegistry(): OracleRegistry {
  const entries = new Map<string, OracleRegistryEntry>();

  return {
    register(entry: OracleRegistryEntry): void {
      entries.set(entry.oracleCode, entry);
    },
    get(oracleCode: string): OracleRegistryEntry | undefined {
      return entries.get(oracleCode);
    },
    listAll(): readonly OracleRegistryEntry[] {
      return [...entries.values()];
    },
    hasSymbol(symbol: LeanTheoremSymbol): boolean {
      for (const e of entries.values()) {
        if (e.leanSymbol === symbol) return true;
      }
      return false;
    },
  };
}

export function isOraclePassed(evidence: TheoryOracleEvidence): boolean {
  return evidence.result === "passed";
}

export function isOraclePremiseMissing(evidence: TheoryOracleEvidence): boolean {
  return evidence.result === "premiseMissing";
}
