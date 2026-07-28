import Mathlib
import Cantilune.Core.CompleteProjection
import Cantilune.Pi.Protocols

/-!
# One native π certificate for signature admission

This module closes one finite reference square:

* a nonempty signature grows by one object and one generator at an epoch
  boundary;
* a two-state source LTS records that admission as one visible source event;
* the event maps to one ordinary, visible π input prefix;
* every native action is observed, the input prefix has exactly that one step,
  and its endpoint is the genuinely terminal process `0`;
* the same `SignatureAdmissionEvent` is connected to the operational
  certificate by `AdmissionProjectionCompatibility`.

`Protocols.admissionWait` continues to demonstrate an input whose continuation
uses the registered channel.  That continuation has a subsequent native
output, so using it as the terminal image of a two-state source LTS would make
reflection false.  The certificate below therefore uses the separate
`certifiedAdmissionWait = input . 0` reference required for full native
reflection.  This is one admission witness, not a proof of general P1c.
-/

namespace Cantilune.Pi.AdmissionCertificate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols

/-! ## A nonempty append-only signature admission -/

namespace ReferenceSignature

inductive SourceObject
  | registry
  deriving DecidableEq, Repr, Fintype

inductive SourceGenerator
  | existing
  deriving DecidableEq, Repr, Fintype

inductive TargetObject
  | registry
  | admitted
  deriving DecidableEq, Repr, Fintype

inductive TargetGenerator
  | existing
  | admitted
  deriving DecidableEq, Repr, Fintype

def contract : ContractSpec where
  requires := {"registered"}
  ensures := {"typed"}

/-- The source is nonempty: it already contains one object and one generator. -/
def source : FinSignature where
  Obj := SourceObject
  Gen := SourceGenerator
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => [.registry]
  output := fun _ => [.registry]
  mode := fun _ => .linear
  contract := fun _ => contract

/-- The target appends an object and a generator without changing the old pair. -/
def target : FinSignature where
  Obj := TargetObject
  Gen := TargetGenerator
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input
    | .existing => [.registry]
    | .admitted => [.registry]
  output
    | .existing => [.registry]
    | .admitted => [.admitted]
  mode := fun _ => .linear
  contract := fun _ => contract

/-- The injection is append-only and preserves the complete old declaration. -/
def extension : SignatureExtension source target where
  obj :=
    ⟨fun _ => .registry, by
      intro left right
      cases left
      cases right
      intro _equality
      rfl⟩
  gen :=
    ⟨fun _ => .existing, by
      intro left right
      cases left
      cases right
      intro _equality
      rfl⟩
  input_preserved := by
    intro generator
    cases generator
    rfl
  output_preserved := by
    intro generator
    cases generator
    rfl
  mode_preserved := by
    intro objectSymbol
    cases objectSymbol
    rfl
  contract_preserved := by
    intro generator
    cases generator
    rfl

inductive View
  | dag
  | petri
  | pi
  | morphism
  deriving DecidableEq, Repr

abbrev SemanticObject := View × Nat

structure SemanticGenerator where
  view : View
  ordinal : Nat
  deriving DecidableEq, Repr

def semanticInput (generator : SemanticGenerator) : List SemanticObject :=
  [(generator.view, 0)]

def semanticOutput (generator : SemanticGenerator) : List SemanticObject :=
  [(generator.view, generator.ordinal)]

def sourceInterpretation (view : View) :
    SignatureInterpretation source SemanticObject SemanticGenerator where
  object := fun _ => (view, 0)
  generator := fun _ => ⟨view, 0⟩
  input := semanticInput
  output := semanticOutput
  mode := fun _ => .linear
  contract := fun _ => contract
  input_preserved := by
    intro symbol
    cases symbol
    rfl
  output_preserved := by
    intro symbol
    cases symbol
    rfl
  mode_preserved := by
    intro objectSymbol
    cases objectSymbol
    rfl
  contract_preserved := by
    intro symbol
    cases symbol
    rfl

def targetInterpretation (view : View) :
    SignatureInterpretation target SemanticObject SemanticGenerator where
  object
    | .registry => (view, 0)
    | .admitted => (view, 1)
  generator
    | .existing => ⟨view, 0⟩
    | .admitted => ⟨view, 1⟩
  input := semanticInput
  output := semanticOutput
  mode := fun _ => .linear
  contract := fun _ => contract
  input_preserved := by
    intro symbol
    cases symbol <;> rfl
  output_preserved := by
    intro symbol
    cases symbol <;> rfl
  mode_preserved := by
    intro objectSymbol
    cases objectSymbol <;> rfl
  contract_preserved := by
    intro symbol
    cases symbol <;> rfl

def universes : ProjectionUniverses where
  dagObject := SemanticObject
  dagGenerator := SemanticGenerator
  petriObject := SemanticObject
  petriGenerator := SemanticGenerator
  piObject := SemanticObject
  piGenerator := SemanticGenerator
  morphismObject := SemanticObject
  morphismGenerator := SemanticGenerator

def oldViews : FourSignatureViews universes source where
  dag := sourceInterpretation .dag
  petri := sourceInterpretation .petri
  pi := sourceInterpretation .pi
  morphism := sourceInterpretation .morphism

def newViews : FourSignatureViews universes target where
  dag := targetInterpretation .dag
  petri := targetInterpretation .petri
  pi := targetInterpretation .pi
  morphism := targetInterpretation .morphism

theorem interpretationExtends (view : View) :
    SignatureInterpretation.Extends extension
      (sourceInterpretation view) (targetInterpretation view) where
  object_preserved := by
    intro objectSymbol
    cases objectSymbol
    rfl
  generator_preserved := by
    intro symbol
    cases symbol
    rfl

