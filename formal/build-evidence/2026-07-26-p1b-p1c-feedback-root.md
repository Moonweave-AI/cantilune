# Local formal build evidence — 2026-07-26

Status: successful pinned kernel build and dependency audit of the current
working tree; uncommitted and not independently reviewed.

Repository state at execution time:

- `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`
- branch: `codex/theory-foundation`
- proof-sensitive `formal/` content: modified/untracked relative to `HEAD`

Consequently this record is local working-tree evidence. It does not satisfy
the manifest's immutable `verifiedCommit` rule and does not promote any
obligation to `proved` or `reviewed`.

## Pinned environment

- requested toolchain: `leanprover/lean4:v4.32.0`
- Lean: `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`
- Lake: `5.0.0-src+8c9756b`
- executable directory:
  `C:\Users\NJHL\.elan\toolchains\leanprover--lean4---v4.32.0\bin`

Git dependency checkouts were made available to the build only through
process-local `safe.directory` entries. No global Git configuration was
changed.

An official Windows archive was also downloaded during toolchain diagnosis:

- path: `C:\Users\NJHL\Downloads\lean-4.32.0-windows.tar.zst`
- size: `576973667` bytes
- SHA-256:
  `98acc2f9a6b990205166c55c9758a8c2f00ab0dfa42b721d6d91fe4cd15b82bb`

The archive matched the official release digest but was not used by the
final build because the pinned Elan toolchain already existed.

## Targeted builds

The following targets completed successfully before the final root gate:

- `Cantilune.Pi.P1bRequestingFingerprint`
- `Cantilune.Pi.P1bTwoThreadExtraction`
- `Cantilune.Pi.P1bRequestingNominalOrbit`
- `Cantilune.Pi.P1bTwoThreadNativeInversion`
- `Cantilune.Pi.P1bLinkedEndpointNormalization`
- `Cantilune.Pi.P1bResidualTargetBoundary`
- `Cantilune.Pi.P1bNominalIncidenceProof`
- `Cantilune.Pi.P1bNominalIncidenceClosure`
- `Cantilune.Tests.P1bRequestingResidual`
- `Cantilune.Tests.P1bStructuralLateBridge`
- `Cantilune.Pi.FMSCpoFiniteHoarePower`
- `Cantilune.Tests.FMSCpoFiniteHoarePower`
- `Cantilune.Pi.FMSCpoFiniteHoareMonad`
- `Cantilune.Tests.FMSCpoFiniteHoareMonad`
- `Cantilune.Pi.OpenSMCNominalAtomBoundary`
- `Cantilune.Tests.OpenSMCNominalAtomBoundary`
- `Cantilune.Theorems.ProductRuleAdmission`
- `Cantilune.Tests.HeterogeneousProductRuleAdmission`
- `Cantilune.Theorems.ProductRuleProofBundle`
- `Cantilune.Tests.ProductRuleProofBundle`
- `Cantilune.Theorems.P1cProductRuleProofBundle`
- `Cantilune.Tests.P1cProductRuleProofBundle`
- `Cantilune.Pi.P1cAdmittedFourOccurrence`
- `Cantilune.Tests.P1cAdmittedFourOccurrence`
- `Cantilune.Feedback.AuthorizedFeedbackExecution`
- `Cantilune.Feedback.AuthorizedFeedbackProbability`
- `Cantilune.Feedback.AuthorizedFeedbackClosure`
- `Cantilune.Feedback.FiniteExecutableEpochProjectionReference`
- `Cantilune.Tests.FiniteExecutableHeterogeneousRuntime`

These builds checked the quantitative and polarity residual, two-thread
extraction, full structural-orbit payload support, native-constructor
inversion including slow freshening, linked endpoint normalization and its
exact-target no-go, all four native nominal-incidence split cases, the
unconditional structural strong-late request/accept certificate, a genuine
finite nonempty Hoare omega-CPO fragment and its real finite-CPO categorical
Monad/Kleisli laws, exact named support admission for open-pi atoms, the
legacy-admission no-go, the corrected heterogeneous interface, the
proof-carrying fixed-epoch product rule gate, one substantive non-identity
reconnect bundle with four native views and complete event reflection, one
nonempty typed cross-epoch admission reference, and the authorized-feedback
probability bridge.

## Full evidence gate

Executed from the repository root with the pinned toolchain at the front of
`PATH`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File formal\scripts\ci.ps1
```

Final observed result:

- source-integrity gate: 283 Lean files;
- aggregate SHA-256:
  `f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`;
- zero whole-word `sorry`, `admit`, `axiom`, or `unsafe`;
- all local `Cantilune.*` imports resolved;
- `lake build`: successful, 8938 jobs;
- build emitted existing linter warnings but no errors;
- kernel dependency audit: 667 declarations parsed exactly once;
- allowed dependencies only:
  `propext`, `Classical.choice`, and `Quot.sound`;
- evidence gate exit code: 0.

The first audit attempt correctly rejected
`AuthorizedFeedbackClosure.referenceClosure` because a stored
`native_decide` proof introduced a generated private axiom. The quorum and
finite-status proofs were replaced by ordinary kernel-reducible `decide`
proofs. The complete gate was then rerun and passed. No audit target was
removed to obtain the successful result.

The audit target set explicitly includes the P1b fingerprint, two-thread
extraction, nominal orbit, slow-freshening/native inversion, linked-core,
endpoint normalization, and exact-target boundary declarations; the
product-admission no-go and heterogeneous occurrence mapping; the P1c
four-view occurrence and replay declarations; the finite Hoare Monad and
Kleisli laws; the named-atom support gate; the non-identity reconnect
product bundle and full event reflection; the typed cross-epoch admission
reference; and the authorized feedback closure. Two upstream
`native_decide` proofs in the P1b fingerprint were replaced by ordinary
kernel-reducible `decide`, so the strong residual-shape theorem has no
generated axiom.

## Completion-gate negative regression

Executed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File formal\scripts\ci.ps1 -RequireComplete
```

Observed result: expected rejection. All 18 obligations remain either
`implemented_unverified` (11) or `partial_scaffold` (7); none is
`reviewed`. This confirms that local build evidence cannot silently bypass
immutable provenance or QA-L4 review.

## Remaining boundary

The successful build now kernel-checks the exact P1b requesting residual,
including all four sync/close split cases and the unconditional
`pi_ra_certificate`. It still does not provide immutable or independently
reviewed evidence for that result. It also does not prove:

- the complete all-omega-CPO FMS powerdomain, recursive natural domain
  solution, hiding/coherence, adequacy, definability, or full abstraction;
- production cross-epoch coherent projection families, substantive
  DAG/Petri/morphism admission semantics, bidirectional pi runtime
  coherence, and product-specific inhabitants of the now kernel-built
  rank/resource/authorization/fairness/positive-epsilon admission gate;
- immutable commit provenance, independent QA-L4 review, FCP approval, or
  ADR acceptance.
