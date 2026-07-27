import Mathlib.CategoryTheory.Monoidal.Cartesian.Basic
import Cantilune.Core.CompleteProjection

/-!
# Layered certificate regression

This finite identity example checks that all layers are simultaneously
inhabited.  It is an interface regression, not evidence for any of the four
production projections.
-/

namespace Cantilune.Tests.CompleteProjection

open CategoryTheory
open Cantilune.Core

/-- A one-declaration signature used only by this interface regression. -/
def signature : FinSignature where
  Obj := Unit
  Gen := Unit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => []
  output := fun _ => []
  mode := fun _ => .linear
  contract := fun _ => {}

def universes : ProjectionUniverses where
  dagObject := Unit
  dagGenerator := Unit
  petriObject := Unit
  petriGenerator := Unit
  piObject := Unit
  piGenerator := Unit
  morphismObject := Unit
  morphismGenerator := Unit

def interpretation :
    SignatureInterpretation signature Unit Unit where
  object := id
  generator := id
  input := fun _ => []
  output := fun _ => []
  mode := fun _ => .linear
  contract := fun _ => {}
  input_preserved := by simp [signature]
  output_preserved := by simp [signature]
  mode_preserved := by simp [signature]
  contract_preserved := by simp [signature]

def views : FourSignatureViews universes signature where
  dag := interpretation
  petri := interpretation
  pi := interpretation
  morphism := interpretation

theorem interpretationRefl :
    SignatureInterpretation.Extends
      (SignatureExtension.refl signature)
      interpretation interpretation where
  object_preserved := by simp [SignatureExtension.refl]
  generator_preserved := by simp [SignatureExtension.refl]

theorem admissionCertificate :
    FourViewAdmission universes
      (SignatureExtension.refl signature) views views where
  dag := interpretationRefl
  petri := interpretationRefl
  pi := interpretationRefl
  morphism := interpretationRefl

def admission :
    SignatureAdmissionEvent universes
      (source := signature) (target := signature) where
  fromVersion := 0
  toVersion := 1
  advancesEpoch := by omega
  extension := SignatureExtension.refl signature
  oldViews := views
  newViews := views
  certificate := admissionCertificate
  tombstoneId := 0

inductive Event
  | registration
  deriving DecidableEq

def lts : ObservableLTS where
  State := Fin 2
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid (Fin 2)
  step := fun source event target =>
    source = 0 ∧ event = .registration ∧ target = 1
  observable := fun _ => True
  success := fun state => state = 1
  waiting := fun _ => False
  signatureVersion := Fin.val
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

def operational : ProjectionCertificate lts lts :=
  ProjectionCertificate.identity lts

def beforeState : Fin 2 := 0

def afterState : Fin 2 := 1

theorem sourceAdmissionStep :
    lts.ObservableStep beforeState .registration afterState := by
  exact ⟨⟨rfl, rfl, rfl⟩, trivial⟩

def admissionCompatible :
    AdmissionProjectionCompatibility operational admission where
  sourceBefore := beforeState
  sourceAfter := afterState
  sourceEvent := .registration
  targetEvent := .registration
  sourceStep := sourceAdmissionStep
  targetStep := sourceAdmissionStep
  lift := rfl
  sourceBeforeVersion := rfl
  sourceAfterVersion := rfl
  targetBeforeVersion := rfl
  targetAfterVersion := rfl

def resources :
    ResourceProjectionCompatibility operational where
  sourceResourcesValid := fun state => state.val ≤ 1
  targetResourcesValid := fun state => state.val ≤ 1
  resources_iff := by simp [operational, ProjectionCertificate.identity]

/-- A nonempty value inhabiting every layer of the complete interface. -/
def identityComplete :
    CompleteProjectionCertificate
      (Type 0) (Type 0) lts lts admission where
  static := StaticSMCProjectionCertificate.identity
  operational := operational
  admissionCompatible := admissionCompatible
  resources := resources
  terminals := TerminalProjectionCompatibility.ofOperational operational

example :
    identityComplete.operational.mapState beforeState = beforeState :=
  rfl

example :
    identityComplete.admissionCompatible.sourceAfterVersion =
      (show lts.signatureVersion afterState = admission.toVersion from rfl) :=
  rfl

example :
    identityComplete.static.functor.obj Unit = Unit :=
  rfl

example :
    identityComplete.static.monoidal =
      identityComplete.static.braided.toMonoidal :=
  rfl

end Cantilune.Tests.CompleteProjection
