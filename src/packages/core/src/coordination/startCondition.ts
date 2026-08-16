/**
 * Declarative, composable start-condition expressions for Agent lifecycle.
 *
 * Evaluated by a ConditionEvaluatorRegistry at runtime — never by switch/case
 * exhaustion. New condition kinds are added by registering evaluators, not by
 * extending this union.
 */

/** Atomic condition — delegated to a named evaluator in the registry. */
export interface StartConditionAtom {
  readonly evaluator: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** Recursive expression tree over atoms and logical operators. */
export type StartConditionExpression =
  | { readonly operator: "atom"; readonly atom: StartConditionAtom }
  | { readonly operator: "and"; readonly operands: readonly StartConditionExpression[] }
  | { readonly operator: "or"; readonly operands: readonly StartConditionExpression[] }
  | { readonly operator: "not"; readonly operand: StartConditionExpression };

/** Construct an atom expression. */
export function conditionAtom(
  evaluator: string,
  params: Record<string, unknown> = {},
): StartConditionExpression {
  return { operator: "atom", atom: { evaluator, params } };
}

/** Construct an AND expression. */
export function conditionAnd(...operands: StartConditionExpression[]): StartConditionExpression {
  return { operator: "and", operands };
}

/** Construct an OR expression. */
export function conditionOr(...operands: StartConditionExpression[]): StartConditionExpression {
  return { operator: "or", operands };
}

/** Construct a NOT expression. */
export function conditionNot(operand: StartConditionExpression): StartConditionExpression {
  return { operator: "not", operand };
}

/** Well-known "always true" atom — agent starts immediately upon registration. */
export const ALWAYS_CONDITION: StartConditionExpression = conditionAtom("always");

/** Well-known "never" atom — agent will never auto-start (manual activation). */
export const NEVER_CONDITION: StartConditionExpression = conditionAtom("never");

const ALWAYS_ALIASES = new Set(["always", "true", "unconditional", "immediately", "now"]);
const NEVER_ALIASES = new Set(["never", "false", "manual"]);

function asAtomParams(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

/**
 * Canonicalize a manifest `startCondition` written by an LLM or a typed caller.
 *
 * The scheduler only evaluates {@link StartConditionExpression} trees. A missing
 * field, empty string, or prose sentence is not a declared condition — it is
 * treated as {@link ALWAYS_CONDITION} so the agent is admitted instead of
 * sitting in `condition_unmet` forever. Well-known aliases (`always` / `never`)
 * and a bare `{ evaluator, params }` atom are accepted. Unknown evaluator
 * names stay in the tree and remain fail-closed at evaluation time.
 */
export function normalizeStartCondition(value: unknown): StartConditionExpression {
  if (value === undefined || value === null) return ALWAYS_CONDITION;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0 || ALWAYS_ALIASES.has(trimmed)) return ALWAYS_CONDITION;
    if (NEVER_ALIASES.has(trimmed)) return NEVER_CONDITION;
    return ALWAYS_CONDITION;
  }
  if (typeof value !== "object") return ALWAYS_CONDITION;
  const record = value as Record<string, unknown>;
  if (typeof record.evaluator === "string" && record.operator === undefined) {
    return conditionAtom(record.evaluator, asAtomParams(record.params));
  }
  if (record.operator === "atom") {
    const atom = record.atom;
    if (atom !== null && typeof atom === "object") {
      const named = atom as { evaluator?: unknown; params?: unknown };
      if (typeof named.evaluator === "string" && named.evaluator.length > 0) {
        return conditionAtom(named.evaluator, asAtomParams(named.params));
      }
    }
    return ALWAYS_CONDITION;
  }
  if (record.operator === "and" || record.operator === "or") {
    const operands = Array.isArray(record.operands)
      ? record.operands.map(normalizeStartCondition)
      : [];
    return record.operator === "and" ? conditionAnd(...operands) : conditionOr(...operands);
  }
  if (record.operator === "not") {
    return conditionNot(normalizeStartCondition(record.operand));
  }
  return ALWAYS_CONDITION;
}
