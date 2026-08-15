import type { EvaluationClaimId } from "../../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { ClaimDecision } from "../../review/claimDecision.js";
import type { ClaimLedger, ClaimLedgerEntry } from "../../ports/stateGovernance.js";

export function createMemoryClaimLedger(): ClaimLedger {
  const entries: ClaimLedgerEntry[] = [];

  return {
    async append(entry: ClaimLedgerEntry): Promise<EvaluationResult<void>> {
      const expectedPrevious = entries.length > 0 ? entries.at(-1)!.entryDigest : undefined;

      if (entry.previousDigest !== expectedPrevious) {
        return violations([
          violation(
            "ledger_chain_broken",
            "entry.previousDigest",
            `Expected previous digest ${expectedPrevious ?? "(none)"}, got ${entry.previousDigest ?? "(none)"}`,
          ),
        ]);
      }

      entries.push(entry);
      return ok(undefined);
    },

    async getHistory(claimRef: EvaluationClaimId): Promise<readonly ClaimLedgerEntry[]> {
      return entries.filter((e) => e.claimRef === claimRef);
    },

    async getLatestDecision(claimRef: EvaluationClaimId): Promise<ClaimDecision | undefined> {
      const claimEntries = entries.filter(
        (e) => e.claimRef === claimRef && e.decision !== undefined,
      );
      return claimEntries.length > 0 ? claimEntries.at(-1)!.decision : undefined;
    },

    async verifyChain(): Promise<EvaluationResult<void>> {
      for (let i = 1; i < entries.length; i++) {
        const current = entries[i]!;
        const previous = entries[i - 1]!;
        if (current.previousDigest !== previous.entryDigest) {
          return violations([
            violation(
              "ledger_chain_broken",
              `entry[${i}].previousDigest`,
              `Chain broken at index ${i}: expected ${previous.entryDigest}, got ${current.previousDigest ?? "(none)"}`,
            ),
          ]);
        }
      }
      return ok(undefined);
    },
  };
}
