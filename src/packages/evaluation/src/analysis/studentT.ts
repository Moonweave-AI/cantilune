/**
 * Student-t / normal primitives for RFC-0004 §10 intervals and p-values.
 *
 * Inverse normal: Peter J. Acklam (2003) rational approximation.
 * log-gamma: Lanczos g=7 (Numerical Recipes / Wikipedia coefficients).
 * Regularized incomplete beta: Lentz continued fraction (Numerical Recipes).
 * t-quantiles: exact Cauchy (ν=1) and ν=2; Newton on the t-CDF otherwise.
 * These are analysis utilities — they do not decide claim support.
 */

const ACKLAM_A = [
  -3.969683028665376e1, 2.209460984213129e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239e0,
] as const;
const ACKLAM_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
] as const;
const ACKLAM_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0,
  4.374664141464968e0, 2.938163982698783e0,
] as const;
const ACKLAM_D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0,
] as const;

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
] as const;

export function clampUnit(p: number): number {
  if (p <= 0) return Number.EPSILON;
  if (p >= 1) return 1 - Number.EPSILON;
  return p;
}

/** Inverse standard normal CDF Φ^{-1}(p). */
export function inverseNormalCdf(p: number): number {
  const q = clampUnit(p);
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (
      (((((ACKLAM_C[0] * r + ACKLAM_C[1]) * r + ACKLAM_C[2]) * r + ACKLAM_C[3]) * r + ACKLAM_C[4]) *
        r +
        ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * r + ACKLAM_D[1]) * r + ACKLAM_D[2]) * r + ACKLAM_D[3]) * r + 1)
    );
  }
  if (q > 1 - 0.02425) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -(
      (((((ACKLAM_C[0] * r + ACKLAM_C[1]) * r + ACKLAM_C[2]) * r + ACKLAM_C[3]) * r + ACKLAM_C[4]) *
        r +
        ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * r + ACKLAM_D[1]) * r + ACKLAM_D[2]) * r + ACKLAM_D[3]) * r + 1)
    );
  }
  const u = q - 0.5;
  const r = u * u;
  return (
    ((((((ACKLAM_A[0] * r + ACKLAM_A[1]) * r + ACKLAM_A[2]) * r + ACKLAM_A[3]) * r + ACKLAM_A[4]) *
      r +
      ACKLAM_A[5]) *
      u) /
    (((((ACKLAM_B[0] * r + ACKLAM_B[1]) * r + ACKLAM_B[2]) * r + ACKLAM_B[3]) * r + ACKLAM_B[4]) *
      r +
      1)
  );
}

export function logGamma(z: number): number {
  if (z <= 0) {
    throw new Error("logGamma requires z > 0");
  }
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const y = z - 1;
  let x = LANCZOS[0]!;
  for (let i = 1; i < LANCZOS.length; i += 1) {
    x += LANCZOS[i]! / (y + i);
  }
  const t = y + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(x);
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIter = 200;
  const epsilon = 3e-14;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) {
      return h;
    }
  }
  return h;
}

export function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (a <= 0 || b <= 0) {
    throw new Error("regularizedIncompleteBeta requires a > 0 and b > 0");
  }
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided complementary probability uses I_{ν/(ν+t²)}(ν/2, 1/2). */
export function studentTCdf(t: number, degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) {
    throw new Error("studentTCdf requires degreesOfFreedom > 0");
  }
  if (!Number.isFinite(t)) {
    return t > 0 ? 1 : 0;
  }
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  const ib = regularizedIncompleteBeta(degreesOfFreedom / 2, 0.5, x);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

export function twoSidedTPvalue(t: number, degreesOfFreedom: number): number {
  const upper = 1 - studentTCdf(Math.abs(t), degreesOfFreedom);
  return Math.min(1, Math.max(0, 2 * upper));
}

export function studentTQuantile(p: number, degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) {
    throw new Error("studentTQuantile requires degreesOfFreedom > 0");
  }
  const q = clampUnit(p);
  if (q === 0.5) return 0;
  if (degreesOfFreedom === 1) {
    return Math.tan(Math.PI * (q - 0.5));
  }
  if (degreesOfFreedom === 2) {
    return (2 * q - 1) / Math.sqrt(2 * q * (1 - q));
  }
  let t = inverseNormalCdf(q);
  for (let i = 0; i < 20; i += 1) {
    const cdf = studentTCdf(t, degreesOfFreedom);
    const density =
      Math.exp(
        logGamma((degreesOfFreedom + 1) / 2) -
          logGamma(degreesOfFreedom / 2) -
          0.5 * Math.log(Math.PI * degreesOfFreedom) -
          ((degreesOfFreedom + 1) / 2) * Math.log(1 + (t * t) / degreesOfFreedom),
      ) || Number.EPSILON;
    const delta = (cdf - q) / density;
    t -= delta;
    if (Math.abs(delta) < 1e-12) {
      return t;
    }
  }
  return t;
}

export function welchDegreesOfFreedom(
  varianceA: number,
  nA: number,
  varianceB: number,
  nB: number,
): number {
  const seA = varianceA / nA;
  const seB = varianceB / nB;
  const denom = (seA * seA) / (nA - 1) + (seB * seB) / (nB - 1);
  if (denom <= 0) return Math.max(1, nA + nB - 2);
  return (seA + seB) ** 2 / denom;
}
