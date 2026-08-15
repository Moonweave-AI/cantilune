import type { ChangeVisibility } from "@cantilune/core";

/** Lean EventKind — maps 1:1 to ChangeVisibility in v1. */
export type EventKind = ChangeVisibility;

export function eventKindFromVisibility(visibility: ChangeVisibility): EventKind {
  return visibility;
}

export function visibilityFromEventKind(kind: EventKind): ChangeVisibility {
  return kind;
}
