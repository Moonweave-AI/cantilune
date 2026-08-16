/**
 * JudgeBudgetPolicy (ADR-0020 J4) — reserve-before / reconcile-after ceilings
 * for LLM judge calls. Hard-kill cannot be overridden by soft rubric scores.
 */
export interface JudgeBudgetLimits {
  readonly maxJudgeCalls?: number;
  readonly maxTokens?: number;
  readonly maxCostUsd?: number;
  readonly maxWallMs?: number;
  /** When true, exhaustion forces hard-kill of further judge calls. */
  readonly hardKillEnabled?: boolean;
}

export interface JudgeBudgetReservation {
  readonly reservationId: string;
  readonly reservedAt: number;
  readonly estimatedTokens: number;
  readonly estimatedCostUsd: number;
}

export interface JudgeBudgetReconcile {
  readonly reservationId: string;
  readonly actualTokens: number;
  readonly actualCostUsd: number;
  readonly wallMs: number;
}

export interface JudgeBudgetSnapshot {
  readonly calls: number;
  readonly tokens: number;
  readonly costUsd: number;
  readonly wallMs: number;
  readonly hardKilled: boolean;
  readonly exhaustedReason?: string;
}

export interface JudgeBudgetPolicy {
  /** Reserve capacity before a judge call. Fail-closed when exhausted. */
  reserve(estimate?: {
    readonly tokens?: number;
    readonly costUsd?: number;
  }): { ok: true; reservation: JudgeBudgetReservation } | { ok: false; reason: string };
  /** Reconcile actual usage after the call. */
  reconcile(input: JudgeBudgetReconcile): void;
  /** True when hard-kill has fired — judge must not run. */
  isHardKilled(): boolean;
  snapshot(): JudgeBudgetSnapshot;
}

let reservationSeq = 0;

export function createJudgeBudgetPolicy(
  limits: JudgeBudgetLimits,
  now: () => number = () => Date.now(),
): JudgeBudgetPolicy {
  let calls = 0;
  let tokens = 0;
  let costUsd = 0;
  let wallMs = 0;
  let hardKilled = false;
  let exhaustedReason: string | undefined;
  const startedAt = now();
  const open = new Map<string, JudgeBudgetReservation>();

  function maybeHardKill(reason: string): void {
    if (limits.hardKillEnabled === false) return;
    hardKilled = true;
    exhaustedReason = reason;
  }

  function checkSpendCeilings(nextTokens: number, nextCost: number): string | undefined {
    if (limits.maxTokens !== undefined && nextTokens > limits.maxTokens) {
      return `maxTokens ${limits.maxTokens} exceeded`;
    }
    if (limits.maxCostUsd !== undefined && nextCost > limits.maxCostUsd) {
      return `maxCostUsd ${limits.maxCostUsd} exceeded`;
    }
    if (limits.maxWallMs !== undefined && now() - startedAt > limits.maxWallMs) {
      return `maxWallMs ${limits.maxWallMs} exceeded`;
    }
    return undefined;
  }

  return {
    reserve(estimate) {
      if (hardKilled) {
        return { ok: false, reason: exhaustedReason ?? "judge budget hard-killed" };
      }
      // maxJudgeCalls=N allows N successful reserves; the (N+1)th fails.
      if (limits.maxJudgeCalls !== undefined && calls >= limits.maxJudgeCalls) {
        const reason = `maxJudgeCalls ${limits.maxJudgeCalls} exceeded`;
        maybeHardKill(reason);
        return { ok: false, reason };
      }
      const estTokens = estimate?.tokens ?? 0;
      const estCost = estimate?.costUsd ?? 0;
      const spendReason = checkSpendCeilings(tokens + estTokens, costUsd + estCost);
      if (spendReason !== undefined) {
        maybeHardKill(spendReason);
        return { ok: false, reason: spendReason };
      }
      reservationSeq += 1;
      const reservation: JudgeBudgetReservation = {
        reservationId: `jbud-${reservationSeq}`,
        reservedAt: now(),
        estimatedTokens: estTokens,
        estimatedCostUsd: estCost,
      };
      open.set(reservation.reservationId, reservation);
      return { ok: true, reservation };
    },

    reconcile(input) {
      const reservation = open.get(input.reservationId);
      open.delete(input.reservationId);
      calls += 1;
      tokens += input.actualTokens;
      costUsd += input.actualCostUsd;
      wallMs += input.wallMs;
      void reservation;
      if (limits.maxJudgeCalls !== undefined && calls >= limits.maxJudgeCalls) {
        maybeHardKill(`maxJudgeCalls ${limits.maxJudgeCalls} reached`);
      }
      const spendReason = checkSpendCeilings(tokens, costUsd);
      if (spendReason !== undefined) {
        maybeHardKill(spendReason);
      }
    },

    isHardKilled() {
      if (hardKilled) return true;
      if (limits.maxWallMs !== undefined && now() - startedAt > limits.maxWallMs) {
        maybeHardKill(`maxWallMs ${limits.maxWallMs} exceeded`);
        return true;
      }
      return hardKilled;
    },

    snapshot() {
      return {
        calls,
        tokens,
        costUsd,
        wallMs,
        hardKilled,
        ...(exhaustedReason !== undefined ? { exhaustedReason } : {}),
      };
    },
  };
}
