import type { ContentDigest } from "@cantilune/core";

/**
 * Opaque branded tokens for high-risk pipeline stages.
 * Token factories are NOT exported — only the engine's evidence-driven
 * commands can mint tokens. Consumers MUST re-verify digest, validity,
 * revocation, and subject binding on receipt.
 */

declare const frozenProtocolBrand: unique symbol;
declare const admittedRunBrand: unique symbol;
declare const recordedRunBrand: unique symbol;
declare const scoredRunBrand: unique symbol;
declare const reviewedDecisionBrand: unique symbol;
declare const publishableReportBrand: unique symbol;

export interface FrozenEvaluationProtocol {
  readonly [frozenProtocolBrand]: true;
  readonly protocolDigest: ContentDigest;
  readonly frozenAt: string;
}

export interface AdmittedEvaluationRun {
  readonly [admittedRunBrand]: true;
  readonly planDigest: ContentDigest;
  readonly admittedAt: string;
}

export interface RecordedEvaluationRun {
  readonly [recordedRunBrand]: true;
  readonly resultDigest: ContentDigest;
  readonly recordedAt: string;
}

export interface ScoredEvaluationRun {
  readonly [scoredRunBrand]: true;
  readonly scoreDigest: ContentDigest;
  readonly scoredAt: string;
}

export interface ReviewedEvaluationDecision {
  readonly [reviewedDecisionBrand]: true;
  readonly evidenceRoot: ContentDigest;
  readonly reviewedAt: string;
}

export interface PublishableEvaluationReport {
  readonly [publishableReportBrand]: true;
  readonly reportDigest: ContentDigest;
  readonly signatureRefs: readonly string[];
  readonly publishableAt: string;
}

/** @internal — only the evaluation engine may call these */
export function _mintFrozenProtocolToken(
  protocolDigest: ContentDigest,
  frozenAt: string,
): FrozenEvaluationProtocol {
  return Object.freeze({ protocolDigest, frozenAt }) as FrozenEvaluationProtocol;
}

/** @internal */
export function _mintAdmittedRunToken(
  planDigest: ContentDigest,
  admittedAt: string,
): AdmittedEvaluationRun {
  return Object.freeze({ planDigest, admittedAt }) as AdmittedEvaluationRun;
}

/** @internal */
export function _mintRecordedRunToken(
  resultDigest: ContentDigest,
  recordedAt: string,
): RecordedEvaluationRun {
  return Object.freeze({ resultDigest, recordedAt }) as RecordedEvaluationRun;
}

/** @internal */
export function _mintScoredRunToken(
  scoreDigest: ContentDigest,
  scoredAt: string,
): ScoredEvaluationRun {
  return Object.freeze({ scoreDigest, scoredAt }) as ScoredEvaluationRun;
}

/** @internal */
export function _mintReviewedDecisionToken(
  evidenceRoot: ContentDigest,
  reviewedAt: string,
): ReviewedEvaluationDecision {
  return Object.freeze({ evidenceRoot, reviewedAt }) as ReviewedEvaluationDecision;
}

/** @internal */
export function _mintPublishableReportToken(
  reportDigest: ContentDigest,
  signatureRefs: readonly string[],
  publishableAt: string,
): PublishableEvaluationReport {
  if (signatureRefs.length === 0) {
    throw new Error("PublishableEvaluationReport requires at least one signature");
  }
  return Object.freeze({
    reportDigest,
    signatureRefs: Object.freeze([...signatureRefs]),
    publishableAt,
  }) as PublishableEvaluationReport;
}
