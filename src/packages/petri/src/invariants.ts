/**
 * Place-invariant (S-invariant) analysis from the net's incidence matrix.
 *
 * A place invariant is a non-negative integer weight vector `x` with
 * `xᵀ·A = 0`, where `A` is the `(#places × #transitions)` incidence matrix
 * `A[i][j] = out(p_i, t_j) − in(p_i, t_j)`. Such an invariant expresses a
 * token-preserving relation: the weighted sum of tokens over its places is
 * constant across any fire sequence.
 *
 * The basis is computed by the Martinez-Silva signed-elimination algorithm:
 * maintain a candidate matrix `B` (one row per candidate weight vector, `m`
 * columns where `m = #places`), seeded with the identity `I_m`. For each
 * transition `t_j`, compute the *signed column product* `c_i = Σ_k B[i][k]·A[k][j]`
 * for every candidate row. Rows whose product `c_i` is zero already satisfy the
 * column and are kept; rows with opposite-signed products are pairwise-combined
 * (weighted so the column cancels) into new non-negative candidates. After all
 * transitions are processed, the surviving rows with `x ≥ 0` and `xᵀA = 0` are
 * the place-invariant basis. This is genuine linear algebra over the net
 * structure, not the cosmetic substring check the old view used.
 */

import { classifyArcsForTransition, type PetriNet } from "./net.js";

/** A computed place invariant: the weighted set of places whose token sum is preserved. */
export interface PlaceInvariant {
  /** The places participating in the invariant, with their non-negative weights. */
  readonly places: ReadonlyArray<{ readonly placeId: string; readonly weight: number }>;
  /** A human-readable name for the invariant (the joined place names). */
  readonly label: string;
}

/** Build the incidence matrix A[i][j]: out-degree minus in-degree of place i under transition j. */
export function incidenceMatrix(net: PetriNet): number[][] {
  const placeIds = net.places.map((p) => p.id);
  const transitions = net.transitions.map((t) => t.id);
  const A: number[][] = placeIds.map(() => transitions.map(() => 0));
  for (let j = 0; j < transitions.length; j += 1) {
    const transitionId = transitions[j]!;
    let classified: {
      inputs: readonly { placeId: string }[];
      outputs: readonly { placeId: string }[];
    };
    try {
      classified = classifyArcsForTransition(net, transitionId);
    } catch {
      // Self-loop arc: skip this transition's contribution to the incidence matrix.
      continue;
    }
    for (const out of classified.outputs) {
      const i = placeIds.indexOf(out.placeId);
      if (i >= 0) {
        A[i]![j] = (A[i]![j] ?? 0) + 1;
      }
    }
    for (const input of classified.inputs) {
      const i = placeIds.indexOf(input.placeId);
      if (i >= 0) {
        A[i]![j] = (A[i]![j] ?? 0) - 1;
      }
    }
  }
  return A;
}

/**
 * Compute the basis of non-negative integer place invariants via the
 * Martinez-Silva signed-elimination algorithm on the incidence matrix.
 */
/** Seed the candidate matrix B with the m×m identity (one row per place). */
function seedIdentity(m: number): number[][] {
  const B: number[][] = [];
  for (let i = 0; i < m; i += 1) {
    const row = new Array<number>(m).fill(0);
    row[i] = 1;
    B.push(row);
  }
  return B;
}

/** Partition candidate-row indices by the sign of their signed column product. */
function partitionBySign(signed: number[]): {
  positives: number[];
  negatives: number[];
  zeros: number[];
} {
  const positives: number[] = [];
  const negatives: number[] = [];
  const zeros: number[] = [];
  for (let i = 0; i < signed.length; i += 1) {
    const c = signed[i]!;
    if (c > 0) {
      positives.push(i);
    } else if (c < 0) {
      negatives.push(i);
    } else {
      zeros.push(i);
    }
  }
  return { positives, negatives, zeros };
}

/** Combine each positive/negative row pair into a new candidate that cancels column j. */
function combineOppositeSigned(
  B: number[][],
  signed: number[],
  positives: number[],
  negatives: number[],
  m: number,
): { combined: number[][]; used: Set<number> } {
  const combined: number[][] = [];
  const used = new Set<number>();
  for (const pos of positives) {
    for (const neg of negatives) {
      const posRow = B[pos]!;
      const negRow = B[neg]!;
      const posWeight = Math.abs(signed[neg]!);
      const negWeight = Math.abs(signed[pos]!);
      const newRow = new Array<number>(m).fill(0);
      for (let k = 0; k < m; k += 1) {
        newRow[k] = (posRow[k] ?? 0) * posWeight + (negRow[k] ?? 0) * negWeight;
      }
      combined.push(newRow);
      used.add(pos);
      used.add(neg);
    }
  }
  return { combined, used };
}

/** Keep zero-product rows that were not consumed by a combination. */
function keepUnusedZeros(B: number[][], zeros: number[], used: Set<number>): number[][] {
  const kept: number[][] = [];
  for (const i of zeros) {
    if (!used.has(i)) {
      kept.push(B[i]!);
    }
  }
  return kept;
}

