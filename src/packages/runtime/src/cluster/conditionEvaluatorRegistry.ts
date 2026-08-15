/**
 * Condition evaluator registry — extensible start-condition evaluation.
 *
 * Evaluates StartConditionExpression trees recursively. Each atom is
 * dispatched to a named evaluator registered in this registry.
 * New condition types are added by registering evaluators — no switch/case.
 */
import type {
  CollaborationSnapshot,
  ActorId,
  ArtifactId,
  StartConditionExpression,
  StartConditionAtom,
} from "@cantilune/core";

export interface ConditionEvaluationContext {
  readonly snapshot: CollaborationSnapshot;
  readonly targetAgent: ActorId;
}

export type ConditionEvaluator = (
  params: Readonly<Record<string, unknown>>,
  context: ConditionEvaluationContext,
) => boolean;

export interface ConditionEvaluatorRegistry {
  register(name: string, evaluator: ConditionEvaluator): void;
  evaluate(expression: StartConditionExpression, context: ConditionEvaluationContext): boolean;
}

export class InMemoryConditionEvaluatorRegistry implements ConditionEvaluatorRegistry {
  private readonly evaluators = new Map<string, ConditionEvaluator>();

  register(name: string, evaluator: ConditionEvaluator): void {
    this.evaluators.set(name, evaluator);
  }

  evaluate(expression: StartConditionExpression, context: ConditionEvaluationContext): boolean {
    return this.evaluateExpression(expression, context);
  }

  private evaluateExpression(
    expr: StartConditionExpression,
    ctx: ConditionEvaluationContext,
  ): boolean {
    if (expr.operator === "atom") {
      return this.evaluateAtom(expr.atom, ctx);
    }
    if (expr.operator === "and") {
      return expr.operands.every((op) => this.evaluateExpression(op, ctx));
    }
    if (expr.operator === "or") {
      return expr.operands.some((op) => this.evaluateExpression(op, ctx));
    }
    if (expr.operator === "not") {
      return !this.evaluateExpression(expr.operand, ctx);
    }
    return false;
  }

  private evaluateAtom(atom: StartConditionAtom, ctx: ConditionEvaluationContext): boolean {
    const evaluator = this.evaluators.get(atom.evaluator);
    if (evaluator === undefined) {
      return false;
    }
    return evaluator(atom.params, ctx);
  }
}

/** Create a registry pre-loaded with default evaluators. */
export function createDefaultConditionRegistry(): ConditionEvaluatorRegistry {
  const registry = new InMemoryConditionEvaluatorRegistry();

  registry.register("always", () => true);
  registry.register("never", () => false);

  registry.register("agentsDone", (params, ctx) => {
    const agents = params["agents"] as string[] | undefined;
    if (agents === undefined || agents.length === 0) return false;
    return agents.every((agentId) => {
      const p = ctx.snapshot.participants.get(agentId as ActorId);
      return p?.status === "done" || p?.status === "retired";
    });
  });

  registry.register("agentsActive", (params, ctx) => {
    const agents = params["agents"] as string[] | undefined;
    if (agents === undefined || agents.length === 0) return false;
    return agents.every((agentId) => {
      const p = ctx.snapshot.participants.get(agentId as ActorId);
      return p?.status === "active";
    });
  });

  registry.register("artifactPublished", (params, ctx) => {
    const id = params["artifactId"] as string | undefined;
    if (id === undefined) return false;
    const artifact = ctx.snapshot.artifacts.get(id as ArtifactId);
    if (artifact === undefined) return false;
    return (artifact as unknown as { lifecycle?: string }).lifecycle === "published";
  });

  return registry;
}
