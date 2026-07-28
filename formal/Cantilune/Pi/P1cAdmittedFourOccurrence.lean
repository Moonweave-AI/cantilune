import Cantilune.Pi.P1cAdmittedP1aCertificates
import Cantilune.Theorems.HeterogeneousProductRuleAdmission

/-!
# Four substantive fixed-epoch views of an admitted P1c occurrence

The existing admitted-occurrence package already supplies concrete DAG,
individual-token Petri, and morphism derivations over the exact runtime
configuration endpoints.  This isolated module adds the fourth operational
view: a genuine native strong-late pi derivation from
`P1cAdmittedOperations.PiView`.

The four views are assembled as one
`HeterogeneousProductRuleAdmission.FourFixedEpochOccurrence`.  Qualification
and authorization name the exact admitted occurrence and retain its resource
and session evidence.  The source event is external, so its rank obligation
is discharged only by the package's explicit non-internal classification.

This is deliberately not a heterogeneous signature-admission certificate:
it constructs no old/new projection family, no boundary step, no probability
kernel, and no positive-epsilon evidence.  The declarations are kernel-checked
and imported by the project root without claiming those absent layers.
-/

noncomputable section

namespace Cantilune.Pi.P1cAdmittedFourOccurrence

open Cantilune.Core
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedP1aCertificates
open Cantilune.Theorems.ProductRuleAdmission
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

variable {σ : FinSignature}

namespace PiTarget

