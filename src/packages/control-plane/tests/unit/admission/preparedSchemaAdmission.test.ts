import { describe, expect, it } from "vitest";
import { preparedAdmissionId, planDigest } from "@cantilune/core";
import {
  createPreparedSchemaAdmission,
  isPreparedSchemaAdmission,
} from "../../../src/admission/preparedSchemaAdmission.js";

describe("prepared schema admission brand", () => {
  it("creates branded prepared admission", () => {
    const prepared = createPreparedSchemaAdmission({
      preparedId: preparedAdmissionId("prep-001"),
      planDigest: planDigest("plan-dig") as string,
      expiresAt: "2026-08-11T01:00:00Z",
    });
    expect(isPreparedSchemaAdmission(prepared)).toBe(true);
    expect(prepared.preparedId).toBe("prep-001");
  });

  it("rejects plain objects without brand", () => {
    expect(
      isPreparedSchemaAdmission({
        preparedId: "prep-forged",
        planDigest: "plan",
        expiresAt: "2026-08-11T01:00:00Z",
      }),
    ).toBe(false);
    expect(isPreparedSchemaAdmission(null)).toBe(false);
    expect(isPreparedSchemaAdmission(undefined)).toBe(false);
  });
});
