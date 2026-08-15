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
