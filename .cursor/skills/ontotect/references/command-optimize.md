# `optimize` command

Use `optimize` only for a measurable target such as classification time,
query latency, SHACL duration, memory, import/module size, CI duration, or human
review complexity.

## Entry

Require a representative ontology/data/import/query workload, a metric and
budget, the relevant environment conditions, and protected semantic results.
Without a measured baseline, the command may design the benchmark but cannot
claim optimization.

## Procedure

1. Freeze the benchmark inputs and semantic invariants.
2. Measure the baseline and variance relevant to the decision.
3. Locate the bottleneck before selecting a change.
4. Test one bounded intervention at a time: profile-compatible remodeling,
   module extraction, materialization, storage/query changes, shape targeting,
   or build simplification as appropriate.
5. Compare before/after measurements under the same contract.
6. Run logical, CQ, SHACL, mapping, and release regressions that protect meaning.

## Exit

Report metric, workload, before/after observations, protected invariants,
trade-offs, rollback path, and residual uncertainty. Smaller serialization or
fewer axioms alone is not evidence of improvement, and performance gain does
not authorize semantic loss.
