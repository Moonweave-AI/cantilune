# Local formal build evidence — 2026-07-26, global SSC/Fubini/sparse-event increment

Status: successful pinned Lean kernel build, source-integrity check,
placeholder scan, and dependency audit of the current mutable working tree.
This record is not immutable commit-bound evidence and is not an independent
human QA-L4 signature.

## Repository and environment

- repository `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch: `codex/theory-foundation`
- proof-sensitive state: modified and untracked relative to `HEAD`
- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`

Git safe-directory values for the repository and dependency checkouts were
provided only through process-local environment variables. No global Git
configuration was changed.

## New load-bearing declarations covered

The root build includes:

- the generated omega-closed nondeterministic subalgebra and its exact strict
  factorization;
- a well-founded generator/constant/choice/omega syntax and its
  source-dependent cardinal bound;
- transport of the complete omega-CPO and strict semilattice computation
  structure to a support in one fixed `Type 0`;
- the actual all-source `SolutionSetCondition.{0}`, ordinary right-adjoint
  evidence, free functor, free/forgetful adjunction, and ordinary monad;
- an unconditional CPO-enriched free/forgetful hom equivalence, continuity
  of free extension and functorial hom action, and naturality in both
  variables;
- the jointly continuous canonical sequential Fubini candidate, pure-unit
  law, and first-argument divergence/deadlock/choice laws;
- the general no-go
  `no_commutative_first_strict_pairing`, showing that separated constants,
  strict preservation of both constants, and swap commutativity imply
  `False`;
- two caller-supplied finite state-kernel trajectory coupling;
- a sparse event-payload Markov kernel on `State × Option Event`, its genuine
  Ionescu--Tulcea path measure, exact state pushforward, positive-support
  native step and verified `DPOEvent` replay, and exact two-kernel path
  coupling; and
- the experimental positional named-boundary algebraic SMC with its scope
  comments corrected after independent adversarial review.

## Complete ordinary evidence gate

Executed from `formal/`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\ci.ps1
```

Observed result:

- source integrity: 384 Lean source files;
- source aggregate SHA-256:
  `e14b886283e3efa46b555ea6d272020476f40a4b5eae52871a4e770e29566990`;
- pinned axiom-target-list SHA-256:
  `ca839c63e143c58490aa55fc8e498effa7060ff2ea06fca4ebd90ba25d6e0cbf`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- root `lake build`: successful, 9038 jobs;
- kernel dependency audit: 1076 declarations;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`;
- ordinary evidence-gate exit code: 0.

Existing Lean linter warnings were emitted, but there were no build or audit
errors.

## Completion-gate regression

Executed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\ci.ps1 -RequireComplete
```

Observed result: expected exit code 1. The gate listed exactly 11
`implemented_unverified` and 7 `partial_scaffold` obligations, with zero
`proved` or `reviewed`.

## Independent agent-level review

The Open-pi positional review accepted the object representation,
freshening, algebraically presented SMC equations, and exact single native
restriction/sync/close propagation. It rejected promotion to a total
operational named Open-pi SMC:

- neither raw operand is renamed onto the realized middle boundary;
- fresh middle names are disjoint from both operands;
- the sync channel need not be a realized middle port;
- there is no quotient-Hom-to-raw realization/adequacy bridge; and
- the finite-control identity no-go is conditional on an explicitly assumed
  arbitrarily-long-native-run realization.

The probability review accepted the exact two-state-kernel path marginals and
the new sparse event-kernel construction. It confirmed that the sparse
version imposes event proof obligations only on positive `some event` mass
and permits an unlabelled diagonal hold without fabricating a self-event.

These are agent-level implementation reviews, not human QA-L4 signatures.

## Exact terminal boundary

This evidence does not establish the requested total theory closure:

- the current strengthened FMS target is inconsistent: separated
  divergence/deadlock plus strict preservation of both constants cannot be
  combined with canonical swap-commutative Fubini;
- consequently no actual separated commutative powerdomain, recursive
  `A ≅ P(H A)`, hiding, adequacy, separately scoped definability, or
  full-abstraction inhabitant is constructed;
- the total operational named-boundary SMC still lacks endpoint
  realization/adequacy and an RFC-selected wire semantics;
- the sparse event theorem consumes caller-supplied kernels and a semantic
  coupling/seam; it does not supply epoch/signature/progress/epsilon facts;
- all eight planned production packages still lack rule inventories and
  package-owned rank, pre-net, resource/session, authorization, fairness,
  stable-window, and positive-epsilon inputs; and
- immutable provenance, human QA-L4, RFC-0002 FCP, and ADR-0001 acceptance
  remain absent.

No proof-manifest status is promoted by this run.
