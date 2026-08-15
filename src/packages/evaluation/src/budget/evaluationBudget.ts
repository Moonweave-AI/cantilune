import type { ContentDigest } from "@cantilune/core";
import type { BudgetPolicyId } from "../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";

export interface EvaluationBudgetPolicy {
  readonly policyId: BudgetPolicyId;
  readonly maxRuns: number;
  readonly maxCases: number;
  readonly maxConcurrency: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxModelCostCents: number;
  readonly maxToolCostCents: number;
  readonly maxNetworkCostCents: number;
  readonly maxTotalCostCents: number;
  readonly maxWallTimeMs: number;
  readonly maxRetries: number;
  readonly providerQuotas: readonly ProviderQuota[];
  readonly suiteQuotas: readonly SuiteQuota[];
  readonly dailyLimitCents: number;
  readonly monthlyLimitCents: number;
  readonly hardKillEnabled: boolean;
  readonly safeStateOnKill: boolean;
  readonly policyDigest: ContentDigest;
}

export interface ProviderQuota {
  readonly provider: string;
  readonly maxRequestsPerMinute: number;
  readonly maxTokensPerMinute: number;
  readonly maxCostCents: number;
}

export interface SuiteQuota {
  readonly suiteRef: string;
  readonly maxRuns: number;
  readonly maxCostCents: number;
}

export interface BudgetLedger {
  readonly policyRef: BudgetPolicyId;
  readonly reservedCostCents: number;
  readonly actualCostCents: number;
  readonly reconciledCostCents: number;
  readonly reservedRuns: number;
  readonly completedRuns: number;
  readonly reservedTokens: number;
  readonly usedTokens: number;
  readonly costReceiptRefs: readonly string[];
  readonly lastReconciledAt: string | undefined;
}

export function reserveBudget(
  ledger: BudgetLedger,
  policy: EvaluationBudgetPolicy,
  costCents: number,
  tokens: number,
): EvaluationResult<BudgetLedger> {
  if (costCents < 0) {
    return violations([
      violation("budget_reserve_failed", "budget.cost", "Cost cannot be negative"),
    ]);
  }
  if (tokens < 0) {
    return violations([
      violation("budget_reserve_failed", "budget.tokens", "Tokens cannot be negative"),
    ]);
  }

  if (ledger.reservedCostCents + costCents > policy.maxTotalCostCents) {
    return violations([
      violation(
        "budget_reserve_failed",
        "budget.totalCost",
        `Reserve ${costCents} would exceed max ${policy.maxTotalCostCents}`,
        { reserved: ledger.reservedCostCents, requested: costCents },
      ),
    ]);
  }

  if (ledger.reservedRuns + 1 > policy.maxRuns) {
    return violations([
      violation(
        "budget_reserve_failed",
        "budget.runs",
        `Run count would exceed max ${policy.maxRuns}`,
        { reserved: ledger.reservedRuns },
      ),
    ]);
  }

  const totalTokens = policy.maxInputTokens + policy.maxOutputTokens;
  if (totalTokens > 0 && ledger.reservedTokens + tokens > totalTokens) {
    return violations([
      violation(
        "budget_reserve_failed",
        "budget.tokens",
        `Token reservation would exceed max ${totalTokens}`,
      ),
    ]);
  }

  return ok({
    ...ledger,
    reservedCostCents: ledger.reservedCostCents + costCents,
    reservedRuns: ledger.reservedRuns + 1,
    reservedTokens: ledger.reservedTokens + tokens,
  });
}

export function reconcileBudget(
  ledger: BudgetLedger,
  actualCostCents: number,
  actualTokens: number,
  receiptRef: string,
  reconciledAt: string,
): EvaluationResult<BudgetLedger> {
  if (actualCostCents < 0) {
    return violations([
      violation(
        "budget_reconciliation_failed",
        "budget.actualCost",
        "Actual cost cannot be negative",
      ),
    ]);
  }
  if (actualTokens < 0) {
    return violations([
      violation(
        "budget_reconciliation_failed",
        "budget.actualTokens",
        "Actual tokens cannot be negative",
      ),
    ]);
  }
  if (!receiptRef) {
    return violations([
      violation("budget_reconciliation_failed", "budget.receiptRef", "Receipt reference required"),
    ]);
  }

  return ok({
    ...ledger,
    actualCostCents: ledger.actualCostCents + actualCostCents,
    reconciledCostCents: ledger.reconciledCostCents + actualCostCents,
    usedTokens: ledger.usedTokens + actualTokens,
    completedRuns: ledger.completedRuns + 1,
    costReceiptRefs: [...ledger.costReceiptRefs, receiptRef],
    lastReconciledAt: reconciledAt,
  });
}

export function isBudgetExhausted(ledger: BudgetLedger, policy: EvaluationBudgetPolicy): boolean {
  return (
    ledger.actualCostCents >= policy.maxTotalCostCents ||
    ledger.completedRuns >= policy.maxRuns ||
    ledger.usedTokens >= policy.maxInputTokens + policy.maxOutputTokens
  );
}

export function createEmptyLedger(policyRef: BudgetPolicyId): BudgetLedger {
  return {
    policyRef,
    reservedCostCents: 0,
    actualCostCents: 0,
    reconciledCostCents: 0,
    reservedRuns: 0,
    completedRuns: 0,
    reservedTokens: 0,
    usedTokens: 0,
    costReceiptRefs: [],
    lastReconciledAt: undefined,
  };
}
