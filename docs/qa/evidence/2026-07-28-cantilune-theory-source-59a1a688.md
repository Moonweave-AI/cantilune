# Cantilune theory source evidence

- Source commit: `59a1a6885ef6a2774b2731f487f83228e67d15dc`
- Completed-build provenance commit: `4c2e90b0b0a64621629a6c494f2ae21a6a6555ab`
- Composite audit command: `C:\Users\NJHL\AppData\Local\Temp\run-cantilune-composite-e26b23b.ps1`
- Composite audit exit code: `0`
- Delivery classification: `proved / review-pending`
- Scope: generic four-projection core plus one substantive reference execution;
  eight production packages remain separate Product Conformance work.

## Source-equivalent proof gate

The pinned clean run rebuilt 8,662 dependency jobs and entered the Cantilune
serial phase. Its external two-hour runner limit interrupted that serial phase.
The continuation began 116 seconds later, established two stable process-drain
polls before its resumed serial phase, and completed all 565 Cantilune modules,
44,282 readable dependency artifacts, 2,825 readable project artifacts, and
aggregate no-build closure from the same clean artifact state.

The continuation's only audit failures were four stale qualified declaration
names. They were repaired without modifying Lean source. The composite audit
then checked all 1,624 declarations, allowing only `propext`,
`Classical.choice`, and `Quot.sound`, and completed immutable-tree checks before
and after the audit.

The completed-build provenance commit and this source commit differ in no
`formal/**/*.lean` or `formal/*.lean` file. Both represent the same 565 Lean
sources with aggregate SHA-256
`4a6f6259c846fef61d56be65407694f68f183a794c229d390f6adcfff2a3b1b0`.
The later source changes only the qualified audit registry, workflow timeout,
Windows-safe S/E/P ancestry gate, and their integrity pins.

The final Windows gate correction has two parts:

1. expected Git exit 128 for an absent parent-tree evidence path is inspected
   under a local non-terminating error preference; and
2. that expected value is reset to zero so GitHub Actions and local wrappers do
   not propagate it after a successful script.

`formal/source-integrity.json` pins the final `formal/scripts/ci.ps1` at
canonical UTF-8/LF SHA-256
`cfa72b58b17a336c4ab7f3473e8523f34c216bf9d91e3cf3aae29d849bab7782`.
The pointer commit must independently pass
`formal/scripts/ci.ps1 -RequireProved -VerifyTreeOnly`.

## Runtime record digests

- Initial clean-build wrapper:
  `d38ede96bc89eaf66db6733f5a2656607e32318c6acb580ecaa3d4aad8236058`
- Initial clean-build stdout:
  `6e4705384a1e7de439649175234b3a6af2f8ea5935eda95be6fbc0f3c9c24bdb`
- Empty stderr:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Interrupted-exit sentinel:
  `6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b`
- Completed-build stdout:
  `a2c9b2a577defb257e30755d56a4c99d24b1f3e779bb3c0d41b36834a0f5d44d`
- Composite audit stdout:
  `6f644bfe9e885dffc61dfe8412f65b6cf0087613bccb53eb92de77b5049d585e`
- Kernel-audit raw output:
  `a5e29b6847c0a860bf537882750f178c05bc11ea28770bae95a64cc9a6209a53`

## Kernel-bound central declarations

- `Cantilune.Core.FreeSMCArbitraryUniversal.AtomicComparison.freeSMC_arbitrary_universal`
- `Cantilune.Core.dpo_result_unique`
- `Cantilune.Core.DPOConcurrency.ParallelIndependent.parallel_independent_concurrency`
- `Cantilune.Core.signature_extension_coherent`
- `Cantilune.Core.ObservableLTS.rewrite_respects_equiv`
- `Cantilune.Core.DPOEvent.event_replay_unique`
- `Cantilune.Core.ProjectionCertificate.projection_paths_lift_and_reflect`
- `Cantilune.Theorems.TechnicalClosure.generic_p1a_projection_scope`
- `Cantilune.Theorems.TechnicalClosure.generic_petri_projection`
- `Cantilune.Theorems.TechnicalClosure.completeOpenPiSMCOperationalBoundary`
- `Cantilune.Pi.Step.standard_typed_pi_erasure_operational`
- `Cantilune.Theorems.TechnicalClosure.maximum_compatible_d1a_fms_closure`
- `Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate`
- `Cantilune.Pi.P1cEnrichedStructuralCertificate.complete_enriched_structural_p1c_certificate`
- `Cantilune.Feedback.CompleteFiniteHeightClosure.FiniteHeightFeedbackClosure.hard_forward_invariant`
- `Cantilune.Feedback.CompleteFiniteHeightClosure.FiniteHeightFeedbackClosure.feedback_almost_sure_hitting_with_replay`
- `Cantilune.Pi.P1cTerminalExecutionClassification.p1c_terminal_classification_iff`
- `Cantilune.Theorems.TechnicalClosure.generic_four_projection_consistency`

## Exact successful gate records

Pinned Lean toolchain: leanprover/lean4:v4.32.0

Source integrity gate: 565 Lean files, aggregate 4a6f6259c846fef61d56be65407694f68f183a794c229d390f6adcfff2a3b1b0.

Lean placeholder gate: clean (565 project source files).

Reused full-build provenance gate: clean (565 modules, 44282 dependency artifacts, 2825 project artifacts).

Kernel dependency allowlist gate: clean (1624 declarations).

Formal development evidence gate completed successfully.

## Governance boundary

This is not an independent human review, FCP approval, ADR acceptance, push,
pull request, or production-package certificate. Final status remains
`proved / review-pending`; the eight production packages retain their separate
rule, resource, authorization, fairness, probability, and trajectory
obligations.
