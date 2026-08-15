import type { ChangeVisibility, MatchBinding } from "@cantilune/core";
import type { OperationTypeId } from "@cantilune/core";
import type { OperationTemplateRef } from "@cantilune/core";

/** Executable predicate name for template requires/ensures. */
export type ConditionKind =
  | "task.exists"
  | "task.not_exists"
  | "session.exists"
  | "session.controller_matches"
  | "delegator.holds"
  | "delegatee.can_accept"
  | "participant.registered";

export interface TemplateCondition {
  readonly kind: ConditionKind;
  /** Maps predicate parameter names to match binding roles. */
  readonly bindings: Readonly<Record<string, MatchBinding["role"]>>;
}

export interface OperationTemplate {
  readonly operationTypeId: OperationTypeId;
  readonly templateRef: OperationTemplateRef;
  readonly description: string;
  readonly requiredRoles: readonly MatchBinding["role"][];
  readonly requires: readonly TemplateCondition[];
  readonly ensures: readonly TemplateCondition[];
  readonly defaultVisibility: ChangeVisibility;
  readonly mayCreateSessions: boolean;
}

export type MatchRole = MatchBinding["role"];
