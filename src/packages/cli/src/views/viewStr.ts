/**
 * Type-safe string extraction for view arguments.
 * Narrows `unknown` to string via typeof guard, preventing
 * SonarLint S6551 ("[object Object]" stringification).
 */
export function str(v: unknown, fallback: unknown = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof fallback === "string") return fallback;
  if (typeof fallback === "number" || typeof fallback === "boolean") return String(fallback);
  return "";
}
