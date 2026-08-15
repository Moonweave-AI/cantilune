/**
 * Lifecycle transition validation — registry-based, never if-else.
 *
 * Each valid transition is registered as a named entry. Any transition
 * not in the registry is considered invalid.
 */
import type { ParticipationStatus } from "@cantilune/core";

type TransitionValidator = (current: ParticipationStatus) => boolean;

const LIFECYCLE_TRANSITIONS = new Map<string, TransitionValidator>([
  ["registered→active", (s) => s === "registered"],
  ["waiting→active", (s) => s === "waiting"],
  ["active→done", (s) => s === "active"],
  ["active→retired", (s) => s === "active"],
  ["active→waiting", (s) => s === "active"],
  ["active→blocked", (s) => s === "active"],
  ["done→retired", (s) => s === "done"],
  ["blocked→active", (s) => s === "blocked"],
]);

/**
 * Check if a lifecycle transition is valid.
 * Returns true only if `from → to` is registered and the validator passes.
 */
export function validateTransition(from: ParticipationStatus, to: ParticipationStatus): boolean {
  const key = `${from}→${to}`;
  const validator = LIFECYCLE_TRANSITIONS.get(key);
  return validator?.(from) ?? false;
}

/** Get all valid target states from a given state. */
export function validTransitionsFrom(from: ParticipationStatus): ParticipationStatus[] {
  const results: ParticipationStatus[] = [];
  for (const [key, validator] of LIFECYCLE_TRANSITIONS) {
    if (validator(from)) {
      const to = key.split("→")[1] as ParticipationStatus;
      results.push(to);
    }
  }
  return results;
}
