/**
 * Judge calibration fixture tests (ADR-0020 §4).
 *
 * Calibration is diagnostic-only (never a hard gate). These tests pin the
 * frozen fixture shape and exercise runCalibration against a deterministic
 * evaluator so the calibration path has coverage and does not drift.
 */
import { describe, it, expect } from "vitest";
import {
  frozenCalibrationSamples,
  runCalibration,
} from "../../../src/termination/judgeCalibration.js";
import type {
  AcceptanceCriterion,
  AgentState,
  CriterionEvaluation,
} from "../../../src/termination/types.js";

function constEvaluator(q: number): (c: AcceptanceCriterion, s: AgentState) => CriterionEvaluation {
  return (criterion) => ({
    criterionId: criterion.id,
    q,
    rho: 0.5,
    passed: q * 0.5 >= criterion.threshold,
    evidenceRefs: [],
    rationale: "const",
  });
}

describe("frozenCalibrationSamples", () => {
  it("returns a non-empty frozen set with llm_judge verifier ids", () => {
    const samples = frozenCalibrationSamples();
    expect(samples.length).toBeGreaterThan(0);
    for (const s of samples) {
      expect(s.criterion.verifierId).toBe("llm_judge");
      expect(s.criterion.kind).toBe("soft");
      expect(s.expectedQ).toBeGreaterThanOrEqual(0);
      expect(s.expectedQ).toBeLessThanOrEqual(1);
    }
  });

  it("each sample carries a complete AgentState", () => {
    for (const s of frozenCalibrationSamples()) {
      expect(s.state.environment).toBeDefined();
      expect(s.state.trace).toBeDefined();
      expect(s.state.pendingReply).toBeDefined();
      expect(s.state.artifacts).toBeDefined();
    }
  });
});

describe("runCalibration", () => {
  it("produces one report per sample with a deviation", () => {
    const samples = frozenCalibrationSamples();
    const reports = runCalibration(constEvaluator(0), samples);
    expect(reports).toHaveLength(samples.length);
    for (let i = 0; i < samples.length; i++) {
      expect(reports[i]!.sampleId).toBe(samples[i]!.id);
      expect(reports[i]!.observedQ).toBe(0);
      expect(reports[i]!.expectedQ).toBe(samples[i]!.expectedQ);
      expect(reports[i]!.deviation).toBe(samples[i]!.expectedQ);
    }
  });

  it("reports zero deviation when the evaluator matches the expected q", () => {
    const samples = frozenCalibrationSamples();
    const evaluator = (criterion: AcceptanceCriterion): CriterionEvaluation => {
      const sample = samples.find((s) => s.criterion.id === criterion.id)!;
      return {
        criterionId: criterion.id,
        q: sample.expectedQ,
        rho: 0.5,
        passed: sample.expectedQ * 0.5 >= criterion.threshold,
        evidenceRefs: [],
        rationale: "exact",
      };
    };
    const reports = runCalibration(evaluator, samples);
    for (const r of reports) {
      expect(r.deviation).toBe(0);
    }
  });

  it("works with a single-sample subset", () => {
    const [only] = frozenCalibrationSamples();
    const reports = runCalibration(constEvaluator(0.5), [only!]);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.sampleId).toBe(only!.id);
  });
});
