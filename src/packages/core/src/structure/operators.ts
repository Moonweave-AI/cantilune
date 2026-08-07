import { operationTypeId } from "../primitives/ids.js";
import type { TargetRef } from "../primitives/refs.js";
import type { CoordinationIntent } from "../coordination/coordinationChange.js";
import { coordinationIntent } from "../coordination/coordinationChange.js";
import type { ActorRef } from "../nodes/participant.js";
import type { Footprint, Goal, Interface, Outcome } from "./boundary.js";

/**
 * Agent-initiated structural verbs (write model).
 * Agents compose topology at runtime — wiring is not pre-authored dead structure.
 */
export type CompositionOperatorKind =
  | "attach"
  | "delegate"
  | "fork"
  | "nest"
  | "rewire"
  | "isolate"
  | "close";

/** Maps composition operators to default operation templates (schema may override). */
const OPERATOR_TO_OPERATION: Record<CompositionOperatorKind, string> = {
  attach: "introduce_artifact",
  delegate: "delegate",
  fork: "introduce_artifact",
  nest: "create_session",
  rewire: "transfer_session",
  isolate: "introduce_artifact",
  close: "publish_artifact",
};

export interface CompositionIntentBase {
  readonly operator: CompositionOperatorKind;
  readonly initiator: ActorRef;
  readonly footprint: Footprint;
  readonly targets: readonly TargetRef[];
  readonly interface?: Interface;
  readonly binds?: Goal | Outcome;
}

export type CompositionIntent = CompositionIntentBase;

export function compositionIntent(
  operator: CompositionOperatorKind,
  initiator: ActorRef,
  footprint: Footprint,
  targets: readonly TargetRef[],
  options?: {
    interface?: Interface;
    binds?: Goal | Outcome;
  },
): CompositionIntent {
  const base: CompositionIntentBase = {
    operator,
    initiator,
    footprint,
    targets,
  };
  if (options?.interface !== undefined) {
    return { ...base, interface: options.interface };
  }
  if (options?.binds !== undefined) {
    return { ...base, binds: options.binds };
  }
  return base;
}

/** Translate agent composition intent into runtime coordination intent for admission. */
export function toCoordinationIntent(composition: CompositionIntent): CoordinationIntent {
  const operation = operationTypeId(OPERATOR_TO_OPERATION[composition.operator]);
  return coordinationIntent(
    composition.initiator,
    operation,
    composition.targets,
  );
}

export function operationTypeForOperator(operator: CompositionOperatorKind): string {
  return OPERATOR_TO_OPERATION[operator];
}
