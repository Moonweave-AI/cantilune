import type { ChangeId, ContentDigest, CoordinationChange, MatchBinding } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import { computeEvidenceDigest, isSha256HexDigest } from "./evidenceDigest.js";

export const RECIPE_CHAIN_REF_PREFIX = "recipe-chain:sha256:";

/** Portable replay recipe snapshot for canonical digest — mirrors runtime ReplayRecipe. */
export interface ReplayRecipeSnapshot {
  readonly epochId: string;
  readonly operationTypeId: string;
  readonly templateRef?: { readonly operationTypeId: string; readonly revision: string };
  readonly matchBindings: readonly { readonly role: string; readonly id: string }[];
  readonly matchWitness: {
    readonly domainSize: number;
    readonly codomainSize: number;
    readonly embedding: readonly number[];
  };
  readonly complementTag: number;
  readonly kind: string;
  readonly authorization: readonly string[];
  readonly external: readonly string[];
  readonly createdSessionRefs: readonly string[];
  readonly freshLinkRefs: readonly string[];
  readonly inputContentRefs: readonly string[];
  readonly visibility: string;
}

function bindingWire(binding: MatchBinding): { readonly role: string; readonly id: string } {
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

export function replayRecipeSnapshotFromChange(
  change: CoordinationChange,
  recipe: {
    readonly epochId: string;
    readonly operationTypeId: string;
    readonly templateRef?: { readonly operationTypeId: string; readonly revision: string };
    readonly matchBindings: readonly MatchBinding[];
    readonly matchWitness: ReplayRecipeSnapshot["matchWitness"];
    readonly complementTag: number;
    readonly kind: string;
    readonly authorization: readonly string[];
    readonly external: readonly string[];
    readonly createdSessionRefs: readonly string[];
    readonly freshLinkRefs: readonly string[];
    readonly inputContentRefs: readonly string[];
    readonly visibility: string;
  },
): ReplayRecipeSnapshot {
  return {
    epochId: recipe.epochId,
    operationTypeId: recipe.operationTypeId,
    ...(recipe.templateRef !== undefined ? { templateRef: recipe.templateRef } : {}),
    matchBindings: recipe.matchBindings.map(bindingWire),
    matchWitness: {
      domainSize: recipe.matchWitness.domainSize,
      codomainSize: recipe.matchWitness.codomainSize,
      embedding: [...recipe.matchWitness.embedding],
    },
    complementTag: recipe.complementTag,
    kind: recipe.kind,
    authorization: [...recipe.authorization],
    external: [...recipe.external],
    createdSessionRefs: [...recipe.createdSessionRefs],
    freshLinkRefs: [...recipe.freshLinkRefs],
    inputContentRefs: [...recipe.inputContentRefs],
    visibility: recipe.visibility,
  };
}

export function computeReplayRecipeDigest(snapshot: ReplayRecipeSnapshot): ContentDigest {
  return computeEvidenceDigest({ kind: "replayRecipe", recipe: snapshot });
}

export function computeReplayRecipeChainDigest(input: {
  readonly changes: readonly CoordinationChange[];
  readonly resolveRecipe: (change: CoordinationChange) => ReplayRecipeSnapshot;
}): ContentDigest {
  const entries = input.changes.map((change) => ({
    changeId: change.changeId as ChangeId,
    recipeDigest: computeReplayRecipeDigest(input.resolveRecipe(change)),
  }));
  return computeEvidenceDigest({ kind: "replayRecipeChain", entries });
}

export function formatRecipeChainRef(digest: ContentDigest): string {
  return `${RECIPE_CHAIN_REF_PREFIX}${digest as string}`;
}

export function parseRecipeChainRef(ref: string): ContentDigest | undefined {
  if (!ref.startsWith(RECIPE_CHAIN_REF_PREFIX)) {
    return undefined;
  }
  const hex = ref.slice(RECIPE_CHAIN_REF_PREFIX.length);
  if (!isSha256HexDigest(hex)) {
    return undefined;
  }
  return contentDigest(hex);
}

export function verifyRecipeChainRefMatchesChanges(input: {
  readonly recipeRef: string;
  readonly changes: readonly CoordinationChange[];
  readonly resolveRecipe: (change: CoordinationChange) => ReplayRecipeSnapshot;
}): boolean {
  const parsed = parseRecipeChainRef(input.recipeRef);
  if (parsed === undefined) {
    return false;
  }
  const expected = computeReplayRecipeChainDigest({
    changes: input.changes,
    resolveRecipe: input.resolveRecipe,
  });
  return (parsed as string) === (expected as string);
}
