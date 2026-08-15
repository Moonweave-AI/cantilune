import { type EventTagIndex } from "../../foundation/eventTagIndex.js";
import { type StructureDelta } from "../../spine/projectionSlice.js";
import { type CollaborationLink, type DerivedDiagnosticView } from "@cantilune/core";
import { deltasAtEvents, type AtEvent } from "./viewQueries.js";

export interface StructureView {
  readonly composition: DerivedDiagnosticView;
  readonly structuralLinks: readonly CollaborationLink[];
  readonly byEvent: EventTagIndex<StructureDelta>;
}

export function structureView(init: {
  readonly composition: DerivedDiagnosticView;
  readonly structuralLinks: readonly CollaborationLink[];
  readonly byEvent: EventTagIndex<StructureDelta>;
}): StructureView {
  return init;
}

export function structureEventsAt(view: StructureView): readonly AtEvent<StructureDelta>[] {
  return deltasAtEvents(view.byEvent);
}
