import { type EventTagIndex } from "../../foundation/eventTagIndex.js";
import { type CommunicationDelta } from "../../spine/projectionSlice.js";
import { type CommunicationSession } from "@cantilune/core";
import { deltasAtEvents, type AtEvent } from "./viewQueries.js";

export interface CommunicationView {
  readonly sessions: readonly CommunicationSession[];
  readonly byEvent: EventTagIndex<CommunicationDelta>;
}

export function communicationView(init: {
  readonly sessions: readonly CommunicationSession[];
  readonly byEvent: EventTagIndex<CommunicationDelta>;
}): CommunicationView {
  return init;
}

export function communicationEventsAt(
  view: CommunicationView,
): readonly AtEvent<CommunicationDelta>[] {
  return deltasAtEvents(view.byEvent);
}
