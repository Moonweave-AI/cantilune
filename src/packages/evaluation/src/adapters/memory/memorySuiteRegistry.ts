import type { BenchmarkSuiteId, BenchmarkCaseId } from "../../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { BenchmarkSuite, BenchmarkCase } from "../../benchmarks/benchmarkSuite.js";
import type { SuiteRegistry } from "../../ports/benchmarkData.js";

export function createMemorySuiteRegistry(): SuiteRegistry {
  const suites = new Map<string, BenchmarkSuite>();
  const cases = new Map<string, BenchmarkCase>();

  return {
    async register(suite: BenchmarkSuite): Promise<EvaluationResult<BenchmarkSuite>> {
      if (suites.has(suite.suiteId)) {
        return violations([
          violation("invalid_input", "suite.suiteId", `Suite already registered: ${suite.suiteId}`),
        ]);
      }
      suites.set(suite.suiteId, suite);
      return ok(suite);
    },

    async get(suiteId: BenchmarkSuiteId): Promise<BenchmarkSuite | undefined> {
      return suites.get(suiteId);
    },

    async listAll(): Promise<readonly BenchmarkSuite[]> {
      return [...suites.values()];
    },

    async getCases(suiteId: BenchmarkSuiteId): Promise<readonly BenchmarkCase[]> {
      return [...cases.values()].filter((c) => c.suiteId === suiteId);
    },

    async getCase(caseId: BenchmarkCaseId): Promise<BenchmarkCase | undefined> {
      return cases.get(caseId);
    },

    async registerCase(benchmarkCase: BenchmarkCase): Promise<EvaluationResult<BenchmarkCase>> {
      if (cases.has(benchmarkCase.caseId)) {
        return violations([
          violation(
            "invalid_input",
            "case.caseId",
            `Case already registered: ${benchmarkCase.caseId}`,
          ),
        ]);
      }
      if (!suites.has(benchmarkCase.suiteId)) {
        return violations([
          violation(
            "invalid_input",
            "case.suiteId",
            `Parent suite not found: ${benchmarkCase.suiteId}`,
          ),
        ]);
      }
      cases.set(benchmarkCase.caseId, benchmarkCase);
      return ok(benchmarkCase);
    },
  };
}
