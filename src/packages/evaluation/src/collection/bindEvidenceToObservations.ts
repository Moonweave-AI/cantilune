/**
 * Bind E8 evidence refs onto metric observations. Valid rows still require
 * at least one evidence ref after binding (RFC-0004 evidence flow).
 */
import { createHash } from "node:crypto";
import { contentDigest } from "@cantilune/core";
import {
  ok,
  violation,
  violations,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";
import { validateObservation, type MetricObservation } from "../scoring/metricObservation.js";
import type { CertifiedTraceEvidence } from "./certifiedTraceEvidence.js";
import type { TheoryOracleEvidence } from "../oracles/theoryOracleEvidence.js";

export function bindEvidenceToObservations(input: {
  readonly observations: readonly MetricObservation[];
  readonly traces?: readonly CertifiedTraceEvidence[];
  readonly oracles?: readonly TheoryOracleEvidence[];
}): EvaluationResult<readonly MetricObservation[]> {
  const extra = [
    ...(input.traces ?? []).map((trace) => `trace:${trace.coreEventRef}`),
    ...(input.oracles ?? []).map((oracle) => `oracle:${oracle.oracleCode}:${oracle.result}`),
  ];
  const bound = input.observations.map((obs) => {
    const evidenceRefs = [...new Set([...obs.evidenceRefs, ...extra])];
    const next: MetricObservation = {
      ...obs,
      evidenceRefs,
      rowDigest: contentDigest(
        createHash("sha256")
          .update(JSON.stringify({ id: obs.observationId, evidenceRefs }))
          .digest("hex"),
      ),
    };
    return next;
  });
  const errors = bound.flatMap((obs) =>
    validateObservation(obs).map((message) =>
      violation("evidence_incomplete", obs.observationId as string, message),
    ),
  );
  if (errors.length > 0) {
    return violations(errors);
  }
  return ok(bound);
}
