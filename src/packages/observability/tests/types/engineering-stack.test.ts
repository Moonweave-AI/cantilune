import { describe, expect, it } from "vitest";
import * as foundation from "../../src/foundation/index.js";
import * as world from "../../src/world/index.js";
import * as input from "../../src/input/index.js";
import * as spine from "../../src/spine/index.js";
import * as projection from "../../src/projection/index.js";
import * as invariants from "../../src/invariants/index.js";
import * as diagnostic from "../../src/diagnostic/index.js";
import * as certificate from "../../src/certificate/index.js";
import * as engine from "../../src/engine/index.js";

/** Maps observability six-layer stack (03H) to exported module surfaces. */
describe("observability engineering module stack", () => {
  it("exports S0+O1–O6 layers through index barrels", () => {
    expect(typeof foundation.eventTagFromChange).toBe("function");
    expect(typeof world.buildEventSpine).toBe("function");
    expect(typeof input.assembleObservationWorld).toBe("function");
    expect(typeof spine.projectObservationWorld).toBe("function");
    expect(typeof projection.interpretDependencyDelta).toBe("function");
    expect(typeof invariants.validateCrossViewInvariants).toBe("function");
    expect(typeof diagnostic.compressDiagnostic).toBe("function");
    expect(typeof certificate.buildReadModelDerivationEvidence).toBe("function");
    expect(typeof engine.createObservabilityService).toBe("function");
  });
});
