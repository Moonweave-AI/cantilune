import {
  coordinationChange,
  matchBinding,
  targetRef,
  type ActorRef,
  type ChangeId,
  type CoordinationChange,
  type EpochId,
  type EvidenceRef,
  type MatchBinding,
  type OperationScalarInputs,
  type OperationTypeId,
  type SessionId,
  type SnapshotRef,
  type TargetRef,
  type Timestamp,
} from "@cantilune/core";
import type { MatchWitness } from "../replay/matchWitness.js";
import type { ReplayRecipe } from "../replay/recipe.js";
import { replayRecipeFromChange } from "../replay/recipe.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import {
  assertTargetsDerivedFromBindings,
  parseChangeWire,
  type CodecParseResult,
} from "./wireValidation.js";

export interface MatchWitnessWireDto {
  readonly domainSize: number;
  readonly codomainSize: number;
  readonly embedding: readonly number[];
}

export interface MatchBindingWireDto {
  readonly role: string;
  readonly id: string;
}

export interface ChangeWireDto {
  readonly changeId: string;
  readonly recordedAt: string;
  readonly epochId: string;
  readonly operationTypeId: string;
  readonly templateRef?: { readonly operationTypeId: string; readonly revision: string };
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly matchBindings: readonly MatchBindingWireDto[];
  readonly targets: readonly { readonly kind: string; readonly id: string }[];
  readonly initiator: ActorRef;
  readonly involved: readonly ActorRef[];
  readonly authorization: readonly EvidenceRef[];
  readonly external: readonly EvidenceRef[];
  readonly createdSessionRefs: readonly string[];
  readonly visibility: "internal" | "external" | "administrative";
  readonly matchWitness?: MatchWitnessWireDto;
  readonly complementTag?: number;
  readonly freshLinkRefs?: readonly string[];
  readonly inputContentRefs?: readonly string[];
  readonly scalarInputs?: OperationScalarInputs;
  readonly emittedAt?: string;
}

function bindingToWire(binding: MatchBinding): MatchBindingWireDto {
  switch (binding.role) {
    case "task":
    case "artifact":
      return { role: binding.role, id: binding.artifactId };
    case "from":
    case "to":
    case "delegator":
    case "delegatee":
    case "participant":
      return { role: binding.role, id: binding.actorId };
    case "capability":
      return { role: binding.role, id: binding.capabilityId };
    case "session":
      return { role: binding.role, id: binding.sessionId };
    case "link":
      return { role: binding.role, id: binding.linkId };
  }
}

function bindingFromWire(dto: MatchBindingWireDto): MatchBinding {
  return matchBinding(dto.role as MatchBinding["role"], dto.id);
}

/**
 * Encode a change whose replay recipe is derivable from the public change.
 * `emit_heartbeat` requires its sidecar-owned deterministic `emittedAt`, so
 * callers must use `encodeChangeWithRecipe` for that operation; this shorthand
 * fails closed instead of inventing replay evidence.
 */
export function encodeChange(change: CoordinationChange): ChangeWireDto {
  return encodeChangeWithRecipe(change, replayRecipeFromChange(change));
}

export function encodeChangeWithRecipe(
  change: CoordinationChange,
  recipe: ReplayRecipe,
): ChangeWireDto {
  if (change.operationTypeId === "emit_heartbeat" && recipe.emittedAt === undefined) {
    throw new Error("cannot encode emit_heartbeat without replay-authoritative emittedAt");
  }
  const base: ChangeWireDto = {
    changeId: change.changeId,
    recordedAt: change.recordedAt,
    epochId: change.epochId,
    operationTypeId: change.operationTypeId,
    beforeRef: change.beforeRef,
    afterRef: change.afterRef,
    matchBindings: change.matchBindings.map(bindingToWire),
    targets: change.targets.map((target) => ({ kind: target.kind, id: target.id })),
    initiator: change.initiator,
    involved: [...change.involved],
    authorization: [...change.authorization],
    external: [...change.external],
    createdSessionRefs: [...change.createdSessionRefs],
    visibility: change.visibility,
    matchWitness: witnessToWire(recipe.matchWitness),
    complementTag: recipe.complementTag,
    ...(recipe.freshLinkRefs.length > 0 ? { freshLinkRefs: [...recipe.freshLinkRefs] } : {}),
    ...(recipe.inputContentRefs.length > 0
      ? { inputContentRefs: [...recipe.inputContentRefs] }
      : {}),
    ...(Object.keys(recipe.scalarInputs).length > 0
      ? { scalarInputs: { ...recipe.scalarInputs } }
      : {}),
    ...(recipe.emittedAt !== undefined ? { emittedAt: recipe.emittedAt } : {}),
  };
  if (change.templateRef === undefined) {
    return base;
  }
  return { ...base, templateRef: change.templateRef };
}

