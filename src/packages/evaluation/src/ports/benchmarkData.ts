import type { ContentDigest } from "@cantilune/core";
import type { EvaluationResult } from "../foundation/evaluationResult.js";
import type { BenchmarkSuite, BenchmarkCase } from "../benchmarks/benchmarkSuite.js";
import type { DatasetManifest } from "../datasets/datasetManifest.js";
import type { BenchmarkSuiteId, BenchmarkCaseId, DatasetId } from "../foundation/evaluationIds.js";

export interface SuiteRegistry {
  register(suite: BenchmarkSuite): Promise<EvaluationResult<BenchmarkSuite>>;
  registerCase(benchmarkCase: BenchmarkCase): Promise<EvaluationResult<BenchmarkCase>>;
  get(suiteId: BenchmarkSuiteId): Promise<BenchmarkSuite | undefined>;
  listAll(): Promise<readonly BenchmarkSuite[]>;
  getCases(suiteId: BenchmarkSuiteId): Promise<readonly BenchmarkCase[]>;
  getCase(caseId: BenchmarkCaseId): Promise<BenchmarkCase | undefined>;
}

export interface DatasetRegistry {
  register(manifest: DatasetManifest): Promise<EvaluationResult<DatasetManifest>>;
  get(datasetId: DatasetId): Promise<DatasetManifest | undefined>;
  listAll(): Promise<readonly DatasetManifest[]>;
}

export interface DatasetStore {
  put(
    datasetId: DatasetId,
    splitRef: string,
    data: Uint8Array,
  ): Promise<EvaluationResult<ContentDigest>>;
  get(datasetId: DatasetId, splitRef: string): Promise<EvaluationResult<Uint8Array>>;
  has(digest: ContentDigest): Promise<boolean>;
  verifyDigest(datasetId: DatasetId, splitRef: string, expected: ContentDigest): Promise<boolean>;
}

export interface RestrictedDataStore {
  putEncrypted(key: string, data: Uint8Array): Promise<EvaluationResult<ContentDigest>>;
  getEncrypted(key: string): Promise<EvaluationResult<Uint8Array>>;
  delete(key: string): Promise<EvaluationResult<void>>;
}

export interface LicensePolicy {
  checkAllowed(license: string, use: string): Promise<boolean>;
}

export interface PrivacyPolicy {
  checkCompliance(
    classification: string,
    residency: string,
    use: string,
  ): Promise<EvaluationResult<void>>;
}

export interface ContaminationScanner {
  scan(
    datasetId: DatasetId,
    candidateRef: string,
  ): Promise<EvaluationResult<ContaminationScanResult>>;
}

export interface ContaminationScanResult {
  readonly status: "clean" | "suspected" | "confirmed";
  readonly overlappingRefs: readonly string[];
  readonly method: string;
  readonly scannedAt: string;
}
