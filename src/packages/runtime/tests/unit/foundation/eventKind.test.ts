import { describe, expect, it } from "vitest";
import {
  eventKindFromVisibility,
  visibilityFromEventKind,
} from "../../../src/foundation/eventKind.js";

describe("eventKind", () => {
  it("maps visibility and event kind 1:1", () => {
    expect(eventKindFromVisibility("external")).toBe("external");
    expect(visibilityFromEventKind("internal")).toBe("internal");
    expect(visibilityFromEventKind("administrative")).toBe("administrative");
  });
});
