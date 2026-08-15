# `status` command

Use `status` to reconstruct current work, check whether a gate is actually
complete, and identify the next bounded action. It is read-only.
Its stage is the stage reconstructed from project evidence; when evidence does
not establish one, report `Current stage: unverified` rather than defaulting to
`verify` or another lifecycle stage.

## Entry

Prefer a filled [work-state.md](../assets/work-state.md), project brief,
competency-question manifest, evidence manifest, review/repair report, or
release checklist. If none exists, inspect the authorized project artifacts and
mark reconstructed claims as assumptions until verified.

## Procedure

1. Identify the active command, target, baseline, pipeline, and mutation
   boundary.
2. Map present artifacts to Stages A–G.
3. Separate evidence actually executed from planned, stale, or merely reported
   evidence. Without the execution contract and evidence artifact, a reported
   pass remains `unverified`.
4. Record each check's underlying result as `pass`, `fail`, `error`,
   `unverified`, or justified `not-applicable`, plus a separate
   `accepted-exception` overlay when valid. Then apply the command contract's
   precedence to mark the lifecycle gate `pass`, `pass-with-actions`, `revise`,
   `blocked`, or `unverified`.
5. Identify unresolved domain decisions, authority, imports, mappings, or
   consumer impacts.
6. Recommend the next command and entry stage without executing it.

## Output

- current command, stage, and gate disposition;
- facts versus assumptions;
- artifact and evidence inventory;
- blockers and residual risk;
- recommended next command, Owner/DRI, and entry condition.

Never infer completion from file presence, a prior chat summary, or a green
advisory audit alone.
