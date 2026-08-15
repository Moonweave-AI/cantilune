/**
 * Judge calibration fixture (ADR-0020 §4) — a frozen set of criterion/state
 * pairs with expected `q` for offline calibration of the LLM judge. The judge
 * runs this set once at construction; the report records per-sample deviation
 * but is **diagnostic only** — it is NOT a hard gate (ADR-0020 §4: calibration
 * informs, never authorizes termination).
 *
 * Determinism: calibration is skipped entirely when no judge adapter is present
 * (no LLM call to calibrate against). The fixture itself is static data with no
 * randomness, so a pinned-seed replay reproduces the same calibration run.
 */
import type { AcceptanceCriterion, AgentState, CriterionEvaluation } from "./types.js";

export interface JudgeCalibrationSample {
  readonly id: string;
  readonly criterion: AcceptanceCriterion;
  readonly state: AgentState;
  readonly expectedQ: number;
}

export interface JudgeCalibrationReport {
  readonly sampleId: string;
  readonly observedQ: number;
  readonly expectedQ: number;
  readonly deviation: number;
}

/**
 * Build the frozen calibration fixture. The samples are deliberately simple
 * and stateless — they probe the judge's q-mapping, not the full termination
 * machinery. New samples are added here, never injected at runtime, so the
 * calibration set is auditable in source.
 */
export function frozenCalibrationSamples(): readonly JudgeCalibrationSample[] {
  return [
    {
      id: "calib-empty-reply",
      criterion: {
        id: "calib-empty-reply",
        description: "The agent must produce a substantive final answer.",
        kind: "soft",
        weight: 1,
        threshold: 0.5,
        verifierId: "llm_judge",
      },
      state: emptyCalibrationState(),
      expectedQ: 0,
    },
    {
      id: "calib-progress-no-reply",
      criterion: {
        id: "calib-progress-no-reply",
        description: "The agent must show measurable progress toward the goal.",
        kind: "soft",
        weight: 1,
        threshold: 0.5,
        verifierId: "llm_judge",
      },
      state: progressCalibrationState(),
      expectedQ: 0.5,
    },
  ];
}

/** Run calibration against a synchronous evaluator and return a diagnostic report. */
export function runCalibration(
  evaluate: (criterion: AcceptanceCriterion, state: AgentState) => CriterionEvaluation,
  samples: readonly JudgeCalibrationSample[] = frozenCalibrationSamples(),
): readonly JudgeCalibrationReport[] {
  const reports: JudgeCalibrationReport[] = [];
  for (const sample of samples) {
    const result = evaluate(sample.criterion, sample.state);
    const observed = result.q;
    const deviation = Math.abs(observed - sample.expectedQ);
    reports.push({
      sampleId: sample.id,
      observedQ: observed,
      expectedQ: sample.expectedQ,
      deviation,
    });
  }
  return reports;
}

// --- Minimal state fixtures (kept local so the fixture is self-contained) ----

function emptyCalibrationState(): AgentState {
  return {
    environment: {
      worldSummary: "empty calibration world",
      headRef: undefined,
      epochId: undefined,
      participantCount: 0,
      artifactCount: 0,
      auditTailLength: 0,
    },
    artifacts: { artifactIds: [], contentRefs: [] },
    evidence: { items: [] },
    trace: {
      conversationTurns: 0,
      plainTextTurns: 0,
      toolCallTurns: 0,
      recentAssistantTexts: [],
      committedOperations: 0,
      rejectedOperations: 0,
    },
    pendingReply: { text: "", hasToolCalls: false },
  };
}

function progressCalibrationState(): AgentState {
  return {
    environment: {
      worldSummary: "calibration world with one committed op",
      headRef: undefined,
      epochId: undefined,
      participantCount: 1,
      artifactCount: 0,
      auditTailLength: 1,
    },
    artifacts: { artifactIds: [], contentRefs: [] },
    evidence: { items: [] },
    trace: {
      conversationTurns: 1,
      plainTextTurns: 0,
      toolCallTurns: 1,
      recentAssistantTexts: [],
      committedOperations: 1,
      rejectedOperations: 0,
    },
    pendingReply: { text: "", hasToolCalls: false },
  };
}
