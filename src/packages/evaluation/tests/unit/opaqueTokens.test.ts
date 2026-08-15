import { describe, it, expect } from "vitest";
import {
  _mintFrozenProtocolToken,
  _mintAdmittedRunToken,
  _mintRecordedRunToken,
  _mintScoredRunToken,
  _mintReviewedDecisionToken,
  _mintPublishableReportToken,
} from "../../src/foundation/opaqueTokens.js";
import type { ContentDigest } from "@cantilune/core";

const digest = "abc123" as ContentDigest;

describe("Opaque tokens (internal mint)", () => {
  it("creates frozen protocol token", () => {
    const token = _mintFrozenProtocolToken(digest, "2026-01-15");
    expect(token.protocolDigest).toBe(digest);
    expect(token.frozenAt).toBe("2026-01-15");
    expect(Object.isFrozen(token)).toBe(true);
  });

  it("creates admitted run token", () => {
    const token = _mintAdmittedRunToken(digest, "2026-01-16");
    expect(token.planDigest).toBe(digest);
    expect(token.admittedAt).toBe("2026-01-16");
    expect(Object.isFrozen(token)).toBe(true);
  });

  it("creates recorded run token", () => {
    const token = _mintRecordedRunToken(digest, "2026-01-17");
    expect(token.resultDigest).toBe(digest);
  });

  it("creates scored run token", () => {
    const token = _mintScoredRunToken(digest, "2026-01-18");
    expect(token.scoreDigest).toBe(digest);
  });

  it("creates reviewed decision token", () => {
    const token = _mintReviewedDecisionToken(digest, "2026-01-19");
    expect(token.evidenceRoot).toBe(digest);
  });

  it("creates publishable report token with frozen signatures", () => {
    const token = _mintPublishableReportToken(digest, ["sig-1", "sig-2"], "2026-01-20");
    expect(token.reportDigest).toBe(digest);
    expect(token.signatureRefs).toEqual(["sig-1", "sig-2"]);
    expect(Object.isFrozen(token)).toBe(true);
  });

  it("rejects publishable report token with empty signatures", () => {
    expect(() => _mintPublishableReportToken(digest, [], "2026-01-20")).toThrow(
      "PublishableEvaluationReport requires at least one signature",
    );
  });
});
