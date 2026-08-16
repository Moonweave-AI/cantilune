export type AlignedDiffKind = "equal" | "replace" | "delete" | "insert";

export interface AlignedDiffRow {
  readonly left: string;
  readonly right: string;
  readonly kind: AlignedDiffKind;
}

function fillLcsTable(leftLines: readonly string[], rightLines: readonly string[]): number[][] {
  const n = leftLines.length;
  const m = rightLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = dp[i];
      const nextRow = dp[i + 1];
      if (row === undefined || nextRow === undefined) continue;
      row[j] =
        leftLines[i] === rightLines[j]
          ? (nextRow[j + 1] ?? 0) + 1
          : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return dp;
}

function walkAlignment(
  leftLines: readonly string[],
  rightLines: readonly string[],
  dp: readonly number[][],
): AlignedDiffRow[] {
  const rows: AlignedDiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < leftLines.length && j < rightLines.length) {
    if (leftLines[i] === rightLines[j]) {
      rows.push({ left: leftLines[i] ?? "", right: rightLines[j] ?? "", kind: "equal" });
      i += 1;
      j += 1;
      continue;
    }
    const down = dp[i + 1]?.[j] ?? 0;
    const rightScore = dp[i]?.[j + 1] ?? 0;
    if (down >= rightScore) {
      rows.push({ left: leftLines[i] ?? "", right: "", kind: "delete" });
      i += 1;
    } else {
      rows.push({ left: "", right: rightLines[j] ?? "", kind: "insert" });
      j += 1;
    }
  }
  while (i < leftLines.length) {
    rows.push({ left: leftLines[i] ?? "", right: "", kind: "delete" });
    i += 1;
  }
  while (j < rightLines.length) {
    rows.push({ left: "", right: rightLines[j] ?? "", kind: "insert" });
    j += 1;
  }
  return rows;
}

/**
 * Line-oriented LCS alignment. Index-aligned diffs mis-label moved lines as
 * replacements; this keeps equal lines paired even when they shift.
 */
export function alignLineDiff(left: string, right: string): AlignedDiffRow[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  return walkAlignment(leftLines, rightLines, fillLcsTable(leftLines, rightLines));
}
