import { coordinationChange } from "../../../src/coordination/coordinationChange.js";
import type { CoordinationChangeInit } from "../../../src/coordination/coordinationChange.js";

/** Test helper — production callers must set visibility explicitly. */
export function testCoordinationChange(
  init: Omit<CoordinationChangeInit, "visibility"> &
    Partial<Pick<CoordinationChangeInit, "visibility">>,
) {
  return coordinationChange({
    visibility: "internal",
    ...init,
  });
}
