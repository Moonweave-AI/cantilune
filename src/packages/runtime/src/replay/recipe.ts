import type {
  ActorRef,
  ChangeId,
  ChangeVisibility,
  CoordinationChange,
  EpochId,
  EvidenceRef,
  LinkId,
  MatchBinding,
  OperationTypeId,
  SessionId,
  SnapshotRef,
  Timestamp,
  ContentRef,
  OperationScalarInputs,
} from "@cantilune/core";
import { coordinationChange } from "@cantilune/core";
import type { OperationTemplateRef } from "@cantilune/core";
import { targetsFromMatchBindings } from "@cantilune/core";
import type { EventKind } from "../foundation/eventKind.js";
import { eventKindFromVisibility, visibilityFromEventKind } from "../foundation/eventKind.js";
import type { AdmittedRecord } from "../admission/admittedRecord.js";
import { complementTagFromSelector, defaultComplementSelector } from "./complementSelector.js";
import type { ComplementSelector } from "./complementSelector.js";
import { matchWitnessFromBindings } from "./matchWitness.js";
import type { MatchWitness } from "./matchWitness.js";

/**
 * Replay input without beforeRef/afterRef — aligned with Lean Execution.ReplayRecipe.
 */
export interface ReplayRecipe {
  readonly epochId: EpochId;
  readonly operationTypeId: OperationTypeId;
  readonly templateRef?: OperationTemplateRef;
  readonly matchBindings: readonly MatchBinding[];
  readonly matchWitness: MatchWitness;
  readonly complementTag: number;
  readonly kind: EventKind;
  readonly authorization: readonly EvidenceRef[];
  readonly external: readonly EvidenceRef[];
  readonly createdSessionRefs: readonly SessionId[];
  readonly freshLinkRefs: readonly LinkId[];
  readonly inputContentRefs: readonly ContentRef[];
  readonly scalarInputs: OperationScalarInputs;
  /**
   * Commit-time heartbeat instant. This is persisted replay authority, not a
   * value that the heartbeat handler may regenerate from wall-clock time.
   */
  readonly emittedAt?: Timestamp;
  readonly visibility: ChangeVisibility;
}

export interface ReplayRecipeInit {
  readonly epochId: EpochId;
  readonly operationTypeId: OperationTypeId;
  readonly templateRef?: OperationTemplateRef;
  readonly matchBindings: readonly MatchBinding[];
  readonly matchWitness?: MatchWitness;
  readonly complementSelector?: ComplementSelector;
  readonly kind?: EventKind;
  readonly authorization?: readonly EvidenceRef[];
  readonly external?: readonly EvidenceRef[];
  readonly createdSessionRefs?: readonly SessionId[];
  readonly freshLinkRefs?: readonly LinkId[];
  readonly inputContentRefs?: readonly ContentRef[];
  readonly scalarInputs?: OperationScalarInputs;
  readonly emittedAt?: Timestamp;
  readonly visibility: ChangeVisibility;
}

export function replayRecipe(init: ReplayRecipeInit): ReplayRecipe {
  const witness = init.matchWitness ?? matchWitnessFromBindings(init.matchBindings);
  const complement = init.complementSelector ?? defaultComplementSelector();
  const visibility = init.visibility;
  const kind = init.kind ?? eventKindFromVisibility(visibility);
  const base = {
    epochId: init.epochId,
    operationTypeId: init.operationTypeId,
    matchBindings: init.matchBindings,
    matchWitness: witness,
    complementTag: complementTagFromSelector(complement),
    kind,
    authorization: init.authorization ?? [],
    external: init.external ?? [],
    createdSessionRefs: init.createdSessionRefs ?? [],
    freshLinkRefs: init.freshLinkRefs ?? [],
    inputContentRefs: init.inputContentRefs ?? [],
    scalarInputs: Object.fromEntries(Object.entries(init.scalarInputs ?? {})),
    ...(init.emittedAt !== undefined ? { emittedAt: init.emittedAt } : {}),
    visibility,
  };
  if (init.templateRef === undefined) {
    return base;
  }
  return { ...base, templateRef: init.templateRef };
}

export function replayRecipeFromChange(change: CoordinationChange): ReplayRecipe {
  return replayRecipe({
    epochId: change.epochId,
    operationTypeId: change.operationTypeId,
    ...(change.templateRef !== undefined ? { templateRef: change.templateRef } : {}),
    matchBindings: change.matchBindings,
    authorization: change.authorization,
    external: change.external,
    createdSessionRefs: change.createdSessionRefs,
    freshLinkRefs: [],
    inputContentRefs: [],
    scalarInputs: {},
    visibility: change.visibility,
    kind: eventKindFromVisibility(change.visibility),
  });
}

export function replayRecipeFromAdmitted(admitted: AdmittedRecord): ReplayRecipe {
  return admitted.recipe;
}

export function coordinationChangeFromCommit(input: {
  readonly recipe: ReplayRecipe;
  readonly changeId: ChangeId;
  readonly recordedAt: Timestamp;
  readonly beforeRef: SnapshotRef;
  readonly afterRef: SnapshotRef;
  readonly initiator: ActorRef;
  readonly involved: readonly ActorRef[];
}): CoordinationChange {
  const visibility = input.recipe.visibility ?? visibilityFromEventKind(input.recipe.kind);
  return coordinationChange({
    changeId: input.changeId,
    recordedAt: input.recordedAt,
    epochId: input.recipe.epochId,
    operationTypeId: input.recipe.operationTypeId,
    ...(input.recipe.templateRef !== undefined ? { templateRef: input.recipe.templateRef } : {}),
    beforeRef: input.beforeRef,
    afterRef: input.afterRef,
    matchBindings: input.recipe.matchBindings,
    targets: targetsFromMatchBindings(input.recipe.matchBindings),
    initiator: input.initiator,
    involved: input.involved,
    authorization: input.recipe.authorization,
    external: input.recipe.external,
    createdSessionRefs: input.recipe.createdSessionRefs,
    visibility,
  });
}

export function withRecipeSessions(
  recipe: ReplayRecipe,
  createdSessionRefs: readonly SessionId[],
): ReplayRecipe {
  return { ...recipe, createdSessionRefs: [...createdSessionRefs] };
}

export function withRecipeAuthorization(
  recipe: ReplayRecipe,
  authorization: readonly EvidenceRef[],
): ReplayRecipe {
  return { ...recipe, authorization: [...authorization] };
}

/** Pins the heartbeat's wall-clock input before apply so replay reuses it. */
export function withHeartbeatEmittedAt(recipe: ReplayRecipe, emittedAt: Timestamp): ReplayRecipe {
  return { ...recipe, emittedAt };
}
