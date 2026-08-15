import { describe, expect, it } from "vitest";
import { computeEvidenceDigest } from "../../src/canonical/evidenceDigest.js";

describe("canonical evidence digest", () => {
  it("computes stable sha256 over canonical json", () => {
    const a = computeEvidenceDigest({ z: 1, a: 2 });
    const b = computeEvidenceDigest({ a: 2, z: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes digest when payload tampered", () => {
    const original = computeEvidenceDigest({ ruleId: "r1", ok: true });
    const tampered = computeEvidenceDigest({ ruleId: "r1", ok: false });
    expect(original).not.toBe(tampered);
  });
});
