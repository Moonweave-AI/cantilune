# Cantilune theory source evidence

- Source commit: `89df6fef65abab42a8a57cca2c461b305f0b97c3`
- Completed-build provenance commit: `4c2e90b0b0a64621629a6c494f2ae21a6a6555ab`
- Prior sealed source commit: `e26b23bdb3de159ba566d49b8653a105ec7c4acd`
- Composite audit command: `C:\Users\NJHL\AppData\Local\Temp\run-cantilune-composite-e26b23b.ps1`
- Composite audit interval: `2026-07-28T06:32:16Z` through `2026-07-28T06:34:58Z`
- Composite audit exit code: `0`
- Delivery classification: `proved / review-pending`
- Scope: generic four-projection core plus one substantive reference execution
  package; the eight production packages remain a separate Product Conformance
  phase.

## Source succession and the Windows ancestry-gate correction

The source commit in this record descends from the prior sealed source without
changing any `formal/**/*.lean` or `formal/*.lean` file. Its only changes after
the former pointer commit are:

1. `formal/scripts/ci.ps1` now treats an absent evidence path in the evidence
   commit's parent tree as the expected result of the introduction check under
   Windows PowerShell 5.1. Previously, `ErrorActionPreference=Stop` promoted
   Git's expected diagnostic into a terminating PowerShell error before exit
   code 128 could be inspected.
2. `formal/source-integrity.json` pins the corrected script at canonical
   UTF-8/LF SHA-256
   `26c73741cb06dafc73368251f022d8356c3b50a0579b18306ae058fd8a74bd6a`.

The correction changes neither a Lean declaration nor a compiled artifact. It
repairs the final S/E/P ancestry verifier; the later pointer commit must run
`formal/scripts/ci.ps1 -RequireProved -VerifyTreeOnly` successfully against
this source/evidence pair.

## Composite clean-build and kernel-audit provenance

The proof gate resumes the already-started pinned clean build rather than
performing a third identical clean rebuild. The initial run invoked the exact
command `.\formal\scripts\ci.ps1 -CleanBuild`; its external two-hour runner
limit interrupted it during the Cantilune serial phase. The continuation began
116 seconds later. Before its resumed Cantilune serial phase, it established
two stable polls with no Lean/Lake build processes, then completed all 565
modules from the same clean artifact state.

The hash-bound composite record establishes:

1. The initial wrapper, interrupted-exit sentinel, stdout, and empty stderr
   prove the exact `-CleanBuild` invocation, the pinned 8,662-job dependency
   rebuild, and entry into the Cantilune serial phase.
2. The continuation records process drain, all 565 Cantilune modules, 44,282
   dependency artifacts, 2,825 project artifacts, and aggregate no-build
   closure.
3. The completed-build provenance commit, prior sealed source, and current
   source have no differences in any Lean source file; all have 565 Lean
   sources with aggregate SHA-256
   `4a6f6259c846fef61d56be65407694f68f183a794c229d390f6adcfff2a3b1b0`.
4. The continuation reached the audit only after complete build closure and
   failed solely on four stale fully qualified declaration names. Those names
   were repaired without changing Lean source.
5. The corrected 1,624-declaration kernel audit completed successfully. Every
   maintained declaration appears exactly once and depends only on
   `propext`, `Classical.choice`, and `Quot.sound`.
6. Immutable-tree verification passed before and after the audit.

## Hash-bound runtime records

- Initial `-CleanBuild` wrapper (1,804 bytes):
  `d38ede96bc89eaf66db6733f5a2656607e32318c6acb580ecaa3d4aad8236058`
- Initial clean-build stdout (1,411,688 bytes):
  `6e4705384a1e7de439649175234b3a6af2f8ea5935eda95be6fbc0f3c9c24bdb`
- Initial clean-build stderr (0 bytes):
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Initial interrupted-exit sentinel (1 byte, value `1`):
  `6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b`
- Completed-build stdout (14,298,108 bytes):
  `a2c9b2a577defb257e30755d56a4c99d24b1f3e779bb3c0d41b36834a0f5d44d`
- Completed-build stderr (0 bytes):
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Composite audit stdout (3,462 bytes):
  `6f644bfe9e885dffc61dfe8412f65b6cf0087613bccb53eb92de77b5049d585e`
- Composite audit stderr (0 bytes):
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Kernel-audit raw output (221,041 bytes):
  `a5e29b6847c0a860bf537882750f178c05bc11ea28770bae95a64cc9a6209a53`

All hashes above are raw-file SHA-256 values. The proof manifest uses the
separate canonical UTF-8/LF SHA-256 of this Markdown file.

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

This evidence records a pinned clean-start/process-drained build, source
equivalence, complete kernel dependency audit, and immutable source seal. It is
not an independent human review, FCP approval, ADR acceptance,
production-package certification, push, or pull request. The eight production
packages still require their own rule, admission, resource, authorization,
fairness, stable-window, positive-epsilon, Markov-kernel, and
TrajectoryAgreement certificates.
