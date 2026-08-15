import { describe, it, expect } from "vitest";
import { isJudgeSafe, type JudgeProtocol } from "../../src/scoring/judgeProtocol.js";
import { judgeProtocolId } from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeProtocol(overrides: Partial<JudgeProtocol> = {}): JudgeProtocol {
  return {
    judgeId: judgeProtocolId("j1"),
    judgeType: "deterministic",
    modelProvider: undefined,
    modelVersion: undefined,
    promptDigest: undefined,
    rubricDigest: undefined,
    candidateIdentityMasking: true,
    presentationOrderRandomized: true,
    calibrationSetRef: undefined,
    graderCount: 3,
    quorum: 2,
    coiRule: "declare",
    selfReviewProhibited: true,
    interRaterStatistic: "kappa",
    disagreementAdjudication: "majority",
    retryRule: "once",
    failureRule: "exclude",
    judgeDigest: d("jd"),
    ...overrides,
  };
}

describe("Judge protocol safety", () => {
  it("accepts protocol with self-review prohibited and quorum met", () => {
    expect(isJudgeSafe(makeProtocol())).toBe(true);
  });

  it("rejects protocol when self-review is allowed", () => {
    expect(isJudgeSafe(makeProtocol({ selfReviewProhibited: false }))).toBe(false);
  });

  it("rejects protocol when grader count is below quorum", () => {
    expect(isJudgeSafe(makeProtocol({ graderCount: 1, quorum: 2 }))).toBe(false);
  });
});
