import type { BudgetPolicyId } from "../../foundation/evaluationIds.js";
import { ok, type EvaluationResult } from "../../foundation/evaluationResult.js";
import type { BudgetLedger } from "../../budget/evaluationBudget.js";
import type { BudgetLedgerPort } from "../../ports/stateGovernance.js";

export function createMemoryBudgetLedger(): BudgetLedgerPort {
  const ledgers = new Map<string, BudgetLedger>();

  return {
    async get(policyRef: BudgetPolicyId): Promise<BudgetLedger | undefined> {
      return ledgers.get(policyRef);
    },

    async save(ledger: BudgetLedger): Promise<EvaluationResult<void>> {
      ledgers.set(ledger.policyRef, ledger);
      return ok(undefined);
    },
  };
}
