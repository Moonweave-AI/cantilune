import type { MatchBinding } from "@cantilune/core";

/**
 * Lean matchEmbedding engineering encoding.
 * Domain slots map into codomain indices (named bindings order).
 */
export interface MatchWitness {
  readonly domainSize: number;
  readonly codomainSize: number;
  /** embedding[domainIndex] = codomainIndex */
  readonly embedding: readonly number[];
}

export function matchWitnessFromBindings(bindings: readonly MatchBinding[]): MatchWitness {
  const size = bindings.length;
  return {
    domainSize: size,
    codomainSize: size,
    embedding: bindings.map((_, index) => index),
  };
}

export function verifyMatchWitness(
  witness: MatchWitness,
  bindings: readonly MatchBinding[],
): boolean {
  if (witness.domainSize !== bindings.length) {
    return false;
  }
  if (witness.codomainSize < witness.domainSize) {
    return false;
  }
  const seen = new Set<number>();
  for (const index of witness.embedding) {
    if (index < 0 || index >= witness.codomainSize) {
      return false;
    }
    if (seen.has(index)) {
      return false;
    }
    seen.add(index);
  }
  return witness.embedding.length === witness.domainSize;
}
