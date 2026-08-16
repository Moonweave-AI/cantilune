/**
 * Descriptive statistics for preregistered analysis (RFC-0004 §10).
 * Tukey fences follow Tukey 1977 exploratory data analysis.
 */

export function meanOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sampleVariance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = meanOf(values);
  let sum = 0;
  for (const value of values) {
    const delta = value - mean;
    sum += delta * delta;
  }
  return sum / (values.length - 1);
}

export function sampleStdDev(values: readonly number[]): number {
  return Math.sqrt(sampleVariance(values));
}

export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (p <= 0) return sorted[0]!;
  if (p >= 1) return sorted[sorted.length - 1]!;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo]!;
  const weight = index - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

export function tukeyFences(values: readonly number[]): { readonly lower: number; readonly upper: number } {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export function withoutTukeyOutliers(values: readonly number[]): readonly number[] {
  if (values.length < 4) return values;
  const fences = tukeyFences(values);
  return values.filter((value) => value >= fences.lower && value <= fences.upper);
}

export function pooledStdDev(valuesA: readonly number[], valuesB: readonly number[]): number {
  const nA = valuesA.length;
  const nB = valuesB.length;
  if (nA + nB < 3) return 0;
  const varA = sampleVariance(valuesA);
  const varB = sampleVariance(valuesB);
  const pooled = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
  return Math.sqrt(Math.max(0, pooled));
}

export function cohenD(valuesA: readonly number[], valuesB: readonly number[]): number {
  const pooled = pooledStdDev(valuesA, valuesB);
  if (pooled === 0) return 0;
  return (meanOf(valuesB) - meanOf(valuesA)) / pooled;
}

/** Hedges 1981 small-sample correction of Cohen's d. */
export function hedgesG(valuesA: readonly number[], valuesB: readonly number[]): number {
  const d = cohenD(valuesA, valuesB);
  const df = valuesA.length + valuesB.length - 2;
  if (df <= 0) return d;
  return d * (1 - 3 / (4 * df - 1));
}

export function interpretCohenD(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude < 0.2) return "negligible";
  if (magnitude < 0.5) return "small";
  if (magnitude < 0.8) return "medium";
  return "large";
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapMeanSamples(
  values: readonly number[],
  draws: number,
  seed: number,
): readonly number[] {
  if (values.length === 0) return [];
  const random = mulberry32(seed);
  const samples: number[] = [];
  for (let i = 0; i < draws; i += 1) {
    let sum = 0;
    for (let j = 0; j < values.length; j += 1) {
      const index = Math.floor(random() * values.length);
      sum += values[index]!;
    }
    samples.push(sum / values.length);
  }
  return samples;
}