export function decodeChange(dto: ChangeWireDto): CoordinationChange {
  return decodeChangeWithRecipe(dto).change;
}

export function decodeChangeFromUnknown(
  input: unknown,
): { readonly change: CoordinationChange; readonly recipe: ReplayRecipe } | RuntimeViolation {
  const parsed = parseChangeWire(input);
  if (!parsed.ok) {
    return parsed.violation;
  }
  return decodeChangeWithRecipe(parsed.value);
}

export function parseChangeWireDto(input: unknown): CodecParseResult<ChangeWireDto> {
  return parseChangeWire(input);
}

export function decodeChangeWithRecipe(dto: ChangeWireDto): {
  readonly change: CoordinationChange;
  readonly recipe: ReplayRecipe;
} {
  const change = coordinationChange({
    changeId: dto.changeId as ChangeId,
    recordedAt: dto.recordedAt as Timestamp,
    epochId: dto.epochId as EpochId,
    operationTypeId: dto.operationTypeId as OperationTypeId,
    ...(dto.templateRef !== undefined ? { templateRef: dto.templateRef } : {}),
    beforeRef: dto.beforeRef as SnapshotRef,
    afterRef: dto.afterRef as SnapshotRef,
    matchBindings: dto.matchBindings.map(bindingFromWire),
    targets: dto.targets.map((target) => targetRef(target.kind as TargetRef["kind"], target.id)),
    initiator: dto.initiator,
    involved: dto.involved,
    authorization: dto.authorization,
    external: dto.external,
    createdSessionRefs: dto.createdSessionRefs as SessionId[],
    visibility: dto.visibility,
  });

  if (!assertTargetsDerivedFromBindings(change.matchBindings, dto.targets)) {
    throw new Error("codec internal: targets/bindings mismatch after parse");
  }

  const recipe = replayRecipeFromChange(change);
  const extendedRecipe: ReplayRecipe = {
    ...recipe,
    ...(dto.matchWitness !== undefined ? { matchWitness: witnessFromWire(dto.matchWitness) } : {}),
    ...(dto.complementTag !== undefined ? { complementTag: dto.complementTag } : {}),
    ...(dto.freshLinkRefs !== undefined
      ? { freshLinkRefs: dto.freshLinkRefs as ReplayRecipe["freshLinkRefs"][number][] }
      : {}),
    ...(dto.inputContentRefs !== undefined
      ? {
          inputContentRefs: dto.inputContentRefs as ReplayRecipe["inputContentRefs"][number][],
        }
      : {}),
    ...(dto.scalarInputs !== undefined ? { scalarInputs: { ...dto.scalarInputs } } : {}),
    ...(dto.emittedAt !== undefined ? { emittedAt: dto.emittedAt as Timestamp } : {}),
  };

  if (change.operationTypeId === "emit_heartbeat" && extendedRecipe.emittedAt === undefined) {
    throw new Error("emit_heartbeat change wire missing replay-authoritative emittedAt");
  }

  if (
    dto.matchWitness === undefined &&
    dto.complementTag === undefined &&
    dto.freshLinkRefs === undefined &&
    dto.inputContentRefs === undefined &&
    dto.scalarInputs === undefined &&
    dto.emittedAt === undefined
  ) {
    return { change, recipe };
  }

  return { change, recipe: extendedRecipe };
}

function witnessToWire(witness: MatchWitness): MatchWitnessWireDto {
  return {
    domainSize: witness.domainSize,
    codomainSize: witness.codomainSize,
    embedding: [...witness.embedding],
  };
}

function witnessFromWire(dto: MatchWitnessWireDto): MatchWitness {
  return {
    domainSize: dto.domainSize,
    codomainSize: dto.codomainSize,
    embedding: dto.embedding,
  };
}
