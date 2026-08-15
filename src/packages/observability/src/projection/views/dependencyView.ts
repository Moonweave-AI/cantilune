import { type EventTagIndex } from "../../foundation/eventTagIndex.js";
import { type DependencyDelta } from "../../spine/projectionSlice.js";
import { type CollaborationLink } from "@cantilune/core";
import { deltasAtEvents, type AtEvent } from "./viewQueries.js";

export interface DependencyView {
  readonly links: readonly CollaborationLink[];
  readonly byEvent: EventTagIndex<DependencyDelta>;
}

export function dependencyView(init: {
  readonly links: readonly CollaborationLink[];
  readonly byEvent: EventTagIndex<DependencyDelta>;
}): DependencyView {
  return init;
}

export function dependencyEventsAt(view: DependencyView): readonly AtEvent<DependencyDelta>[] {
  return deltasAtEvents(view.byEvent);
}
