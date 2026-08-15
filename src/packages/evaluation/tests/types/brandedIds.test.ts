import { describe, it, expect } from "vitest";
import type {
  EvaluationClaimId,
  EvaluationProtocolId,
  BenchmarkSuiteId,
  BenchmarkCaseId,
  DatasetId,
  EvaluationSubjectId,
  EvaluationRunId,
  RunAttemptId,
  MetricId,
  MetricObservationId,
  OracleId,
  BudgetPolicyId,
  ReportId,
} from "../../src/foundation/evaluationIds.js";
import type { EpochId } from "@cantilune/core";

describe("L2: Branded ID type safety", () => {
  it("EvaluationClaimId is not assignable to EvaluationProtocolId", () => {
    const _check = (id: EvaluationClaimId) => {
      // @ts-expect-error — incompatible branded types
      const _: EvaluationProtocolId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("BenchmarkSuiteId is not assignable to BenchmarkCaseId", () => {
    const _check = (id: BenchmarkSuiteId) => {
      // @ts-expect-error — incompatible branded types
      const _: BenchmarkCaseId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("EvaluationRunId is not assignable to RunAttemptId", () => {
    const _check = (id: EvaluationRunId) => {
      // @ts-expect-error — incompatible branded types
      const _: RunAttemptId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("MetricId is not assignable to MetricObservationId", () => {
    const _check = (id: MetricId) => {
      // @ts-expect-error — incompatible branded types
      const _: MetricObservationId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("DatasetId is not assignable to BenchmarkSuiteId", () => {
    const _check = (id: DatasetId) => {
      // @ts-expect-error — incompatible branded types
      const _: BenchmarkSuiteId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("EvaluationSubjectId is not assignable to EvaluationRunId", () => {
    const _check = (id: EvaluationSubjectId) => {
      // @ts-expect-error — incompatible branded types
      const _: EvaluationRunId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("OracleId is not assignable to MetricId", () => {
    const _check = (id: OracleId) => {
      // @ts-expect-error — incompatible branded types
      const _: MetricId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("BudgetPolicyId is not assignable to ReportId", () => {
    const _check = (id: BudgetPolicyId) => {
      // @ts-expect-error — incompatible branded types
      const _: ReportId = id;
    };
    expect(typeof _check).toBe("function");
  });

  it("EvaluationClaimId is not assignable to EpochId (cross-package)", () => {
    const _check = (id: EvaluationClaimId) => {
      // @ts-expect-error — incompatible branded types
      const _: EpochId = id;
    };
    expect(typeof _check).toBe("function");
  });
});
