/**
 * Claim status is decomposed into three orthogonal axes:
 * - lifecycle: proposed → protocolFrozen → measured → decided → independentlyReviewed → published → superseded | retracted
 * - decision: supported | notSupported | inconclusive | blocked | invalidated | undecided
 * - publication: unpublished | published | retracted
 *
 * The compound ClaimStatus is the lifecycle axis; decision and publication
 * are tracked via ClaimDecisionStatus and ClaimPublicationStatus respectively.
 */
export type ClaimStatus =
  | "proposed"
  | "protocolFrozen"
  | "measured"
  | "supported"
  | "notSupported"
  | "inconclusive"
  | "independentlyReviewed"
  | "published"
  | "superseded"
  | "retracted";

/** Claim lifecycle axis (without decision/publication conflation) */
export type ClaimLifecycle =
  | "proposed"
  | "protocolFrozen"
  | "measured"
  | "decided"
  | "independentlyReviewed"
  | "published"
  | "superseded"
  | "retracted";

/** Publication status axis — orthogonal to decision */
export type ClaimPublicationStatus = "unpublished" | "published" | "retracted";

/** Suite lifecycle: draft → reviewPending → approved → frozen → deprecated | revoked */
export type SuiteStatus =
  "draft" | "reviewPending" | "approved" | "frozen" | "deprecated" | "revoked";

/** Dataset lifecycle: proposed → provenanceChecked → privacyReviewed → approved → frozen → active → expired | quarantined | deleted */
export type DatasetStatus =
  | "proposed"
  | "provenanceChecked"
  | "privacyReviewed"
  | "approved"
  | "frozen"
  | "active"
  | "expired"
  | "quarantined"
  | "deleted";

/** Run lifecycle: planned → admitted → queued → leased → running → collecting → scoring → analyzing → reviewPending → accepted | rejected → published */
export type RunStatus =
  | "planned"
  | "admitted"
  | "queued"
  | "leased"
  | "running"
  | "collecting"
  | "scoring"
  | "analyzing"
  | "reviewPending"
  | "accepted"
  | "rejected"
  | "published"
  | "failed"
  | "cancelled"
  | "budgetExhausted"
  | "providerUnavailable"
  | "dataQuarantined"
  | "securityStopped";

/** Attempt lifecycle: queued → running → succeeded | failed | timedOut | cancelled */
export type AttemptStatus =
  "queued" | "running" | "succeeded" | "failed" | "timedOut" | "cancelled";

/** Product certificate status axis (independent of evaluation) */
export type CertificateValidity = "valid" | "expired" | "revoked" | "superseded";

/** Claim decision status — never a single boolean */
export type ClaimDecisionStatus =
  "supported" | "notSupported" | "inconclusive" | "blocked" | "invalidated";

/** Metric observation status */
export type MetricObservationStatus = "valid" | "invalid" | "missing" | "quarantined";

/** Theory oracle result — premiseMissing is NOT pass */
export type OracleResult =
  "passed" | "failed" | "premiseMissing" | "notApplicable" | "checkerUnavailable";

/** Privacy classification for dataset */
export type PrivacyClassification = "public" | "internal" | "confidential" | "restricted";

/** Benchmark case kind */
export type BenchmarkCaseKind = "structural" | "modelBacked" | "humanRated" | "adversarial";

/** Subject kind — candidate and baseline are structurally incompatible */
export type SubjectKind = "candidate" | "baseline";

/** Metric endpoint role */
export type MetricEndpointRole = "primary" | "secondary" | "guardrail";

/** Judge type */
export type JudgeType = "deterministic" | "schema" | "human" | "llm";

/** Oracle semantic layer */
export type OracleSemanticLayer = "effect" | "nativeTrace" | "terminal";

/** Metric aggregation method */
export type MetricAggregation =
  "mean" | "median" | "sum" | "min" | "max" | "ratio" | "count" | "custom";

/** Metric direction — higher is better or lower is better */
export type MetricDirection = "higher" | "lower";

/** Missing data treatment */
export type MissingTreatment = "exclude" | "impute" | "worstCase" | "fail";

/** Failure treatment */
export type FailureTreatment = "exclude" | "worstCase" | "fail" | "retry";

/** C1-C5 expressiveness classification */
export type ExpressivenessClassification =
  | "exactlyRepresentable"
  | "representableWithAdapter"
  | "contorted"
  | "partiallySupported"
  | "unsupported";

/** C3 decision taxonomy */
export type DecisionCategory =
  | "structure"
  | "deterministicPolicy"
  | "modelNodeInternal"
  | "human"
  | "externalService"
  | "unclassified";
