/**
 * Family-wise error control for RFC-0004 §10.
 * Bonferroni: α/m. Holm (1979) step-down: reject while p_(i) ≤ α/(m-i+1).
 */

export type MultipleComparisonMethod = "holm" | "bonferroni" | "none";

export interface AdjustedTest {
  readonly index: number;
  readonly rawP: number;
  readonly adjustedP: number;
  readonly rejected: boolean;
}

export function normalizeMultipleComparison(method: string): MultipleComparisonMethod {
  const normalized = method.trim().toLowerCase();
  if (normalized === "holm" || normalized === "holm-bonferroni") return "holm";
  if (normalized === "bonferroni") return "bonferroni";
  return "none";
}

export function adjustPvalues(
  rawP: readonly number[],
  method: MultipleComparisonMethod,
  alpha: number,
): readonly AdjustedTest[] {
  const m = rawP.length;
  if (m === 0) return [];
  if (method === "none") {
    return rawP.map((p, index) => ({
      index,
      rawP: p,
      adjustedP: p,
      rejected: p <= alpha,
    }));
  }
  if (method === "bonferroni") {
    return rawP.map((p, index) => {
      const adjustedP = Math.min(1, p * m);
      return { index, rawP: p, adjustedP, rejected: adjustedP <= alpha };
    });
  }
  const order = rawP
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p || a.index - b.index);
  const adjustedByIndex = new Array<number>(m);
  let running = 0;
  for (let i = 0; i < m; i += 1) {
    const factor = m - i;
    const candidate = Math.min(1, order[i]!.p * factor);
    running = Math.max(running, candidate);
    adjustedByIndex[order[i]!.index] = running;
  }
  let reject = true;
  const rejectedByIndex = new Array<boolean>(m).fill(false);
  for (let i = 0; i < m; i += 1) {
    const threshold = alpha / (m - i);
    if (reject && order[i]!.p <= threshold) {
      rejectedByIndex[order[i]!.index] = true;
    } else {
      reject = false;
    }
  }
  return rawP.map((p, index) => ({
    index,
    rawP: p,
    adjustedP: adjustedByIndex[index] ?? p,
    rejected: rejectedByIndex[index] ?? false,
  }));
}
