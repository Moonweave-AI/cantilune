import { describe, expect, it } from "vitest";
import { planDigest } from "@cantilune/core";
import { planDigestFromCanonical } from "../../../src/administration/evidenceSubject.js";

describe("admission evidence subject helpers", () => {
  it("derives plan digest from canonical string", () => {
    expect(planDigestFromCanonical("canonical-plan")).toBe(planDigest("canonical-plan"));
  });
});
