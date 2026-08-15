import type { ContentDigest } from "@cantilune/core";
import type { JudgeProtocolId, ReviewRecordId } from "../foundation/evaluationIds.js";
import type { JudgeType } from "../foundation/evaluationStatus.js";

export interface JudgeProtocol {
  readonly judgeId: JudgeProtocolId;
  readonly judgeType: JudgeType;
  readonly modelProvider: string | undefined;
  readonly modelVersion: string | undefined;
  readonly promptDigest: ContentDigest | undefined;
  readonly rubricDigest: ContentDigest | undefined;
  readonly candidateIdentityMasking: boolean;
  readonly presentationOrderRandomized: boolean;
  readonly calibrationSetRef: string | undefined;
  readonly graderCount: number;
  readonly quorum: number;
  readonly coiRule: string;
  readonly selfReviewProhibited: boolean;
  readonly interRaterStatistic: string;
  readonly disagreementAdjudication: string;
  readonly retryRule: string;
  readonly failureRule: string;
  readonly judgeDigest: ContentDigest;
}

export interface HumanReviewRecord {
  readonly reviewId: ReviewRecordId;
  readonly judgeRef: JudgeProtocolId;
  readonly reviewerId: string;
  readonly reviewerRole: string;
  readonly planRef: string;
  readonly resultRef: string;
  readonly evidenceRootRef: string;
  readonly decision: string;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly coiDeclaration: string;
  readonly reviewerSignature: string;
  readonly reviewedAt: string;
  readonly reviewDigest: ContentDigest;
}

/**
 * LLM judge must NOT hold tools, network control, or secrets.
 * Deterministic oracle should be preferred over LLM judge.
 */
export function isJudgeSafe(protocol: JudgeProtocol): boolean {
  return protocol.selfReviewProhibited && protocol.graderCount >= protocol.quorum;
}
