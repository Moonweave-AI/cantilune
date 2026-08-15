import { describe, it, expect } from "vitest";
import {
  reserveBudget,
  reconcileBudget,
  isBudgetExhausted,
  createEmptyLedger,
} from "../../src/budget/evaluationBudget.js";
import type { EvaluationBudgetPolicy } from "../../src/budget/evaluationBudget.js";
import { budgetPolicyId } from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const policyId = budgetPolicyId("pol-1");

function createPolicy(overrides: Partial<EvaluationBudgetPolicy> = {}): EvaluationBudgetPolicy {
  return {
    policyId,
    maxRuns: 10,
    maxCases: 100,
    maxConcurrency: 4,
    maxInputTokens: 100000,
    maxOutputTokens: 50000,
    maxModelCostCents: 1000,
    maxToolCostCents: 200,
    maxNetworkCostCents: 100,
    maxTotalCostCents: 1500,
    maxWallTimeMs: 3600000,
    maxRetries: 3,
    providerQuotas: [],
    suiteQuotas: [],
    dailyLimitCents: 5000,
    monthlyLimitCents: 50000,
    hardKillEnabled: true,
    safeStateOnKill: true,
    policyDigest: "digest" as ContentDigest,
    ...overrides,
  };
}

describe("Budget management", () => {
  it("creates empty ledger with zero values", () => {
    const ledger = createEmptyLedger(policyId);
    expect(ledger.reservedCostCents).toBe(0);
    expect(ledger.actualCostCents).toBe(0);
    expect(ledger.completedRuns).toBe(0);
  });

  it("reserves budget successfully", () => {
    const ledger = createEmptyLedger(policyId);
    const policy = createPolicy();
    const result = reserveBudget(ledger, policy, 100, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.reservedCostCents).toBe(100);
      expect(result.value.reservedRuns).toBe(1);
      expect(result.value.reservedTokens).toBe(1000);
    }
  });

  it("rejects budget reservation over cost limit", () => {
    const ledger = createEmptyLedger(policyId);
    const policy = createPolicy({ maxTotalCostCents: 50 });
    const result = reserveBudget(ledger, policy, 100, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("budget_reserve_failed");
    }
  });

  it("rejects budget reservation over run limit", () => {
    const ledger = { ...createEmptyLedger(policyId), reservedRuns: 10 };
    const policy = createPolicy({ maxRuns: 10 });
    const result = reserveBudget(ledger, policy, 0, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("budget_reserve_failed");
    }
  });

  it("rejects negative cost reservation", () => {
    const ledger = createEmptyLedger(policyId);
    const policy = createPolicy();
    const result = reserveBudget(ledger, policy, -10, 0);
    expect(result.ok).toBe(false);
  });

  it("rejects negative token reservation", () => {
    const ledger = createEmptyLedger(policyId);
    const policy = createPolicy();
    const result = reserveBudget(ledger, policy, 0, -100);
    expect(result.ok).toBe(false);
  });

  it("reconciles budget after run", () => {
    const ledger = createEmptyLedger(policyId);
    const result = reconcileBudget(ledger, 50, 500, "receipt-1", "2026-01-01");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actualCostCents).toBe(50);
      expect(result.value.usedTokens).toBe(500);
      expect(result.value.completedRuns).toBe(1);
      expect(result.value.costReceiptRefs).toEqual(["receipt-1"]);
      expect(result.value.lastReconciledAt).toBe("2026-01-01");
    }
  });

  it("rejects reconciliation with negative cost", () => {
    const ledger = createEmptyLedger(policyId);
    const result = reconcileBudget(ledger, -10, 0, "receipt-1", "2026-01-01");
    expect(result.ok).toBe(false);
  });

  it("rejects reconciliation without receipt", () => {
    const ledger = createEmptyLedger(policyId);
    const result = reconcileBudget(ledger, 50, 500, "", "2026-01-01");
    expect(result.ok).toBe(false);
  });

  it("detects budget exhaustion by cost", () => {
    const policy = createPolicy({ maxTotalCostCents: 100 });
    const ledger = { ...createEmptyLedger(policyId), actualCostCents: 100 };
    expect(isBudgetExhausted(ledger, policy)).toBe(true);
  });

  it("detects budget exhaustion by runs", () => {
    const policy = createPolicy({ maxRuns: 5 });
    const ledger = { ...createEmptyLedger(policyId), completedRuns: 5 };
    expect(isBudgetExhausted(ledger, policy)).toBe(true);
  });

  it("not exhausted when under limits", () => {
    const policy = createPolicy();
    const ledger = createEmptyLedger(policyId);
    expect(isBudgetExhausted(ledger, policy)).toBe(false);
  });

  it("rejects budget reservation over token limit", () => {
    const ledger = createEmptyLedger(policyId);
    const policy = createPolicy({ maxInputTokens: 1000, maxOutputTokens: 1000 });
    const result = reserveBudget(ledger, policy, 0, 2001);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.path).toBe("budget.tokens");
  });

  it("rejects reconciliation with negative tokens", () => {
    const ledger = createEmptyLedger(policyId);
    const result = reconcileBudget(ledger, 10, -1, "receipt-1", "2026-01-01");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.path).toBe("budget.actualTokens");
  });
});
