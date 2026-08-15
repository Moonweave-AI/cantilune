import type { Result } from "@cantilune/core";

export interface DecisionLogEntry {
  readonly sequence: number;
  readonly runId: string;
  readonly decisionDigest: string;
  readonly profile: string;
  readonly recordedAt: string;
  readonly entryDigest: string;
  readonly previousEntryDigest: string;
}

export interface DecisionAppendInput {
  readonly runId: string;
  readonly decisionDigest: string;
  readonly profile: string;
  readonly recordedAt: string;
}

export interface DecisionStore {
  readonly append: (input: DecisionAppendInput) => Promise<Result<DecisionLogEntry, "unavailable">>;
  readonly readAll: () => Promise<Result<readonly DecisionLogEntry[], "unavailable">>;
}