/** Convert a surviving weight row into a labeled place invariant (or undefined if trivial). */
function rowToInvariant(
  row: number[],
  placeIds: string[],
  placeNames: ReadonlyMap<string, string>,
): PlaceInvariant | undefined {
  const places: { placeId: string; weight: number }[] = [];
  for (let i = 0; i < placeIds.length; i += 1) {
    const w = row[i] ?? 0;
    if (w > 0) {
      places.push({ placeId: placeIds[i]!, weight: w });
    }
  }
  if (places.length === 0) {
    return undefined;
  }
  const label = places.map((p) => placeNames.get(p.placeId) ?? p.placeId).join(" + ");
  return { places, label };
}

export function placeInvariants(net: PetriNet): readonly PlaceInvariant[] {
  const placeIds = net.places.map((p) => p.id);
  const placeNames = new Map(net.places.map((p) => [p.id, p.name] as const));
  if (placeIds.length === 0) {
    return [];
  }
  const A = incidenceMatrix(net);
  const m = placeIds.length;
  const numTransitions = A[0]?.length ?? 0;

  let B = seedIdentity(m);

  for (let j = 0; j < numTransitions; j += 1) {
    const signed = B.map((row) => dotColumn(row, A, j));
    const { positives, negatives, zeros } = partitionBySign(signed);
    if (positives.length === 0 || negatives.length === 0) {
      // No opposite signs to combine for this transition; keep only zero-product rows.
      // (Rows with non-zero product cannot be invariants, and without a partner they
      //  cannot be combined now — drop them.)
      B = zeros.map((i) => B[i]!);
      continue;
    }
    const { combined, used } = combineOppositeSigned(B, signed, positives, negatives, m);
    const kept = keepUnusedZeros(B, zeros, used);
    B = reduceRows([...kept, ...combined]);
  }

  const invariants: PlaceInvariant[] = [];
  for (const row of B) {
    if (row.every((w) => w === 0)) {
      continue;
    }
    if (!rowIsInvariant(row, A)) {
      continue;
    }
    const inv = rowToInvariant(row, placeIds, placeNames);
    if (inv !== undefined) {
      invariants.push(inv);
    }
  }
  return dedupInvariants(invariants);
}

/** Dot product of a weight row against the j-th incidence column: Σ_k row[k]·A[k][j]. */
export function dotColumn(row: number[], A: number[][], j: number): number {
  let sum = 0;
  for (let k = 0; k < A.length; k += 1) {
    sum += (row[k] ?? 0) * (A[k]![j] ?? 0);
  }
  return sum;
}

/** Whether a candidate weight row satisfies xᵀ·A = 0 (every transition column sums to 0). */
export function rowIsInvariant(row: number[], A: number[][]): boolean {
  if (A.length === 0) {
    return true;
  }
  const numTransitions = A[0]?.length ?? 0;
  for (let j = 0; j < numTransitions; j += 1) {
    if (dotColumn(row, A, j) !== 0) {
      return false;
    }
  }
  return true;
}

/** Remove duplicate rows and rows that are a positive integer scalar multiple of an earlier row. */
export function reduceRows(rows: number[][]): number[][] {
  const result: number[][] = [];
  for (const row of rows) {
    if (result.some((kept) => isScalarMultiple(row, kept))) {
      continue;
    }
    for (let i = result.length - 1; i >= 0; i -= 1) {
      if (isScalarMultiple(result[i]!, row)) {
        result.splice(i, 1);
      }
    }
    result.push(row);
  }
  return result;
}

/** Whether `a` is a positive integer scalar multiple of `b` (both non-zero, same support). */
export function isScalarMultiple(a: number[], b: number[]): boolean {
  const aNonzero = a.filter((v) => v !== 0);
  const bNonzero = b.filter((v) => v !== 0);
  if (aNonzero.length === 0 || bNonzero.length === 0) {
    return false;
  }
  if (aNonzero.length !== bNonzero.length) {
    return false;
  }
  let ratio: number | null = null;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if ((av === 0) !== (bv === 0)) {
      return false; // different support
    }
    if (av === 0 && bv === 0) {
      continue;
    }
    const r = av / bv;
    if (!Number.isInteger(r) || r <= 0) {
      return false;
    }
    if (ratio === null) {
      ratio = r;
    } else if (r !== ratio) {
      return false;
    }
  }
  return ratio !== null;
}

/** Deduplicate invariants by their place-weight signature. */
export function dedupInvariants(invariants: PlaceInvariant[]): PlaceInvariant[] {
  const seen = new Set<string>();
  const result: PlaceInvariant[] = [];
  for (const inv of invariants) {
    const sig = [...inv.places]
      .sort((a, b) => a.placeId.localeCompare(b.placeId))
      .map((p) => `${p.placeId}:${p.weight}`)
      .join("|");
    if (seen.has(sig)) {
      continue;
    }
    seen.add(sig);
    result.push(inv);
  }
  return result;
}
