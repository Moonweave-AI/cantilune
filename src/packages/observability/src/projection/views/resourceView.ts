import { type EventTagIndex } from "../../foundation/eventTagIndex.js";
import { type ResourceDelta } from "../../spine/projectionSlice.js";
import { type ScopedCapability } from "@cantilune/core";
import { deltasAtEvents, type AtEvent } from "./viewQueries.js";

export interface ResourceView {
  readonly capabilities: readonly ScopedCapability[];
  readonly byEvent: EventTagIndex<ResourceDelta>;
}

export function resourceView(init: {
  readonly capabilities: readonly ScopedCapability[];
  readonly byEvent: EventTagIndex<ResourceDelta>;
}): ResourceView {
  return init;
}

export function resourceEventsAt(view: ResourceView): readonly AtEvent<ResourceDelta>[] {
  return deltasAtEvents(view.byEvent);
}