theorem fourViewAdmission :
    FourViewAdmission universes extension oldViews newViews where
  dag := interpretationExtends .dag
  petri := interpretationExtends .petri
  pi := interpretationExtends .pi
  morphism := interpretationExtends .morphism

/-- The concrete epoch-boundary event shared with the π compatibility proof. -/
def event :
    SignatureAdmissionEvent universes (source := source) (target := target) where
  fromVersion := 0
  toVersion := 1
  advancesEpoch := by omega
  extension := extension
  oldViews := oldViews
  newViews := newViews
  certificate := fourViewAdmission
  tombstoneId := 4000

end ReferenceSignature

/-! ## One source event and one unfiltered native π input -/

inductive SourceState
  | before
  | after
  deriving DecidableEq, Repr, Fintype

inductive SourceEvent
  | admission
  deriving DecidableEq, Repr, Fintype

inductive SourceStep : SourceState → SourceEvent → SourceState → Prop
  | admission : SourceStep .before .admission .after

def sourceSuccess : SourceState → Prop
  | .after => True
  | .before => False

def sourceWaiting : SourceState → Prop
  | .before => True
  | .after => False

def sourceVersion : SourceState → Nat
  | .before => 0
  | .after => 1

def sourceLTS : ObservableLTS where
  State := SourceState
  Event := SourceEvent
  stateSetoid := ObservableLTS.equalitySetoid SourceState
  step := SourceStep
  observable := fun _ => True
  success := sourceSuccess
  waiting := sourceWaiting
  signatureVersion := sourceVersion
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

/--
The certificate-specific registration process.  Unlike
`Protocols.admissionWait`, its continuation is terminal, so an all-native
reflection theorem is possible for a two-state source.
-/
def certifiedAdmissionWait : Proc :=
  .recv delegationChannel delegatedBinder .zero

def admissionAction : Action :=
  .input delegationChannel delegatedBinder

theorem certified_admission_native :
    Cantilune.Pi.Step certifiedAdmissionWait admissionAction .zero :=
  Cantilune.Pi.Step.prefixInput

/-- The input prefix has exactly one native action and one native endpoint. -/
theorem certified_admission_native_unique
    {action : Action} {target : Proc}
    (step : Cantilune.Pi.Step certifiedAdmissionWait action target) :
    action = admissionAction ∧ target = .zero := by
  cases step
  exact ⟨rfl, rfl⟩

/-- The mapped after-state has no native π transition of any action. -/
theorem admitted_zero_no_native_step
    {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step .zero action target := by
  intro step
  cases step

def mapState : SourceState → Proc
  | .before => certifiedAdmissionWait
  | .after => .zero

def mapEvent : SourceEvent → Action
  | .admission => admissionAction

def targetSuccess (process : Proc) : Prop :=
  process = .zero

def targetWaiting (process : Proc) : Prop :=
  process = certifiedAdmissionWait

def targetVersion : Proc → Nat
  | .zero => 1
  | _ => 0

/--
The native target LTS observes every native π action.  Its version observation
distinguishes the two mapped states so it can witness the epoch boundary.
-/
def targetLTS : ObservableLTS where
  State := Proc
  Event := Action
  stateSetoid := ObservableLTS.equalitySetoid Proc
  step := Cantilune.Pi.Step
  observable := fun _ => True
  success := targetSuccess
  waiting := targetWaiting
  signatureVersion := targetVersion
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

/--
Complete operational certificate for the single reference admission.  The
reflection field quantifies over every native action because `targetLTS`
observes all of them.
-/
def certificate : ProjectionCertificate sourceLTS targetLTS where
  mapState := mapState
  mapEvent := mapEvent
  Lift := fun sourceEvent targetEvent => mapEvent sourceEvent = targetEvent
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target h
    subst target
    rfl
  sound := by
    intro source event target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact ⟨certified_admission_native, trivial⟩
  reflect := by
    intro source action target step
    rcases step with ⟨native, _observable⟩
    cases source with
    | before =>
        rcases certified_admission_native_unique native with
          ⟨actionEquation, targetEquation⟩
        subst action
        subst target
        exact
          ⟨.admission, .after,
            ⟨SourceStep.admission, trivial⟩, rfl, rfl⟩
    | after =>
        exact False.elim (admitted_zero_no_native_step native)
  success_iff := by
    intro state
    cases state <;>
      simp [targetLTS, targetSuccess, mapState, certifiedAdmissionWait,
        sourceLTS, sourceSuccess]
  waiting_iff := by
    intro state
    cases state <;>
      simp [targetLTS, targetWaiting, mapState, certifiedAdmissionWait,
        sourceLTS, sourceWaiting]
  signatureVersion_preserved := by
    intro state
    cases state <;> rfl

theorem source_admission_observable :
    sourceLTS.ObservableStep .before .admission .after :=
  ⟨SourceStep.admission, trivial⟩

theorem target_admission_observable :
    targetLTS.ObservableStep
      certifiedAdmissionWait admissionAction .zero :=
  ⟨certified_admission_native, trivial⟩

/--
The operational step and the four-view signature event share the same
endpoint versions.  No static SMC claim is made by this compatibility value.
-/
def admissionCompatibility :
    AdmissionProjectionCompatibility certificate ReferenceSignature.event where
  sourceBefore := .before
  sourceAfter := .after
  sourceEvent := .admission
  targetEvent := admissionAction
  sourceStep := source_admission_observable
  targetStep := target_admission_observable
  lift := rfl
  sourceBeforeVersion := rfl
  sourceAfterVersion := rfl
  targetBeforeVersion := rfl
  targetAfterVersion := rfl

end Cantilune.Pi.AdmissionCertificate
