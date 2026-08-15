import { operationTypeId } from "../primitives/ids.js";
import type { ContentRef, TargetRef } from "../primitives/refs.js";
import type { CoordinationIntent } from "../coordination/coordinationChange.js";
import { coordinationIntentFromTargets } from "../coordination/coordinationChange.js";
import type { ActorRef } from "../nodes/participant.js";
import type { Footprint, Goal, Interface, Outcome } from "./boundary.js";

/**
 * Agent-initiated structural verbs (write model).
 * Agents compose topology at runtime — wiring is not pre-authored dead structure.
 */
export type CompositionOperatorKind =
  "attach" | "delegate" | "fork" | "nest" | "rewire" | "isolate" | "close";

/** Maps composition operators to default operation templates (schema may override). */
const OPERATOR_TO_OPERATION: Record<CompositionOperatorKind, string> = {
  attach: "introduce_artifact",
  delegate: "delegate",
  fork: "fork_branch",
  nest: "create_session",
  rewire: "transfer_session",
  isolate: "introduce_artifact",
  close: "publish_artifact",
};

export interface CompositionIntentBase {
  readonly operator: CompositionOperatorKind;
  readonly initiator: ActorRef;
  /**
   * Agent-requested isolation scope (may be wider than targets for conservative locking).
   * Not authoritative for concurrency — see {@link effectiveFootprintOfCompositionIntent}.
   */
  readonly footprint: Footprint;
  readonly targets: readonly TargetRef[];
  /** Ordered handler inputs; separate from structural targets and external evidence. */
  readonly inputContentRefs?: readonly ContentRef[];
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
    inputContentRefs?: readonly ContentRef[];
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
  if (options === undefined) {
    return base;
  }
  return {
    ...base,
    ...(options.inputContentRefs !== undefined
      ? { inputContentRefs: options.inputContentRefs }
      : {}),
    ...(options.interface !== undefined ? { interface: options.interface } : {}),
    ...(options.binds !== undefined ? { binds: options.binds } : {}),
  };
}

/** Translate agent composition intent into runtime coordination intent for admission. */
export function toCoordinationIntent(composition: CompositionIntent): CoordinationIntent {
  const operation = operationTypeId(OPERATOR_TO_OPERATION[composition.operator]);
  return coordinationIntentFromTargets(
    composition.initiator,
    operation,
    composition.targets,
    undefined,
    composition.inputContentRefs,
  );
}

export function operationTypeForOperator(operator: CompositionOperatorKind): string {
  return OPERATOR_TO_OPERATION[operator];
}
