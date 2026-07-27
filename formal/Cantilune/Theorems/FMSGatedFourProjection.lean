import Cantilune.Pi.FMSExactAcceptance
import Cantilune.Theorems.CoherentFourProjection

/-!
# FMS-gated four-projection consistency

`coherent_four_projection_consistency` is deliberately a general composition
theorem.  By itself it cannot require that the π category is the pinned FMS
model.  A candidate production claim for the dual operational/denotational π
route must therefore pass a stronger gate.

This module makes the missing inhabitant impossible to bypass: callers must
provide one concrete `ExactFMSAcceptancePackage` in addition to four
cross-layer-coherent projection certificates.  Cantilune currently constructs
no such FMS package.  Moreover `ExactFMSAcceptancePackage` is itself the
strongest currently enumerated *provisional* boundary: its defining module
records remaining source-formula and powerdomain/coherence acceptance gaps.
Consequently this theorem checks conditional composition plumbing; it is not
by itself a completed genuine-FMS or production-acceptance claim.
-/

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExactAcceptance

universe vₛ vₜ uₛ uₜ

/--
The operational π projection and the supplied FMS model denote the same
mapped states and the same one-step transitions.

The π static functor is already tied to `piOperational` by
`CoherentCompleteProjectionCertificate.crossLayer`; this record closes the
other side of the triangle, from that operational target to the FMS
denotation.  A provider cannot pair an unrelated exact FMS package with an
arbitrary π certificate.
-/
structure OperationalFMSPiCoherence
    (fms : ExactFMSAcceptancePackage)
    (Source PiTarget : ObservableLTS)
    (piOperational : ProjectionCertificate Source PiTarget) where
  sourceProcess : Source.State → ClosedRaw
  targetDenotation :
    PiTarget.State → fms.base.domain.agent.obj 0
  targetAction : PiTarget.Event → Raw.Action
  source_equiv :
    ∀ {source target},
      Source.stateSetoid.r source target →
        Late.Struct (sourceProcess source).1 (sourceProcess target).1
  target_equiv :
    ∀ {source target},
      PiTarget.stateSetoid.r source target →
        targetDenotation source = targetDenotation target
  mapped_state_denotation :
    ∀ source,
      targetDenotation (piOperational.mapState source) =
        fms.base.lateFullAbstraction.denote (sourceProcess source)
  mapped_step_iff :
    ∀ {source event target},
      PiTarget.ObservableStep
          (piOperational.mapState source) event target ↔
        fms.base.lateFullAbstraction.transition
          (fms.base.lateFullAbstraction.denote (sourceProcess source))
          (targetAction event)
          (targetDenotation target)

namespace OperationalFMSPiCoherence

variable
    {fms : ExactFMSAcceptancePackage}
    {Source PiTarget : ObservableLTS}
    {piOperational : ProjectionCertificate Source PiTarget}
    (coherence :
      OperationalFMSPiCoherence fms Source PiTarget piOperational)

/-- On mapped source states, the target transition is exactly the FMS step. -/
theorem mapped_source_step_iff
    {source : Source.State} {event : PiTarget.Event}
    {target : PiTarget.State} :
    PiTarget.ObservableStep
        (piOperational.mapState source) event target ↔
      fms.base.lateFullAbstraction.transition
        (coherence.targetDenotation
          (piOperational.mapState source))
        (coherence.targetAction event)
        (coherence.targetDenotation target) := by
  rw [coherence.mapped_state_denotation]
  exact coherence.mapped_step_iff

end OperationalFMSPiCoherence

/--
The provisional gated input bundle.  The FMS field is a concrete package, not
a proposition that can be omitted by a general four-view composition theorem.
No value of that package is constructed locally.
-/
structure FMSGatedFourProjectionCertificates
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (DagCategory : Type uₜ) [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    (PetriCategory : Type uₜ) [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    (PiCategory : Type uₜ) [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    (MorphismCategory : Type uₜ) [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  fms : ExactFMSAcceptancePackage
  projections :
    FourCoherentProjectionCertificates
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission
  piFms :
    OperationalFMSPiCoherence fms Source PiTarget
      projections.pi.complete.operational

/--
The gated conclusion retains both the categorical/operational
four-projection theorem and the supplied provisional exact-FMS package which
licenses the corresponding conditional denotational π claim.
-/
structure FMSGatedFourProjectionConsistency
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (DagCategory : Type uₜ) [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    (PetriCategory : Type uₜ) [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    (PiCategory : Type uₜ) [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    (MorphismCategory : Type uₜ) [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  fms : ExactFMSAcceptancePackage
  projections :
    CoherentFourProjectionConsistency
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission
  piFms :
    OperationalFMSPiCoherence fms Source PiTarget
      projections.layers.pi.operational

/--
Construction of the gated conclusion performs no choice of FMS semantics: the
exact package in the result is definitionally the caller-supplied package.
-/
def buildFMSGatedFourProjectionConsistency
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory : Type uₜ} [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    {PetriCategory : Type uₜ} [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    {PiCategory : Type uₜ} [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    {MorphismCategory : Type uₜ} [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    (certificates :
      FMSGatedFourProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :
    FMSGatedFourProjectionConsistency
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      Source DagTarget PetriTarget PiTarget MorphismTarget admission where
  fms := certificates.fms
  projections :=
    buildCoherentFourProjectionConsistency certificates.projections
  piFms := certificates.piFms

/--
The strongest current conditional four-projection composition theorem.  It
cannot be applied from the mechanized finite/discrete support fragment alone
because that fragment does not inhabit `ExactFMSAcceptancePackage`; supplying
such a package would still be subject to the remaining acceptance boundaries
documented by `FMSExactAcceptance`.
-/
theorem fms_gated_four_projection_consistency
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory : Type uₜ} [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    {PetriCategory : Type uₜ} [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    {PiCategory : Type uₜ} [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    {MorphismCategory : Type uₜ} [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {Source DagTarget PetriTarget PiTarget MorphismTarget : ObservableLTS}
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)}
    (certificates :
      FMSGatedFourProjectionCertificates
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :
    Nonempty
      (FMSGatedFourProjectionConsistency
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        Source DagTarget PetriTarget PiTarget MorphismTarget admission) :=
  ⟨buildFMSGatedFourProjectionConsistency certificates⟩

end Cantilune.Theorems
