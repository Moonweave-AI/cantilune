import { describe, expect, it } from "vitest";
import * as foundation from "../../src/foundation/index.js";
import * as admission from "../../src/admission/index.js";
import * as observe from "../../src/observe/index.js";
import * as execution from "../../src/execution/index.js";
import * as replay from "../../src/replay/index.js";
import * as schema from "../../src/schema/index.js";
import * as memory from "../../src/memory/index.js";
import * as codec from "../../src/codec/index.js";
import * as engine from "../../src/engine/index.js";

/** Maps runtime six-layer stack (02H) to exported module surfaces. */
describe("runtime engineering module stack", () => {
  it("exports foundation through engine entry points", () => {
    expect(typeof foundation.admittedId).toBe("function");
    expect(typeof foundation.runtimeViolation).toBe("function");
    expect(typeof admission.createAdmissionGateway).toBe("function");
    expect(typeof observe.ingestObservation).toBe("function");
    expect(typeof execution.createCommitter).toBe("function");
    expect(typeof execution.replayKernelRun).toBe("function");
    expect(typeof replay.replayRecipe).toBe("function");
    expect(typeof schema.createDefaultSchema).toBe("function");
    expect(typeof memory.MemoryCollaborationStore).toBe("function");
    expect(typeof codec.encodeChange).toBe("function");
    expect(typeof engine.createCoordinationRuntime).toBe("function");
  });
});
