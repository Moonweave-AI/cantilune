import { describe, expect, it } from "vitest";
import { contentDigest } from "@cantilune/core";
import { projectionCertificateDigest } from "../../../src/evidence/projectionCertificateDigest.js";

describe("projectionCertificateDigest", () => {
  it("holds only a digest string", () => {
    const ref = projectionCertificateDigest("sha256:abc");
    expect(ref).toEqual({ digest: "sha256:abc" });
    expect(Object.keys(ref)).toEqual(["digest"]);
  });

  it("accepts a core ContentDigest brand", () => {
    const digest = contentDigest("sha256:conformance-cert");
    expect(projectionCertificateDigest(digest).digest).toBe(digest);
  });

  it("rejects an empty digest", () => {
    expect(() => projectionCertificateDigest("")).toThrow(/non-empty string/);
  });
});