/-- A target step contains the independently defined native late-pi proof. -/
inductive Step (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop
  | execute (request : Family occurrence)
      (native :
        Late.NativeStep
          (PiView.source occurrence.request)
          .tau
          (PiView.target occurrence.request)) :
      Step occurrence (.ready request) request (.completed request)

def lts (occurrence : Occurrence σ) : ObservableLTS where
  State := State occurrence
  Event := Family occurrence
  stateSetoid := ObservableLTS.equalitySetoid _
  step := Step occurrence
  observable := fun _ => True
  success := success occurrence
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
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

/-- Every target transition exposes the genuine native strong-late proof. -/
theorem step_native
    {occurrence : Occurrence σ}
    {source target : State occurrence}
    {request : Family occurrence}
    (step : Step occurrence source request target) :
    Late.NativeStep
      (PiView.source occurrence.request)
      .tau
      (PiView.target occurrence.request) := by
  cases step with
  | execute _ native =>
      exact native

def certificate (occurrence : Occurrence σ) :
    ProjectionCertificate (sourceLTS occurrence) (lts occurrence) where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by
    intro request
    rfl
  map_equiv := by
    intro source target equality
    exact equality
  sound := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact ⟨Step.execute request (PiView.native occurrence), trivial⟩
  reflect := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact
      ⟨request, .completed request,
        source_observable occurrence request, rfl, rfl⟩
  success_iff := by
    intro state
    rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

def package (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := lts occurrence
  configOf := configOf occurrence
  replayKernel := P1cAdmittedOperations.replayKernel
  eventRecord := fun _ => verifiedEvent occurrence
  eventEndpoints := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact replay_exact occurrence
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := resourcesClear occurrence
  sessionsQuiescent := sessionsQuiescent occurrence
  deletionPermitted := deletionPermitted occurrence
  deletion_requires_resources := deletion_requires_resources occurrence
  deletion_requires_quiescence := deletion_requires_quiescence occurrence
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

def resources (occurrence : Occurrence σ) :
    ResourceProjectionCompatibility (certificate occurrence) where
  sourceResourcesValid := (sourcePackage occurrence).resourcesClear
  targetResourcesValid := (package occurrence).resourcesClear
  resources_iff := by
    intro state
    rfl

end PiTarget

/-! ## Concrete product policy -/

/-- Qualification identifies exactly the occurrence being certified. -/
def RuleQualified (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop :=
  fun before event after =>
    before = .ready (family occurrence) ∧
      event = family occurrence ∧
      after = .completed (family occurrence)

/--
Authorization retains qualification together with the occurrence's concrete
resource and session predicates at the source endpoint.
-/
def RuleAuthorized (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop :=
  fun before event after =>
    RuleQualified occurrence before event after ∧
      resourcesClear occurrence before ∧
      sessionsQuiescent occurrence before

/-- The admitted event is explicitly external, so no internal-rank premise holds. -/
theorem rankEvidence (occurrence : Occurrence σ) :
    RuleRankEvidence
      (sourcePackage occurrence)
      (before := .ready (family occurrence))
      (event := family occurrence)
      (after := .completed (family occurrence)) where
  decreases_if_internal := by
    intro internal
    change False at internal
    contradiction
  epoch_preserved_if_internal := by
    intro internal
    change False at internal
    contradiction

/--
All four packages use the same concrete runtime predicates; this helper
anchors the abstract resource compatibility to those package fields.
-/
theorem fixedPolicy
    (occurrence : Occurrence σ)
    (target : ExecutionPackage σ)
    (projection :
      ProjectionCertificate (sourceLTS occurrence) target.lts)
    (resourceCompatibility :
      ResourceProjectionCompatibility projection)
    (resourcesDef :
      resourceCompatibility.sourceResourcesValid =
        (sourcePackage occurrence).resourcesClear)
    (targetResourcesDef :
      resourceCompatibility.targetResourcesValid =
        target.resourcesClear)
    (sessions :
      ∀ state,
        target.sessionsQuiescent (projection.mapState state) ↔
          (sourcePackage occurrence).sessionsQuiescent state)
    (deletion :
      ∀ state,
        target.deletionPermitted (projection.mapState state) ↔
          (sourcePackage occurrence).deletionPermitted state) :
    FixedEpochPolicyCompatibility
      (sourcePackage occurrence) target projection resourceCompatibility where
  sourceResources := resourcesDef
  targetResources := targetResourcesDef
  sessions := sessions
  deletion := deletion

theorem dagPolicy (occurrence : Occurrence σ) :
    FixedEpochPolicyCompatibility
      (sourcePackage occurrence)
      (DAG.package occurrence)
      (DAG.certificate occurrence)
      (dagResources occurrence) :=
  fixedPolicy occurrence
    (DAG.package occurrence)
    (DAG.certificate occurrence)
    (dagResources occurrence)
    rfl rfl (by intro state; rfl) (by intro state; rfl)

theorem petriPolicy (occurrence : Occurrence σ) :
    FixedEpochPolicyCompatibility
      (sourcePackage occurrence)
      (Petri.package occurrence)
      (Petri.certificate occurrence)
      (petriResources occurrence) :=
  fixedPolicy occurrence
    (Petri.package occurrence)
    (Petri.certificate occurrence)
    (petriResources occurrence)
    rfl rfl (by intro state; rfl) (by intro state; rfl)

theorem piPolicy (occurrence : Occurrence σ) :
    FixedEpochPolicyCompatibility
      (sourcePackage occurrence)
      (PiTarget.package occurrence)
      (PiTarget.certificate occurrence)
      (PiTarget.resources occurrence) :=
  fixedPolicy occurrence
    (PiTarget.package occurrence)
    (PiTarget.certificate occurrence)
    (PiTarget.resources occurrence)
    rfl rfl (by intro state; rfl) (by intro state; rfl)

theorem morphismPolicy (occurrence : Occurrence σ) :
    FixedEpochPolicyCompatibility
      (sourcePackage occurrence)
      (Morphism.package occurrence)
      (Morphism.certificate occurrence)
      (morphismResources occurrence) :=
  fixedPolicy occurrence
    (Morphism.package occurrence)
    (Morphism.certificate occurrence)
    (morphismResources occurrence)
    rfl rfl (by intro state; rfl) (by intro state; rfl)

/--
Every concrete admitted mismatch, reconnect, or quiescent-delete occurrence
inhabits the corrected four-view fixed-epoch product interface.
-/
def fixedOccurrence (occurrence : Occurrence σ) :
    FourFixedEpochOccurrence
      (sourcePackage occurrence)
      (DAG.package occurrence)
      (Petri.package occurrence)
      (PiTarget.package occurrence)
      (Morphism.package occurrence)
      (DAG.certificate occurrence)
      (Petri.certificate occurrence)
      (PiTarget.certificate occurrence)
      (Morphism.certificate occurrence)
      (dagResources occurrence)
      (petriResources occurrence)
      (PiTarget.resources occurrence)
      (morphismResources occurrence)
      (RuleQualified occurrence)
      (RuleAuthorized occurrence) where
  before := .ready (family occurrence)
  event := family occurrence
  after := .completed (family occurrence)
  sourceStep := source_observable occurrence (family occurrence)
  rank := rankEvidence occurrence
  dagPolicy := dagPolicy occurrence
  petriPolicy := petriPolicy occurrence
  piPolicy := piPolicy occurrence
  morphismPolicy := morphismPolicy occurrence
  sourceResourcesBefore :=
    resourcesClear_all occurrence (.ready (family occurrence))
  sourceResourcesAfter :=
    resourcesClear_all occurrence (.completed (family occurrence))
  sourceSessionsBefore :=
    sessionsQuiescent_all occurrence (.ready (family occurrence))
  sourceSessionsAfter :=
    sessionsQuiescent_all occurrence (.completed (family occurrence))
  qualified := ⟨rfl, rfl, rfl⟩
  authorized :=
    ⟨⟨rfl, rfl, rfl⟩,
      resourcesClear_all occurrence (.ready (family occurrence)),
      sessionsQuiescent_all occurrence (.ready (family occurrence))⟩

/-- The corrected fixed-epoch interface is inhabited for every admitted occurrence. -/
theorem fixedOccurrence_nonempty (occurrence : Occurrence σ) :
    Nonempty
      (FourFixedEpochOccurrence
        (sourcePackage occurrence)
        (DAG.package occurrence)
        (Petri.package occurrence)
        (PiTarget.package occurrence)
        (Morphism.package occurrence)
        (DAG.certificate occurrence)
        (Petri.certificate occurrence)
        (PiTarget.certificate occurrence)
        (Morphism.certificate occurrence)
        (dagResources occurrence)
        (petriResources occurrence)
        (PiTarget.resources occurrence)
        (morphismResources occurrence)
        (RuleQualified occurrence)
        (RuleAuthorized occurrence)) :=
  ⟨fixedOccurrence occurrence⟩

/-- The pi component of `fixedOccurrence` is the native late-pi derivation. -/
theorem fixedOccurrence_pi_native (occurrence : Occurrence σ) :
    Late.NativeStep
      (PiView.source occurrence.request)
      .tau
      (PiView.target occurrence.request) :=
  PiTarget.step_native (fixedOccurrence occurrence).mappedSteps.2.2.1.1

/--
All four mapped steps expose their independently defined native target
derivations, not merely the wrapper transition constructors.
-/
theorem fixedOccurrence_native_all (occurrence : Occurrence σ) :
    P1cAdmittedOperations.DAG.Step
        occurrence.source occurrence.request occurrence.target ∧
      P1cAdmittedOperations.Petri.Step
        occurrence.source occurrence.request occurrence.target ∧
      Late.NativeStep
        (PiView.source occurrence.request)
        .tau
        (PiView.target occurrence.request) ∧
      P1cAdmittedOperations.Morphism.Step
        occurrence.source occurrence.request occurrence.target := by
  have mapped := (fixedOccurrence occurrence).mappedSteps
  exact
    ⟨DAG.step_native mapped.1.1,
      Petri.step_native mapped.2.1.1,
      PiTarget.step_native mapped.2.2.1.1,
      Morphism.step_native mapped.2.2.2.1⟩

/-- The source package replays the occurrence's endpoint-free event record. -/
theorem fixedOccurrence_replays (occurrence : Occurrence σ) :
    ((sourcePackage occurrence).eventRecord (family occurrence)).Replays
      occurrence.source occurrence.target :=
  source_replay_exact occurrence (family occurrence)

/--
Each target package carries the same verified event record and independently
exposes its replay witness at the shared source/target configuration.
-/
theorem fixedOccurrence_target_records_replay
    (occurrence : Occurrence σ) :
    ((DAG.package occurrence).eventRecord (family occurrence)).Replays
        occurrence.source occurrence.target ∧
      ((Petri.package occurrence).eventRecord (family occurrence)).Replays
        occurrence.source occurrence.target ∧
      ((PiTarget.package occurrence).eventRecord (family occurrence)).Replays
        occurrence.source occurrence.target ∧
      ((Morphism.package occurrence).eventRecord (family occurrence)).Replays
        occurrence.source occurrence.target := by
  exact ⟨replay_exact occurrence, replay_exact occurrence,
    replay_exact occurrence, replay_exact occurrence⟩

end Cantilune.Pi.P1cAdmittedFourOccurrence
