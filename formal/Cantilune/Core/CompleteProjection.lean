import Mathlib.CategoryTheory.Monoidal.Braided.Basic
import Cantilune.Core.Admission
import Cantilune.Core.Projection

/-!
# Layered projection certificates

`ProjectionCertificate` is intentionally an operational LTS certificate.  This
module does not reinterpret it as a categorical result.  Instead it adds a
separate static symmetric-monoidal layer and packages the independently
checkable layers needed by a complete projection claim.

The admission layer is deliberately concrete: it certifies one epoch-boundary
`SignatureAdmissionEvent` and exhibits native source and target transitions
whose endpoints carry that event's versions.  Quantifying this structure over
all admitted extensions remains an obligation of a concrete projection.
-/

namespace Cantilune.Core

open CategoryTheory

universe v₁ v₂ u₁ u₂

/--
A static projection between symmetric monoidal categories.

Mathlib's `SymmetricCategory` extends `BraidedCategory`, while
`Functor.Braided` extends `Functor.Monoidal`.  We therefore retain one coherent
`Braided` witness and expose its inherited `Monoidal` witness below, instead of
storing two potentially inconsistent monoidal structures.
-/
structure StaticSMCProjectionCertificate
    (SourceCategory : Type u₁) [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type u₂) [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory] where
  functor : SourceCategory ⥤ TargetCategory
  braided : functor.Braided

namespace StaticSMCProjectionCertificate

variable
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]

/-- The strong monoidal evidence inherited from the coherent braided witness. -/
@[reducible] def monoidal
    (certificate :
      StaticSMCProjectionCertificate SourceCategory TargetCategory) :
    certificate.functor.Monoidal :=
  certificate.braided.toMonoidal

/-- Every symmetric monoidal category has a non-vacuous identity certificate. -/
def identity :
    StaticSMCProjectionCertificate SourceCategory SourceCategory := by
  let braidedWitness : (𝟭 SourceCategory).Braided := inferInstance
  exact
    { functor := 𝟭 SourceCategory
      braided := braidedWitness }

end StaticSMCProjectionCertificate

/--
Resource predicates are supplied by a concrete projection and must agree on
mapped states.  This field does not pretend that the core LTS determines a
particular resource discipline.
-/
structure ResourceProjectionCompatibility
    {Source Target : ObservableLTS}
    (operational : ProjectionCertificate Source Target) where
  sourceResourcesValid : Source.State → Prop
  targetResourcesValid : Target.State → Prop
  resources_iff :
    ∀ source,
      targetResourcesValid (operational.mapState source) ↔
        sourceResourcesValid source

/--
The complete terminal classification transported by an operational
certificate.  It is packaged explicitly so downstream code need not collapse
success, external waiting, and genuine deadlock into one `Normal` predicate.
-/
structure TerminalProjectionCompatibility
    {Source Target : ObservableLTS}
    (operational : ProjectionCertificate Source Target) : Prop where
  successfulTermination_iff :
    ∀ source,
      Target.SuccessfulTermination (operational.mapState source) ↔
        Source.SuccessfulTermination source
  externalWait_iff :
    ∀ source,
      Target.ExternalWait (operational.mapState source) ↔
        Source.ExternalWait source
  deadlocked_iff :
    ∀ source,
      Target.Deadlocked (operational.mapState source) ↔
        Source.Deadlocked source

namespace TerminalProjectionCompatibility

/-- Operational soundness and exhaustiveness supply the terminal layer. -/
theorem ofOperational {Source Target : ObservableLTS}
    (operational : ProjectionCertificate Source Target) :
    TerminalProjectionCompatibility operational where
  successfulTermination_iff :=
    operational.successfulTermination_iff
  externalWait_iff := operational.externalWait_iff
  deadlocked_iff := operational.deadlocked_iff

end TerminalProjectionCompatibility

/--
One four-view signature admission, tied to native source and target steps.

The version equations bind the operational endpoints to the epoch-boundary
event.  `lift` permits a target-native event distinct from the chosen event
map, while still requiring the operational certificate to relate the two.
-/
structure AdmissionProjectionCompatibility
    {Source Target : ObservableLTS}
    (operational : ProjectionCertificate Source Target)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  sourceBefore : Source.State
  sourceAfter : Source.State
  sourceEvent : Source.Event
  targetEvent : Target.Event
  sourceStep :
    Source.ObservableStep sourceBefore sourceEvent sourceAfter
  targetStep :
    Target.ObservableStep
      (operational.mapState sourceBefore)
      targetEvent
      (operational.mapState sourceAfter)
  lift : operational.Lift sourceEvent targetEvent
  sourceBeforeVersion :
    Source.signatureVersion sourceBefore = admission.fromVersion
  sourceAfterVersion :
    Source.signatureVersion sourceAfter = admission.toVersion
  targetBeforeVersion :
    Target.signatureVersion (operational.mapState sourceBefore) =
      admission.fromVersion
  targetAfterVersion :
    Target.signatureVersion (operational.mapState sourceAfter) =
      admission.toVersion

/--
The layered certificate required before calling a projection "complete".

This structure combines, but does not manufacture, a static SMC functor, an
operational LTS certificate, a four-view admission step, resource preservation,
and the three-way terminal classification.  A concrete development must still
construct one value for every projection and every admitted extension in its
claimed scope.
-/
structure CompleteProjectionCertificate
    (SourceCategory : Type u₁) [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type u₂) [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (Source Target : ObservableLTS)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature)) where
  static :
    StaticSMCProjectionCertificate SourceCategory TargetCategory
  operational : ProjectionCertificate Source Target
  admissionCompatible :
    AdmissionProjectionCompatibility operational admission
  resources : ResourceProjectionCompatibility operational
  terminals : TerminalProjectionCompatibility operational

namespace ProjectionCertificate

/-- Identity is an operational certificate, without any categorical claim. -/
def identity (lts : ObservableLTS) : ProjectionCertificate lts lts where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by simp
  map_equiv := by simp
  sound := by
    intro source event target step
    exact step
  reflect := by
    intro source event target step
    exact ⟨event, target, step, rfl, lts.stateSetoid.iseqv.refl target⟩
  success_iff := by simp
  waiting_iff := by simp
  signatureVersion_preserved := by simp

end ProjectionCertificate

end Cantilune.Core
