import {
  clonePlainObject,
  cloneReadonlyArray,
  type ActorRef,
  type CoordinationChange,
  type EvidenceRef,
  type MatchBinding,
  type OperationScalarInputs,
  type OperationScalarValue,
  type OperationTemplateRef,
  type TargetRef,
} from "@cantilune/core";
import type { MatchWitness } from "./matchWitness.js";
import type { ReplayRecipe } from "./recipe.js";

function snapshotTemplateRef(value: OperationTemplateRef): OperationTemplateRef {
  return clonePlainObject({
    operationTypeId: value.operationTypeId,
    revision: value.revision,
  });
}

function snapshotMatchBinding(value: MatchBinding): MatchBinding {
  return clonePlainObject({ ...value });
}

function snapshotTargetRef(value: TargetRef): TargetRef {
  return clonePlainObject({ kind: value.kind, id: value.id });
}

function snapshotActorRef(value: ActorRef): ActorRef {
  return clonePlainObject({ actorId: value.actorId, kind: value.kind });
}

function snapshotEvidenceRef(value: EvidenceRef): EvidenceRef {
  return clonePlainObject({
    evidenceId: value.evidenceId,
    kind: value.kind,
    contentRef: value.contentRef,
  });
}

function snapshotMatchWitness(value: MatchWitness): MatchWitness {
  return clonePlainObject({
    domainSize: value.domainSize,
    codomainSize: value.codomainSize,
    embedding: cloneReadonlyArray(value.embedding),
  });
}

function snapshotScalarInputs(value: OperationScalarInputs): OperationScalarInputs {
  const copy: Record<string, OperationScalarValue> = {};
  for (const [name, scalar] of Object.entries(value)) {
    copy[name] = scalar;
  }
  return clonePlainObject(copy);
}

/**
 * Materialize replay-authoritative change data as detached, deeply immutable
 * own data. Memory persistence uses this at both ingress and egress so neither
 * the committing caller nor a later reader can rewrite committed history.
 */
export function snapshotCoordinationChange(value: CoordinationChange): CoordinationChange {
  return clonePlainObject({
    changeId: value.changeId,
    recordedAt: value.recordedAt,
    epochId: value.epochId,
    operationTypeId: value.operationTypeId,
    ...(value.templateRef !== undefined
      ? { templateRef: snapshotTemplateRef(value.templateRef) }
      : {}),
    beforeRef: value.beforeRef,
    afterRef: value.afterRef,
    matchBindings: cloneReadonlyArray(value.matchBindings, snapshotMatchBinding),
    targets: cloneReadonlyArray(value.targets, snapshotTargetRef),
    initiator: snapshotActorRef(value.initiator),
    involved: cloneReadonlyArray(value.involved, snapshotActorRef),
    authorization: cloneReadonlyArray(value.authorization, snapshotEvidenceRef),
    external: cloneReadonlyArray(value.external, snapshotEvidenceRef),
    createdSessionRefs: cloneReadonlyArray(value.createdSessionRefs),
    visibility: value.visibility,
  });
}

/** Deeply detached/frozen copy of the sidecar-owned replay recipe. */
export function snapshotReplayRecipe(value: ReplayRecipe): ReplayRecipe {
  return clonePlainObject({
    epochId: value.epochId,
    operationTypeId: value.operationTypeId,
    ...(value.templateRef !== undefined
      ? { templateRef: snapshotTemplateRef(value.templateRef) }
      : {}),
    matchBindings: cloneReadonlyArray(value.matchBindings, snapshotMatchBinding),
    matchWitness: snapshotMatchWitness(value.matchWitness),
    complementTag: value.complementTag,
    kind: value.kind,
    authorization: cloneReadonlyArray(value.authorization, snapshotEvidenceRef),
    external: cloneReadonlyArray(value.external, snapshotEvidenceRef),
    createdSessionRefs: cloneReadonlyArray(value.createdSessionRefs),
    freshLinkRefs: cloneReadonlyArray(value.freshLinkRefs),
    inputContentRefs: cloneReadonlyArray(value.inputContentRefs),
    scalarInputs: snapshotScalarInputs(value.scalarInputs),
    ...(value.emittedAt !== undefined ? { emittedAt: value.emittedAt } : {}),
    visibility: value.visibility,
  });
}
