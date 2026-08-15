import type { CoordinationIntent, MatchBinding } from "@cantilune/core";
import { targetsFromMatchBindings } from "@cantilune/core";

function cloneBinding(binding: MatchBinding): MatchBinding {
  return { ...binding };
}

/** Deep-copy bindings and derive targets as the single authoritative target list. */
export function normalizeCoordinationIntent(intent: CoordinationIntent): CoordinationIntent {
  const matchBindings = intent.matchBindings.map(cloneBinding);
  const targets = targetsFromMatchBindings(matchBindings);
  const normalized: CoordinationIntent = {
    initiator: { ...intent.initiator },
    operationTypeId: intent.operationTypeId,
    matchBindings,
    targets,
  };
  return {
    ...normalized,
    ...(intent.inputContentRefs !== undefined
      ? { inputContentRefs: [...intent.inputContentRefs] }
      : {}),
    ...(intent.scalarInputs !== undefined
      ? { scalarInputs: Object.fromEntries(Object.entries(intent.scalarInputs)) }
      : {}),
    ...(intent.external !== undefined
      ? { external: intent.external.map((item) => ({ ...item })) }
      : {}),
  };
}
