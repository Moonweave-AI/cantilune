import Cantilune.Theorems.FMSGatedCrossEpochProductFamily
import Cantilune.Theorems.FiniteCrossEpochProductChain

/-!
# Row-wise FMS gates over finite four-projection product chains

`FiniteCrossEpochProductChain` composes replay, exact event labels, and strict
epoch boundaries, but it does not require a denotational pi witness at each
row.  `FMSGatedCrossEpochProductFamily` supplies that witness for one actual
cross-epoch product family.

This module combines the two without erasing dependent row types.  The
certificate shape is recursive, but the current direct
`CrossEpochProductFamily` adapter constructs exactly one row.  In particular,
an adapter's `afterReplayEpoch` contains its singleton business event whereas
every adapter's `beforeReplayEpoch` is empty.  Those records cannot be the
same dependent middle endpoint, so two direct rows do not currently compose.

The total conclusion contains:

* `FiniteCrossEpochProductChain.CompleteAgreement`, hence all five replay
  chains, strict epoch advancement, fixed-event preservation, and typed
  admission-event preservation; and
* a dependent `FMSGatedCrossEpochConclusion` for every stored row, exposing
  the concrete FMS transition for both its pi rule and its heterogeneous pi
  admission.

This is only row-wise evidence.  Different stored rows are not required to
share one `ExactFMSAcceptancePackage`, and no denotational endpoint-stitching
equation is stored.  Consequently this module proves neither a common
multi-row FMS trace nor arbitrary direct-family composition.  It constructs
neither an `ExactFMSAcceptancePackage` nor a production product-family
inhabitant.
-/

noncomputable section

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExactAcceptance
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.CrossEpochProductFamily
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.ProductRuleProofBundle

universe u v w

variable
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}

/--
A recursive row-wise certificate whose every stored nonterminal row has its
own actual FMS-gated cross-epoch product evidence.

