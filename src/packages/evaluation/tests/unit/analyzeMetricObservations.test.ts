import { describe, expect, it } from "vitest";
import {
  analyzeMetricObservations,
  createPreregisteredStatisticsEngine,
  DEFAULT_STATISTICS_CONFIG,
  recommendDecisionFromAnalysis,
} from "../../src/analysis/analyzeMetricObservations.js";
import { evaluationRunPlanId, evaluationSubjectId, metricId } from "../../src/foundation/evaluationIds.js";
import { makeObservation } from "../support/makeObservation.js";

describe("analyzeMetricObservations", () => {
  it("rejects an empty usable set", () => {
    const result = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      observations: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]?.code).toBe("invalid_input");
  });

  it("fail-closes when missingDataMethod is fail", () => {
    const result = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      observations: [
        makeObservation(),
        makeObservation({
          observationId: "obs-missing" as never,
          status: "missing",
          rawValue: undefined,
          normalizedValue: undefined,
        }),
      ],
      config: { ...DEFAULT_STATISTICS_CONFIG, missingDataMethod: "fail" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]?.code).toBe("metric_missing_treatment");
  });

  it("fail-closes undeclared extra looks", () => {
    const result = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      observations: [makeObservation(), makeObservation({ observationId: "obs-2" as never, rawValue: 0.8 })],
      plannedLooks: 1,
      actualLooks: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]?.code).toBe("analysis_stopping_rule_violated");
  });

  it("aggregates a single-arm student-t interval and records negative results", () => {
    const result = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      observations: [
        makeObservation({ rawValue: 0.1, normalizedValue: 0.1 }),
        makeObservation({
          observationId: "obs-2" as never,
          attemptId: "a2" as never,
          rawValue: -0.1,
          normalizedValue: -0.1,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.estimate.method).toContain("student-t");
    expect(result.value.confidenceOrCredibleInterval.level).toBe(0.95);
    expect(result.value.negativeResults.some((row) => row.includes("null"))).toBe(true);
    expect(recommendDecisionFromAnalysis(result.value)).toBe("inconclusive");
  });

  it("pairs candidate and baseline by case and applies Holm", () => {
    const result = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "paired",
      candidateSubjectRef: "cand",
      baselineSubjectRef: "base",
      observations: [
        makeObservation({
          subjectRef: evaluationSubjectId("base"),
          caseRef: "c1" as never,
          rawValue: 0,
          normalizedValue: 0,
        }),
        makeObservation({
          observationId: "obs-c" as never,
          subjectRef: evaluationSubjectId("cand"),
          caseRef: "c1" as never,
          rawValue: 1,
          normalizedValue: 1,
        }),
        makeObservation({
          observationId: "obs-b2" as never,
          subjectRef: evaluationSubjectId("base"),
          caseRef: "c2" as never,
          rawValue: 0,
          normalizedValue: 0,
        }),
        makeObservation({
          observationId: "obs-c2" as never,
          subjectRef: evaluationSubjectId("cand"),
          caseRef: "c2" as never,
          rawValue: 1,
          normalizedValue: 1,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pairedResults).toHaveLength(1);
    expect(result.value.pairedResults[0]?.difference).toBe(1);
    expect(result.value.effectSize?.method).toBe("hedges-g");
    expect(result.value.multipleComparisonAdjustment).toBe("holm");
    expect(recommendDecisionFromAnalysis(result.value)).toBe("notSupported");
  });

  it("labels exploratory analyses and imputes or worst-cases missing rows", () => {
    const imputed = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      exploratory: true,
      observations: [
        makeObservation({ rawValue: 1, normalizedValue: 1 }),
        makeObservation({
          observationId: "miss" as never,
          status: "missing",
          rawValue: undefined,
          normalizedValue: undefined,
        }),
      ],
      config: { ...DEFAULT_STATISTICS_CONFIG, missingDataMethod: "impute" },
    });
    expect(imputed.ok).toBe(true);
    if (imputed.ok) {
      expect(imputed.value.multipleComparisonAdjustment).toBe("exploratory-unadjusted");
      expect(imputed.value.missingnessAnalysis.imputationMethod).toBe("impute");
      expect(recommendDecisionFromAnalysis(imputed.value)).toBe("inconclusive");
    }

    const worst = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      analysisPlanDeclared: false,
      direction: "lower",
      observations: [
        makeObservation({ rawValue: 0.2, normalizedValue: 0.2 }),
        makeObservation({
          observationId: "miss2" as never,
          status: "quarantined",
          rawValue: undefined,
          normalizedValue: undefined,
        }),
      ],
      config: { ...DEFAULT_STATISTICS_CONFIG, missingDataMethod: "worstCase", outlierMethod: "tukey-fence" },
    });
    expect(worst.ok).toBe(true);
    if (worst.ok) {
      expect(worst.value.missingnessAnalysis.imputationMethod).toBe("worstCase");
    }
  });

  it("supports bootstrap and Welch intervals", () => {
    const bootstrap = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      bootstrapDraws: 50,
      bootstrapSeed: 1,
      observations: [
        makeObservation({ rawValue: 1, normalizedValue: 1 }),
        makeObservation({ observationId: "b" as never, rawValue: 2, normalizedValue: 2 }),
      ],
      config: { ...DEFAULT_STATISTICS_CONFIG, method: "bootstrap-percentile" },
    });
    expect(bootstrap.ok).toBe(true);
    if (bootstrap.ok) {
      expect(bootstrap.value.confidenceOrCredibleInterval.method).toBe("bootstrap-percentile");
    }

    const welch = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      candidateSubjectRef: "cand",
      baselineSubjectRef: "base",
      observations: [
        makeObservation({
          subjectRef: evaluationSubjectId("base"),
          caseRef: "a" as never,
          rawValue: 0,
          normalizedValue: 0,
        }),
        makeObservation({
          observationId: "b2" as never,
          subjectRef: evaluationSubjectId("base"),
          caseRef: "b" as never,
          rawValue: 0.1,
          normalizedValue: 0.1,
        }),
        makeObservation({
          observationId: "c1" as never,
          subjectRef: evaluationSubjectId("cand"),
          caseRef: "c" as never,
          rawValue: 2,
          normalizedValue: 2,
        }),
        makeObservation({
          observationId: "c2" as never,
          subjectRef: evaluationSubjectId("cand"),
          caseRef: "d" as never,
          rawValue: 2.2,
          normalizedValue: 2.2,
        }),
      ],
      config: { ...DEFAULT_STATISTICS_CONFIG, method: "welch-t", effectSizeMethod: "cohen-d" },
    });
    expect(welch.ok).toBe(true);
    if (welch.ok) {
      expect(welch.value.pairedResults[0]?.interval.method).toBe("welch-t");
      expect(welch.value.effectSize?.method).toBe("cohen-d");
    }
  });

  it("uses a degenerate interval when n=1 and fills higher-is-better worst case", () => {
    const single = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      observations: [makeObservation({ rawValue: 0.4, normalizedValue: 0.4 })],
    });
    expect(single.ok).toBe(true);
    if (single.ok) {
      expect(single.value.confidenceOrCredibleInterval.method).toContain("degenerate");
    }

    const worstHigher = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      direction: "higher",
      expectedObservationCount: 3,
      observations: [
        makeObservation({ rawValue: 0.8, normalizedValue: 0.8 }),
        makeObservation({ observationId: "h2" as never, rawValue: 0.9, normalizedValue: 0.9 }),
      ],
      config: { ...DEFAULT_STATISTICS_CONFIG, missingDataMethod: "worstCase" },
    });
    expect(worstHigher.ok).toBe(true);
    if (worstHigher.ok) {
      expect(worstHigher.value.missingnessAnalysis.totalMissing).toBeGreaterThan(0);
    }
  });

  it("exposes a StatisticsEngine port", async () => {
    const engine = createPreregisteredStatisticsEngine({
      planRef: evaluationRunPlanId("engine-plan"),
      population: "engine",
      candidateSubjectRef: "cand",
      baselineSubjectRef: "base",
      direction: "higher",
      plannedLooks: 1,
      actualLooks: 1,
      earlyStopReasons: [],
      exploratory: false,
      analysisPlanDeclared: true,
      environmentRef: "test",
      expectedObservationCount: 2,
    });
    const result = await engine.analyze(
      [
        makeObservation({ metricRef: metricId("primary"), rawValue: 1, normalizedValue: 1 }),
        makeObservation({
          observationId: "e2" as never,
          metricRef: metricId("primary"),
          rawValue: 1,
          normalizedValue: 1,
        }),
      ],
      DEFAULT_STATISTICS_CONFIG,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.planRef).toBe(evaluationRunPlanId("engine-plan"));

    const defaults = createPreregisteredStatisticsEngine();
    const fallback = await defaults.analyze(
      [makeObservation({ rawValue: 1, normalizedValue: undefined })],
      { ...DEFAULT_STATISTICS_CONFIG, confidenceLevel: 2, multipleComparisonMethod: "bonferroni" },
    );
    expect(fallback.ok).toBe(true);
  });

  it("allows a declared extra look and a single paired case", () => {
    const result = analyzeMetricObservations({
      planRef: evaluationRunPlanId("plan"),
      population: "all",
      plannedLooks: 1,
      actualLooks: 2,
      earlyStopReasons: ["budget"],
      candidateSubjectRef: "cand",
      baselineSubjectRef: "base",
      observations: [
        makeObservation({
          subjectRef: evaluationSubjectId("base"),
          rawValue: 0,
          normalizedValue: 0,
        }),
        makeObservation({
          observationId: "only-c" as never,
          subjectRef: evaluationSubjectId("cand"),
          rawValue: 0,
          normalizedValue: 0,
        }),
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stoppingAudit.earlyStopReasons).toEqual(["budget"]);
      expect(recommendDecisionFromAnalysis(result.value)).toBe("inconclusive");
    }
  });
});