The `cons` result uses `toFiveViewBoundary family` and the tail is indexed by
`afterReplayEpoch family`; this is the exact shared-middle condition.  The
current direct adapter below cannot satisfy it with a second direct row.
-/
inductive FMSGatedFiniteChain :
    {first last : FourProjectionReplayEpoch} →
    FiniteCrossEpochProductChain universes first last →
    Type (max 2 u v (w + 1))
  | single (epoch : FourProjectionReplayEpoch) :
      FMSGatedFiniteChain (.single epoch)
  | cons
      {oldSignature newSignature : FinSignature}
      {admission :
        SignatureAdmissionEvent universes
          (source := oldSignature) (target := newSignature)}
      {sourceSemantics :
        HeterogeneousAdmissionLTS
          (source.package oldSignature)
          (source.package newSignature)}
      {sourceOccurrence :
        HeterogeneousPackageAdmission
          (source.package oldSignature)
          (source.package newSignature)
          sourceSemantics admission}
      {signatureCertificate :
        FourCoherentFamilyAdmission
          SourceCategory DagCategory PetriCategory PiCategory
          MorphismCategory
          source dagFamily petriFamily piFamily morphismFamily
          admission sourceSemantics sourceOccurrence}
      {KernelState : Type w}
      [Fintype KernelState] [DecidableEq KernelState]
      {kernel :
        NativeMarkovKernel newSignature
          (source.package newSignature) KernelState}
      {initial : InitialDistribution KernelState}
      {epsilon : Real}
      {RuleQualified RuleAuthorized :
        (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
      {candidate : Candidate (source.package newSignature)}
      (family :
        CrossEpochProductFamily
          SourceCategory DagCategory PetriCategory PiCategory
          MorphismCategory
          source dagFamily petriFamily piFamily morphismFamily
          admission sourceSemantics sourceOccurrence signatureCertificate
          kernel initial epsilon RuleQualified RuleAuthorized candidate)
      (evidence :
        FMSGatedCrossEpochEvidence
          (SourceCategory := SourceCategory)
          (DagCategory := DagCategory)
          (PetriCategory := PetriCategory)
          (PiCategory := PiCategory)
          (MorphismCategory := MorphismCategory)
          family)
      {last : FourProjectionReplayEpoch}
      {tail :
        FiniteCrossEpochProductChain universes
          (CrossEpochProductFamily.afterReplayEpoch family) last}
      (tailCertificate : FMSGatedFiniteChain tail) :
      FMSGatedFiniteChain
        (.cons
          (CrossEpochProductFamily.toFiveViewBoundary family)
          tail)

namespace FMSGatedFiniteChain

/-- The gated-chain family with all five projection families fixed. -/
abbrev CertifiedChain
    {first last : FourProjectionReplayEpoch}
    (chain : FiniteCrossEpochProductChain universes first last) :=
  FMSGatedFiniteChain
    (SourceCategory := SourceCategory)
    (DagCategory := DagCategory)
    (PetriCategory := PetriCategory)
    (PiCategory := PiCategory)
    (MorphismCategory := MorphismCategory)
    (source := source)
    (dagFamily := dagFamily)
    (petriFamily := petriFamily)
    (piFamily := piFamily)
    (morphismFamily := morphismFamily)
    (universes := universes)
    chain

local notation "FixedGated[" chain "]" =>
  CertifiedChain
    (SourceCategory := SourceCategory)
    (DagCategory := DagCategory)
    (PetriCategory := PetriCategory)
    (PiCategory := PiCategory)
    (MorphismCategory := MorphismCategory)
    (source := source)
    (dagFamily := dagFamily)
    (petriFamily := petriFamily)
    (piFamily := piFamily)
    (morphismFamily := morphismFamily)
    (universes := universes)
    chain

/-- Terminal certificate with all projection-family parameters fixed. -/
def singleCertificate (epoch : FourProjectionReplayEpoch) :
    FixedGated[
      FiniteCrossEpochProductChain.single
        (universes := universes) epoch] :=
  .single epoch

/--
Every cons row carries the strongest existing one-row FMS-gated conclusion.

Because the constructor retains `family` and `evidence`, the two transition
fields in each row have their original domain/action/codomain types.
-/
inductive AllRows :
    {first last : FourProjectionReplayEpoch} →
    {chain : FiniteCrossEpochProductChain universes first last} →
    FixedGated[chain] → Prop
  | single (epoch : FourProjectionReplayEpoch) :
      AllRows (singleCertificate epoch)
  | cons
      {oldSignature newSignature : FinSignature}
      {admission :
        SignatureAdmissionEvent universes
          (source := oldSignature) (target := newSignature)}
      {sourceSemantics :
        HeterogeneousAdmissionLTS
          (source.package oldSignature)
          (source.package newSignature)}
      {sourceOccurrence :
        HeterogeneousPackageAdmission
          (source.package oldSignature)
          (source.package newSignature)
          sourceSemantics admission}
      {signatureCertificate :
        FourCoherentFamilyAdmission
          SourceCategory DagCategory PetriCategory PiCategory
          MorphismCategory
          source dagFamily petriFamily piFamily morphismFamily
          admission sourceSemantics sourceOccurrence}
      {KernelState : Type w}
      [Fintype KernelState] [DecidableEq KernelState]
      {kernel :
        NativeMarkovKernel newSignature
          (source.package newSignature) KernelState}
      {initial : InitialDistribution KernelState}
      {epsilon : Real}
      {RuleQualified RuleAuthorized :
        (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
      {candidate : Candidate (source.package newSignature)}
      (family :
        CrossEpochProductFamily
          SourceCategory DagCategory PetriCategory PiCategory
          MorphismCategory
          source dagFamily petriFamily piFamily morphismFamily
          admission sourceSemantics sourceOccurrence signatureCertificate
          kernel initial epsilon RuleQualified RuleAuthorized candidate)
      (evidence :
        FMSGatedCrossEpochEvidence
          (SourceCategory := SourceCategory)
          (DagCategory := DagCategory)
          (PetriCategory := PetriCategory)
          (PiCategory := PiCategory)
          (MorphismCategory := MorphismCategory)
          family)
      {last : FourProjectionReplayEpoch}
      {tail :
        FiniteCrossEpochProductChain universes
          (CrossEpochProductFamily.afterReplayEpoch family) last}
      (tailCertificate : FixedGated[tail])
      (row :
        FMSGatedCrossEpochConclusion family evidence)
      (tailRows : AllRows tailCertificate) :
      AllRows
        (FMSGatedFiniteChain.cons family evidence tailCertificate)

/--
Construct all dependent row conclusions by invoking the existing one-row
FMS-gated theorem at every cons.
-/
theorem allRows
    {first last : FourProjectionReplayEpoch}
    {chain : FiniteCrossEpochProductChain universes first last}
    (certificate : FixedGated[chain]) :
    AllRows certificate := by
  induction certificate with
  | single epoch =>
      exact .single epoch
  | cons family evidence tailCertificate inductionHypothesis =>
      exact .cons family evidence tailCertificate
        (fms_gated_cross_epoch_product_consistency evidence)
        inductionHypothesis

/--
Row-wise conclusion: common operational event/replay/epoch agreement plus
the two native FMS transitions stored at every row.  This does not assert
that different rows share an FMS package or denotational endpoint.
-/
structure CompleteAgreement
    {first last : FourProjectionReplayEpoch}
    {chain : FiniteCrossEpochProductChain universes first last}
    (certificate : FixedGated[chain]) : Prop where
  chain :
    FiniteCrossEpochProductChain.CompleteAgreement chain
  fmsRows : AllRows certificate

/--
Every *inhabited* recursive certificate yields operational chain agreement
and row-wise FMS conclusions.  The direct adapter is currently one-row only.
-/
theorem composeComplete
    {first last : FourProjectionReplayEpoch}
    {chain : FiniteCrossEpochProductChain universes first last}
    (certificate : FixedGated[chain]) :
    CompleteAgreement certificate where
  chain := chain.composeComplete
  fmsRows := certificate.allRows

namespace CompleteAgreement

/-- All five dependent replay trajectories compose exactly. -/
theorem replay
    {first last : FourProjectionReplayEpoch}
    {finiteChain :
      FiniteCrossEpochProductChain universes first last}
    {certificate : FixedGated[finiteChain]}
    (agreement : CompleteAgreement certificate) :
    FiniteCrossEpochProductChain.ReplayAgreement finiteChain :=
  agreement.chain.replay

/-- Every epoch boundary in all five views advances strictly. -/
theorem strict
    {first last : FourProjectionReplayEpoch}
    {finiteChain :
      FiniteCrossEpochProductChain universes first last}
    {certificate : FixedGated[finiteChain]}
    (agreement : CompleteAgreement certificate) :
    FiniteCrossEpochProductChain.AllBoundariesStrict finiteChain :=
  agreement.chain.strict

/-- Every fixed-epoch rule-event list remains the exact mapped list. -/
theorem events
    {first last : FourProjectionReplayEpoch}
    {finiteChain :
      FiniteCrossEpochProductChain universes first last}
    {certificate : FixedGated[finiteChain]}
    (agreement : CompleteAgreement certificate) :
    FiniteCrossEpochProductChain.AllEventMarksPreserved finiteChain :=
  agreement.chain.events

/-- Every heterogeneous admission label remains the exact typed mapped label. -/
theorem admissions
    {first last : FourProjectionReplayEpoch}
    {finiteChain :
      FiniteCrossEpochProductChain universes first last}
    {certificate : FixedGated[finiteChain]}
    (agreement : CompleteAgreement certificate) :
    FiniteCrossEpochProductChain.AllAdmissionMarksPreserved finiteChain :=
  agreement.chain.admissions

end CompleteAgreement

/-! ## Honest direct-adapter boundary -/

/--
An epoch whose source event list has length one cannot be the dependent
middle endpoint of an epoch whose source event list is empty.

`CrossEpochProductFamily.afterReplayEpoch` and
`CrossEpochProductFamily.beforeReplayEpoch` have exactly these respective
shapes.  This small theorem records the obstruction without erasing their
package-indexed event types.
-/
theorem singletonSourceEvents_ne_emptySourceEvents
    (eventful empty : FourProjectionReplayEpoch)
    (eventfulLength : eventful.source.epoch.events.length = 1)
    (emptyLength : empty.source.epoch.events.length = 0) :
    eventful ≠ empty := by
  intro equality
  have equalLengths :
      eventful.source.epoch.events.length =
        empty.source.epoch.events.length :=
    congrArg
      (fun epoch : FourProjectionReplayEpoch =>
        epoch.source.epoch.events.length)
      equality
  exact Nat.one_ne_zero
    (eventfulLength.symm.trans (equalLengths.trans emptyLength))

/-- One existing FMS-gated family gives a one-row finite certificate. -/
def oneRow
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w}
    [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
      (source.package newSignature).lts.Event →
      (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)
    (evidence :
      FMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        family) :
    FixedGated[
      CrossEpochProductFamily.toFiniteChain family] :=
  .cons family evidence
    (singleCertificate
      (CrossEpochProductFamily.afterReplayEpoch family))

/--
Adapter from the existing one-row conclusion.  It stores that actual
conclusion as the head and the terminal row as `single`.
-/
theorem oneRow_allRows
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w}
    [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
      (source.package newSignature).lts.Event →
      (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)
    (evidence :
      FMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        family) :
    AllRows (oneRow family evidence) :=
  .cons family evidence
    (singleCertificate
      (CrossEpochProductFamily.afterReplayEpoch family))
    (fms_gated_cross_epoch_product_consistency evidence)
    (.single (CrossEpochProductFamily.afterReplayEpoch family))

/-- The one-row adapter inherits the complete finite theorem. -/
theorem oneRow_complete
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w}
    [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
      (source.package newSignature).lts.Event →
      (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)
    (evidence :
      FMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        family) :
    CompleteAgreement (oneRow family evidence) :=
  composeComplete (oneRow family evidence)

end FMSGatedFiniteChain

end Cantilune.Theorems
